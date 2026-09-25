import assert from "node:assert/strict";
import test from "node:test";
import { assertFullPhoto, cardImageForOcr, jpegSize, sipsArgs } from "./image";

function jpegOf(width: number, height: number): Buffer {
  const sof = Buffer.alloc(11);
  sof[0] = 0xff;
  sof[1] = 0xc0;
  sof.writeUInt16BE(9, 2);
  sof[4] = 8;
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  sof[9] = 1;
  sof[10] = 0;
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, Buffer.from([0xff, 0xd9])]);
}

test("jpeg, png, and webp go to OCR unchanged", async () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const jpegOut = await cardImageForOcr(jpeg, ".jpg");
  assert.equal(jpegOut.mime, "image/jpeg");
  assert.equal(jpegOut.bytes.equals(jpeg), true);

  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const pngOut = await cardImageForOcr(png, ".PNG");
  assert.equal(pngOut.mime, "image/png");
  assert.equal(pngOut.bytes.equals(png), true);

  const webp = Buffer.from("RIFF");
  const webpOut = await cardImageForOcr(webp, ".webp");
  assert.equal(webpOut.mime, "image/webp");
});

test("sips is asked for a jpeg and a 2px strip is rejected", () => {
  assert.deepEqual(sipsArgs("/tmp/card.heic", "/tmp/card.jpg"), ["-s", "format", "jpeg", "/tmp/card.heic", "--out", "/tmp/card.jpg"]);
  const strip = jpegOf(2, 36);
  assert.deepEqual(jpegSize(strip), { width: 2, height: 36 });
  assert.throws(() => assertFullPhoto(strip, "HEIC"), /Could not decode this HEIC photo/);
  assert.equal(assertFullPhoto(jpegOf(1200, 800), "HEIC").length > 0, true);
});

test("a file that is not HEIC explains that conversion failed", async () => {
  await assert.rejects(
    () => cardImageForOcr(Buffer.from("not a heic photo"), ".heic"),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /Could not decode this HEIC photo/);
      assert.equal(error.stack?.includes("pixReadStream") ?? false, false);
      return true;
    },
  );
});
