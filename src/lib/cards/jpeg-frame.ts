import jpeg from "jpeg-js";
import { MIN_CARD_SIDE, jpegSize, tinyPhotoMessage } from "@/lib/cards/image";

export type RgbaFrame = {
  data: Uint8Array;
  width: number;
  height: number;
};

/** Phone JPEGs often store a tiny preview beside the photo. Decode the primary frame. */
export function decodePrimaryJpeg(bytes: Buffer): RgbaFrame {
  let decoded: { width: number; height: number; data: Uint8Array | Buffer };
  try {
    decoded = jpeg.decode(bytes, {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: 60,
      tolerantDecoding: true,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "decode failed";
    throw new Error(`Could not decode this JPEG photo (${detail}).`);
  }
  const { width, height } = decoded;
  if (!width || !height || width < MIN_CARD_SIDE || height < MIN_CARD_SIDE) {
    throw new Error(tinyPhotoMessage("JPEG", width && height ? { width, height } : null));
  }
  const data = decoded.data instanceof Uint8Array ? decoded.data : new Uint8Array(decoded.data);
  if (data.length < width * height * 4) {
    throw new Error("Could not decode this JPEG photo (the pixel buffer is incomplete).");
  }
  return { data, width, height };
}

export function encodeJpeg(frame: RgbaFrame, quality = 82): Buffer {
  const encoded = jpeg.encode({ data: frame.data, width: frame.width, height: frame.height }, quality);
  const bytes = Buffer.from(encoded.data);
  const size = jpegSize(bytes);
  if (!size || size.width !== frame.width || size.height !== frame.height) {
    throw new Error("Could not decode this JPEG photo (the re-encoded image has no size).");
  }
  return bytes;
}

/** Quarter turns counter-clockwise. 1 makes a clockwise-sideways card horizontal. */
export function rotateQuarter(frame: RgbaFrame, turns: number): RgbaFrame {
  const t = ((turns % 4) + 4) % 4;
  if (t === 0) return frame;
  const { data, width, height } = frame;
  if (t === 2) {
    const out = new Uint8Array(data.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const si = (y * width + x) * 4;
        const di = ((height - 1 - y) * width + (width - 1 - x)) * 4;
        out[di] = data[si] ?? 0;
        out[di + 1] = data[si + 1] ?? 0;
        out[di + 2] = data[si + 2] ?? 0;
        out[di + 3] = data[si + 3] ?? 0;
      }
    }
    return { data: out, width, height };
  }
  const nw = height;
  const nh = width;
  const out = new Uint8Array(data.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const si = (y * width + x) * 4;
      const nx = t === 1 ? y : height - 1 - y;
      const ny = t === 1 ? width - 1 - x : x;
      const di = (ny * nw + nx) * 4;
      out[di] = data[si] ?? 0;
      out[di + 1] = data[si + 1] ?? 0;
      out[di + 2] = data[si + 2] ?? 0;
      out[di + 3] = data[si + 3] ?? 0;
    }
  }
  return { data: out, width: nw, height: nh };
}

export function downscaleMax(frame: RgbaFrame, maxEdge: number): RgbaFrame {
  const edge = Math.max(frame.width, frame.height);
  if (edge <= maxEdge) return frame;
  const scale = maxEdge / edge;
  const width = Math.max(1, Math.round(frame.width * scale));
  const height = Math.max(1, Math.round(frame.height * scale));
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(frame.height - 1, Math.floor((y * frame.height) / height));
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(frame.width - 1, Math.floor((x * frame.width) / width));
      const si = (sy * frame.width + sx) * 4;
      const di = (y * width + x) * 4;
      data[di] = frame.data[si] ?? 0;
      data[di + 1] = frame.data[si + 1] ?? 0;
      data[di + 2] = frame.data[si + 2] ?? 0;
      data[di + 3] = frame.data[si + 3] ?? 0;
    }
  }
  return { data, width, height };
}
