import assert from "node:assert/strict";
import test from "node:test";
import { readableCardText } from "./ocr-text";

test("blank and symbol-only OCR is not readable card text", () => {
  assert.equal(readableCardText(null), null);
  assert.equal(readableCardText("  \n"), null);
  assert.equal(readableCardText("... ---"), null);
});

test("Chinese and English card text is kept", () => {
  assert.equal(readableCardText(" 宁波头盔有限公司\nNingbo Helmet "), "宁波头盔有限公司\nNingbo Helmet");
});
