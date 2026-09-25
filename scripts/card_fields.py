"""Field cleanup for card OCR text. No network and no OCR engine."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
WEBSITE_RE = re.compile(r"(?:https?://|www\.)[^\s,，;；]+", re.IGNORECASE)
PHONE_RE = re.compile(r"(?:\+?\d[\d\s().\-]{6,}\d)")
CJK_RE = re.compile(r"[\u4e00-\u9fff]")
TITLE_RE = re.compile(r"经理|总监|主管|主任|工程师|顾问|董事|销售|Manager|Director|Engineer|Sales", re.IGNORECASE)
COMPANY_ZH_RE = re.compile(r"公司|集团")
COMPANY_EN_RE = re.compile(r"\b(CO\.?,?\s*LTD\.?|LIMITED|HOLDINGS|INC\.?|CORP\.?|TECHNOLOGY)\b", re.IGNORECASE)


def compact(value: str) -> str:
    return re.sub(r"\s+", "", value).casefold()


def digits(value: str) -> str:
    return re.sub(r"\D", "", value)


def appears(value: str | None, text: str) -> bool:
    if not value:
        return False
    return compact(value) in compact(text)


def printed_email(email: str | None, text: str) -> str | None:
    if not email:
        return None
    hay = text.casefold()
    needle = email.casefold()
    start = 0
    while start <= len(hay):
        at = hay.find(needle, start)
        if at < 0:
            return None
        before = "" if at == 0 else hay[at - 1]
        if not re.match(r"[a-z0-9._%+\-]", before):
            return email
        start = at + 1
    return None


def printed_phone(phone: str | None, text: str) -> str | None:
    if not phone:
        return None
    found = digits(phone)
    if len(found) < 8 or found not in digits(text):
        return None
    return phone


def printed_website(website: str | None, text: str) -> str | None:
    if not website:
        return None
    host = re.sub(r"^https?://", "", website, flags=re.IGNORECASE)
    host = host.split("/")[0].split("?")[0]
    host = re.sub(r"^www\.", "", host, flags=re.IGNORECASE)
    if not host or host.casefold() not in text.casefold():
        return None
    return website


def normalize_website(raw: str) -> str | None:
    value = raw.strip().rstrip(".,;，；")
    if not value:
        return None
    if not re.match(r"https?://", value, flags=re.IGNORECASE):
        if not re.match(r"[\w.-]+\.[A-Za-z]{2,}([/:?#]|$)", value):
            return None
        value = f"https://{value}"
    return value


def website_tokens(text: str) -> list[str]:
    return [match.rstrip(".,;，；)") for match in WEBSITE_RE.findall(text)]


def websites_in(text: str) -> list[str]:
    found: list[str] = []
    for match in WEBSITE_RE.findall(text):
        cleaned = match.rstrip(".,;，；)")
        site = normalize_website(cleaned)
        if site and site not in found and printed_website(site, text):
            found.append(site)
    return found


def emails_in(text: str) -> list[str]:
    found: list[str] = []
    for match in EMAIL_RE.findall(text):
        if printed_email(match, text) and match not in found:
            found.append(match)
    return found


def phones_in(text: str) -> list[str]:
    found: list[str] = []
    for match in PHONE_RE.findall(text):
        token = match.strip()
        count = len(digits(token))
        if count < 8 or count > 15:
            continue
        if any(token in mail or digits(token) in digits(mail) for mail in emails_in(text)):
            continue
        if token not in found:
            found.append(token)
    found.sort(key=lambda item: (0 if re.fullmatch(r"1\d{10}", digits(item)) else 1, -len(digits(item))))
    return found


def lines_of(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def chinese_company(lines: list[str]) -> str | None:
    candidates = [line for line in lines if COMPANY_ZH_RE.search(line) and CJK_RE.search(line) and "@" not in line]
    if not candidates:
        return None
    holding = [line for line in candidates if "控股" in line]
    pool = holding or candidates
    return max(pool, key=len)


def english_company(lines: list[str]) -> str | None:
    candidates = [line for line in lines if COMPANY_EN_RE.search(line) and "@" not in line and not CJK_RE.search(line)]
    if not candidates:
        return None
    return max(candidates, key=len)


def contact_name(lines: list[str]) -> str | None:
    titles = [index for index, line in enumerate(lines) if TITLE_RE.search(line)]
    names = [
        index
        for index, line in enumerate(lines)
        if re.fullmatch(r"[\u4e00-\u9fff]{2,4}", line) and not TITLE_RE.search(line) and not COMPANY_ZH_RE.search(line)
    ]
    if not names:
        return None
    if not titles:
        return lines[names[0]]
    return lines[min(names, key=lambda index: min(abs(index - title) for title in titles))]


def contact_title(lines: list[str]) -> str | None:
    for line in lines:
        if TITLE_RE.search(line) and "@" not in line and not COMPANY_ZH_RE.search(line) and len(line) <= 12:
            return line
    return None


def address_lines(lines: list[str]) -> str | None:
    picked = [
        line
        for line in lines
        if re.search(r"路|街|号|园区|Road|Street|District", line, re.IGNORECASE)
        and "@" not in line
        and not WEBSITE_RE.search(line)
    ]
    if not picked:
        return None
    return "；".join(picked)


def city_in(text: str) -> str | None:
    match = re.search(r"([\u4e00-\u9fff]{2,8})市", text)
    if not match:
        return None
    return match.group(1)


def brand_in(lines: list[str], name_en: str | None) -> str | None:
    for line in lines:
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9&+\-]{1,20}", line):
            continue
        if name_en and compact(line) in compact(name_en) and len(line) > 12:
            continue
        return line
    return None


def company_type_in(text: str) -> str:
    factory = bool(re.search(r"工厂|制造|Factory", text, re.IGNORECASE))
    trading = bool(re.search(r"贸易|Trading", text, re.IGNORECASE))
    if factory and trading:
        return "mixed"
    if factory:
        return "factory"
    if trading:
        return "trading"
    return "unknown"


def blank(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text or re.fullmatch(r"(n/?a|none|null|unknown|-|—)", text, flags=re.IGNORECASE):
        return None
    return text


def classify_locally(text: str) -> dict[str, Any]:
    rows = lines_of(text)
    name_zh = chinese_company(rows)
    name_en = english_company(rows)
    sites = websites_in(text)
    mails = emails_in(text)
    numbers = phones_in(text)
    return {
        "name_zh": name_zh,
        "name_en": name_en,
        "brand": brand_in(rows, name_en),
        "company_type": company_type_in(text),
        "address": address_lines(rows),
        "city": city_in(text),
        "province": None,
        "country": "CN",
        "website": sites[0] if sites else None,
        "websites": sites,
        "wechat": None,
        "phone": numbers[0] if numbers else None,
        "email": mails[0] if mails else None,
        "export_markets": [],
        "contact_name": contact_name(rows),
        "contact_title": contact_title(rows),
    }


def keep_printed(fields: dict[str, Any], text: str) -> dict[str, Any]:
    kept = dict(fields)
    for key in ("name_zh", "name_en", "brand", "address", "city", "province", "contact_name", "contact_title", "wechat"):
        value = blank(kept.get(key))
        if key == "address":
            parts = [part.strip() for part in re.split(r"[；;\n]", value or "") if part.strip()]
            kept[key] = value if parts and all(appears(part, text) for part in parts) else None
            continue
        kept[key] = value if appears(value, text) else None
    kept["website"] = printed_website(normalize_website(blank(kept.get("website")) or "") if blank(kept.get("website")) else None, text)
    if kept["website"] is None:
        sites = websites_in(text)
        kept["website"] = sites[0] if sites else None
    kept["websites"] = websites_in(text)
    phone = printed_phone(blank(kept.get("phone")), text)
    kept["phone"] = phone or (phones_in(text)[0] if phones_in(text) else None)
    email = printed_email(blank(kept.get("email")), text)
    kept["email"] = email or (emails_in(text)[0] if emails_in(text) else None)
    company_type = blank(kept.get("company_type"))
    kept["company_type"] = company_type if company_type in {"factory", "trading", "mixed", "unknown"} else "unknown"
    if kept["company_type"] == "unknown":
        kept["company_type"] = company_type_in(text)
    markets = kept.get("export_markets")
    if not isinstance(markets, list):
        markets = []
    kept["export_markets"] = [item for item in (blank(entry) for entry in markets) if item and appears(item, text)]
    kept["country"] = blank(kept.get("country")) or "CN"
    if kept["country"] != "CN" and not appears(kept["country"], text):
        kept["country"] = "CN"
    return kept


def prefer_printed_company(local_value: str | None, model_value: str | None, text: str, pattern: re.Pattern[str]) -> str | None:
    model_text = blank(model_value)
    if not appears(model_text, text):
        return local_value
    if local_value and pattern.search(local_value) and not pattern.search(model_text or ""):
        return local_value
    return model_text


def apply_model_fields(local: dict[str, Any], model: dict[str, Any] | None, text: str) -> dict[str, Any]:
    fields = dict(local)
    if model:
        fields["name_zh"] = prefer_printed_company(blank(local.get("name_zh")), blank(model.get("name_zh")), text, COMPANY_ZH_RE)
        fields["name_en"] = prefer_printed_company(blank(local.get("name_en")), blank(model.get("name_en")), text, COMPANY_EN_RE)
        for key in ("brand", "city", "province", "contact_name", "contact_title", "wechat"):
            value = blank(model.get(key))
            if appears(value, text):
                fields[key] = value
        model_address = blank(model.get("address"))
        local_parts = [part.strip() for part in re.split(r"[；;\n]", blank(local.get("address")) or "") if part.strip()]
        if appears(model_address, text) and len(local_parts) <= 1:
            fields["address"] = model_address
        markets = model.get("export_markets")
        if isinstance(markets, list):
            fields["export_markets"] = markets
    numbers = phones_in(text)
    mails = emails_in(text)
    sites = websites_in(text)
    fields["phone"] = numbers[0] if numbers else None
    fields["email"] = mails[0] if mails else None
    fields["website"] = sites[0] if sites else None
    fields["websites"] = sites
    return keep_printed(fields, text)


def load_env_file(path: Any) -> None:
    file = Path(path) if not isinstance(path, Path) else path
    try:
        raw = file.read_text(encoding="utf-8")
    except OSError:
        return
    for line in raw.splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#") or "=" not in trimmed:
            continue
        key, value = trimmed.split("=", 1)
        key = key.strip()
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key) or key in os.environ:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        os.environ[key] = value


def company_record(fields: dict[str, Any]) -> dict[str, Any]:
    return {
        "name_zh": fields.get("name_zh"),
        "name_en": fields.get("name_en"),
        "brand": fields.get("brand"),
        "company_type": fields.get("company_type") or "unknown",
        "address": fields.get("address"),
        "city": fields.get("city"),
        "province": fields.get("province"),
        "country": fields.get("country") or "CN",
        "website": fields.get("website"),
        "wechat": fields.get("wechat"),
        "phone": fields.get("phone"),
        "email": fields.get("email"),
        "export_markets": fields.get("export_markets") or [],
        "contact_name": fields.get("contact_name"),
        "contact_title": fields.get("contact_title"),
    }
