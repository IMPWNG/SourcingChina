import type { Company, Contact, Product, Source } from "@/lib/records";

/** Fits a browser cookie with room for the rest of the request headers. */
const LIMIT = 3500;

export type CardDraftBundle = {
  companies: Company[];
  sources: Source[];
  contacts: Contact[];
  products: Product[];
};

export function packCardDrafts(bundle: CardDraftBundle): string | null {
  let companies = bundle.companies.filter((company) => company && typeof company.id === "string");
  let sources = [...bundle.sources];
  let contacts = [...bundle.contacts];
  let products = [...bundle.products];

  const current = (): CardDraftBundle => ({ companies, sources, contacts, products });

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const encoded = Buffer.from(JSON.stringify(current())).toString("base64url");
    if (encoded.length <= LIMIT) return encoded;
    if (sources.some((source) => (source.raw_text?.length ?? 0) > 160)) {
      sources = sources.map((source) => ({
        ...source,
        raw_text: source.raw_text ? source.raw_text.slice(0, 160) : source.raw_text,
      }));
      continue;
    }
    if (products.length) {
      products = products.slice(0, Math.max(0, products.length - 2));
      continue;
    }
    if (companies.length > 1) {
      const drop = companies[0]?.id;
      companies = companies.slice(1);
      sources = sources.filter((source) => source.company_id !== drop);
      contacts = contacts.filter((contact) => contact.company_id !== drop);
      products = products.filter((product) => product.company_id !== drop);
      continue;
    }
    if (sources.some((source) => source.raw_text)) {
      sources = sources.map((source) => ({ ...source, raw_text: null }));
      continue;
    }
    return null;
  }
  const encoded = Buffer.from(JSON.stringify(current())).toString("base64url");
  return encoded.length <= LIMIT ? encoded : null;
}

export function unpackCardDrafts(encoded: string | undefined): CardDraftBundle | null {
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<CardDraftBundle>;
    if (!Array.isArray(parsed.companies)) return null;
    return {
      companies: parsed.companies,
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
    };
  } catch {
    return null;
  }
}

type DraftDb = {
  companies: Company[];
  sources: Source[];
  contacts: Contact[];
  products: Product[];
};

/** Adds card drafts that were saved in the browser when the server disk cannot keep them. */
export function mergeCardDrafts(db: DraftDb, bundle: CardDraftBundle | null): void {
  if (!bundle) return;
  const companyIds = new Set(db.companies.map((company) => company.id));
  for (const company of bundle.companies) {
    if (!company?.id || companyIds.has(company.id)) continue;
    db.companies.push(company);
    companyIds.add(company.id);
  }
  const sourceIds = new Set(db.sources.map((source) => source.id));
  for (const source of bundle.sources) {
    if (!source?.id || sourceIds.has(source.id)) continue;
    if (source.company_id && !companyIds.has(source.company_id)) continue;
    db.sources.push(source);
    sourceIds.add(source.id);
  }
  const contactIds = new Set(db.contacts.map((contact) => contact.id));
  for (const contact of bundle.contacts) {
    if (!contact?.id || contactIds.has(contact.id)) continue;
    if (!companyIds.has(contact.company_id)) continue;
    db.contacts.push(contact);
    contactIds.add(contact.id);
  }
  const productIds = new Set(db.products.map((product) => product.id));
  for (const product of bundle.products) {
    if (!product?.id || productIds.has(product.id)) continue;
    if (!companyIds.has(product.company_id)) continue;
    db.products.push(product);
    productIds.add(product.id);
  }
}
