import { normalizeWebsite, type CardExtraction, type CompanyType } from "@/lib/domain";

const COMPANY_TYPES = new Set<CompanyType>(["factory", "trading", "mixed", "unknown"]);

export const CARD_PROMPT =
  "Extract only the fields printed on this motorcycle-industry business card. Return company names, brand, address, city, province, country, website, WeChat, phone, email, export markets, and the person named as a contact. Do not invent a website, phone, email, WeChat, or contact that is not on the card. Do not include prices, SKUs, stock, stand numbers, or show dates. Use company_type factory, trading, mixed, or unknown.";

export const CARD_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    name_zh: { type: "string" },
    name_en: { type: "string" },
    brand: { type: "string" },
    company_type: { type: "string", enum: ["factory", "trading", "mixed", "unknown"] },
    address: { type: "string" },
    city: { type: "string" },
    province: { type: "string" },
    country: { type: "string" },
    website: { type: "string" },
    wechat: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    export_markets: { type: "array", items: { type: "string" } },
    contact_name: { type: "string" },
    contact_title: { type: "string" },
    contact_phone: { type: "string" },
    contact_email: { type: "string" },
  },
};

export function readMammouthApiKey(value: string | undefined): string | null {
  const key = value?.trim() ?? "";
  if (!key || /your-|placeholder/i.test(key)) return null;
  return key;
}

export function scrapeGraphApiKey(): string | null {
  return readMammouthApiKey(process.env.MAMMOUTH_API_KEY);
}

function blank(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /^(n\/a|na|none|null|unknown|-|—)$/i.test(trimmed)) return null;
  return trimmed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function cardFromScrapeGraph(value: unknown): CardExtraction | null {
  const record = asRecord(value);
  if (!record) return null;
  const companyType = blank(record.company_type)?.toLowerCase();
  const company_type: CompanyType = COMPANY_TYPES.has(companyType as CompanyType) ? (companyType as CompanyType) : "unknown";
  const contactName = blank(record.contact_name);
  const contact = contactName
    ? {
        name: contactName,
        title: blank(record.contact_title),
        phone: blank(record.contact_phone),
        email: blank(record.contact_email),
      }
    : null;
  const export_markets = Array.isArray(record.export_markets)
    ? [...new Set(record.export_markets.map((item) => blank(item)).filter((item): item is string => Boolean(item)))]
    : [];
  const extraction: CardExtraction = {
    name_zh: blank(record.name_zh),
    name_en: blank(record.name_en),
    brand: blank(record.brand),
    company_type,
    address: blank(record.address),
    city: blank(record.city),
    province: blank(record.province),
    country: blank(record.country) ?? "CN",
    website: normalizeWebsite(blank(record.website)),
    wechat: blank(record.wechat),
    phone: blank(record.phone),
    email: blank(record.email),
    export_markets,
    contact,
    confidence: {},
  };
  const filled = [
    extraction.name_zh,
    extraction.name_en,
    extraction.brand,
    extraction.address,
    extraction.website,
    extraction.wechat,
    extraction.phone,
    extraction.email,
    extraction.contact?.name,
    extraction.export_markets.length ? "markets" : null,
  ].filter(Boolean);
  if (!filled.length) return null;
  for (const key of ["name_zh", "name_en", "brand", "address", "website", "wechat", "phone", "email"] as const) {
    if (extraction[key]) extraction.confidence[key] = 0.85;
  }
  if (extraction.contact) extraction.confidence.contact = 0.85;
  if (extraction.export_markets.length) extraction.confidence.export_markets = 0.8;
  return extraction;
}
