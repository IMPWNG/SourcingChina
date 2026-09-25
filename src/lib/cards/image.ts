import convert from "heic-convert";

const PASS_THROUGH: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function isHeicExtension(ext: string): boolean {
  const lower = ext.toLowerCase();
  return lower === ".heic" || lower === ".heif";
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
  try {
    const jpeg = await convert({
      buffer: new Uint8Array(bytes),
      format: "JPEG",
      quality: 0.92,
    });
    const converted = Buffer.from(jpeg);
    if (converted.length < 3 || converted[0] !== 0xff || converted[1] !== 0xd8) {
      throw new Error("the converter did not return a JPEG");
    }
    return { bytes: converted, mime: "image/jpeg" };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "conversion failed";
    throw new Error(`Could not convert this ${label} photo to JPEG (${detail}).`);
  }
}
