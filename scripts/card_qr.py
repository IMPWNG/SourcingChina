"""Decode QR payloads on a business-card photo. No network."""

from __future__ import annotations

import re
import tempfile
from pathlib import Path
from typing import Any

from scripts.card_fields import blank, digits, normalize_website

ROOT = Path(__file__).resolve().parents[1]
WECHAT_HOST_RE = re.compile(
    r"(?:^|://)(?:u\.wechat\.com|weixin\.qq\.com|work\.weixin\.qq\.com)(?:/|$)",
    re.IGNORECASE,
)
WA_PHONE_RE = re.compile(
    r"(?:wa\.me/|(?:api\.)?whatsapp\.com/send\?(?:[^#]*[?&])?phone=|whatsapp://send\?phone=)(\+?\d[\d\s\-]+)",
    re.IGNORECASE,
)
WECHAT_ID_RE = re.compile(r"(?:wxid_)?[A-Za-z][A-Za-z0-9_-]{5,19}$")
WEIXIN_PROFILE_RE = re.compile(r"weixin://(?:contacts/profile/)([A-Za-z0-9_\-]+)", re.IGNORECASE)


def classify_qr_payload(payload: str) -> dict[str, Any]:
    text = payload.strip()
    if not text:
        return {}
    upper = text.upper()
    if upper.startswith("BEGIN:VCARD"):
        return _vcard_fields(text)
    if upper.startswith("MECARD:"):
        return _mecard_fields(text)
    if re.match(r"wxp://", text, flags=re.IGNORECASE):
        return {}
    profile = WEIXIN_PROFILE_RE.search(text)
    if profile:
        return {"wechat": profile.group(1)}
    if WECHAT_HOST_RE.search(text) or text.lower().startswith("weixin://"):
        return {"wechat_qr": True}
    phone = _whatsapp_phone(text)
    if phone:
        return {"phone": phone}
    site = normalize_website(text) if re.match(r"https?://|www\.", text, flags=re.IGNORECASE) else None
    if site and not WECHAT_HOST_RE.search(site) and "whatsapp" not in site.lower():
        return {"website": site}
    if WECHAT_ID_RE.fullmatch(text):
        return {"wechat": text}
    return {}


def apply_qr_fields(fields: dict[str, Any], hits: list[dict[str, Any]]) -> dict[str, Any]:
    for item in hits:
        phone = blank(item.get("phone"))
        if phone:
            fields["phone"] = _merge_phone(blank(fields.get("phone")), phone)
        email = blank(item.get("email"))
        if email and not blank(fields.get("email")):
            fields["email"] = email
        wechat = blank(item.get("wechat"))
        if wechat and not blank(fields.get("wechat")):
            fields["wechat"] = wechat
        name = blank(item.get("contact_name"))
        if name and not blank(fields.get("contact_name")):
            fields["contact_name"] = name
        site = blank(item.get("website"))
        if site:
            if not blank(fields.get("website")):
                fields["website"] = site
            sites = [entry for entry in (fields.get("websites") or []) if blank(entry)]
            if site not in sites:
                sites.append(site)
            fields["websites"] = sites
        if item.get("wechat_qr") and not blank(fields.get("wechat_qr_path")):
            fields["wechat_qr_path"] = blank(item.get("crop_path"))
    return fields


def read_barcodes(image: Any, source: str) -> tuple[list[dict[str, Any]], list[str]]:
    detections = _vision_qrs(image)
    hits: list[dict[str, Any]] = []
    payloads: list[str] = []
    index = 0
    for payload, box in detections:
        payloads.append(payload)
        item = classify_qr_payload(payload)
        if not item:
            continue
        if item.get("wechat_qr"):
            crop = _save_crop(image, box, source, index)
            if crop:
                item["crop_path"] = str(crop)
                index += 1
        hits.append(item)
    return hits, payloads


def _whatsapp_phone(payload: str) -> str | None:
    match = WA_PHONE_RE.search(payload)
    if not match:
        return None
    found = digits(match.group(1))
    if len(found) < 8 or len(found) > 15:
        return None
    return f"+{found}"


def _merge_phone(existing: str | None, extra: str) -> str:
    if not existing:
        return extra
    if digits(extra) in digits(existing):
        return existing
    return f"{existing}; {extra}"


def _vcard_fields(text: str) -> dict[str, Any]:
    fields: dict[str, Any] = {}
    for raw in text.replace("\r\n", "\n").splitlines():
        line = raw.strip()
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        kind = key.split(";")[0].upper()
        value = value.strip()
        if not value:
            continue
        if kind in {"FN", "N"} and "contact_name" not in fields:
            fields["contact_name"] = re.sub(r"\s+", " ", value.replace(";", " ")).strip()
        elif kind == "TEL" and "phone" not in fields:
            fields["phone"] = value if digits(value) else None
        elif kind == "EMAIL" and "email" not in fields:
            fields["email"] = value
        elif kind == "URL":
            nested = classify_qr_payload(value)
            for key_name in ("website", "wechat", "phone"):
                if nested.get(key_name) and key_name not in fields:
                    fields[key_name] = nested[key_name]
            if nested.get("wechat_qr"):
                fields["wechat_qr"] = True
        elif "WECHAT" in raw.upper() and "wechat" not in fields:
            fields["wechat"] = value
    return {key: item for key, item in fields.items() if item}


def _mecard_fields(text: str) -> dict[str, Any]:
    body = text.split(":", 1)[-1]
    parts = dict(item.split(":", 1) for item in body.strip().rstrip(";").split(";") if ":" in item)
    mapped = {
        "N": "contact_name",
        "TEL": "phone",
        "EMAIL": "email",
        "URL": "website",
    }
    fields: dict[str, Any] = {}
    for key, dest in mapped.items():
        value = blank(parts.get(key))
        if not value:
            continue
        if dest == "website":
            nested = classify_qr_payload(value)
            fields.update(nested or ({"website": normalize_website(value)} if normalize_website(value) else {}))
            continue
        fields[dest] = value.replace(",", " ").strip() if dest == "contact_name" else value
    return {key: item for key, item in fields.items() if item}


def _vision_qrs(image: Any) -> list[tuple[str, tuple[float, float, float, float]]]:
    try:
        import Vision
        from Foundation import NSURL
    except Exception:
        return []
    handle = tempfile.NamedTemporaryFile(prefix="card-qr-", suffix=".jpg", delete=False)
    path = handle.name
    handle.close()
    try:
        image.save(path, format="JPEG", quality=92)
        url = NSURL.fileURLWithPath_(path)
        request = Vision.VNDetectBarcodesRequest.alloc().init()
        request.setSymbologies_([Vision.VNBarcodeSymbologyQR])
        handler = Vision.VNImageRequestHandler.alloc().initWithURL_options_(url, None)
        ok, _error = handler.performRequests_error_([request], None)
        if not ok:
            return []
        rows: list[tuple[str, tuple[float, float, float, float]]] = []
        for observation in request.results() or []:
            payload = str(observation.payloadStringValue() or "").strip()
            if not payload:
                continue
            box = observation.boundingBox()
            rows.append((payload, (float(box.origin.x), float(box.origin.y), float(box.size.width), float(box.size.height))))
        return rows
    except Exception:
        return []
    finally:
        Path(path).unlink(missing_ok=True)


def _save_crop(image: Any, box: tuple[float, float, float, float], source: str, index: int) -> Path | None:
    width, height = image.size
    x, y, box_w, box_h = box
    left = x * width
    top = (1 - y - box_h) * height
    right = (x + box_w) * width
    bottom = (1 - y) * height
    pad_x = max(8.0, (right - left) * 0.25)
    pad_y = max(8.0, (bottom - top) * 0.25)
    crop = image.crop(
        (
            max(0, int(left - pad_x)),
            max(0, int(top - pad_y)),
            min(width, int(right + pad_x)),
            min(height, int(bottom + pad_y)),
        )
    )
    if min(crop.size) < 40:
        return None
    folder = ROOT / "data" / "card-qr"
    folder.mkdir(parents=True, exist_ok=True)
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", Path(source).stem)[:80] or "card"
    path = folder / f"{stem}-{index}.jpg"
    crop.save(path, format="JPEG", quality=92)
    return path
