import assert from "node:assert/strict";
import test from "node:test";
import { decodePrimaryJpeg, downscaleMax, encodeJpeg, rotateQuarter, type RgbaFrame } from "./jpeg-frame";

function solid(width: number, height: number, rgba: [number, number, number, number]): RgbaFrame {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = rgba[0];
    data[i * 4 + 1] = rgba[1];
    data[i * 4 + 2] = rgba[2];
    data[i * 4 + 3] = rgba[3];
  }
  return { data, width, height };
}

test("a normal JPEG round-trips at its real size", () => {
  const encoded = encodeJpeg(solid(320, 240, [20, 40, 60, 255]), 80);
  const decoded = decodePrimaryJpeg(encoded);
  assert.equal(decoded.width, 320);
  assert.equal(decoded.height, 240);
  assert.equal(decoded.data.length, 320 * 240 * 4);
});

test("a few-pixel JPEG is rejected instead of being sent to OCR", () => {
  const strip = encodeJpeg(solid(2, 36, [0, 0, 0, 255]), 80);
  assert.throws(() => decodePrimaryJpeg(strip), /Could not decode this JPEG photo/);
  assert.throws(() => decodePrimaryJpeg(Buffer.from([0xff, 0xd8, 0xff, 0xd9])), /Could not decode this JPEG photo/);
});

test("a clockwise-sideways frame turns 90 degrees counter-clockwise", () => {
  const frame: RgbaFrame = {
    width: 2,
    height: 1,
    data: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]),
  };
  const turned = rotateQuarter(frame, 1);
  assert.deepEqual([turned.width, turned.height], [1, 2]);
  assert.equal(turned.data[2], 255);
  assert.equal(turned.data[4], 255);
  const back = rotateQuarter(turned, 3);
  assert.equal(back.width, 2);
  assert.equal(back.data[0], 255);
  assert.equal(back.data[6], 255);
});

test("downscale keeps the longer edge at the requested size", () => {
  const small = downscaleMax(solid(400, 200, [1, 2, 3, 255]), 100);
  assert.equal(Math.max(small.width, small.height), 100);
  assert.equal(small.data.length, small.width * small.height * 4);
});
