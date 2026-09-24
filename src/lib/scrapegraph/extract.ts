import "server-only";

import { ScrapeGraphAI } from "scrapegraph-js";
import type { CardExtraction } from "@/lib/domain";
import { logInfo } from "@/lib/log";
import { CARD_PROMPT, CARD_SCHEMA, cardFromScrapeGraph, scrapeGraphApiKey } from "@/lib/scrapegraph/fields";

const MAX_IMAGE_BYTES = 4_000_000;

export type ScrapeGraphCardResult = {
  attempted: boolean;
  extraction: CardExtraction | null;
  rawText: string | null;
  error: string | null;
};

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "request_failed";
  return message.replace(/sgai[_-]?[a-z0-9_-]{8,}/gi, "[redacted]").slice(0, 180);
}

function imageHtml(bytes: Buffer, mime: string): string {
  return `<!doctype html><html><body><img alt="business card" src="data:${mime};base64,${bytes.toString("base64")}" /></body></html>`;
}

export async function extractCardWithScrapeGraph(input: {
  text: string | null;
  image: { bytes: Buffer; mime: string } | null;
}): Promise<ScrapeGraphCardResult> {
  const apiKey = scrapeGraphApiKey();
  if (!apiKey) return { attempted: false, extraction: null, rawText: null, error: null };

  const text = input.text?.trim() ?? "";
  let markdown: string | undefined;
  let html: string | undefined;
  if (text) {
    markdown = text;
  } else if (input.image) {
    if (input.image.bytes.length > MAX_IMAGE_BYTES) {
      return { attempted: true, extraction: null, rawText: null, error: "image_too_large" };
    }
    html = imageHtml(input.image.bytes, input.image.mime || "image/jpeg");
  } else {
    return { attempted: false, extraction: null, rawText: null, error: null };
  }

  try {
    const sgai = ScrapeGraphAI({ apiKey });
    const res = await sgai.extract({
      prompt: CARD_PROMPT,
      schema: CARD_SCHEMA,
      ...(markdown ? { markdown } : { html }),
    });
    if (res.status !== "success" || !res.data?.json) {
      logInfo("scrapegraph_card_failed", { error: (res.error ?? "empty").slice(0, 180) });
      return { attempted: true, extraction: null, rawText: text || res.data?.raw || null, error: res.error ?? "empty" };
    }
    const extraction = cardFromScrapeGraph(res.data.json);
    const rawText = res.data.raw || text || JSON.stringify(res.data.json);
    if (!extraction) return { attempted: true, extraction: null, rawText, error: "empty_fields" };
    return { attempted: true, extraction, rawText, error: null };
  } catch (error) {
    const message = safeError(error);
    logInfo("scrapegraph_card_failed", { error: message });
    return { attempted: true, extraction: null, rawText: text || null, error: "request_failed" };
  }
}
