import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { keepPrintedContacts, parseCardArgs, type CardCompanyRecord, type CardRecord } from "@/lib/cards/batch";
import { cardImageForOcr } from "@/lib/cards/image";
import type { CardExtraction } from "@/lib/domain";
import { extractCard } from "@/lib/domain";
import { recognizeImage, shutdownOcr } from "@/lib/ocr";
import { scrapeSiteProducts } from "@/lib/scrapegraph/catalog";
import { extractCardWithScrapeGraph } from "@/lib/scrapegraph/extract";
import { mammouthConfig } from "@/lib/mammouth/client";
import { CATEGORIES } from "@/lib/seed";
import type { CatalogReason } from "@/lib/scrapegraph/products";
import { loadEnvLocal } from "./load-env";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);
/** A full card photo, including the Chinese model load, can outlast the short server limit. */
const CARD_OCR_MS = 180_000;

function companyFrom(extraction: CardExtraction): CardCompanyRecord {
  return {
    name_zh: extraction.name_zh,
    name_en: extraction.name_en,
    brand: extraction.brand,
    company_type: extraction.company_type,
    address: extraction.address,
    city: extraction.city,
    province: extraction.province,
    country: extraction.country || "CN",
    website: extraction.website,
    wechat: extraction.wechat,
    phone: extraction.phone,
    email: extraction.email,
    export_markets: extraction.export_markets,
  };
}

async function imagePaths(input: string): Promise<string[]> {
  const info = await stat(input);
  if (info.isDirectory()) {
    const names = await readdir(input);
    return names
      .filter((name) => IMAGE_EXT.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => path.join(input, name));
  }
  if (!IMAGE_EXT.has(path.extname(input).toLowerCase())) {
    throw new Error(`${input} is not a jpg, png, webp, or heic photo.`);
  }
  return [input];
}

function unreadCard(file: string, ocrError: string): CardRecord {
  return {
    source: file,
    ocr_text: null,
    ocr_error: ocrError,
    mammouth_error: null,
    company: companyFrom(extractCard("")),
    products: [],
    catalog: "no_website",
  };
}

async function readCard(file: string): Promise<CardRecord> {
  const ext = path.extname(file).toLowerCase();
  const original = await readFile(file);
  let prepared: { bytes: Buffer; mime: string };
  try {
    prepared = await cardImageForOcr(original, ext);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not convert this photo.";
    console.error(`${file}: ${message}`);
    return unreadCard(file, message);
  }
  const ocr = await recognizeImage(prepared.bytes, prepared.mime, CARD_OCR_MS);
  const ocrError =
    ocr.provider === "tesseract_error"
      ? "The photo could not be read."
      : ocr.text
        ? null
        : "This photo had no readable text.";
  let extraction = extractCard(ocr.text ?? "");
  let mammouthError: string | null = null;
  if (ocr.text) {
    const structured = await extractCardWithScrapeGraph({ text: ocr.text, image: null });
    if (structured.extraction) extraction = structured.extraction;
    else if (structured.attempted) mammouthError = structured.error;
  }
  const company = keepPrintedContacts(companyFrom(extraction), ocr.text);
  let catalog: CatalogReason = company.website ? "failed" : "no_website";
  let products: CardRecord["products"] = [];
  if (company.website) {
    const categories = CATEGORIES.map((item) => ({ id: item.id, slug: item.slug, name_en: item.name_en, name_zh: item.name_zh }));
    const slugById = new Map<string, string>(categories.map((item) => [item.id, item.slug]));
    const crawl = await scrapeSiteProducts(company.website, categories);
    catalog = crawl.reason;
    products = crawl.products.map((item) => ({
      name: item.name,
      description: item.description,
      image_url: item.image_url,
      source_url: item.source_url,
      category: item.category_id ? slugById.get(item.category_id) ?? null : null,
      details: item.details,
    }));
  }
  return {
    source: file,
    ocr_text: ocr.text,
    ocr_error: ocrError,
    mammouth_error: mammouthError,
    company,
    products,
    catalog,
  };
}

async function main(): Promise<void> {
  loadEnvLocal();
  const parsed = parseCardArgs(process.argv.slice(2));
  if ("error" in parsed) {
    console.error(parsed.error);
    console.error("Usage: npm run cards -- <folder-or-photos...> --out cards.json");
    process.exit(1);
  }
  const files: string[] = [];
  for (const input of parsed.paths) files.push(...(await imagePaths(input)));
  if (!files.length) {
    console.error("No card photos found. Use jpg, png, webp, or heic.");
    process.exit(1);
  }
  if (!mammouthConfig()) {
    console.error("MAMMOUTH_API_KEY is not set. Cards will keep the OCR text and sites will not be crawled.");
  }
  const cards: CardRecord[] = [];
  try {
    for (const file of files) {
      console.error(`Reading ${file}`);
      try {
        cards.push(await readCard(file));
      } catch (error) {
        const message = error instanceof Error ? error.message : "The photo could not be read.";
        console.error(`${file}: ${message}`);
        cards.push(unreadCard(file, message));
      }
    }
    const batch = { generated_at: new Date().toISOString(), cards };
    await writeFile(parsed.out, `${JSON.stringify(batch, null, 2)}\n`);
    console.log(`Wrote ${cards.length} card${cards.length === 1 ? "" : "s"} to ${parsed.out}`);
  } finally {
    await shutdownOcr();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The command failed.");
  process.exit(1);
});
