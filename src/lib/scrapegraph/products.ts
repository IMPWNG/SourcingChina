import { normalizeWebsite } from "@/lib/domain";

export const PRODUCT_PAGE_LIMIT = 8;
export const PRODUCT_DEPTH = 2;
export const PRODUCT_LINKS_PER_PAGE = 6;
export const PRODUCT_CRAWL_MS = 45_000;
export const PRODUCT_SAVE_LIMIT = 40;

export type CatalogReason = "no_key" | "no_website" | "failed" | "empty" | "saved";

export type ScrapedProduct = {
  name: string;
  description: string | null;
  image_url: string | null;
  source_url: string | null;
  category_id: string | null;
  details: Record<string, string>;
};

const NAV_NAME = /^(home|about|contact|products|product|news|menu|login|search|首页|关于|联系|产品)$/i;
const BLOCKED_DETAIL = /^(price|prices|sku|skus|stock|stocks|inventory|msrp|cost|costs)$/i;

export function planSiteCrawl(input: { hasKey: boolean; website: string | null }):
  | { action: "crawl"; website: string }
  | { action: "skip"; reason: "no_key" | "no_website" } {
  const website = input.website && !input.website.startsWith("fixture:") ? normalizeWebsite(input.website) : null;
  if (!website) return { action: "skip", reason: "no_website" };
  if (!input.hasKey) return { action: "skip", reason: "no_key" };
  return { action: "crawl", website };
}

export function catalogMessage(reason: CatalogReason, count = 0): string {
  if (reason === "no_key") return "Site crawl skipped because SGAI_API_KEY is not set. The card was still saved.";
  if (reason === "no_website") return "No website on the card, so the site was not crawled.";
  if (reason === "failed") return "The company site could not be crawled. Card fields were saved.";
  if (reason === "empty") return "The site was crawled and no individual products were found.";
  return `Saved ${count} product${count === 1 ? "" : "s"} from the company site.`;
}

function blank(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /^(n\/a|na|none|null|unknown|-|—)$/i.test(trimmed)) return null;
  return trimmed;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function absoluteHttp(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function categoryId(
  label: string | null,
  categories: { id: string; slug: string; name_en: string; name_zh: string | null }[],
): string | null {
  if (!label) return null;
  const hay = label.toLowerCase();
  const hit = categories.find((category) => {
    const slug = category.slug.replace(/-/g, " ");
    return (
      hay === category.slug ||
      hay.includes(slug) ||
      hay.includes(category.name_en.toLowerCase()) ||
      (category.name_zh ? hay.includes(category.name_zh) : false)
    );
  });
  return hit?.id ?? null;
}

function detailsOf(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const details: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (BLOCKED_DETAIL.test(key) || Object.keys(details).length >= 8) continue;
    const text = blank(typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : null);
    if (!text || /[$€¥]|价格|库存/.test(text)) continue;
    details[key.slice(0, 40)] = text.slice(0, 200);
  }
  return details;
}

function asProducts(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object" && Array.isArray((json as { products?: unknown }).products)) {
    return (json as { products: unknown[] }).products;
  }
  return [];
}

export function productsFromPage(input: {
  json: unknown;
  pageUrl: string;
  imageUrls: string[];
  siteHost: string;
  categories: { id: string; slug: string; name_en: string; name_zh: string | null }[];
}): ScrapedProduct[] {
  if (hostOf(input.pageUrl) !== input.siteHost) return [];
  const images = input.imageUrls.map((url) => absoluteHttp(url, input.pageUrl)).filter((url): url is string => Boolean(url));
  const products: ScrapedProduct[] = [];
  for (const item of asProducts(input.json)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = blank(row.name);
    if (!name || name.length < 2 || name.length > 120 || NAV_NAME.test(name) || /price|sku|\$|€|¥/i.test(name)) continue;
    const description = blank(row.description)?.slice(0, 600) ?? null;
    const image = absoluteHttp(blank(row.image_url) ?? blank(row.image), input.pageUrl) ?? (images.length === 1 ? images[0] : null);
    products.push({
      name,
      description,
      image_url: image,
      source_url: input.pageUrl,
      category_id: categoryId(blank(row.category), input.categories),
      details: detailsOf(row.details),
    });
  }
  return products;
}

export function uniqueProducts(products: ScrapedProduct[]): ScrapedProduct[] {
  const seen = new Set<string>();
  const unique: ScrapedProduct[] = [];
  for (const product of products) {
    const key = product.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(product);
    if (unique.length >= PRODUCT_SAVE_LIMIT) break;
  }
  return unique;
}
