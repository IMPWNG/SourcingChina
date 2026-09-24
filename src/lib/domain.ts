export const COMPANY_TYPES = ["factory", "trading", "mixed", "unknown"] as const;
export type CompanyType = (typeof COMPANY_TYPES)[number];

export const SUBSCRIPTION_STATUSES = ["none", "active", "past_due", "canceled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const USER_ROLES = ["subscriber", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PLAN_PERIOD_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd: string | null;
};

export type CardContact = {
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
};

export type CardExtraction = {
  name_zh: string | null;
  name_en: string | null;
  brand: string | null;
  company_type: CompanyType;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string;
  website: string | null;
  wechat: string | null;
  phone: string | null;
  email: string | null;
  export_markets: string[];
  contact: CardContact | null;
  confidence: Record<string, number>;
};

const TRACKING_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];

const PLACES: { city: string; province: string; tokens: string[] }[] = [
  { city: "Chongqing", province: "Chongqing", tokens: ["chongqing", "重庆", "沙坪坝", "渝中", "南岸", "北碚", "两江", "shapingba"] },
  { city: "Wenzhou", province: "Zhejiang", tokens: ["wenzhou", "温州", "瓯海", "zhejiang", "浙江"] },
  { city: "Guangzhou", province: "Guangdong", tokens: ["guangzhou", "广州", "guangdong", "广东"] },
  { city: "Shanghai", province: "Shanghai", tokens: ["shanghai", "上海"] },
  { city: "Ningbo", province: "Zhejiang", tokens: ["ningbo", "宁波"] },
];

export function hasDirectoryAccess(
  user: Pick<SessionUser, "role" | "subscriptionStatus" | "currentPeriodEnd"> | null,
  now = Date.now(),
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.subscriptionStatus !== "active" || !user.currentPeriodEnd) return false;
  return new Date(user.currentPeriodEnd).getTime() > now;
}

export function safeNext(value: unknown, fallback = "/directory"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) {
    return fallback;
  }
  return value;
}

export function normalizeWebsite(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value || /^fixture:/i.test(value)) return value || null;
  if (!/^https?:\/\//i.test(value)) {
    if (!/^[\w.-]+\.[a-z]{2,}([/:?#]|$)/i.test(value)) return null;
    value = `https://${value}`;
  }
  try {
    const url = new URL(value);
    if (!url.hostname.includes(".")) return null;
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of TRACKING_PARAMS) url.searchParams.delete(key);
    let out = url.toString();
    if (out.endsWith("/")) out = out.slice(0, -1);
    return out;
  } catch {
    return null;
  }
}

export function websiteHost(raw: string | null | undefined): string | null {
  const normalized = normalizeWebsite(raw);
  if (!normalized || normalized.startsWith("fixture:")) return null;
  try {
    return new URL(normalized).hostname;
  } catch {
    return null;
  }
}

export function phoneDigits(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = phoneDigits(a);
  const right = phoneDigits(b);
  if (left.length < 8 || right.length < 8) return false;
  if (left === right) return true;
  const tail = (value: string) => value.replace(/^0+/, "").replace(/^86/, "");
  return tail(left) === tail(right);
}

export function planAmount(): number {
  const parsed = Number(process.env.AIRWALLEX_PLAN_AMOUNT ?? "79");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 79;
}

export function planCurrency(): string {
  return (process.env.AIRWALLEX_PLAN_CURRENCY ?? "EUR").trim().toUpperCase() || "EUR";
}

export function paymentMatchesPlan(amount: unknown, currency: unknown): boolean {
  const numeric = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(numeric)) return false;
  return Math.abs(numeric - planAmount()) < 0.001 && String(currency ?? "").trim().toUpperCase() === planCurrency();
}

export function extendPeriod(currentEnd: string | null, days: number, now: Date): string {
  const current = currentEnd ? new Date(currentEnd).getTime() : 0;
  const base = current > now.getTime() ? current : now.getTime();
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
}

export function inferCompanyType(text: string): CompanyType {
  const factory = /factory|制造|工厂|\u5382/i.test(text);
  const trading = /trading|贸易|商贸|进出口/i.test(text);
  if (factory && trading) return "mixed";
  if (factory) return "factory";
  if (trading) return "trading";
  return "unknown";
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function extractCard(rawText: string): CardExtraction {
  const text = rawText.replace(/\r/g, "").trim();
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const confidence: Record<string, number> = {};
  const emails = unique(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []);
  const email = emails[0] ?? null;
  if (email) confidence.email = 0.95;

  const urlMatches = text.match(/https?:\/\/[^\s,;]+|www\.[^\s,;]+/gi) ?? [];
  const labeledWeb = lines
    .map((line) => line.match(/^(?:web|website|url|网址)\s*[:：]\s*(.+)$/i)?.[1])
    .find(Boolean);
  const website = normalizeWebsite(labeledWeb ?? urlMatches[0] ?? null);
  if (website) confidence.website = labeledWeb ? 0.95 : 0.8;

  const wechatMatch = text.match(/(?:wechat|weixin|微信)\s*[:：]?\s*([A-Za-z][A-Za-z0-9_-]{3,})/i);
  const wechat = wechatMatch?.[1] ?? null;
  if (wechat) confidence.wechat = 0.9;

  const phoneMatches = text.match(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}(?:[\s-]?\d{2,4})?/g) ?? [];
  const phones = unique(
    phoneMatches
      .map((item) => item.trim())
      .filter((item) => phoneDigits(item).length >= 8 && phoneDigits(item).length <= 15)
      .filter((item) => !emails.some((mail) => mail.includes(item))),
  );
  const phone = phones.length ? phones.join("; ") : null;
  if (phone) confidence.phone = 0.85;

  const exportLine = lines.find((line) => /export|出口市场|市场/i.test(line));
  const export_markets = exportLine
    ? unique(
        (exportLine.match(/\b(EU|US|USA|UK|ASEAN|AU|AUSTRALIA|AFRICA|MIDDLE EAST|LATAM|ASIA)\b/gi) ?? []).map((item) =>
          item.toUpperCase() === "USA" ? "US" : item.toUpperCase(),
        ),
      )
    : [];
  if (export_markets.length) confidence.export_markets = 0.8;

  const zhLine =
    lines.find((line) => /[\u4e00-\u9fff]/.test(line) && /公司|厂|集团|贸易/.test(line)) ??
    lines.find((line) => /[\u4e00-\u9fff]{2,}/.test(line) && !/地址|电话|微信|邮箱/.test(line));
  const name_zh = zhLine ? zhLine.replace(/^(公司|名称)\s*[:：]\s*/, "") : null;
  if (name_zh) confidence.name_zh = /公司|厂|集团/.test(name_zh) ? 0.9 : 0.6;

  const enLine = lines.find((line) => /\b(CO\.?,?\s*LTD\.?|LIMITED|FACTORY|TRADING|INC\.?|CORP\.?)\b/i.test(line) && !/@/.test(line));
  const name_en = enLine ? enLine.replace(/^(company|name)\s*[:：]\s*/i, "") : null;
  if (name_en) confidence.name_en = 0.9;

  const brandLine = lines.find((line) => /^brand\s*[:：]/i.test(line));
  const brand = brandLine ? brandLine.replace(/^brand\s*[:：]\s*/i, "").trim() || null : null;
  if (brand) confidence.brand = 0.9;

  const addressLine = lines.find((line) => /^(add|address|地址)\s*[:：]/i.test(line) || /路|街|区|号|road|street|district/i.test(line));
  const address = addressLine ? addressLine.replace(/^(add|address|地址)\s*[:：]\s*/i, "").trim() || null : null;
  if (address) confidence.address = 0.85;

  const place = PLACES.find((item) => item.tokens.some((token) => text.toLowerCase().includes(token.toLowerCase())));
  const city = place?.city ?? null;
  const province = place?.province ?? null;
  if (city) confidence.city = 0.7;
  if (province) confidence.province = 0.7;

  const company_type = inferCompanyType(text);
  if (company_type !== "unknown") confidence.company_type = 0.75;

  const contactLine = lines.find((line) => /^(contact|联系人)\s*[:：]/i.test(line));
  let contact: CardContact | null = null;
  if (contactLine) {
    const body = contactLine.replace(/^(contact|联系人)\s*[:：]\s*/i, "");
    const parts = body.split(/[,，]/).map((part) => part.trim()).filter(Boolean);
    const contactPhone = parts.find((part) => phoneDigits(part).length >= 8) ?? null;
    const contactEmail = parts.find((part) => part.includes("@")) ?? null;
    const name = parts.find((part) => part !== contactPhone && part !== contactEmail) ?? "";
    const title = parts.find((part) => part !== name && part !== contactPhone && part !== contactEmail) ?? null;
    if (name) {
      contact = { name, title, phone: contactPhone, email: contactEmail };
      confidence.contact = 0.8;
    }
  }

  return {
    name_zh,
    name_en,
    brand,
    company_type,
    address,
    city,
    province,
    country: "CN",
    website,
    wechat,
    phone,
    email,
    export_markets,
    contact,
    confidence,
  };
}

export type CompanyIdentity = {
  name_zh: string | null;
  name_en: string | null;
  brand: string | null;
  company_type: CompanyType;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string;
  website: string | null;
  wechat: string | null;
  phone: string | null;
  email: string | null;
  export_markets: string[];
};

export function fillEmptyFields(primary: CompanyIdentity, incoming: Partial<CompanyIdentity>, overwrite = false): Partial<CompanyIdentity> {
  const patch: Partial<CompanyIdentity> = {};
  const keys: (keyof CompanyIdentity)[] = [
    "name_zh",
    "name_en",
    "brand",
    "address",
    "city",
    "province",
    "country",
    "website",
    "wechat",
    "phone",
    "email",
  ];
  for (const key of keys) {
    const next = incoming[key];
    if (typeof next !== "string" || !next.trim()) continue;
    const current = primary[key];
    if (overwrite || current == null || (typeof current === "string" && !current.trim())) {
      (patch as Record<string, string>)[key] = next.trim();
    }
  }
  if (incoming.company_type && incoming.company_type !== "unknown" && (overwrite || primary.company_type === "unknown")) {
    patch.company_type = incoming.company_type;
  }
  if (incoming.export_markets && incoming.export_markets.length && (overwrite || primary.export_markets.length === 0)) {
    patch.export_markets = incoming.export_markets;
  }
  return patch;
}

export type DuplicateReason = "website" | "phone" | "email";

export function findDuplicatePairs(
  companies: { id: string; website: string | null; phone: string | null; email: string | null; merged_into_id?: string | null }[],
): { a: string; b: string; reason: DuplicateReason }[] {
  const pairs: { a: string; b: string; reason: DuplicateReason }[] = [];
  const active = companies.filter((company) => !company.merged_into_id);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const left = active[i];
      const right = active[j];
      const hostA = websiteHost(left.website);
      const hostB = websiteHost(right.website);
      if (hostA && hostA === hostB) {
        pairs.push({ a: left.id, b: right.id, reason: "website" });
        continue;
      }
      if (phonesMatch(left.phone, right.phone)) {
        pairs.push({ a: left.id, b: right.id, reason: "phone" });
        continue;
      }
      if (left.email && right.email && left.email.trim().toLowerCase() === right.email.trim().toLowerCase()) {
        pairs.push({ a: left.id, b: right.id, reason: "email" });
      }
    }
  }
  return pairs;
}
