import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import convert from "heic-convert";

const execFileAsync = promisify(execFile);

const PASS_THROUGH: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** A business card photo is never a few pixels tall. Smaller output is a failed decode. */
export const MIN_CARD_SIDE = 200;

let sipsAvailable: Promise<boolean> | null = null;

export function isHeicExtension(ext: string): boolean {
  const lower = ext.toLowerCase();
  return lower === ".heic" || lower === ".heif";
}

export function sipsArgs(input: string, output: string): string[] {
  return ["-s", "format", "jpeg", input, "--out", output];
}

/** Read the size from a JPEG SOF marker. */
export function jpegSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xd8) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if (sof.has(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

export function tinyPhotoMessage(label: string, size: { width: number; height: number } | null): string {
  const dims = size ? `${size.width}×${size.height}` : "an unreadable size";
  return `Could not decode this ${label} photo. The image is ${dims}, which is too small to be the card.`;
}

export function assertFullPhoto(jpeg: Buffer, label: string): Buffer {
  const size = jpegSize(jpeg);
  if (!size || size.width < MIN_CARD_SIDE || size.height < MIN_CARD_SIDE) {
    throw new Error(tinyPhotoMessage(label, size));
  }
  return jpeg;
}

function hasSips(): Promise<boolean> {
  sipsAvailable ??= new Promise((resolve) => {
    execFile("sips", ["-h"], { timeout: 3000 }, (error) => {
      resolve(!error || (error as NodeJS.ErrnoException).code !== "ENOENT");
    });
  });
  return sipsAvailable;
}

async function convertWithSips(bytes: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "card-heic-"));
  const input = path.join(dir, "card.heic");
  const output = path.join(dir, "card.jpg");
  try {
    await writeFile(input, bytes);
    await execFileAsync("sips", sipsArgs(input, output), { timeout: 60_000 });
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Pick the largest frame. The first frame in an iPhone HEIC is sometimes a tiny auxiliary image. */
async function convertWithDecoder(bytes: Buffer): Promise<Buffer> {
  const frames = await convert.all({
    buffer: new Uint8Array(bytes),
    format: "JPEG",
    quality: 0.92,
  });
  let best: Buffer | null = null;
  let bestArea = -1;
  for (const frame of frames) {
    const jpeg = Buffer.from(await frame.convert());
    const size = jpegSize(jpeg);
    const area = size ? size.width * size.height : 0;
    if (area > bestArea) {
      best = jpeg;
      bestArea = area;
    }
  }
  if (!best || best.length < 3 || best[0] !== 0xff || best[1] !== 0xd8) {
    throw new Error("the decoder did not return a JPEG");
  }
  return best;
}

async function heicToJpeg(bytes: Buffer, label: string): Promise<Buffer> {
  if (await hasSips()) {
    try {
      const jpeg = await convertWithSips(bytes);
      if (jpeg.length >= 3 && jpeg[0] === 0xff && jpeg[1] === 0xd8) {
        const size = jpegSize(jpeg);
        if (size && size.width >= MIN_CARD_SIDE && size.height >= MIN_CARD_SIDE) return jpeg;
      }
    } catch {
      // sips could not read this file. The decoder below is the other attempt.
    }
  }
  try {
    return assertFullPhoto(await convertWithDecoder(bytes), label);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Could not decode")) throw error;
    const detail = error instanceof Error ? error.message : "conversion failed";
    throw new Error(`Could not decode this ${label} photo (${detail}).`);
  }
}

/** Tesseract cannot read HEIC. JPEG, PNG, and WebP are returned unchanged. */
export async function cardImageForOcr(bytes: Buffer, ext: string): Promise<{ bytes: Buffer; mime: string }> {
  const lower = ext.toLowerCase();
  const mime = PASS_THROUGH[lower];
  if (mime) return { bytes, mime };
  if (!isHeicExtension(lower)) {
    throw new Error(`Unsupported photo type ${ext || "(none)"}. Use jpg, png, webp, or heic.`);
  }
  const label = lower === ".heif" ? "HEIF" : "HEIC";
  const jpeg = await heicToJpeg(bytes, label);
  return { bytes: jpeg, mime: "image/jpeg" };
}
