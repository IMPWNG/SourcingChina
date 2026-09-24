import "server-only";

import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import { SCRAPER_UA } from "@/lib/enrichment/crawl";
import { sameHost } from "@/lib/enrichment/extract";
import { logInfo } from "@/lib/log";
import { mammouthConfig, mammouthJson } from "@/lib/mammouth/client";
import {
  PRODUCT_CRAWL_MS,
  PRODUCT_DEPTH,
  PRODUCT_LINKS_PER_PAGE,
  PRODUCT_PAGE_LIMIT,
  planSiteCrawl,
  productsFromPage,
  uniqueProducts,
  type CatalogReason,
  type ScrapedProduct,
} from "@/lib/scrapegraph/products";

export type ProductCrawlResult = {
  reason: CatalogReason;
  products: ScrapedProduct[];
};

const PRODUCT_SYSTEM =
  "You extract motorcycle products from supplier website pages. Reply with one JSON object only: {\"products\":[{\"name\":\"\",\"description\":\"\",\"image_url\":\"\",\"category\":\"\",\"source_url\":\"\",\"details\":{}}]}. Use only names, descriptions, categories, and image URLs that appear in the supplied pages. source_url must be the page URL. Leave image_url empty when no product image is listed. Do not invent products, prices, SKUs, or stock. Skip navigation, contact, and about-us text.";

type SitePage = { url: string; text: string; images: string[] };

async function allowed(url: string): Promise<boolean> {
  const robotsUrl = new URL("/robots.txt", url).toString();
  try {
    const response = await fetch(robotsUrl, {
      headers: { "User-Agent": SCRAPER_UA },
      signal: AbortSignal.timeout(4000),
      redirect: "follow",
    });
    if (response.status === 404) return true;
    if (!response.ok) return false;
    const robots = robotsParser(robotsUrl, await response.text());
    return robots.isAllowed(url, SCRAPER_UA) !== false;
  } catch {
    return false;
  }
}

async function collectPages(start: string, deadline: number): Promise<SitePage[]> {
  if (!(await allowed(start))) return [];
  const origin = new URL(start).host;
  const queue: { url: string; depth: number }[] = [{ url: start, depth: 0 }];
  const seen = new Set<string>();
  const pages: SitePage[] = [];
  while (queue.length && pages.length < PRODUCT_PAGE_LIMIT && Date.now() < deadline) {
    const next = queue.shift();
    if (!next || seen.has(next.url)) continue;
    seen.add(next.url);
    let response: Response;
    try {
      response = await fetch(next.url, {
        headers: { "User-Agent": SCRAPER_UA, Accept: "text/html" },
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
      });
    } catch {
      continue;
    }
    const finalUrl = response.url || next.url;
    if (!response.ok || !sameHost(finalUrl, start)) continue;
    const html = (await response.text()).slice(0, 500_000);
    const $ = cheerio.load(html);
    $("script,style,noscript").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 6000);
    const images = $("img")
      .map((_, el) => $(el).attr("src") ?? "")
      .get()
      .filter(Boolean)
      .slice(0, 12);
    pages.push({ url: finalUrl, text, images });
    if (next.depth >= PRODUCT_DEPTH) continue;
    const links = $("a[href]")
      .map((_, el) => $(el).attr("href") ?? "")
      .get()
      .slice(0, PRODUCT_LINKS_PER_PAGE);
    for (const href of links) {
      try {
        const url = new URL(href, next.url);
        if (url.host !== origin || !/^https?:$/.test(url.protocol)) continue;
        url.hash = "";
        queue.push({ url: url.toString(), depth: next.depth + 1 });
      } catch {
        continue;
      }
    }
  }
  return pages;
}

export async function scrapeSiteProducts(
  website: string | null,
  categories: { id: string; slug: string; name_en: string; name_zh: string | null }[],
): Promise<ProductCrawlResult> {
  const plan = planSiteCrawl({ hasKey: Boolean(mammouthConfig()), website });
  if (plan.action === "skip") return { reason: plan.reason, products: [] };
  const siteHost = new URL(plan.website).host;
  const deadline = Date.now() + PRODUCT_CRAWL_MS;

  try {
    const pages = await collectPages(plan.website, deadline);
    if (!pages.length) return { reason: "failed", products: [] };
    const packed = pages
      .map((page) => `URL: ${page.url}\nTEXT: ${page.text}\nIMAGES:\n${page.images.join("\n")}`)
      .join("\n\n")
      .slice(0, 24_000);
    const result = await mammouthJson({
      system: PRODUCT_SYSTEM,
      user: packed,
      timeoutMs: Math.max(5_000, deadline - Date.now()),
    });
    if (!result.ok) {
      logInfo("product_crawl_failed", { error: result.error });
      return { reason: "failed", products: [] };
    }
    const record = result.json && typeof result.json === "object" ? (result.json as { products?: unknown[] }) : {};
    const items = Array.isArray(record.products) ? record.products : [];
    const byPage = new Map<string, unknown[]>();
    for (const item of items) {
      const source =
        item && typeof item === "object" && "source_url" in item && typeof item.source_url === "string" && item.source_url
          ? item.source_url
          : plan.website;
      const list = byPage.get(source) ?? [];
      list.push(item);
      byPage.set(source, list);
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
    const products: ScrapedProduct[] = uniqueProducts(rows);
    return { reason: products.length ? "saved" : "empty", products };
  } catch (error) {
    const message = error instanceof Error ? error.message : "request_failed";
    logInfo("product_crawl_failed", { error: message.slice(0, 180) });
    return { reason: "failed", products: [] };
  }
}
