#!/usr/bin/env python3
"""Read business-card photos with PaddleOCR, then classify the text.

PaddleOCR (Chinese + English) is the engine when it imports. On macOS, if
Paddle is not installed, the same command uses Vision through ocrmac or pyobjc.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import request as urlrequest

warnings.filterwarnings("ignore", message="No ccache found")

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.card_fields import (  # noqa: E402
    apply_model_fields,
    classify_locally,
    company_record,
    load_env_file,
    website_tokens,
)

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
MIN_SIDE = 200
ORIENT_EDGE = 1200
MAMMOUTH_URL = "https://api.mammouth.ai/v1/chat/completions"
SYSTEM = (
    "You extract business-card fields. Reply with one JSON object only, using the keys "
    "name_zh, name_en, brand, company_type, address, city, province, country, website, wechat, "
    "phone, email, export_markets, contact_name, contact_title, contact_phone, and contact_email. "
    "Use empty strings when a field is not printed. Do not invent a website, phone, email, or WeChat. "
    "Keep the Chinese company name and the English company name separate from the person's name and job title."
)


def parse_args(argv: list[str]) -> tuple[list[str], str]:
    paths: list[str] = []
    out = "cards.json"
    index = 0
    while index < len(argv):
        arg = argv[index]
        if arg == "--out":
            if index + 1 >= len(argv) or argv[index + 1].startswith("--"):
                raise SystemExit("Pass a file after --out.")
            out = argv[index + 1]
            index += 2
            continue
        if arg.startswith("--out="):
            value = arg[len("--out=") :]
            if not value:
                raise SystemExit("Pass a file after --out.")
            out = value
            index += 1
            continue
        if arg.startswith("-"):
            raise SystemExit(f"Unknown option {arg}.")
        paths.append(arg)
        index += 1
    if not paths:
        raise SystemExit("Pass a folder or one or more card photos.")
    return paths, out


def image_paths(inputs: list[str]) -> list[str]:
    files: list[str] = []
    for item in inputs:
        path = Path(item)
        if path.is_dir():
            names = sorted(entry.name for entry in path.iterdir() if entry.suffix.lower() in IMAGE_EXT)
            files.extend(str(path / name) for name in names)
            continue
        if path.suffix.lower() not in IMAGE_EXT:
            raise SystemExit(f"{item} is not a jpg, png, webp, or heic photo.")
        files.append(item)
    return files


def open_photo(path: str):
    from PIL import Image

    ext = Path(path).suffix.lower()
    source = path
    temporary: str | None = None
    if ext in {".heic", ".heif"}:
        if not shutil_which("sips"):
            raise RuntimeError("Could not decode this HEIC photo. On macOS, install the photo tools or convert it with sips.")
        handle = tempfile.NamedTemporaryFile(prefix="card-", suffix=".jpg", delete=False)
        temporary = handle.name
        handle.close()
        subprocess.run(["sips", "-s", "format", "jpeg", path, "--out", temporary], check=True, capture_output=True)
        source = temporary
    try:
        image = Image.open(source)
        image.seek(0)
        image = image.convert("RGB")
    finally:
        if temporary:
            Path(temporary).unlink(missing_ok=True)
    if min(image.size) < MIN_SIDE:
        raise RuntimeError(
            f"Could not decode this photo. The image is {image.width}×{image.height}, which is too small to be the card."
        )
    return image


def shutil_which(name: str) -> str | None:
    from shutil import which

    return which(name)


def downscale(image, edge: int):
    from PIL import Image

    width, height = image.size
    longest = max(width, height)
    if longest <= edge:
        return image
    scale = edge / longest
    return image.resize((max(1, int(width * scale)), max(1, int(height * scale))), Image.Resampling.LANCZOS)


class CardReader:
    def __init__(self) -> None:
        self.name = ""
        self._paddle = None

    def load(self) -> None:
        try:
            from paddleocr import PaddleOCR

            self._paddle = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False)
            self.name = "paddleocr"
            return
        except Exception as error:
            paddle_error = error
        if self._vision_ready():
            return
        message = (
            "PaddleOCR is not installed, and macOS Vision is not available.\n"
            "From the repository root:\n"
            "  python3 -m venv .venv\n"
            "  source .venv/bin/activate\n"
            "  pip install -r requirements-cards.txt\n"
            "On a Mac, if that install fails:\n"
            "  pip install ocrmac\n"
            f"({paddle_error})"
        )
        raise SystemExit(message)

    def _vision_ready(self) -> bool:
        try:
            import ocrmac  # noqa: F401

            self.name = "ocrmac"
            return True
        except Exception:
            pass
        try:
            import Vision  # noqa: F401
            import Quartz  # noqa: F401

            self.name = "pyobjc"
            return True
        except Exception:
            return False

    def read(self, image) -> tuple[float, str]:
        if self.name == "paddleocr":
            import numpy as np

            result = self._paddle.ocr(np.array(image), cls=True)
            return score_paddle(result)
        text = vision_text(image, self.name)
        return float(len(text)), text


def score_paddle(result: Any) -> tuple[float, str]:
    lines = result[0] if result else None
    if not lines:
        return 0.0, ""
    ordered: list[tuple[float, float, str]] = []
    chars = 0
    confidence = 0.0
    wide = 0
    for box, rec in lines:
        text = str(rec[0] or "").strip()
        if not text:
            continue
        score = float(rec[1] or 0)
        xs = [point[0] for point in box]
        ys = [point[1] for point in box]
        width = max(xs) - min(xs)
        height = max(ys) - min(ys)
        ordered.append((sum(ys) / 4, sum(xs) / 4, text))
        chars += len(text)
        confidence += score
        if width >= height:
            wide += 1
    ordered.sort()
    return chars + wide * 5 + confidence, "\n".join(item[2] for item in ordered)


def vision_text(image, engine: str) -> str:
    from PIL import Image

    handle = tempfile.NamedTemporaryFile(prefix="card-ocr-", suffix=".jpg", delete=False)
    path = handle.name
    handle.close()
    try:
        image.save(path, format="JPEG", quality=90)
        if engine == "ocrmac":
            from ocrmac import ocrmac

            rows = ocrmac.OCR(path, language_preference=["zh-Hans", "en-US"]).recognize()
            return "\n".join(str(item[0]).strip() for item in rows if item and str(item[0]).strip())
        return pyobjc_text(path)
    finally:
        Path(path).unlink(missing_ok=True)


def pyobjc_text(path: str) -> str:
    import Vision
    from Foundation import NSURL

    url = NSURL.fileURLWithPath_(path)
    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLanguages_(["zh-Hans", "en-US"])
    request.setUsesLanguageCorrection_(True)
    handler = Vision.VNImageRequestHandler.alloc().initWithURL_options_(url, None)
    ok, error = handler.performRequests_error_([request], None)
    if not ok:
        raise RuntimeError(f"Could not read this photo ({error}).")
    lines: list[str] = []
    for observation in request.results() or []:
        candidates = observation.topCandidates_(1)
        if candidates:
            text = str(candidates[0].string()).strip()
            if text:
                lines.append(text)
    return "\n".join(lines)


def horizontal_text(reader: CardReader, image) -> tuple[str, int, int, int]:
    preview = downscale(image, ORIENT_EDGE)
    best_score = -1.0
    best_angle = 0
    for angle in (0, 90, 180, 270):
        turned = preview.rotate(angle, expand=True)
        score, _text = reader.read(turned)
        if score > best_score:
            best_score = score
            best_angle = angle
    final = image.rotate(best_angle, expand=True)
    _score, text = reader.read(final)
    return text, image.width, image.height, best_angle


def mammouth_fields(text: str) -> tuple[dict[str, Any] | None, str | None]:
    key = os.environ.get("MAMMOUTH_API_KEY", "").strip()
    if not key or re.search(r"your-|placeholder", key, flags=re.IGNORECASE):
        return None, None
    model = os.environ.get("MAMMOUTH_MODEL", "").strip() or "gpt-4.1-nano"
    payload = {
        "model": model,
        "temperature": 0,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Card text:\n{text}"},
        ],
    }
    body = json.dumps(payload).encode("utf-8")
    req = urlrequest.Request(
        MAMMOUTH_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "User-Agent": "sourcing-china/0.1",
        },
        method="POST",
    )
    try:
        with urlrequest.urlopen(req, timeout=25) as response:
            raw = response.read().decode("utf-8", errors="replace")
    except Exception as error:
        status = getattr(error, "code", None)
        reason = f"http_{status}" if status else "request_failed"
        return None, f"The card text could not be classified ({reason})."
    try:
        content = json.loads(raw)["choices"][0]["message"]["content"]
        start = content.find("{")
        end = content.rfind("}")
        if start < 0 or end < start:
            return None, "The card text could not be classified."
        parsed = json.loads(content[start : end + 1])
    except Exception:
        return None, "The card text could not be classified."
    if not isinstance(parsed, dict):
        return None, "The card text could not be classified."
    return parsed, None


def unread(path: str, message: str) -> dict[str, Any]:
    fields = company_record(classify_locally(""))
    return {
        "source": path,
        "ocr_text": None,
        "ocr_error": message,
        "mammouth_error": None,
        "company": fields,
        "products": [],
        "catalog": "no_website",
    }


def read_one(reader: CardReader, path: str) -> dict[str, Any]:
    image = open_photo(path)
    text, width, height, angle = horizontal_text(reader, image)
    turned = f", rotated {angle}° so the text is horizontal" if angle else ""
    print(f"Decoded {path} at {width}×{height}{turned}", file=sys.stderr)
    if not text.strip():
        card = unread(path, "This photo had no readable text.")
        card["ocr_error"] = "This photo had no readable text."
        return card
    local = classify_locally(text)
    model, error = mammouth_fields(text)
    fields = apply_model_fields(local, model, text)
    website = fields.get("website")
    return {
        "source": path,
        "ocr_text": text,
        "ocr_error": None,
        "mammouth_error": error,
        "company": company_record(fields),
        "products": [],
        "catalog": "failed" if website else "no_website",
    }


def print_found(card: dict[str, Any], engine: str) -> None:
    text = card.get("ocr_text") or ""
    company = card["company"]
    print(f"ocr_engine: {engine}", file=sys.stderr)
    for label in ("name_zh", "name_en", "contact_name", "contact_title", "phone", "email", "address"):
        value = company.get(label)
        if value:
            print(f"{label}: {value}", file=sys.stderr)
    for token in website_tokens(text):
        print(f"website: {token}", file=sys.stderr)


def main() -> None:
    try:
        inputs, out = parse_args(sys.argv[1:])
        files = image_paths(inputs)
    except SystemExit as error:
        print(error, file=sys.stderr)
        print("Usage: npm run cards -- <folder-or-photos...> --out cards.json", file=sys.stderr)
        raise
    if not files:
        print("No card photos found. Use jpg, png, webp, or heic.", file=sys.stderr)
        raise SystemExit(1)
    load_env_file(ROOT / ".env.local")
    if not os.environ.get("MAMMOUTH_API_KEY", "").strip():
        print("MAMMOUTH_API_KEY is not set. Cards will keep the OCR text and sites will not be crawled.", file=sys.stderr)
    reader = CardReader()
    reader.load()
    print(f"Using {reader.name} for Chinese and English card text.", file=sys.stderr)
    cards = []
    for path in files:
        print(f"Reading {path}", file=sys.stderr)
        try:
            card = read_one(reader, path)
        except Exception as error:
            message = str(error) or "The photo could not be read."
            print(f"{path}: {message}", file=sys.stderr)
            card = unread(path, message)
        print_found(card, reader.name)
        cards.append(card)
    batch = {"generated_at": datetime.now(timezone.utc).isoformat(), "cards": cards}
    Path(out).write_text(json.dumps(batch, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as error:
        print(str(error) or "The command failed.", file=sys.stderr)
        raise SystemExit(1)
