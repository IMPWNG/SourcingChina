"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { extractCard, fillEmptyFields, normalizeWebsite } from "@/lib/domain";
import { crawlWebsite } from "@/lib/enrichment/crawl";
import { isDemoMode } from "@/lib/env";
import { logInfo } from "@/lib/log";
import { recognizeImage } from "@/lib/ocr";
import { extractCardWithScrapeGraph } from "@/lib/scrapegraph/extract";
import { directory } from "@/lib/store";
import { supabaseStore } from "@/lib/supabase/store";
import {
  IMAGE_MIME_TYPES,
  categorySchema,
  certSchema,
  companySchema,
  contactSchema,
  emptyToNull,
  factorySchema,
  familySchema,
  parseMarkets,
} from "@/lib/validation";

function draftFromForm(formData: FormData) {
  const parsed = companySchema.safeParse({
    name_zh: formData.get("name_zh") ?? "",
    name_en: formData.get("name_en") ?? "",
    brand: formData.get("brand") ?? "",
    company_type: formData.get("company_type") || "unknown",
    address: formData.get("address") ?? "",
    city: formData.get("city") ?? "",
    province: formData.get("province") ?? "",
    country: formData.get("country") || "CN",
    website: formData.get("website") ?? "",
    wechat: formData.get("wechat") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    export_markets: formData.get("export_markets") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) throw new Error("Check the company fields and try again.");
  const category_ids = formData
    .getAll("category_id")
    .map(String)
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  return {
    name_zh: emptyToNull(parsed.data.name_zh),
    name_en: emptyToNull(parsed.data.name_en),
    brand: emptyToNull(parsed.data.brand),
    company_type: parsed.data.company_type,
    address: emptyToNull(parsed.data.address),
    city: emptyToNull(parsed.data.city),
    province: emptyToNull(parsed.data.province),
    country: parsed.data.country || "CN",
    website: emptyToNull(parsed.data.website),
    wechat: emptyToNull(parsed.data.wechat),
    phone: emptyToNull(parsed.data.phone),
    email: emptyToNull(parsed.data.email),
    export_markets: parseMarkets(parsed.data.export_markets),
    notes: parsed.data.notes,
    category_ids,
  };
}

export async function createCompany(formData: FormData) {
  await requireAdmin();
  const company = await directory.createCompany(draftFromForm(formData));
  revalidatePath("/admin/companies");
  redirect(`/admin/companies/${company.id}`);
}

export async function updateCompany(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await directory.updateCompany(id, draftFromForm(formData));
  revalidatePath(`/admin/companies/${id}`);
  revalidatePath("/directory");
  redirect(`/admin/companies/${id}?saved=1`);
}

export async function setPublished(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await directory.setPublished(id, formData.get("published") === "true");
  revalidatePath("/directory");
  revalidatePath(`/admin/companies/${id}`);
  redirect(`/admin/companies/${id}`);
}

export async function addCategory(formData: FormData) {
  await requireAdmin();
  const parsed = categorySchema.safeParse({
    slug: formData.get("slug"),
    name_en: formData.get("name_en"),
    name_zh: formData.get("name_zh") ?? "",
  });
  if (!parsed.success) redirect("/admin/taxonomy?error=1");
  await directory.addCategory({
    slug: parsed.data.slug,
    name_en: parsed.data.name_en,
    name_zh: emptyToNull(parsed.data.name_zh),
  });
  revalidatePath("/admin/taxonomy");
  redirect("/admin/taxonomy");
}

export async function addFamily(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  const parsed = familySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    category_id: formData.get("category_id") ?? "",
  });
  if (!parsed.success) redirect(`/admin/companies/${companyId}?error=family`);
  await directory.addFamily(companyId, {
    name: parsed.data.name,
    description: emptyToNull(parsed.data.description),
    category_id: parsed.data.category_id || null,
  });
  revalidatePath(`/admin/companies/${companyId}`);
  redirect(`/admin/companies/${companyId}`);
}

export async function deleteFamily(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  await directory.deleteFamily(String(formData.get("id") ?? ""));
  revalidatePath(`/admin/companies/${companyId}`);
  redirect(`/admin/companies/${companyId}`);
}

export async function addCert(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  const parsed = certSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) redirect(`/admin/companies/${companyId}?error=cert`);
  await directory.addCert(companyId, parsed.data.code);
  revalidatePath(`/admin/companies/${companyId}`);
  redirect(`/admin/companies/${companyId}`);
}

export async function deleteCert(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  await directory.deleteCert(String(formData.get("id") ?? ""));
  revalidatePath(`/admin/companies/${companyId}`);
  redirect(`/admin/companies/${companyId}`);
}

export async function addFactory(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  const parsed = factorySchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") ?? "",
    city: formData.get("city") ?? "",
  });
  if (!parsed.success) redirect(`/admin/companies/${companyId}?error=factory`);
  await directory.addFactory(companyId, {
    name: parsed.data.name,
    address: emptyToNull(parsed.data.address),
    city: emptyToNull(parsed.data.city),
  });
  revalidatePath(`/admin/companies/${companyId}`);
  redirect(`/admin/companies/${companyId}`);
}

export async function deleteFactory(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  await directory.deleteFactory(String(formData.get("id") ?? ""));
  revalidatePath(`/admin/companies/${companyId}`);
  redirect(`/admin/companies/${companyId}`);
}

export async function addContact(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    title: formData.get("title") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    is_public: formData.get("is_public") === "on",
  });
  if (!parsed.success) redirect(`/admin/companies/${companyId}?error=contact`);
  await directory.addContact(companyId, {
    name: parsed.data.name,
    title: emptyToNull(parsed.data.title),
    phone: emptyToNull(parsed.data.phone),
    email: emptyToNull(parsed.data.email),
    is_public: parsed.data.is_public,
  });
  revalidatePath(`/admin/companies/${companyId}`);
  redirect(`/admin/companies/${companyId}`);
}

export async function setContactPublic(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  await directory.setContactPublic(String(formData.get("id") ?? ""), formData.get("is_public") === "true");
  revalidatePath(`/admin/companies/${companyId}`);
  redirect(`/admin/companies/${companyId}`);
}

export async function deleteContact(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  await directory.deleteContact(String(formData.get("id") ?? ""));
  revalidatePath(`/admin/companies/${companyId}`);
  redirect(`/admin/companies/${companyId}`);
}

export async function mergeCompanies(formData: FormData) {
  await requireAdmin();
  const primaryId = String(formData.get("primary_id") ?? "");
  const duplicateId = String(formData.get("duplicate_id") ?? "");
  await directory.merge(primaryId, duplicateId);
  revalidatePath("/admin/duplicates");
  revalidatePath("/directory");
  redirect(`/admin/companies/${primaryId}?merged=1`);
}

export async function runScrape(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  const force = formData.get("force") === "on";
  const company = await directory.adminGet(companyId);
  if (!company?.website) redirect(`/admin/companies/${companyId}?error=noweb`);
  if (!force && company.last_scrape_status === "succeeded" && company.last_scraped_at) {
    const age = Date.now() - new Date(company.last_scraped_at).getTime();
    if (age < 7 * 24 * 60 * 60 * 1000) redirect(`/admin/companies/${companyId}?error=recent`);
  }
  const result = await crawlWebsite(company.website);
  logInfo("scrape_finished", { companyId, status: result.status, pages: result.pages.length });
  if (!result.patch) {
    await directory.saveScrapeJob({
      company_id: companyId,
      status: result.status === "skipped" ? "skipped" : "failed",
      proposed_patch: null,
      error: result.error,
    });
    await directory.addSource({
      company_id: companyId,
      source_type: "website",
      url_or_ref: company.website,
      raw_text: null,
      payload: { status: result.status, error: result.error },
    });
    redirect(`/admin/companies/${companyId}?scrape=${result.status}`);
  }
  const filled = fillEmptyFields(company, {
    phone: result.patch.phone,
    email: result.patch.email,
    wechat: result.patch.wechat,
    address: result.patch.address,
    city: result.patch.city,
    province: result.patch.province,
    export_markets: result.patch.export_markets,
    company_type: result.patch.company_type,
  });
  const categories = await directory.listCategories();
  const category_slugs = categories
    .filter((category) =>
      result.patch!.families.some((family) => family.name.toLowerCase().includes(category.name_en.toLowerCase().split(" ")[0].toLowerCase())),
    )
    .map((category) => category.slug);
  await directory.saveScrapeJob({
    company_id: companyId,
    status: "proposed",
    proposed_patch: {
      ...filled,
      families: result.patch.families,
      certifications: result.patch.certifications,
      factories: result.patch.factories,
      category_slugs,
    },
    error: null,
  });
  await directory.addSource({
    company_id: companyId,
    source_type: "website",
    url_or_ref: result.pages[0]?.url ?? company.website,
    raw_text: result.patch.excerpt,
    payload: { pages: result.pages.map((page) => page.url) },
  });
  revalidatePath(`/admin/companies/${companyId}`);
  redirect(`/admin/companies/${companyId}?scrape=proposed`);
}

export async function applyScrape(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("company_id") ?? "");
  await directory.applyScrape(String(formData.get("job_id") ?? ""));
  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/directory");
  redirect(`/admin/companies/${companyId}?applied=1`);
}

export async function uploadCards(formData: FormData) {
  await requireAdmin();
  const textOverride = String(formData.get("raw_text") ?? "");
  const files = formData.getAll("cards").filter((item): item is File => item instanceof File && item.size > 0);
  if (!files.length && !textOverride.trim()) redirect("/admin/upload?error=empty");
  const targets = files.length ? files : [null];
  const created: string[] = [];
  let scrapeGraphFallback = false;

  for (const file of targets) {
    if (file && (file.size > 8_000_000 || !IMAGE_MIME_TYPES.includes(file.type as (typeof IMAGE_MIME_TYPES)[number]))) {
      continue;
    }
    let urlRef: string | null = null;
    let recognized: string | null = textOverride.trim() || null;
    let provider = recognized ? "pasted_text" : "none";
    const bytes = file ? Buffer.from(await file.arrayBuffer()) : null;
    if (file && bytes) {
      const id = randomUUID();
      const rawExt = file.name.split(".").pop()?.toLowerCase() || "img";
      const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : "img";
      if (isDemoMode()) {
        await mkdir(path.join(process.cwd(), "data", "demo-uploads"), { recursive: true });
        await writeFile(path.join(process.cwd(), "data", "demo-uploads", `${id}.${ext}`), bytes);
        urlRef = `local:${id}.${ext}`;
      } else {
        urlRef = await supabaseStore.uploadCard(`${id}.${ext}`, bytes, file.type);
      }
    }
    const scraped = await extractCardWithScrapeGraph({
      text: textOverride.trim() || null,
      image: file && bytes ? { bytes, mime: file.type } : null,
    });
    let extraction = scraped.extraction;
    if (scraped.attempted && !extraction) scrapeGraphFallback = true;
    if (extraction) {
      provider = "scrapegraphai";
      recognized = scraped.rawText || recognized;
    } else if (file && bytes && !textOverride.trim()) {
      const vision = await recognizeImage(bytes, file.type);
      recognized = vision.text;
      provider = vision.provider;
      extraction = extractCard(recognized ?? "");
    } else {
      extraction = extractCard(recognized ?? "");
    }
    if (extraction.website) extraction.website = normalizeWebsite(extraction.website);
    const raw = recognized ?? "";
    const company = await directory.createFromCard(extraction, {
      url_or_ref: urlRef,
      raw_text: raw,
      payload: { provider, confidence: extraction.confidence, needs_text: !raw, scrapegraph_error: scraped.error },
    });
    created.push(company.id);
    logInfo("card_ingested", { companyId: company.id, provider, hasText: Boolean(raw) });
  }

  revalidatePath("/admin/companies");
  const warning = scrapeGraphFallback ? "warning=scrapegraph" : "";
  if (created.length === 1) redirect(`/admin/companies/${created[0]}${warning ? `?${warning}` : ""}`);
  redirect(`/admin/upload?created=${created.length}${warning ? `&${warning}` : ""}`);
}
