import type { CompanyType } from "@/lib/domain";
import type { CatalogReason } from "@/lib/scrapegraph/products";

const COMPANY_TYPES = new Set<CompanyType>(["factory", "trading", "mixed", "unknown"]);

export type CardCompanyRecord = {
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

export type CardProductRecord = {
  name: string;
  description: string | null;
  image_url: string | null;
  source_url: string | null;
  category: string | null;
  details: Record<string, string>;
};

export type CardRecord = {
  source: string;
  ocr_text: string | null;
  ocr_error: string | null;
  mammouth_error: string | null;
  company: CardCompanyRecord;
  products: CardProductRecord[];
  catalog: CatalogReason;
};

export type CardBatch = {
  generated_at: string;
  cards: CardRecord[];
};

export function parseCardArgs(argv: string[]): { paths: string[]; out: string } | { error: string } {
  const paths: string[] = [];
  let out = "cards.json";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (arg === "--out") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) return { error: "Pass a file after --out." };
      out = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--out=")) {
      const value = arg.slice("--out=".length);
      if (!value) return { error: "Pass a file after --out." };
      out = value;
      continue;
    }
    if (arg.startsWith("-")) return { error: `Unknown option ${arg}.` };
    paths.push(arg);
  }
  if (!paths.length) return { error: "Pass a folder or one or more card photos." };
  return { paths, out };
}

function blank(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function companyType(value: unknown): CompanyType {
  const text = blank(value)?.toLowerCase();
  return text && COMPANY_TYPES.has(text as CompanyType) ? (text as CompanyType) : "unknown";
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => blank(item)).filter((item): item is string => Boolean(item)))];
}

function detailsOf(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const details: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    const text = blank(item);
    if (text) details[key] = text;
  }
  return details;
}

function companyOf(value: unknown): CardCompanyRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return {
    name_zh: blank(record.name_zh),
    name_en: blank(record.name_en),
    brand: blank(record.brand),
    company_type: companyType(record.company_type),
    address: blank(record.address),
    city: blank(record.city),
    province: blank(record.province),
    country: blank(record.country) ?? "CN",
    website: blank(record.website),
    wechat: blank(record.wechat),
    phone: blank(record.phone),
    email: blank(record.email),
    export_markets: stringList(record.export_markets),
  };
}

function productsOf(value: unknown): CardProductRecord[] {
  if (!Array.isArray(value)) return [];
  const products: CardProductRecord[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const name = blank(record.name);
    if (!name) continue;
    products.push({
      name,
      description: blank(record.description),
      image_url: blank(record.image_url),
      source_url: blank(record.source_url),
      category: blank(record.category),
      details: detailsOf(record.details),
    });
  }
  return products;
}

const CATALOGS = new Set<CatalogReason>(["no_key", "no_website", "failed", "empty", "saved"]);

export function parseCardBatch(value: unknown): CardBatch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.cards)) return null;
  const cards: CardRecord[] = [];
  for (const item of record.cards) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const card = item as Record<string, unknown>;
    const company = companyOf(card.company);
    const source = blank(card.source);
    if (!company || !source) return null;
    const catalog = blank(card.catalog);
    cards.push({
      source,
      ocr_text: blank(card.ocr_text),
      ocr_error: blank(card.ocr_error),
      mammouth_error: blank(card.mammouth_error),
      company,
      products: productsOf(card.products),
      catalog: catalog && CATALOGS.has(catalog as CatalogReason) ? (catalog as CatalogReason) : "failed",
    });
  }
  return { generated_at: blank(record.generated_at) ?? new Date(0).toISOString(), cards };
}

/** Drop a website, phone, or email the model added when it is not in the OCR text. */
export function keepPrintedContacts(company: CardCompanyRecord, ocrText: string | null): CardCompanyRecord {
  const text = ocrText ?? "";
  return {
    ...company,
    website: printedWebsite(company.website, text),
    phone: printedPhone(company.phone, text),
    email: printedEmail(company.email, text),
  };
}

function printedEmail(email: string | null, text: string): string | null {
  if (!email || !text.toLowerCase().includes(email.toLowerCase())) return null;
  return email;
}

function printedPhone(phone: string | null, text: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (!text.replace(/\D/g, "").includes(digits)) return null;
  return phone;
}

function printedWebsite(website: string | null, text: string): string | null {
  if (!website) return null;
  let host = website;
  try {
    host = new URL(website).host.replace(/^www\./, "");
  } catch {
    return null;
  }
  const hay = text.toLowerCase();
  if (!hay.includes(host.toLowerCase())) return null;
  return website;
}

export function missingSupabaseKeys(env: Record<string, string | undefined>): string[] {
  const missing: string[] = [];
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!url || /your-project|placeholder|example/i.test(url) || !url.startsWith("https://")) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  const secret = (env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!secret || /your-|placeholder/i.test(secret)) missing.push("SUPABASE_SECRET_KEY");
  return missing;
}

export function supabaseKeyMessage(missing: string[]): string {
  const lines = ["Missing Supabase settings. Add them to .env.local:", ...missing.map((name) => `- ${name}`)];
  if (missing.includes("SUPABASE_SECRET_KEY")) {
    lines.push("SUPABASE_SERVICE_ROLE_KEY is accepted in place of SUPABASE_SECRET_KEY.");
  }
  return lines.join("\n");
}
