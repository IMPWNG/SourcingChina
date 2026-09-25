import assert from "node:assert/strict";
import test from "node:test";
import { cardImageForOcr } from "./image";

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

test("a file that is not HEIC explains that conversion failed", async () => {
  await assert.rejects(
    () => cardImageForOcr(Buffer.from("not a heic photo"), ".heic"),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /Could not convert this HEIC photo to JPEG/);
      assert.equal(error.stack?.includes("pixReadStream") ?? false, false);
      return true;
    },
  );
});
