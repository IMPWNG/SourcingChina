import "server-only";

import type { CardExtraction } from "@/lib/domain";
import { logInfo } from "@/lib/log";
import { mammouthConfig, mammouthJson, type MammouthContent } from "@/lib/mammouth/client";
import { CARD_PROMPT, cardFromScrapeGraph } from "@/lib/scrapegraph/fields";

const MAX_IMAGE_BYTES = 4_000_000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type ScrapeGraphCardResult = {
  attempted: boolean;
  extraction: CardExtraction | null;
  rawText: string | null;
  error: string | null;
};

const SYSTEM =
  "You extract business-card fields. Reply with one JSON object only, using the keys name_zh, name_en, brand, company_type, address, city, province, country, website, wechat, phone, email, export_markets, contact_name, contact_title, contact_phone, and contact_email. Use empty strings when a field is not printed. Do not invent a website, phone, email, or WeChat.";

function cardUser(text: string, image: { bytes: Buffer; mime: string } | null): MammouthContent {
  const instruction = text ? `${CARD_PROMPT}\n\nCard text:\n${text}` : `${CARD_PROMPT}\nRead the business card in the image.`;
  if (!image) return instruction;
  return [
    { type: "text", text: instruction },
    { type: "image_url", image_url: { url: `data:${image.mime};base64,${image.bytes.toString("base64")}` } },
  ];
}

export async function extractCardWithScrapeGraph(input: {
  text: string | null;
  image: { bytes: Buffer; mime: string } | null;
}): Promise<ScrapeGraphCardResult> {
  if (!mammouthConfig()) return { attempted: false, extraction: null, rawText: null, error: null };

  const text = input.text?.trim() ?? "";
  const image =
    input.image && input.image.bytes.length <= MAX_IMAGE_BYTES && IMAGE_TYPES.has(input.image.mime) ? input.image : null;
  if (!text && !image) return { attempted: false, extraction: null, rawText: null, error: null };

  let result = await mammouthJson({ system: SYSTEM, user: cardUser(text, image) });
  if (!result.ok && text && image) {
    result = await mammouthJson({ system: SYSTEM, user: cardUser(text, null) });
  }
  if (!result.ok) {
    logInfo("mammouth_card_failed", { error: result.error });
    return { attempted: true, extraction: null, rawText: text || null, error: result.error };
  }
  const extraction = cardFromScrapeGraph(result.json);
  if (!extraction) return { attempted: true, extraction: null, rawText: result.raw, error: "empty_fields" };
  return { attempted: true, extraction, rawText: result.raw || text, error: null };
}
