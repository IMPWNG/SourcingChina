import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fillEmptyFields, findDuplicatePairs, normalizeWebsite, type CardExtraction } from "@/lib/domain";
import type { CompanyDraft, Company, DirectoryFilters, Product } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const COMPANY_COLUMNS =
  "id, name_zh, name_en, brand, company_type, address, city, province, country, website, wechat, phone, email, export_markets, is_published, merged_into_id, last_scrape_status, last_scraped_at, created_at, updated_at";

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

type Row = Record<string, unknown>;

function asCompany(row: Row, categoryIds: string[] = []): Company {
  return {
    id: String(row.id),
    name_zh: (row.name_zh as string | null) ?? null,
    name_en: (row.name_en as string | null) ?? null,
    brand: (row.brand as string | null) ?? null,
    company_type: row.company_type as Company["company_type"],
    address: (row.address as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    province: (row.province as string | null) ?? null,
    country: String(row.country ?? "CN"),
    website: (row.website as string | null) ?? null,
    wechat: (row.wechat as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    export_markets: Array.isArray(row.export_markets) ? (row.export_markets as string[]) : [],
    is_published: Boolean(row.is_published),
    merged_into_id: (row.merged_into_id as string | null) ?? null,
    last_scrape_status: String(row.last_scrape_status ?? "never"),
    last_scraped_at: (row.last_scraped_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    category_ids: categoryIds,
  };
}

async function categoryMap(supabase: SupabaseClient, companyIds: string[]) {
  const map = new Map<string, string[]>();
  if (!companyIds.length) return map;
  const { data, error } = await supabase.from("company_categories").select("company_id, category_id").in("company_id", companyIds);
  fail(error);
  for (const row of data ?? []) {
    const list = map.get(row.company_id) ?? [];
    list.push(row.category_id);
    map.set(row.company_id, list);
  }
  return map;
}

function searchable(company: Company, slugById: Map<string, string>, filters: DirectoryFilters): boolean {
  if (filters.companyType && company.company_type !== filters.companyType) return false;
  if (filters.province && (company.province ?? "").toLowerCase() !== filters.province.toLowerCase()) return false;
  if (filters.city && (company.city ?? "").toLowerCase() !== filters.city.toLowerCase()) return false;
  if (filters.hasEmail && !company.email) return false;
  if (filters.hasWebsite && !company.website) return false;
  if (filters.category && !company.category_ids.some((id) => slugById.get(id) === filters.category)) return false;
  if (filters.q) {
    const hay = [company.name_en, company.name_zh, company.brand, company.city].filter(Boolean).join(" ").toLowerCase();
    if (!hay.includes(filters.q.toLowerCase())) return false;
  }
  return true;
}

function asProduct(row: Row): Product {
  const raw = row.details;
  const details: Record<string, string> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === "string") details[key] = value;
    }
  }
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    category_id: row.category_id ? String(row.category_id) : null,
    name: String(row.name ?? ""),
    description: row.description ? String(row.description) : null,
    image_url: row.image_url ? String(row.image_url) : null,
    source_url: row.source_url ? String(row.source_url) : null,
    details,
    created_at: String(row.created_at ?? ""),
  };
}

async function relations(supabase: SupabaseClient, companyId: string, publicContacts: boolean) {
  const [families, products, certifications, factories, contacts] = await Promise.all([
    supabase.from("product_families").select("*").eq("company_id", companyId),
    supabase.from("products").select("*").eq("company_id", companyId).order("created_at"),
    supabase.from("certifications").select("*").eq("company_id", companyId),
    supabase.from("factories").select("*").eq("company_id", companyId),
    supabase
      .from("contacts")
      .select("*")
      .eq("company_id", companyId)
      .match(publicContacts ? { is_public: true } : {}),
  ]);
  fail(families.error);
  fail(products.error);
  fail(certifications.error);
  fail(factories.error);
  fail(contacts.error);
  return {
    families: families.data ?? [],
    products: ((products.data ?? []) as Row[]).map(asProduct),
    certifications: certifications.data ?? [],
    factories: factories.data ?? [],
    contacts: contacts.data ?? [],
  };
}

function columnPatch(draft: CompanyDraft) {
  return {
    name_zh: draft.name_zh ?? null,
    name_en: draft.name_en ?? null,
    brand: draft.brand ?? null,
    company_type: draft.company_type ?? "unknown",
    address: draft.address ?? null,
    city: draft.city ?? null,
    province: draft.province ?? null,
    country: draft.country || "CN",
    website: draft.website ? normalizeWebsite(draft.website) : null,
    wechat: draft.wechat ?? null,
    phone: draft.phone ?? null,
    email: draft.email ?? null,
    export_markets: draft.export_markets ?? [],
  };
}

async function replaceCategories(supabase: SupabaseClient, companyId: string, categoryIds: string[]) {
  const deleted = await supabase.from("company_categories").delete().eq("company_id", companyId);
  fail(deleted.error);
  if (!categoryIds.length) return;
  const inserted = await supabase.from("company_categories").insert(categoryIds.map((category_id) => ({ company_id: companyId, category_id })));
  fail(inserted.error);
}

export const supabaseStore = {
  async listCategories() {
    const supabase = await createClient();
    const { data, error } = await supabase.from("product_categories").select("*").order("name_en");
    fail(error);
    return data ?? [];
  },
  async search(filters: DirectoryFilters) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("companies")
      .select(COMPANY_COLUMNS)
      .eq("is_published", true)
      .is("merged_into_id", null)
      .order("name_en");
    fail(error);
    const rows = (data ?? []) as Row[];
    const ids = rows.map((row) => String(row.id));
    const cats = await categoryMap(supabase, ids);
    const categories = await this.listCategories();
    const slugById = new Map(categories.map((item) => [item.id, item.slug]));
    const companies = rows
      .map((row) => asCompany(row, cats.get(String(row.id)) ?? []))
      .filter((company) => searchable(company, slugById, filters));
    return Promise.all(
      companies.map(async (company) => ({
        ...company,
        ...(await relations(supabase, company.id, true)),
      })),
    );
  },
  async getPublished(id: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("companies")
      .select(COMPANY_COLUMNS)
      .eq("id", id)
      .eq("is_published", true)
      .is("merged_into_id", null)
      .maybeSingle();
    fail(error);
    if (!data) return null;
    const cats = await categoryMap(supabase, [id]);
    return { ...asCompany(data as Row, cats.get(id) ?? []), ...(await relations(supabase, id, true)) };
  },
  async adminList(status: "all" | "draft" | "published") {
    const supabase = await createClient();
    let query = supabase.from("companies").select(COMPANY_COLUMNS).is("merged_into_id", null).order("updated_at", { ascending: false });
    if (status === "published") query = query.eq("is_published", true);
    if (status === "draft") query = query.eq("is_published", false);
    const { data, error } = await query;
    fail(error);
    const rows = (data ?? []) as Row[];
    const cats = await categoryMap(supabase, rows.map((row) => String(row.id)));
    return rows.map((row) => asCompany(row, cats.get(String(row.id)) ?? []));
  },
  async adminGet(id: string) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("companies").select(COMPANY_COLUMNS).eq("id", id).maybeSingle();
    fail(error);
    if (!data) return null;
    const cats = await categoryMap(supabase, [id]);
    const [related, sources, jobs, notes] = await Promise.all([
      relations(supabase, id, false),
      supabase.from("sources").select("*").eq("company_id", id).order("captured_at", { ascending: false }),
      supabase.from("scrape_jobs").select("*").eq("company_id", id).order("created_at", { ascending: false }),
      supabase.rpc("company_notes", { company: id }),
    ]);
    fail(sources.error);
    fail(jobs.error);
    fail(notes.error);
    return {
      ...asCompany(data as Row, cats.get(id) ?? []),
      ...related,
      notes: (notes.data as string | null) ?? null,
      sources: sources.data ?? [],
      scrape_jobs: jobs.data ?? [],
    };
  },
  async counts() {
    const rows = await this.adminList("all");
    const categories = await this.listCategories();
    return {
      companies: rows.length,
      published: rows.filter((row) => row.is_published).length,
      drafts: rows.filter((row) => !row.is_published).length,
      categories: categories.length,
    };
  },
  async createCompany(draft: CompanyDraft) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("companies").insert(columnPatch(draft)).select(COMPANY_COLUMNS).single();
    fail(error);
    const company = asCompany(data as Row, draft.category_ids ?? []);
    if (draft.category_ids?.length) await replaceCategories(supabase, company.id, draft.category_ids);
    if (draft.notes) {
      const notes = await supabase.rpc("set_company_notes", { company: company.id, body: draft.notes });
      fail(notes.error);
    }
    return company;
  },
  async updateCompany(id: string, draft: CompanyDraft) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("companies").update(columnPatch(draft)).eq("id", id).select(COMPANY_COLUMNS).maybeSingle();
    fail(error);
    if (!data) return null;
    if (draft.category_ids) await replaceCategories(supabase, id, draft.category_ids);
    const notes = await supabase.rpc("set_company_notes", { company: id, body: draft.notes ?? "" });
    fail(notes.error);
    return asCompany(data as Row, draft.category_ids ?? []);
  },
  async deleteCompany(id: string) {
    const supabase = await createClient();
    const detached = await supabase.from("companies").update({ merged_into_id: null }).eq("merged_into_id", id);
    fail(detached.error);
    const { data, error } = await supabase.from("companies").delete().eq("id", id).select("id").maybeSingle();
    fail(error);
    if (!data) throw new Error("The company could not be deleted.");
  },
  async setPublished(id: string, isPublished: boolean) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("companies").update({ is_published: isPublished }).eq("id", id).select("id").maybeSingle();
    fail(error);
    return data;
  },
  async addCategory(input: { slug: string; name_en: string; name_zh: string | null }) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("product_categories").insert(input).select("*").single();
    fail(error);
    return data;
  },
  async addFamily(companyId: string, input: { name: string; description: string | null; category_id: string | null }) {
    const supabase = await createClient();
    const { error } = await supabase.from("product_families").insert({ company_id: companyId, ...input });
    fail(error);
  },
  async deleteFamily(id: string) {
    const supabase = await createClient();
    fail((await supabase.from("product_families").delete().eq("id", id)).error);
  },
  async addCert(companyId: string, code: string) {
    const supabase = await createClient();
    fail((await supabase.from("certifications").insert({ company_id: companyId, code })).error);
  },
  async deleteCert(id: string) {
    const supabase = await createClient();
    fail((await supabase.from("certifications").delete().eq("id", id)).error);
  },
  async addFactory(companyId: string, input: { name: string; address: string | null; city: string | null }) {
    const supabase = await createClient();
    fail((await supabase.from("factories").insert({ company_id: companyId, ...input })).error);
  },
  async deleteFactory(id: string) {
    const supabase = await createClient();
    fail((await supabase.from("factories").delete().eq("id", id)).error);
  },
  async addContact(companyId: string, input: { name: string; title: string | null; phone: string | null; email: string | null; is_public: boolean }) {
    const supabase = await createClient();
    fail((await supabase.from("contacts").insert({ company_id: companyId, ...input })).error);
  },
  async setContactPublic(id: string, isPublic: boolean) {
    const supabase = await createClient();
    fail((await supabase.from("contacts").update({ is_public: isPublic }).eq("id", id)).error);
  },
  async deleteContact(id: string) {
    const supabase = await createClient();
    fail((await supabase.from("contacts").delete().eq("id", id)).error);
  },
  async addSource(input: { company_id: string | null; source_type: "card" | "website" | "pdf"; url_or_ref: string | null; raw_text: string | null; payload: Record<string, unknown> }) {
    const supabase = await createClient();
    const { error } = await supabase.from("sources").insert(input);
    fail(error);
  },
  async saveScrapeJob(input: { company_id: string; status: "proposed" | "applied" | "failed" | "skipped"; proposed_patch: Record<string, unknown> | null; error: string | null }) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("scrape_jobs").insert(input).select("id").single();
    fail(error);
    const status = input.status === "failed" ? "failed" : input.status === "skipped" ? "skipped" : "succeeded";
    fail((await supabase.from("companies").update({ last_scrape_status: status, last_scraped_at: new Date().toISOString() }).eq("id", input.company_id)).error);
    return data;
  },
  async applyScrape(jobId: string) {
    const supabase = await createClient();
    const { data: job, error } = await supabase.from("scrape_jobs").select("*").eq("id", jobId).maybeSingle();
    fail(error);
    if (!job?.proposed_patch) return null;
    const company = await this.adminGet(job.company_id);
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
      contacts?: { name: string; title: string | null; phone: string | null; email: string | null }[];
      category_slugs?: string[];
    };
    const filled = fillEmptyFields(company, patch, false);
    if (Object.keys(filled).length) {
      fail((await supabase.from("companies").update(filled).eq("id", company.id)).error);
    }
    const categories = await this.listCategories();
    const extra = (patch.category_slugs ?? [])
      .map((slug) => categories.find((item) => item.slug === slug)?.id)
      .filter((id): id is string => Boolean(id));
    if (extra.length) await replaceCategories(supabase, company.id, Array.from(new Set([...company.category_ids, ...extra])));
    for (const family of patch.families ?? []) {
      if (company.families.some((item) => item.name.toLowerCase() === family.name.toLowerCase())) continue;
      await this.addFamily(company.id, { name: family.name, description: family.description, category_id: null });
    }
    for (const code of patch.certifications ?? []) {
      if (!company.certifications.some((item) => item.code.toLowerCase() === code.toLowerCase())) await this.addCert(company.id, code);
    }
    for (const factory of patch.factories ?? []) await this.addFactory(company.id, factory);
    for (const contact of patch.contacts ?? []) {
      if (company.contacts.some((item) => item.phone === contact.phone && item.email === contact.email)) continue;
      await this.addContact(company.id, { ...contact, is_public: false });
    }
    fail((await supabase.from("scrape_jobs").update({ status: "applied" }).eq("id", jobId)).error);
    return company;
  },
  async duplicates() {
    const companies = await this.adminList("all");
    return findDuplicatePairs(companies).map((pair) => ({
      ...pair,
      left: companies.find((item) => item.id === pair.a)!,
      right: companies.find((item) => item.id === pair.b)!,
    }));
  },
  async merge(primaryId: string, duplicateId: string) {
    const supabase = await createClient();
    const primary = await this.adminGet(primaryId);
    const duplicate = await this.adminGet(duplicateId);
    if (!primary || !duplicate || primaryId === duplicateId) return null;
    const filled = fillEmptyFields(primary, duplicate, false);
    if (Object.keys(filled).length) fail((await supabase.from("companies").update(filled).eq("id", primaryId)).error);
    const categoryIds = Array.from(new Set([...primary.category_ids, ...duplicate.category_ids]));
    await replaceCategories(supabase, primaryId, categoryIds);
    for (const table of ["product_families", "products", "certifications", "factories", "contacts", "sources", "scrape_jobs"] as const) {
      fail((await supabase.from(table).update({ company_id: primaryId }).eq("company_id", duplicateId)).error);
    }
    fail(
      (
        await supabase
          .from("companies")
          .update({ is_published: false, merged_into_id: primaryId })
          .eq("id", duplicateId)
      ).error,
    );
    const notes = await supabase.rpc("set_company_notes", {
      company: primaryId,
      body: [primary.notes, `Merged ${duplicateId}.`].filter(Boolean).join("\n"),
    });
    fail(notes.error);
    return primary;
  },
  async createFromCard(extraction: CardExtraction, source: { url_or_ref: string | null; raw_text: string; payload: Record<string, unknown> }) {
    const company = await this.createCompany({
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
    });
    if (extraction.contact) {
      await this.addContact(company.id, {
        name: extraction.contact.name,
        title: extraction.contact.title,
        phone: extraction.contact.phone,
        email: extraction.contact.email,
        is_public: false,
      });
    }
    await this.addSource({
      company_id: company.id,
      source_type: "card",
      url_or_ref: source.url_or_ref,
      raw_text: source.raw_text,
      payload: source.payload,
    });
    return company;
  },
  async addProducts(
    companyId: string,
    products: Omit<Product, "id" | "company_id" | "created_at">[],
    status: "succeeded" | "failed" | "skipped",
  ) {
    const supabase = await createClient();
    const saved: Product[] = [];
    if (products.length) {
      const rows = products.map((item) => ({
        id: randomUUID(),
        company_id: companyId,
        category_id: item.category_id,
        name: item.name,
        description: item.description,
        image_url: item.image_url,
        source_url: item.source_url,
        details: item.details,
      }));
      const inserted = await supabase.from("products").insert(rows).select("*");
      fail(inserted.error);
      saved.push(...((inserted.data ?? []) as Row[]).map(asProduct));
      const { data: links, error: linkError } = await supabase.from("company_categories").select("category_id").eq("company_id", companyId);
      fail(linkError);
      const categoryIds = Array.from(
        new Set([
          ...((links ?? []) as { category_id: string }[]).map((link) => link.category_id),
          ...products.map((item) => item.category_id).filter((id): id is string => Boolean(id)),
        ]),
      );
      if (categoryIds.length) await replaceCategories(supabase, companyId, categoryIds);
    }
    fail(
      (
        await supabase
          .from("companies")
          .update({ last_scrape_status: status, last_scraped_at: new Date().toISOString() })
          .eq("id", companyId)
      ).error,
    );
    return saved;
  },
  async uploadCard(path: string, bytes: Buffer, contentType: string) {
    const supabase = await createClient();
    const { error } = await supabase.storage.from("card-images").upload(path, bytes, { contentType, upsert: false });
    fail(error);
    return path;
  },
};

export function billingPort() {
  const service = createServiceClient();
  if (!service) return null;
  return {
    async claimEvent(id: string, name: string) {
      const { error } = await service.from("billing_events").insert({ id, name, granted: false, reason: "pending" });
      if (error?.code === "23505") return "duplicate" as const;
      fail(error);
      return "new" as const;
    },
    async finishEvent(id: string, granted: boolean, reason: string) {
      fail((await service.from("billing_events").update({ granted, reason }).eq("id", id)).error);
    },
    async currentPeriodEnd(userId: string) {
      const { data, error } = await service.from("profiles").select("current_period_end").eq("id", userId).maybeSingle();
      fail(error);
      return (data?.current_period_end as string | null) ?? null;
    },
    async grantAccess(input: { userId: string; intentId: string | null; amount: number; currency: string; periodEnd: string }) {
      fail(
        (
          await service.from("subscriptions").insert({
            id: randomUUID(),
            user_id: input.userId,
            provider: "airwallex",
            provider_payment_intent_id: input.intentId,
            status: "active",
            amount: input.amount,
            currency: input.currency,
            current_period_end: input.periodEnd,
          })
        ).error,
      );
      fail(
        (
          await service
            .from("profiles")
            .update({ subscription_status: "active", current_period_end: input.periodEnd })
            .eq("id", input.userId)
        ).error,
      );
    },
    async cancelAccess(userId: string) {
      const end = new Date().toISOString();
      fail((await service.from("profiles").update({ subscription_status: "canceled", current_period_end: end }).eq("id", userId)).error);
      fail((await service.from("subscriptions").update({ status: "canceled", current_period_end: end }).eq("user_id", userId).eq("status", "active")).error);
    },
  };
}
