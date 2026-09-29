import { normalizeWebsite } from "@/lib/domain";

export const PRODUCT_PAGE_LIMIT = 8;
export const PRODUCT_DEPTH = 2;
export const PRODUCT_LINKS_PER_PAGE = 6;
export const PRODUCT_CRAWL_MS = 45_000;
/** Upload returns the draft first. The site crawl on that request stays inside this bound. */
export const UPLOAD_PRODUCT_CRAWL_MS = 8_000;
export const PRODUCT_SAVE_LIMIT = 80;

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
const MODEL_CODE = /^[A-Z]{2,4}-\d{2,5}[A-Z]{0,2}$/i;
const SKIP_MODEL = /^(ISO|CCC|DOT|ECE|GB|CE|IEC|UN|EN|DIN|ASTM)-/i;

export function planSiteCrawl(input: { hasKey: boolean; website: string | null }):
  | { action: "crawl"; website: string }
  | { action: "skip"; reason: "no_key" | "no_website" } {
  const website = input.website && !input.website.startsWith("fixture:") ? normalizeWebsite(input.website) : null;
  if (!website) return { action: "skip", reason: "no_website" };
  if (!input.hasKey) return { action: "skip", reason: "no_key" };
  return { action: "crawl", website };
}

export function catalogMessage(reason: CatalogReason, count = 0): string {
  if (reason === "no_key") return "Site crawl skipped because MAMMOUTH_API_KEY is not set. The card was still saved.";
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

function sameSite(url: string, siteHost: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return host.replace(/^www\./i, "").toLowerCase() === siteHost.replace(/^www\./i, "").toLowerCase();
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

const PRODUCTISH = /BMS|充电器|控制器|电池|电机|头盔|盔|灯具|灯|换电|helmet|visor|cycling|jacket|glove/i;
const ABOUT = /成立于|高新技术|专精特新|专利|深耕|请输入要描述|是国内|头部企业|集成商|投入使用|founded in|high-tech|patents/i;
const SECTION = /products?$|equipment$|center$|中心$|系列$/i;
const LISTED_NAV = /^(首页|关于我们|产品中心|解决方案|新闻资讯|联系我们|了解更多|注册|登录|产品|products?)$/i;
const NAV_MARK = /首页|关于我们|关于|新闻|联系我们|注册|登录|荣誉|资质|企业文化|发展历程|常见问题|资料下载|合作伙伴|校企|产品中心|解决方案|About us|Register|Login|News|Our advantages/gi;

const GENERIC = /^(helmets?|cycling|visor|jacket|gloves?|products?|arrivals?)$/i;

export function namePrintedOnPage(name: string, text: string): boolean {
  const needle = name.replace(/\s+/g, "").toLowerCase();
  if (needle.length < 2) return false;
  return text.replace(/\s+/g, "").toLowerCase().includes(needle);
}

function isProductName(name: string): boolean {
  const trimmed = name.replace(/^MODEL[:：]\s*/i, "").trim();
  if (trimmed.length < 4 || trimmed.length > 80 || LISTED_NAV.test(trimmed) || NAV_NAME.test(trimmed) || SECTION.test(trimmed)) {
    return false;
  }
  if (/@/.test(trimmed) || GENERIC.test(trimmed) || /model[:：]/i.test(trimmed)) return false;
  if (MODEL_CODE.test(trimmed) && !SKIP_MODEL.test(trimmed)) return true;
  if (!PRODUCTISH.test(trimmed)) return false;
  if (/[，。！？、；：]/.test(trimmed) || ABOUT.test(trimmed) || /超力源|运营|arrival|co-?operate/i.test(trimmed)) return false;
  if (!/[\u4e00-\u9fff]/.test(trimmed) && !/\d/.test(trimmed) && trimmed.length < 12) return false;
  return true;
}

/** A product blurb is the sentence after the name. Menu bars and company-about blocks are not a description. */
export function productDescription(afterName: string): string | null {
  const rest = afterName.replace(/^[\s|｜:：\-–—]+/, "");
  const end = rest.search(/[。！？]/);
  const sentence = (end >= 12 ? rest.slice(0, end + 1) : rest.slice(0, 180)).trim();
  if (sentence.length < 12) return null;
  const marks = sentence.match(NAV_MARK);
  if (marks && marks.length >= 2) return null;
  if (ABOUT.test(sentence)) return null;
  return sentence.slice(0, 600);
}

export function contentImageUrls(urls: string[], pageUrl: string): string[] {
  const images: string[] = [];
  for (const raw of urls) {
    const url = absoluteHttp(raw, pageUrl);
    if (!url || /logo|icon|sprite|placeholder|richdefault|wechat|weixin|facebook|youtube|douyin|qrcode|favicon/i.test(url)) continue;
    if (!images.includes(url)) images.push(url);
  }
  return images;
}

export function productsListedOnPage(input: {
  text: string;
  html?: string;
  imageUrls: string[];
  pageUrl: string;
  siteHost: string;
  categories: { id: string; slug: string; name_en: string; name_zh: string | null }[];
}): ScrapedProduct[] {
  if (!sameSite(input.pageUrl, input.siteHost)) return [];
  const names: string[] = [];
  const add = (raw: string) => {
    const name = raw.replace(/^MODEL[:：]\s*/i, "").trim();
    if (!isProductName(name) || names.includes(name)) return;
    names.push(name);
  };
  const text = input.text.replace(/([A-Z]{2,4}-\d{2,5})(?=[A-Z]{2,4}-|$|[^A-Za-z0-9])/g, " $1 ");
  for (const token of text.split(/\s+/)) {
    add(token.replace(/^[|｜,，;；:：]+|[|｜,，;；:：]+$/g, ""));
  }
  for (const match of text.matchAll(/(?:^|[\s|｜])([A-Za-z0-9.+-]{0,16}[\u4e00-\u9fff]{0,20}(?:BMS|充电器|控制器|换电平台|头盔))/g)) {
    add(match[1].replace(/^[|｜,，;；:：/]+/, ""));
  }
  const hay = `${input.html ?? ""}\n${text}`;
  for (const match of hay.matchAll(/\b([A-Z]{2,4}-\d{2,5}[A-Z]{0,2})\b/g)) {
    add(match[1]);
  }
  const listed = names.map((name) => {
    const at = input.text.lastIndexOf(name);
    const sentence = productDescription(at < 0 ? "" : input.text.slice(at + name.length));
    return {
      name,
      description: sentence,
      image_url: null as string | null,
      source_url: input.pageUrl,
      category_id: categoryId(guessCategory(name, input.pageUrl, input.text), input.categories),
      details: {},
    };
  });
  const described = listed.filter((item) => item.description);
  const namedOnly = listed.filter((item) => !item.description);
  return [...described, ...namedOnly].slice(0, PRODUCT_SAVE_LIMIT);
}

function guessCategory(name: string, pageUrl: string, text: string): string | null {
  const hay = `${name} ${pageUrl} ${text.slice(0, 1200)}`;
  if (/helmet|盔|visor/i.test(hay)) return "头盔";
  if (/BMS|电池|换电/.test(name) || /BMS|电池/.test(hay)) return "电池";
  if (/充电|控制器|电机/.test(name) || /charger|controller/i.test(hay)) return "电气";
  if (/cycling|骑行|jacket|glove|apparel/i.test(hay)) return "骑行服饰";
  return null;
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
  if (!sameSite(input.pageUrl, input.siteHost)) return [];
  const images = input.imageUrls.map((url) => absoluteHttp(url, input.pageUrl)).filter((url): url is string => Boolean(url));
  const products: ScrapedProduct[] = [];
  for (const item of asProducts(input.json)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = blank(row.name);
    if (!name || name.length < 2 || name.length > 120 || NAV_NAME.test(name) || /price|sku|\$|€|¥/i.test(name)) continue;
    const description = blank(row.description)?.slice(0, 600) ?? null;
    const photos = contentImageUrls(images, input.pageUrl);
    const image =
      absoluteHttp(blank(row.image_url) ?? blank(row.image), input.pageUrl) ??
      (photos.length ? photos[products.length % photos.length] ?? null : null) ??
      (images.length === 1 ? images[0] : null);
    products.push({
      name,
      description,
      image_url: image,
      source_url: input.pageUrl,
      category_id:
        categoryId(blank(row.category), input.categories) ??
        categoryId(guessCategory(name, input.pageUrl, name), input.categories),
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
