#!/usr/bin/env python3
"""Assert QR payload mapping. No Vision, no photos."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.card_qr import apply_qr_fields, classify_qr_payload

assert classify_qr_payload("https://wa.me/8613800002210") == {"phone": "+8613800002210"}
assert classify_qr_payload("https://api.whatsapp.com/send?phone=8613900000000") == {"phone": "+8613900000000"}
assert classify_qr_payload("https://u.wechat.com/EFlQ-ofS_zoSL1Xhm5-RcwI?s=2") == {"wechat_qr": True}
assert classify_qr_payload("http://weixin.qq.com/r/LxCFnYfEhtr5rcP_90U9") == {"wechat_qr": True}
assert classify_qr_payload("wxp://f2f0abc") == {}
assert classify_qr_payload("ApexRideHelmets") == {"wechat": "ApexRideHelmets"}
assert classify_qr_payload("https://apexride.example/products") == {"website": "https://apexride.example/products"}
assert classify_qr_payload("weixin://contacts/profile/wxid_abc12") == {"wechat": "wxid_abc12"}

vcard = classify_qr_payload(
    "BEGIN:VCARD\nFN:Li Wei\nTEL:+86 13800002210\nEMAIL:sales@apexride.example\nEND:VCARD"
)
assert vcard["contact_name"] == "Li Wei"
assert vcard["phone"] == "+86 13800002210"
assert vcard["email"] == "sales@apexride.example"

fields = {
    "wechat": "PrintedId",
    "phone": "+86 13800002210",
    "website": None,
    "websites": [],
}
apply_qr_fields(
    fields,
    [
        {"wechat": "QrId"},
        {"phone": "+8613800002210"},
        {"phone": "+8613999999999"},
        {"wechat_qr": True, "crop_path": "data/card-qr/front-0.jpg"},
        {"website": "https://factory.example"},
    ],
)
assert fields["wechat"] == "PrintedId"
assert fields["phone"] == "+86 13800002210; +8613999999999"
assert fields["website"] == "https://factory.example"
assert fields["wechat_qr_path"] == "data/card-qr/front-0.jpg"
print("card_qr ok")
