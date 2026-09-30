import { COMPANY_TYPES, isPlausibleAddress, isPlausiblePhone, normalizeWebsite, type CompanyType } from "@/lib/domain";
import * as cheerio from "cheerio";

export const PRODUCT_PAGE_LIMIT = 120;
export const PRODUCT_DEPTH = 4;
export const PRODUCT_LINKS_PER_PAGE = 6;
export const PRODUCT_CRAWL_MS = 300_000;
/** Admin upload still returns a draft; keep this under a Vercel function. */
export const UPLOAD_PRODUCT_CRAWL_MS = 45_000;
export const PRODUCT_SAVE_LIMIT = 400;

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
const MODEL_CODE = /^[A-Z]{2,6}(?:-[A-Z0-9()]{1,16}){1,4}$/i;
const SKIP_MODEL = /^(ISO|CCC|DOT|ECE|GB|CE|IEC|UN|EN|DIN|ASTM|COL|UTF|JSON|HTTP|HTML|CORS|XML|CSS|BEARER)-/i;
const JUNK_NAME = /^(UTF-8|BEARER-TOKEN|CHARSET|CONTENT-TYPE|JSON|HTML|UNDEFINED|NULL)$/i;

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

const PRODUCTISH = /BMS|充电器|控制器|电池|电机|头盔|盔|灯具|灯|换电|helmet|visor|cycling|jacket|glove|engine|brake|fork|tire|tyre|wheel|exhaust|frame/i;
const ABOUT = /成立于|高新技术|专精特新|专利|深耕|请输入要描述|是国内|头部企业|集成商|投入使用|founded in|high-tech|patents/i;
const SECTION = /products?$|equipment$|center$|中心$|系列$/i;
const LISTED_NAV = /^(首页|关于我们|产品中心|解决方案|新闻资讯|联系我们|了解更多|注册|登录|产品|products?)$/i;
const NAV_MARK = /首页|关于我们|关于|新闻|联系我们|注册|登录|荣誉|资质|企业文化|发展历程|常见问题|资料下载|合作伙伴|校企|产品中心|解决方案|About us|Register|Login|News|Our advantages/gi;

const GENERIC = /^(helmets?|cycling|visor|jacket|gloves?|products?|arrivals?)$/i;
const ASSET_NAME = /\.(png|jpe?g|gif|webp|svg|css|js|pdf)(\b|$)/i;
const ASSET_LABEL = /banner[_-]?(text|title|m)?\d|slider[_-]|sprite[_-]|favicon|placeholder|hero[_-]|logo[_-]/i;
const CHROME_IMAGE = /logo|icon|sprite|placeholder|richdefault|banner[_-]|slider|hero[_-]|title[_-]|wechat|weixin|facebook|youtube|douyin|qrcode|favicon/i;

function isAssetName(name: string): boolean {
  const trimmed = name.trim();
  return ASSET_NAME.test(trimmed) || ASSET_LABEL.test(trimmed);
}

export function namePrintedOnPage(name: string, text: string): boolean {
  const needle = name.replace(/\s+/g, "").toLowerCase();
  if (needle.length < 2) return false;
  return text.replace(/\s+/g, "").toLowerCase().includes(needle);
}

const WEAK_TOKEN = /^(full|face|half|open|type|series|model|product|products|helmet|helmets|casque|the|and|with|for)$/i;

/** Match a product against visible page text, not image URLs in the HTML. */
export function productOnPage(name: string, details: Record<string, string>, hay: string): boolean {
  const visible = hay.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/\b(?:src|href)=["'][^"']+["']/gi, " ");
  if (namePrintedOnPage(name, visible)) return true;
  for (const key of ["name_zh", "name_en", "name_fr"]) {
    if (details[key] && namePrintedOnPage(details[key], visible)) return true;
  }
  const tokens = name.split(/[\s/|,，]+/).filter((token) => token.length >= 5 && !WEAK_TOKEN.test(token));
  if (tokens.length < 2) return false;
  return tokens.filter((token) => namePrintedOnPage(token, visible)).length >= 2;
}

export type CompanySiteFill = {
  phone: string | null;
  email: string | null;
  wechat: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  export_markets: string[];
  company_type: CompanyType;
  families: { name: string; description: string }[];
  excerpt: string;
};

export function companyFillFromModel(json: unknown): CompanySiteFill {
  const root = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const raw = root.company && typeof root.company === "object" ? (root.company as Record<string, unknown>) : root;
  const type = String(raw.company_type ?? "").toLowerCase();
  let company_type = COMPANY_TYPES.includes(type as CompanyType) ? (type as CompanyType) : "unknown";
  const families: { name: string; description: string }[] = [];
  const summary = blank(raw.summary_fr) ?? blank(raw.summary_en) ?? blank(raw.summary) ?? "";
  if (/express|logistique|livraison|快递|物流|freight|courier/i.test(summary) && company_type === "factory") {
    company_type = "unknown";
  }
  if (summary) families.push({ name: "Présentation", description: summary.slice(0, 800) });
  const list = Array.isArray(raw.families) ? raw.families : [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = blank(row.name);
    if (!name || isAssetName(name) || isCategoryLabel(name) || /présentation|overview/i.test(name)) continue;
    const description = blank(row.description) ?? "";
    if (families.some((family) => family.name.toLowerCase() === name.toLowerCase())) continue;
    families.push({ name: name.slice(0, 80), description: description.slice(0, 600) });
    if (families.length >= 12) break;
  }
  const phone = blank(raw.phone);
  const address = blank(raw.address);
  const markets = Array.isArray(raw.export_markets)
    ? raw.export_markets
        .map((item) => blank(item))
        .filter((item): item is string => Boolean(item) && item.length < 24 && !/^(global|worldwide|international)$/i.test(item))
    : [];
  return {
    phone: phone && isPlausiblePhone(phone) ? phone : null,
    email: blank(raw.email),
    wechat: blank(raw.wechat),
    address: address && isPlausibleAddress(address) ? address : null,
    city: blank(raw.city),
    province: blank(raw.province),
    export_markets: markets,
    company_type,
    families,
    excerpt: summary.slice(0, 800),
  };
}

function catalogTitle(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/\s*(Reservation Now|立即预订|Buy Now|立即购买).*$/i, "")
    .replace(/\s*Certificate(?:\s+CCC(?:\/DOT)?)?.*$/i, "")
    .trim();
}

function isCategoryLabel(name: string): boolean {
  return /^(full face helmets?|half face helmets?|open face helmets?|kids(?: helmets?)?|sport(?:s)?(?: helmets?)?|retro(?: helmets?)?|off[- ]road(?: helmets?)?|flip-?up(?: helmets?)?|modular(?: helmets?)?|lens|cycling equipment|helmet products|accessories|other accessories)$/i.test(
    name.trim(),
  );
}

export function isPlausibleProductName(name: string): boolean {
  const trimmed = name.replace(/^MODEL[:：]\s*/i, "").trim();
  if (trimmed.length < 3 || trimmed.length > 80) return false;
  if (JUNK_NAME.test(trimmed) || SKIP_MODEL.test(trimmed)) return false;
  if (/我的快递|运单查询|服务支持|客户案例|可持续发展|ESG|javascript|utf-?8/i.test(trimmed)) return false;
  return !isAssetName(trimmed);
}

function isListedName(name: string, loose = false): boolean {
  const trimmed = name.replace(/^MODEL[:：]\s*/i, "").trim();
  if (!isPlausibleProductName(trimmed)) return false;
  if (trimmed.length < 4 || LISTED_NAV.test(trimmed) || NAV_NAME.test(trimmed) || SECTION.test(trimmed)) {
    return false;
  }
  if (/@/.test(trimmed) || GENERIC.test(trimmed) || /model[:：]/i.test(trimmed)) return false;
  if (MODEL_CODE.test(trimmed) && !SKIP_MODEL.test(trimmed)) return true;
  if (loose) return !ABOUT.test(trimmed) && !/[，。！？]/.test(trimmed);
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
    if (!url || CHROME_IMAGE.test(url)) continue;
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
  const imagesByName = new Map<string, string>();
  const add = (raw: string, loose = false) => {
    const name = catalogTitle(raw.replace(/^MODEL[:：]\s*/i, ""));
    if (!name || isCategoryLabel(name) || !isListedName(name, loose) || names.includes(name)) return;
    names.push(name);
  };
  const text = input.text.replace(/([A-Z]{2,6}(?:-[A-Z0-9()]{1,16})+)(?=[A-Z]{2,6}-)/g, "$1 ");
  for (const token of text.split(/\s+/)) {
    add(token.replace(/^[|｜,，;；:：]+|[|｜,，;；:：]+$/g, ""));
  }
  for (const match of text.matchAll(/(?:^|[\s|｜])([A-Za-z0-9.+-]{0,16}[\u4e00-\u9fff]{0,20}(?:BMS|充电器|控制器|换电平台|头盔))/g)) {
    add(match[1].replace(/^[|｜,，;；:：/]+/, ""));
  }
  let visible = text;
  if (input.html) {
    visible = `${text} ${input.html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")}`;
  }
  for (const match of visible.matchAll(/\b([A-Z]{2,6}(?:-[A-Z0-9()]{1,16}){1,4})\b/g)) {
    add(match[1]);
  }
  for (const name of namesFromJsonLd(input.html ?? "")) add(name, true);
  if (input.html) {
    const $ = cheerio.load(input.html);
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const label = catalogTitle($(el).text());
      if (!label || isCategoryLabel(label)) return;
      const productish = /sys-pr|sys-pd|\/product|\/goods|\/item|\/detail/i.test(href);
      if (label.length > 90) {
        for (const match of label.matchAll(/\b([A-Z]{2,6}(?:-[A-Z0-9()]{1,16}){1,4})\b/g)) add(match[1]);
      } else if (productish || MODEL_CODE.test(label)) {
        add(label, productish);
      }
      const src = $(el).find("img").first().attr("src") ?? $(el).find("img").first().attr("data-src");
      const photo = absoluteHttp(src ?? null, input.pageUrl);
      if (photo && !CHROME_IMAGE.test(photo) && names.includes(label)) imagesByName.set(label, photo);
    });
  }
  if (/product|goods|item|detail|sys-p[rd]|\/pd\/|商品|产品/i.test(input.pageUrl)) {
    for (const match of (input.html ?? "").matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)) {
      add(match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(), true);
    }
  }
  const listed = names.map((name) => {
    const at = input.text.lastIndexOf(name);
    const sentence = productDescription(at < 0 ? "" : input.text.slice(at + name.length));
    return {
      name,
      description: sentence,
      image_url: imagesByName.get(name) ?? null,
      source_url: input.pageUrl,
      category_id: categoryId(guessCategory(name, input.pageUrl), input.categories),
      details: {},
    };
  });
  const described = listed.filter((item) => item.description);
  const namedOnly = listed.filter((item) => !item.description);
  return [...described, ...namedOnly].slice(0, PRODUCT_SAVE_LIMIT);
}

function guessCategory(name: string, pageUrl: string): string | null {
  const hay = `${name} ${pageUrl}`;
  if (/helmet|盔|visor/i.test(hay)) return "头盔";
  if (/BMS|电池|换电/.test(name)) return "电池";
  if (/充电|控制器|电机/.test(name) || /charger|controller/i.test(hay)) return "电气";
  if (/cycling|骑行|jacket|glove|apparel/i.test(hay)) return "骑行服饰";
  if (/engine|活塞|发动机/i.test(hay)) return "发动机配件";
  if (/lamp|light|灯具|headlight/i.test(hay)) return "灯具";
  if (/tire|tyre|wheel|轮胎|轮毂/i.test(hay)) return "轮胎轮毂";
  if (/exhaust|排气/i.test(hay)) return "排气";
  return null;
}

function namesFromJsonLd(html: string): string[] {
  const names: string[] = [];
  const walk = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== "object") return;
    const row = node as Record<string, unknown>;
    const types = row["@type"];
    const type = Array.isArray(types) ? types.map(String).join(" ") : String(types ?? "");
    if (/Product/i.test(type) && typeof row.name === "string") names.push(row.name);
    walk(row["@graph"]);
    walk(row.itemListElement);
    walk(row.item);
  };
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(match[1]!));
    } catch {
      /* ignore broken JSON-LD */
    }
  }
  return names;
}

export function urlsFromModelPick(json: unknown, siteHost: string): string[] {
  const record = json && typeof json === "object" ? (json as { urls?: unknown }) : {};
  const list = Array.isArray(record.urls) ? record.urls : [];
  const urls: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const url = absoluteHttp(item.trim(), `https://${siteHost.replace(/^www\./i, "")}`);
    if (!url || !sameSite(url, siteHost) || urls.includes(url)) continue;
    urls.push(url);
    if (urls.length >= 120) break;
  }
  return urls;
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
    if (!name || !isPlausibleProductName(name) || NAV_NAME.test(name) || /price|sku|\$|€|¥/i.test(name)) continue;
    if (/co-?operate|请输入要描述|information与|与我们共同经营/i.test(name)) continue;
    if (isCategoryLabel(name)) continue;
    const description = blank(row.description)?.slice(0, 600) ?? null;
    const photos = contentImageUrls(images, input.pageUrl);
    const picked = absoluteHttp(blank(row.image_url) ?? blank(row.image), input.pageUrl);
    const image =
      (picked && !CHROME_IMAGE.test(picked) ? picked : null) ??
      (photos.length ? photos[products.length % photos.length] ?? null : null);
    products.push({
      name,
      description,
      image_url: image,
      source_url: input.pageUrl,
      category_id:
        categoryId(blank(row.category), input.categories) ??
        categoryId(guessCategory(name, input.pageUrl), input.categories),
      details: detailsOf(row.details),
    });
  }
  return products;
}

export function uniqueProducts(products: ScrapedProduct[]): ScrapedProduct[] {
  const seen = new Set<string>();
  const unique: ScrapedProduct[] = [];
  for (const product of products) {
    if (!isPlausibleProductName(product.name) || isCategoryLabel(product.name)) continue;
    const key = product.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(product);
    if (unique.length >= PRODUCT_SAVE_LIMIT) break;
  }
  return unique;
}
