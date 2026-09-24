import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fillEmptyFields, findDuplicatePairs, normalizeWebsite, type CardExtraction } from "@/lib/domain";
import { isDirectoryWritable } from "@/lib/demo/filesystem";
import { hashPassword, verifyPassword } from "@/lib/demo/password";
import {
  CATEGORIES,
  DEMO_ADMIN_EMAIL,
  DEMO_ADMIN_PASSWORD,
  DEMO_SUBSCRIBER_EMAIL,
  DEMO_SUBSCRIBER_PASSWORD,
  SEED_COMPANIES,
} from "@/lib/seed";
import type {
  AdminCompany,
  Category,
  Certification,
  Company,
  CompanyDraft,
  Contact,
  DirectoryCompany,
  DirectoryFilters,
  Factory,
  Family,
  Product,
  ScrapeJob,
  SessionProfile,
  Source,
} from "@/lib/records";

type UserRow = SessionProfile & { passwordHash: string };

type Db = {
  users: UserRow[];
  companies: Company[];
  notes: Record<string, string>;
  categories: Category[];
  families: Family[];
  products: Product[];
  certifications: Certification[];
  factories: Factory[];
  contacts: Contact[];
  sources: Source[];
  jobs: ScrapeJob[];
  events: { id: string; name: string; granted: boolean; reason: string }[];
};

function seed(): Db {
  const now = new Date().toISOString();
  const categories: Category[] = CATEGORIES.map((item) => ({ ...item }));
  const bySlug = new Map(categories.map((item) => [item.slug, item.id]));
  const companies: Company[] = [];
  const families: Family[] = [];
  const certifications: Certification[] = [];
  const notes: Record<string, string> = {};
  for (const item of SEED_COMPANIES) {
    companies.push({
      id: item.id,
      name_zh: item.name_zh,
      name_en: item.name_en,
      brand: item.brand,
      company_type: item.company_type,
      address: item.address,
      city: item.city,
      province: item.province,
      country: item.country,
      website: item.website,
      wechat: item.wechat,
      phone: item.phone,
      email: item.email,
      export_markets: item.export_markets,
      is_published: item.is_published,
      merged_into_id: null,
      last_scrape_status: "never",
      last_scraped_at: null,
      created_at: now,
      updated_at: now,
      category_ids: item.categories.map((slug) => bySlug.get(slug)!).filter(Boolean),
    });
    notes[item.id] = item.notes;
    for (const family of item.families) {
      families.push({
        id: randomUUID(),
        company_id: item.id,
        category_id: family.category ? bySlug.get(family.category) ?? null : null,
        name: family.name,
        description: family.description,
      });
    }
    for (const code of item.certifications) {
      certifications.push({ id: randomUUID(), company_id: item.id, code });
    }
  }
  return {
    users: [
      {
        id: "d0000001-0000-4000-8000-000000000001",
        email: DEMO_SUBSCRIBER_EMAIL,
        passwordHash: hashPassword(DEMO_SUBSCRIBER_PASSWORD),
        role: "subscriber",
        subscriptionStatus: "none",
        currentPeriodEnd: null,
      },
      {
        id: "d0000001-0000-4000-8000-000000000002",
        email: DEMO_ADMIN_EMAIL,
        passwordHash: hashPassword(DEMO_ADMIN_PASSWORD),
        role: "admin",
        subscriptionStatus: "none",
        currentPeriodEnd: null,
      },
    ],
    companies,
    notes,
    categories,
    families,
    products: [],
    certifications,
    factories: [],
    contacts: [
      {
        id: randomUUID(),
        company_id: SEED_COMPANIES[0].id,
        name: "Li Wei",
        title: "Export manager",
        phone: "+86 13800002210",
        email: "li.wei@apexride.example",
        is_public: false,
      },
    ],
    sources: [],
    jobs: [],
    events: [],
  };
}

let chain: Promise<unknown> = Promise.resolve();

async function readDb(): Promise<Db> {
  try {
    const raw = await readFile(path.join(process.cwd(), "data", "demo-db.json"), "utf8");
    const parsed = JSON.parse(raw) as Db;
    parsed.products ??= [];
    return parsed;
  } catch {
    const initial = seed();
    await writeDb(initial);
    return initial;
  }
}

async function writeDb(db: Db): Promise<void> {
  if (!(await isDirectoryWritable(process.cwd()))) {
    throw Object.assign(new Error("Demo database is not writable."), { code: "EROFS" });
  }
  const dir = path.join(process.cwd(), "data");
  const file = path.join(dir, "demo-db.json");
  await mkdir(dir, { recursive: true });
  await writeFile(file, JSON.stringify(db));
}

function update<T>(fn: (db: Db) => Promise<T> | T): Promise<T> {
  const run = chain.then(async () => {
    const db = await readDb();
    const result = await fn(db);
    await writeDb(db);
    return result;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function matches(company: Company, categories: Category[], filters: DirectoryFilters): boolean {
  if (!company.is_published || company.merged_into_id) return false;
  if (filters.companyType && company.company_type !== filters.companyType) return false;
  if (filters.province && (company.province ?? "").toLowerCase() !== filters.province.toLowerCase()) return false;
  if (filters.city && (company.city ?? "").toLowerCase() !== filters.city.toLowerCase()) return false;
  if (filters.hasEmail && !company.email) return false;
  if (filters.hasWebsite && !company.website) return false;
  if (filters.category) {
    const category = categories.find((item) => item.slug === filters.category);
    if (!category || !company.category_ids.includes(category.id)) return false;
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    const hay = [company.name_en, company.name_zh, company.brand, company.city].filter(Boolean).join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function publicUser(user: UserRow): SessionProfile {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    subscriptionStatus: user.subscriptionStatus,
    currentPeriodEnd: user.currentPeriodEnd,
  };
}

function profileOf(company: Company, db: Db, publicContacts: boolean): DirectoryCompany {
  return {
    ...company,
    families: db.families.filter((item) => item.company_id === company.id),
    products: db.products.filter((item) => item.company_id === company.id),
    certifications: db.certifications.filter((item) => item.company_id === company.id),
    factories: db.factories.filter((item) => item.company_id === company.id),
    contacts: db.contacts.filter((item) => item.company_id === company.id && (!publicContacts || item.is_public)),
  };
}

export const demoStore = {
  async listCategories(): Promise<Category[]> {
    const db = await readDb();
    return db.categories;
  },
  async search(filters: DirectoryFilters): Promise<DirectoryCompany[]> {
    const db = await readDb();
    return db.companies
      .filter((company) => matches(company, db.categories, filters))
      .sort((a, b) => (a.name_en ?? "").localeCompare(b.name_en ?? ""))
      .map((company) => profileOf(company, db, true));
  },
  async getPublished(id: string): Promise<DirectoryCompany | null> {
    const db = await readDb();
    const company = db.companies.find((item) => item.id === id && item.is_published && !item.merged_into_id);
    return company ? profileOf(company, db, true) : null;
  },
  async adminList(status: "all" | "draft" | "published"): Promise<Company[]> {
    const db = await readDb();
    return db.companies
      .filter((company) => !company.merged_into_id)
      .filter((company) => (status === "all" ? true : status === "published" ? company.is_published : !company.is_published))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },
  async adminGet(id: string): Promise<AdminCompany | null> {
    const db = await readDb();
    const company = db.companies.find((item) => item.id === id);
    if (!company) return null;
    return {
      ...profileOf(company, db, false),
      notes: db.notes[id] ?? null,
      sources: db.sources.filter((item) => item.company_id === id),
      scrape_jobs: db.jobs.filter((item) => item.company_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    };
  },
  async counts() {
    const db = await readDb();
    const live = db.companies.filter((company) => !company.merged_into_id);
    return {
      companies: live.length,
      published: live.filter((company) => company.is_published).length,
      drafts: live.filter((company) => !company.is_published).length,
      categories: db.categories.length,
    };
  },
  createCompany(draft: CompanyDraft) {
    return update((db) => {
      const now = new Date().toISOString();
      const company: Company = {
        id: randomUUID(),
        name_zh: draft.name_zh ?? null,
        name_en: draft.name_en ?? null,
        brand: draft.brand ?? null,
        company_type: draft.company_type ?? "unknown",
        address: draft.address ?? null,
        city: draft.city ?? null,
        province: draft.province ?? null,
        country: draft.country ?? "CN",
        website: draft.website ? normalizeWebsite(draft.website) : null,
        wechat: draft.wechat ?? null,
        phone: draft.phone ?? null,
        email: draft.email ?? null,
        export_markets: draft.export_markets ?? [],
        is_published: false,
        merged_into_id: null,
        last_scrape_status: "never",
        last_scraped_at: null,
        created_at: now,
        updated_at: now,
        category_ids: draft.category_ids ?? [],
      };
      db.companies.push(company);
      if (draft.notes) db.notes[company.id] = draft.notes;
      return company;
    });
  },
  updateCompany(id: string, draft: CompanyDraft) {
    return update((db) => {
      const company = db.companies.find((item) => item.id === id);
      if (!company) return null;
      Object.assign(company, {
        name_zh: draft.name_zh ?? null,
        name_en: draft.name_en ?? null,
        brand: draft.brand ?? null,
        company_type: draft.company_type ?? company.company_type,
        address: draft.address ?? null,
        city: draft.city ?? null,
        province: draft.province ?? null,
        country: draft.country || "CN",
        website: draft.website ? normalizeWebsite(draft.website) : null,
        wechat: draft.wechat ?? null,
        phone: draft.phone ?? null,
        email: draft.email ?? null,
        export_markets: draft.export_markets ?? [],
        category_ids: draft.category_ids ?? company.category_ids,
        updated_at: new Date().toISOString(),
      });
      db.notes[id] = draft.notes ?? "";
      return company;
    });
  },
  setPublished(id: string, isPublished: boolean) {
    return update((db) => {
      const company = db.companies.find((item) => item.id === id);
      if (!company) return null;
      company.is_published = isPublished;
      company.updated_at = new Date().toISOString();
      return company;
    });
  },
  addCategory(input: { slug: string; name_en: string; name_zh: string | null }) {
    return update((db) => {
      if (db.categories.some((item) => item.slug === input.slug)) throw new Error("That slug already exists.");
      const category: Category = { id: randomUUID(), ...input };
      db.categories.push(category);
      return category;
    });
  },
  addFamily(companyId: string, input: { name: string; description: string | null; category_id: string | null }) {
    return update((db) => {
      const family: Family = { id: randomUUID(), company_id: companyId, ...input };
      db.families.push(family);
      return family;
    });
  },
  deleteFamily(id: string) {
    return update((db) => {
      db.families = db.families.filter((item) => item.id !== id);
    });
  },
  addCert(companyId: string, code: string) {
    return update((db) => {
      db.certifications.push({ id: randomUUID(), company_id: companyId, code });
    });
  },
  deleteCert(id: string) {
    return update((db) => {
      db.certifications = db.certifications.filter((item) => item.id !== id);
    });
  },
  addFactory(companyId: string, input: { name: string; address: string | null; city: string | null }) {
    return update((db) => {
      db.factories.push({ id: randomUUID(), company_id: companyId, ...input });
    });
  },
  deleteFactory(id: string) {
    return update((db) => {
      db.factories = db.factories.filter((item) => item.id !== id);
    });
  },
  addContact(companyId: string, input: Omit<Contact, "id" | "company_id">) {
    return update((db) => {
      db.contacts.push({ id: randomUUID(), company_id: companyId, ...input });
    });
  },
  setContactPublic(id: string, isPublic: boolean) {
    return update((db) => {
      const contact = db.contacts.find((item) => item.id === id);
      if (contact) contact.is_public = isPublic;
    });
  },
  deleteContact(id: string) {
    return update((db) => {
      db.contacts = db.contacts.filter((item) => item.id !== id);
    });
  },
  addSource(input: Omit<Source, "id" | "captured_at">) {
    return update((db) => {
      const source: Source = { ...input, id: randomUUID(), captured_at: new Date().toISOString() };
      db.sources.push(source);
      return source;
    });
  },
  saveScrapeJob(input: Omit<ScrapeJob, "id" | "created_at">) {
    return update((db) => {
      const job: ScrapeJob = { ...input, id: randomUUID(), created_at: new Date().toISOString() };
      db.jobs.push(job);
      const company = db.companies.find((item) => item.id === input.company_id);
      if (company) {
        company.last_scrape_status = input.status === "failed" ? "failed" : input.status === "skipped" ? "skipped" : "succeeded";
        company.last_scraped_at = new Date().toISOString();
      }
      return job;
    });
  },
  applyScrape(jobId: string) {
    return update((db) => {
      const job = db.jobs.find((item) => item.id === jobId);
      if (!job?.proposed_patch) return null;
      const company = db.companies.find((item) => item.id === job.company_id);
      if (!company) return null;
      const patch = job.proposed_patch as {
        phone?: string | null;
        email?: string | null;
        wechat?: string | null;
        address?: string | null;
        city?: string | null;
        province?: string | null;
        export_markets?: string[];
        company_type?: Company["company_type"];
        families?: { name: string; description: string }[];
        certifications?: string[];
        factories?: { name: string; address: string | null; city: string | null }[];
        category_slugs?: string[];
      };
      const filled = fillEmptyFields(company, patch, false);
      Object.assign(company, filled, { updated_at: new Date().toISOString() });
      for (const slug of patch.category_slugs ?? []) {
        const category = db.categories.find((item) => item.slug === slug);
        if (category && !company.category_ids.includes(category.id)) company.category_ids.push(category.id);
      }
      for (const family of patch.families ?? []) {
        if (db.families.some((item) => item.company_id === company.id && item.name.toLowerCase() === family.name.toLowerCase())) continue;
        db.families.push({
          id: randomUUID(),
          company_id: company.id,
          category_id: null,
          name: family.name,
          description: family.description,
        });
      }
      for (const code of patch.certifications ?? []) {
        if (!db.certifications.some((item) => item.company_id === company.id && item.code.toLowerCase() === code.toLowerCase())) {
          db.certifications.push({ id: randomUUID(), company_id: company.id, code });
        }
      }
      for (const factory of patch.factories ?? []) {
        db.factories.push({ id: randomUUID(), company_id: company.id, ...factory });
      }
      job.status = "applied";
      return company;
    });
  },
  duplicates() {
    return readDb().then((db) => {
      const pairs = findDuplicatePairs(db.companies);
      return pairs.map((pair) => ({
        ...pair,
        left: db.companies.find((item) => item.id === pair.a)!,
        right: db.companies.find((item) => item.id === pair.b)!,
      }));
    });
  },
  merge(primaryId: string, duplicateId: string) {
    return update((db) => {
      const primary = db.companies.find((item) => item.id === primaryId);
      const duplicate = db.companies.find((item) => item.id === duplicateId);
      if (!primary || !duplicate || primaryId === duplicateId) return null;
      const filled = fillEmptyFields(primary, duplicate, false);
      Object.assign(primary, filled);
      for (const id of duplicate.category_ids) {
        if (!primary.category_ids.includes(id)) primary.category_ids.push(id);
      }
      for (const family of db.families.filter((item) => item.company_id === duplicateId)) {
        if (!db.families.some((item) => item.company_id === primaryId && item.name.toLowerCase() === family.name.toLowerCase())) {
          family.company_id = primaryId;
        }
      }
      for (const product of db.products.filter((item) => item.company_id === duplicateId)) {
        if (!db.products.some((item) => item.company_id === primaryId && item.name.toLowerCase() === product.name.toLowerCase())) {
          product.company_id = primaryId;
        }
      }
      for (const row of [...db.certifications, ...db.factories, ...db.contacts, ...db.sources]) {
        if (row.company_id === duplicateId) row.company_id = primaryId;
      }
      duplicate.is_published = false;
      duplicate.merged_into_id = primaryId;
      duplicate.updated_at = new Date().toISOString();
      primary.updated_at = duplicate.updated_at;
      db.notes[primaryId] = [db.notes[primaryId], `Merged ${duplicateId}.`].filter(Boolean).join("\n");
      return primary;
    });
  },
  async authenticate(email: string, password: string): Promise<SessionProfile | null> {
    const db = await readDb();
    const user = db.users.find((item) => item.email.toLowerCase() === email.toLowerCase());
    if (!user || !verifyPassword(password, user.passwordHash)) return null;
    return publicUser(user);
  },
  register(email: string, password: string) {
    return update((db) => {
      if (db.users.some((item) => item.email.toLowerCase() === email.toLowerCase())) {
        throw new Error("An account with that email already exists.");
      }
      const user: UserRow = {
        id: randomUUID(),
        email,
        passwordHash: hashPassword(password),
        role: "subscriber",
        subscriptionStatus: "none",
        currentPeriodEnd: null,
      };
      db.users.push(user);
      return publicUser(user);
    });
  },
  async getUser(id: string): Promise<SessionProfile | null> {
    const db = await readDb();
    const user = db.users.find((item) => item.id === id);
    if (!user) return null;
    return publicUser(user);
  },
  grantAccess(userId: string, periodEnd: string) {
    return update((db) => {
      const user = db.users.find((item) => item.id === userId);
      if (!user) return null;
      user.subscriptionStatus = "active";
      user.currentPeriodEnd = periodEnd;
      return user;
    });
  },
  cancelAccess(userId: string) {
    return update((db) => {
      const user = db.users.find((item) => item.id === userId);
      if (!user) return;
      user.subscriptionStatus = "canceled";
      user.currentPeriodEnd = new Date().toISOString();
    });
  },
  async currentPeriodEnd(userId: string) {
    const user = await this.getUser(userId);
    return user?.currentPeriodEnd ?? null;
  },
  claimEvent(id: string, name: string) {
    return update((db) => {
      if (db.events.some((event) => event.id === id)) return "duplicate" as const;
      db.events.push({ id, name, granted: false, reason: "pending" });
      return "new" as const;
    });
  },
  finishEvent(id: string, granted: boolean, reason: string) {
    return update((db) => {
      const event = db.events.find((item) => item.id === id);
      if (event) {
        event.granted = granted;
        event.reason = reason;
      }
    });
  },
  createFromCard(extraction: CardExtraction, source: { url_or_ref: string | null; raw_text: string; payload: Record<string, unknown> }) {
    return update((db) => {
      const now = new Date().toISOString();
      const company: Company = {
        id: randomUUID(),
        name_zh: extraction.name_zh,
        name_en: extraction.name_en,
        brand: extraction.brand,
        company_type: extraction.company_type,
        address: extraction.address,
        city: extraction.city,
        province: extraction.province,
        country: "CN",
        website: extraction.website,
        wechat: extraction.wechat,
        phone: extraction.phone,
        email: extraction.email,
        export_markets: extraction.export_markets,
        is_published: false,
        merged_into_id: null,
        last_scrape_status: "never",
        last_scraped_at: null,
        created_at: now,
        updated_at: now,
        category_ids: [],
      };
      db.companies.push(company);
      if (extraction.contact) {
        db.contacts.push({
          id: randomUUID(),
          company_id: company.id,
          name: extraction.contact.name,
          title: extraction.contact.title,
          phone: extraction.contact.phone,
          email: extraction.contact.email,
          is_public: false,
        });
      }
      db.sources.push({
        id: randomUUID(),
        company_id: company.id,
        source_type: "card",
        url_or_ref: source.url_or_ref,
        raw_text: source.raw_text,
        payload: source.payload,
        captured_at: now,
      });
      return company;
    });
  },
  addProducts(
    companyId: string,
    products: Omit<Product, "id" | "company_id" | "created_at">[],
    status: "succeeded" | "failed" | "skipped",
  ) {
    return update((db) => {
      const company = db.companies.find((item) => item.id === companyId);
      if (!company) return [];
      const now = new Date().toISOString();
      const saved: Product[] = [];
      for (const item of products) {
        if (db.products.some((product) => product.company_id === companyId && product.name.toLowerCase() === item.name.toLowerCase())) {
          continue;
        }
        const product: Product = { id: randomUUID(), company_id: companyId, created_at: now, ...item };
        db.products.push(product);
        saved.push(product);
        if (item.category_id && !company.category_ids.includes(item.category_id)) company.category_ids.push(item.category_id);
      }
      company.last_scrape_status = status;
      company.last_scraped_at = now;
      company.updated_at = now;
      return saved;
    });
  },
};
