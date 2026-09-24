import "server-only";

import { ScrapeGraphAI } from "scrapegraph-js";
import { logInfo } from "@/lib/log";
import { scrapeGraphApiKey } from "@/lib/scrapegraph/fields";
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

const PRODUCT_PROMPT =
  "Extract the individual products shown on this page. For each product return its name, a description of what it is, an image URL printed on the page, and the product category. Do not invent products, images, or descriptions that are not on the page. Do not include prices, SKUs, or stock. Skip navigation, contact, and about-us text.";

const PRODUCT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          image_url: { type: "string" },
          category: { type: "string" },
          details: { type: "object", additionalProperties: { type: "string" } },
        },
      },
    },
  },
};

type CrawlPage = {
  url?: string;
  scrape?: {
    results?: {
      json?: { data?: unknown };
      images?: { data?: string[] };
    };
  };
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scrapeSiteProducts(
  website: string | null,
  categories: { id: string; slug: string; name_en: string; name_zh: string | null }[],
): Promise<ProductCrawlResult> {
  const plan = planSiteCrawl({ hasKey: Boolean(scrapeGraphApiKey()), website });
  if (plan.action === "skip") return { reason: plan.reason, products: [] };

  const apiKey = scrapeGraphApiKey();
  if (!apiKey) return { reason: "no_key", products: [] };
  const siteHost = new URL(plan.website).host;
  const started = Date.now();

  try {
    const sgai = ScrapeGraphAI({ apiKey });
    const start = await sgai.crawl.start({
      url: plan.website,
      formats: [
        { type: "json", prompt: PRODUCT_PROMPT, schema: PRODUCT_SCHEMA },
        { type: "images" },
      ],
      maxPages: PRODUCT_PAGE_LIMIT,
      maxDepth: PRODUCT_DEPTH,
      maxLinksPerPage: PRODUCT_LINKS_PER_PAGE,
      allowExternal: false,
    });
    if (start.status !== "success" || !start.data?.id) {
      logInfo("product_crawl_failed", { error: (start.error ?? "start_failed").slice(0, 180) });
      return { reason: "failed", products: [] };
    }
    let status = start.data.status;
    while ((status === "running" || status === "paused") && Date.now() - started < PRODUCT_CRAWL_MS) {
      await sleep(2000);
      const current = await sgai.crawl.get(start.data.id);
      if (current.status !== "success" || !current.data) break;
      status = current.data.status;
    }
    if (status === "running" || status === "paused") {
      await sgai.crawl.stop(start.data.id);
    }
    const pages = await sgai.crawl.pages(start.data.id, { limit: PRODUCT_PAGE_LIMIT });
    if (pages.status !== "success") return { reason: "failed", products: [] };
    const rows = ((pages.data?.data ?? []) as CrawlPage[]).flatMap((page) =>
      productsFromPage({
        json: page.scrape?.results?.json?.data,
        pageUrl: page.url ?? plan.website,
        imageUrls: page.scrape?.results?.images?.data ?? [],
        siteHost,
        categories,
      }),
    );
    const products = uniqueProducts(rows);
    return { reason: products.length ? "saved" : "empty", products };
  } catch (error) {
    const message = error instanceof Error ? error.message : "request_failed";
    logInfo("product_crawl_failed", { error: message.replace(/sgai[_-]?[a-z0-9_-]{8,}/gi, "[redacted]").slice(0, 180) });
    return { reason: "failed", products: [] };
  }
}
