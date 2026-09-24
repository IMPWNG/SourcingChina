import * as cheerio from "cheerio";
import type { CompanyType } from "@/lib/domain";
import { inferCompanyType, normalizeWebsite } from "@/lib/domain";

export type ExtractedPage = {
  phone: string | null;
  email: string | null;
  wechat: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  export_markets: string[];
  company_type: CompanyType;
  families: { name: string; description: string }[];
  certifications: string[];
  factories: { name: string; address: string | null; city: string | null }[];
  excerpt: string;
  links: { href: string; label: string }[];
};

const CERT_RE = /\b(CCC|CE|E-?mark|ISO\s?9001|ISO\/TS\s?16949|DOT|ECE)\b/gi;
const INTERESTING = /(about|contact|product|certif|证书|关于|联系|产品|资质)/i;

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function extractFromHtml(html: string, pageUrl: string): ExtractedPage {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const text = clean($("body").text() || $.root().text());
  const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  const phones = (text.match(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}/g) ?? []).filter(
    (item) => item.replace(/\D/g, "").length >= 8,
  );
  const wechat = text.match(/(?:wechat|weixin|微信)\s*[:：]?\s*([A-Za-z][A-Za-z0-9_-]{3,})/i)?.[1] ?? null;
  const address =
    text.match(/(?:address|地址)\s*[:：]\s*([^.]{8,160})/i)?.[1]?.trim() ?? null;
  const markets = (text.match(/\b(EU|US|USA|UK|ASEAN|AFRICA|ASIA)\b/gi) ?? []).map((item) =>
    item.toUpperCase() === "USA" ? "US" : item.toUpperCase(),
  );
  const certs = Array.from(new Set((text.match(CERT_RE) ?? []).map((item) => item.replace(/\s+/g, "").replace(/emark/i, "E-mark"))));

  const families: { name: string; description: string }[] = [];
  $("h2, h3").each((_, element) => {
    const name = clean($(element).text());
    if (name.length < 3 || name.length > 80) return;
    if (/price|sku|价格|货号|\$|€|¥|\bUSD\b/i.test(name)) return;
    if (/^(about|contact|home|products|certificates|证书|关于|联系)$/i.test(name)) return;
    const description = clean($(element).next("p").text()).slice(0, 280);
    if (families.some((family) => family.name.toLowerCase() === name.toLowerCase())) return;
    families.push({ name, description });
  });

  const links: { href: string; label: string }[] = [];
  $("a[href]").each((_, element) => {
    const label = clean($(element).text());
    const href = $(element).attr("href") ?? "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    if (!INTERESTING.test(label) && !INTERESTING.test(href)) return;
    try {
      const absolute = new URL(href, pageUrl).toString();
      links.push({ href: absolute, label });
    } catch {
      /* ignore bad hrefs */
    }
  });

  let city: string | null = null;
  let province: string | null = null;
  if (/chongqing|重庆/i.test(text)) {
    city = "Chongqing";
    province = "Chongqing";
  } else if (/wenzhou|温州|zhejiang|浙江/i.test(text)) {
    city = /wenzhou|温州/i.test(text) ? "Wenzhou" : null;
    province = "Zhejiang";
  }

  const factories: ExtractedPage["factories"] = [];
  const factoryName = text.match(/(?:factory|工厂)\s*[:：]\s*([^.]{3,80})/i)?.[1]?.trim();
  if (factoryName && address) {
    factories.push({ name: factoryName, address, city });
  }

  return {
    phone: phones[0]?.trim() ?? null,
    email: emails[0] ?? null,
    wechat,
    address,
    city,
    province,
    export_markets: Array.from(new Set(markets)),
    company_type: inferCompanyType(text),
    families,
    certifications: certs,
    factories,
    excerpt: text.slice(0, 2000),
    links,
  };
}

export function normalizeLink(href: string, base: string): string | null {
  try {
    const url = new URL(href, base);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function sameHost(a: string, b: string): boolean {
  try {
    return new URL(a).host === new URL(b).host;
  } catch {
    return false;
  }
}

export { normalizeWebsite };
