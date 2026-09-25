import "server-only";

import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import { SCRAPER_UA } from "@/lib/enrichment/crawl";
import { logInfo } from "@/lib/log";
import { mammouthConfig, mammouthJson } from "@/lib/mammouth/client";
import { scraplingCrawl } from "@/lib/scrapling/crawl";
import {
  PRODUCT_CRAWL_MS,
  PRODUCT_DEPTH,
  PRODUCT_PAGE_LIMIT,
  planSiteCrawl,
  productDescription,
  productsFromPage,
  productsListedOnPage,
  uniqueProducts,
  type CatalogReason,
  type ScrapedProduct,
} from "@/lib/scrapegraph/products";

export type ProductCrawlResult = {
  reason: CatalogReason;
  products: ScrapedProduct[];
};

const PRODUCT_SYSTEM =
  "You extract products a supplier lists on the provided pages (parts, chargers, BMS, controllers, and other catalog items). Reply with one JSON object only: {\"products\":[{\"name\":\"\",\"description\":\"\",\"image_url\":\"\",\"category\":\"\",\"source_url\":\"\",\"details\":{}}]}. Use only names, descriptions, categories, and image URLs that appear in the supplied pages. source_url must be the page URL. Copy image_url from that page's IMAGES list when a product photo is listed. Do not invent products, prices, SKUs, or stock. Skip navigation, contact, and about-us text.";

type SitePage = { url: string; text: string; images: string[] };

function bareHost(value: string): string {
  try {
    return new URL(value).host.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function fetchCandidates(url: string): string[] {
  const parsed = new URL(url);
  const hosts = parsed.host.toLowerCase().startsWith("www.")
    ? [parsed.host, parsed.host.replace(/^www\./i, "")]
    : [parsed.host, `www.${parsed.host}`];
  const protocols = parsed.protocol === "http:" ? ["http:", "https:"] : ["https:", "http:"];
  const urls: string[] = [];
  for (const host of hosts) {
    for (const protocol of protocols) {
      const next = new URL(parsed.toString());
      next.protocol = protocol;
      next.host = host;
      if (!urls.includes(next.toString())) urls.push(next.toString());
    }
  }
  return urls;
}

async function fetchDocument(url: string, timeoutMs: number): Promise<Response> {
  let last: Response | null = null;
  let lastError: unknown = null;
  for (const candidate of fetchCandidates(url)) {
    try {
      const response = await readPage(candidate, timeoutMs);
      if (response.ok || response.status === 404) return response;
      last = response;
    } catch (error) {
      lastError = error;
    }
  }
  if (last) return last;
  throw lastError instanceof Error ? lastError : new Error("request_failed");
}

/** Some supplier sites answer with a script that sets jsKey, then reload. */
async function readPage(url: string, timeoutMs: number, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (compatible; SourcingChina/1.0)",
    Accept: "text/html,text/plain",
  };
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
  if (!response.ok) return response;
  const html = await response.text();
  const key = html.match(/document\.cookie="(jsKey=[^;"]+)/);
  if (key && !cookie) return readPage(url, timeoutMs, key[1]);
  return new Response(html, { status: response.status, headers: response.headers });
}

async function allowed(url: string): Promise<boolean> {
  const robotsUrl = new URL("/robots.txt", url).toString();
  try {
    const response = await fetchDocument(robotsUrl, 4000);
    if (response.status === 404) return true;
    if (!response.ok) return false;
    const robots = robotsParser(response.url || robotsUrl, await response.text());
    return fetchCandidates(url).every((candidate) => robots.isAllowed(candidate, SCRAPER_UA) !== false);
  } catch {
    return true;
  }
}

async function collectPages(start: string, deadline: number): Promise<SitePage[]> {
  if (!(await allowed(start))) return [];
  const origin = bareHost(start);
  const fetched = await scraplingCrawl({
    start,
    maxPages: PRODUCT_PAGE_LIMIT,
    maxDepth: PRODUCT_DEPTH,
    timeoutSec: 8,
    budgetMs: Math.max(1000, deadline - Date.now()),
  });
  const pages: SitePage[] = [];
  for (const page of fetched) {
    if (bareHost(page.url) !== origin) continue;
    const html = page.html.slice(0, 500_000);
    const $ = cheerio.load(html);
    const images = new Set<string>();
    $("img").each((_, el) => {
      for (const attr of ["src", "data-src", "data-original"]) {
        const value = $(el).attr(attr);
        if (value) images.add(value);
      }
    });
    $("[style]").each((_, el) => {
      const style = $(el).attr("style") ?? "";
      for (const match of style.matchAll(/url\((['"]?)(.*?)\1\)/g)) {
        if (match[2]) images.add(match[2]);
      }
    });
    $("script,style,noscript").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 20_000);
    if (text.length >= 40) pages.push({ url: page.url, text, images: [...images].slice(0, 24) });
  }
  return pages;
}

export async function scrapeSiteProducts(
  website: string | null,
  categories: { id: string; slug: string; name_en: string; name_zh: string | null }[],
  options?: { budgetMs?: number },
): Promise<ProductCrawlResult> {
  const plan = planSiteCrawl({ hasKey: Boolean(mammouthConfig()), website });
  if (plan.action === "skip") return { reason: plan.reason, products: [] };
  const siteHost = new URL(plan.website).host;
  const deadline = Date.now() + (options?.budgetMs ?? PRODUCT_CRAWL_MS);

  try {
    const pages = await collectPages(plan.website, deadline);
    if (!pages.length) return { reason: "failed", products: [] };
    const listed = uniqueProducts(
      pages.flatMap((page) =>
        productsListedOnPage({
          text: page.text,
          imageUrls: page.images,
          pageUrl: page.url,
          siteHost,
          categories,
        }),
      ),
    );
    const packed = pages
      .map((page) => `URL: ${page.url}\nTEXT: ${page.text}\nIMAGES:\n${page.images.join("\n")}`)
      .join("\n\n")
      .slice(0, 24_000);
    const remaining = deadline - Date.now();
    if (remaining < 1_500) {
      logInfo("product_crawl_failed", { error: "budget" });
      return { reason: listed.length ? "saved" : "failed", products: listed };
    }
    const result = await mammouthJson({
      system: PRODUCT_SYSTEM,
      user: packed,
      timeoutMs: remaining,
    });
    if (!result.ok) {
      logInfo("product_crawl_failed", { error: result.error });
      return { reason: listed.length ? "saved" : "failed", products: listed };
    }
    const record = result.json && typeof result.json === "object" ? (result.json as { products?: unknown[] }) : {};
    const items = Array.isArray(record.products) ? record.products : [];
    const byPage = new Map<string, unknown[]>();
    for (const item of items) {
      const source =
        item && typeof item === "object" && "source_url" in item && typeof item.source_url === "string" && item.source_url
          ? item.source_url
          : pages[0]?.url ?? plan.website;
      const page = pages.find((entry) => entry.url === source) ?? pages.find((entry) => bareHost(entry.url) === bareHost(source));
      const key = page?.url ?? source;
      const list = byPage.get(key) ?? [];
      list.push(item);
      byPage.set(key, list);
    }
    const images = new Map(pages.map((page) => [page.url, page.images]));
    const rows = [...byPage.entries()].flatMap(([pageUrl, products]) =>
      productsFromPage({
        json: { products },
        pageUrl,
        imageUrls: images.get(pageUrl) ?? [],
        siteHost,
        categories,
      }),
    );
    const listedByName = new Map(listed.map((product) => [product.name, product]));
    const grounded = rows.flatMap((product) => {
      const page = pages.find((entry) => entry.url === product.source_url);
      if (!page || !page.text.includes(product.name)) return [];
      const verbatim = product.description && page.text.includes(product.description) ? productDescription(product.description) : null;
      const fallback = listedByName.get(product.name);
      return [{ ...product, description: verbatim ?? fallback?.description ?? null }];
    });
    const products: ScrapedProduct[] = uniqueProducts([...listed, ...grounded]);
    return { reason: products.length ? "saved" : "empty", products };
  } catch (error) {
    const message = error instanceof Error ? error.message : "request_failed";
    logInfo("product_crawl_failed", { error: message.slice(0, 180) });
    return { reason: "failed", products: [] };
  }
}
