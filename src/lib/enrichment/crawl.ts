import robotsParser from "robots-parser";
import { SAMPLE_SUPPLIER_HTML } from "@/lib/enrichment/fixture";
import { extractFromHtml, sameHost, type ExtractedPage } from "@/lib/enrichment/extract";

export const SCRAPER_UA = "SourcingChinaBot/0.1 (+https://sourcingchina.example/bot; directory enrichment)";
const MAX_PAGES = 10;
const MAX_BYTES = 1_000_000;

export type CrawlResult = {
  status: "succeeded" | "failed" | "skipped";
  error: string | null;
  pages: { url: string; extracted: ExtractedPage }[];
};

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

function merged(pages: CrawlResult["pages"]) {
  const first = pages[0]?.extracted;
  const families = pages.flatMap((page) => page.extracted.families);
  const uniqueFamilies = families.filter(
    (family, index) => families.findIndex((item) => item.name.toLowerCase() === family.name.toLowerCase()) === index,
  );
  const certs = Array.from(new Set(pages.flatMap((page) => page.extracted.certifications)));
  return {
    phone: pages.map((page) => page.extracted.phone).find(Boolean) ?? null,
    email: pages.map((page) => page.extracted.email).find(Boolean) ?? null,
    wechat: pages.map((page) => page.extracted.wechat).find(Boolean) ?? null,
    address: pages.map((page) => page.extracted.address).find(Boolean) ?? null,
    city: pages.map((page) => page.extracted.city).find(Boolean) ?? null,
    province: pages.map((page) => page.extracted.province).find(Boolean) ?? null,
    export_markets: Array.from(new Set(pages.flatMap((page) => page.extracted.export_markets))),
    company_type: first?.company_type ?? "unknown",
    families: uniqueFamilies,
    certifications: certs,
    factories: pages.flatMap((page) => page.extracted.factories),
    contacts: pages.flatMap((page) => page.extracted.contacts).filter(
      (contact, index, all) => all.findIndex((item) => item.phone === contact.phone && item.email === contact.email) === index,
    ),
    excerpt: pages.map((page) => page.extracted.excerpt).join("\n").slice(0, 4000),
  };
}

async function allowed(url: string, fetchImpl: FetchLike): Promise<boolean> {
  const robotsUrl = new URL("/robots.txt", url).toString();
  try {
    const response = await fetchImpl(robotsUrl, {
      headers: { "User-Agent": SCRAPER_UA },
      signal: AbortSignal.timeout(4000),
      redirect: "follow",
    });
    if (response.status === 404) return true;
    if (!response.ok) return false;
    const body = await response.text();
    const robots = robotsParser(robotsUrl, body);
    return robots.isAllowed(url, SCRAPER_UA) !== false;
  } catch {
    return false;
  }
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return (await response.text()).slice(0, MAX_BYTES);
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const step = await reader.read();
    if (step.done) break;
    total += step.value.byteLength;
    chunks.push(step.value);
  }
  reader.cancel().catch(() => undefined);
  return new TextDecoder().decode(Buffer.concat(chunks)).slice(0, MAX_BYTES);
}

export async function crawlWebsite(website: string, fetchImpl: FetchLike = fetch): Promise<CrawlResult & { patch: ReturnType<typeof merged> | null }> {
  if (website === "fixture://sample-supplier") {
    const extracted = extractFromHtml(SAMPLE_SUPPLIER_HTML, "https://fixture.local/sample-supplier");
    const pages = [{ url: website, extracted }];
    return { status: "succeeded", error: null, pages, patch: merged(pages) };
  }

  let start: URL;
  try {
    start = new URL(website);
  } catch {
    return { status: "failed", error: "invalid_url", pages: [], patch: null };
  }
  if (!["http:", "https:"].includes(start.protocol)) {
    return { status: "skipped", error: "unsupported_protocol", pages: [], patch: null };
  }

  if (!(await allowed(start.toString(), fetchImpl))) {
    return { status: "skipped", error: "robots", pages: [], patch: null };
  }

  const queue = [start.toString()];
  const seen = new Set<string>();
  const pages: CrawlResult["pages"] = [];

  while (queue.length && pages.length < MAX_PAGES) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    if (!(await allowed(url, fetchImpl))) continue;
    try {
      const response = await fetchImpl(url, {
        headers: { "User-Agent": SCRAPER_UA, Accept: "text/html" },
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
      });
      const type = response.headers.get("content-type") ?? "";
      if (!response.ok || !type.includes("html")) continue;
      let html = await readLimited(response);
      const gate = html.match(/document\.cookie="(jsKey=[^;"]+)/);
      if (gate) {
        const opened = await fetchImpl(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SourcingChina/1.0)", Accept: "text/html", Cookie: gate[1] },
          signal: AbortSignal.timeout(8000),
          redirect: "follow",
        });
        if (opened.ok) html = await readLimited(opened);
      }
      if (!html.trim() || html.includes('document.cookie="jsKey=')) continue;
      const extracted = extractFromHtml(html, url);
      pages.push({ url, extracted });
      for (const link of extracted.links) {
        if (sameHost(link.href, start.toString()) && !seen.has(link.href) && queue.length + pages.length < MAX_PAGES) {
          queue.push(link.href);
        }
      }
      if (queue.length) await new Promise((resolve) => setTimeout(resolve, 400));
    } catch {
      if (!pages.length && url === start.toString()) {
        return { status: "failed", error: "fetch_failed", pages: [], patch: null };
      }
    }
  }

  if (!pages.length) return { status: "failed", error: "no_html", pages: [], patch: null };
  return { status: "succeeded", error: null, pages, patch: merged(pages) };
}
