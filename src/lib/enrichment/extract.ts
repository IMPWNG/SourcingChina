import * as cheerio from "cheerio";
import type { CompanyType } from "@/lib/domain";
import { inferCompanyType, isPlausibleAddress, isPlausiblePhone, normalizeWebsite } from "@/lib/domain";

export type ExtractedPage = {
  phone: string | null;
  email: string | null;
  wechat: string | null;
  wechat_qr_url: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  export_markets: string[];
  company_type: CompanyType;
  families: { name: string; description: string }[];
  certifications: string[];
  factories: { name: string; address: string | null; city: string | null }[];
  contacts: { name: string; title: string | null; phone: string | null; email: string | null }[];
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
  const labeledPhone =
    text.match(/(?:电话|手机|phone|tel(?:ephone)?|mobile|hotline)\s*[:：]\s*(\+?\d[\d\s-]{6,18})/i)?.[1] ?? null;
  const phones: string[] = [];
  if (labeledPhone && isPlausiblePhone(labeledPhone)) phones.push(labeledPhone.trim());
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href") ?? "";
    const wa = href.match(/(?:wa\.me\/|whatsapp\.com\/send\?phone=)(\+?\d{8,15})/i);
    if (!wa?.[1]) return;
    const number = wa[1].startsWith("+") ? wa[1] : `+${wa[1]}`;
    if (isPlausiblePhone(number) && !phones.some((item) => item.replace(/\D/g, "").endsWith(number.replace(/\D/g, "").slice(-8)))) {
      phones.unshift(number);
    }
  });
  const wechatMatch = text.match(/(?:wechat|weixin|微信)\s*[:：]?\s*(\+?\d[\d\s-]{8,18}|[A-Za-z][A-Za-z0-9_-]{3,})/i);
  const wechatRaw = wechatMatch?.[1]?.trim() ?? null;
  const wechatDigits = wechatRaw ? wechatRaw.replace(/\D/g, "") : "";
  const wechat = wechatRaw && wechatDigits.length >= 8 && isPlausiblePhone(wechatRaw) ? wechatRaw : wechatRaw && /[A-Za-z]/.test(wechatRaw) ? wechatRaw : null;
  if (wechat && wechatDigits.length >= 8 && isPlausiblePhone(wechat) && !phones.some((item) => item.replace(/\D/g, "").includes(wechatDigits))) {
    phones.unshift(wechat);
  }
  let wechat_qr_url: string | null = null;
  $("img").each((_, element) => {
    if (wechat_qr_url) return;
    const src = $(element).attr("src") || $(element).attr("data-src") || $(element).attr("data-original") || "";
    const blob = `${$(element).attr("alt") ?? ""} ${$(element).attr("title") ?? ""} ${$(element).attr("class") ?? ""} ${src}`;
    if (!/qrcode|wechat|weixin|微信/.test(blob)) return;
    try {
      wechat_qr_url = new URL(src, pageUrl).toString();
    } catch {
      /* ignore bad src */
    }
  });
  const addressRaw =
    text.match(/(?:address|地址)\s*[:：]\s*([^。\n]{8,70}?(?:号|Road|Street|Rd\.?))/i)?.[1]?.trim() ?? null;
  const address = addressRaw && isPlausibleAddress(addressRaw) ? addressRaw : null;
  const markets = (text.match(/\b(EU|US|USA|UK|ASEAN|AFRICA|ASIA)\b/gi) ?? []).map((item) =>
    item.toUpperCase() === "USA" ? "US" : item.toUpperCase(),
  );
  const certs = Array.from(new Set((text.match(CERT_RE) ?? []).map((item) => item.replace(/\s+/g, "").replace(/emark/i, "E-mark"))));

  const families: { name: string; description: string }[] = [];
  $("h2, h3").each((_, element) => {
    const name = clean($(element).text());
    if (name.length < 3 || name.length > 80) return;
    if (/price|sku|价格|货号|\$|€|¥|\bUSD\b/i.test(name)) return;
    if (/^(about|contact|home|products|certificates|证书|关于|联系|客户案例|服务优势|可持续发展)$/i.test(name)) return;
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
  } else if (/yueqing|乐清|wenzhou|温州|zhejiang|浙江/i.test(text)) {
    city = /yueqing|乐清/i.test(text) ? "Yueqing" : /wenzhou|温州/i.test(text) ? "Wenzhou" : null;
    province = "Zhejiang";
  }

  const factories: ExtractedPage["factories"] = [];
  const factoryName = text.match(/(?:factory|工厂)\s*[:：]\s*([^.]{3,80})/i)?.[1]?.trim();
  if (factoryName && address) {
    factories.push({ name: factoryName, address, city });
  }
  const contactAt = text.lastIndexOf("联系我们");
  const contactBlock = contactAt >= 0 ? text.slice(contactAt, contactAt + 420) : "";
  if (contactBlock && !/请输入要描述/.test(contactBlock)) {
    for (const match of contactBlock.matchAll(/(惠州|无锡|深圳)\s*[:：]\s*([^。|]{8,90}?)(?=\s*(?:惠州|无锡|深圳)\s*[:：]|电话|邮箱|$)/g)) {
      const place = match[1];
      const line = clean(match[2]);
      if (factories.some((item) => item.address === line)) continue;
      factories.push({ name: `${place} office`, address: line, city: place });
    }
  }
  const officePhone = contactBlock.match(/电话\s*[:：]\s*(0\d{2,3}-\d{7,8})/)?.[1] ?? null;
  const labeledEmail = contactBlock.match(/邮箱\s*[:：]\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i)?.[1] ?? null;
  const officePhoneOk = officePhone && isPlausiblePhone(officePhone) ? officePhone : null;
  const contacts: ExtractedPage["contacts"] =
    officePhoneOk || labeledEmail ? [{ name: "Office", title: null, phone: officePhoneOk, email: labeledEmail }] : [];
  if (!contacts.length && (phones[0] || emails[0] || wechat)) {
    contacts.push({ name: "Sales", title: null, phone: phones[0]?.trim() ?? null, email: emails[0] ?? null });
  }

  return {
    phone: phones[0]?.trim() ?? null,
    email: emails[0] ?? null,
    wechat,
    wechat_qr_url,
    address,
    city,
    province,
    export_markets: Array.from(new Set(markets)),
    company_type: inferCompanyType(text),
    families,
    certifications: certs,
    factories,
    contacts,
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

export async function fetchRemoteImage(url: string, timeoutMs = 8000): Promise<{ bytes: Buffer; mime: string } | null> {
  const abs = url.startsWith("//") ? `https:${url}` : url;
  try {
    const response = await fetch(abs, {
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 80 || bytes.length > 2_000_000) return null;
    const mime = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    if (!mime.startsWith("image/")) return null;
    return { bytes, mime };
  } catch {
    return null;
  }
}

export { normalizeWebsite };
