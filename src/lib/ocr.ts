import "server-only";

import { logInfo } from "@/lib/log";

export async function recognizeImage(bytes: Buffer, mime: string): Promise<{ text: string | null; provider: string }> {
  const key = process.env.GOOGLE_VISION_API_KEY?.trim();
  if (!key || /your-|placeholder/i.test(key)) return { text: null, provider: "none" };
  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: bytes.toString("base64") },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        },
      ],
    }),
  });
  if (!response.ok) {
    logInfo("ocr_failed", { status: response.status, mime });
    return { text: null, provider: "google_vision_error" };
  }
  const json = (await response.json()) as {
    responses?: { fullTextAnnotation?: { text?: string } }[];
  };
  const text = json.responses?.[0]?.fullTextAnnotation?.text?.trim() || null;
  return { text, provider: "google_vision" };
}
