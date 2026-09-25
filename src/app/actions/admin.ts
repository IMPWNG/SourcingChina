"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { extractCard, fillEmptyFields, normalizeWebsite, type CardExtraction } from "@/lib/domain";
import { isDirectoryWritable, isReadOnlyFsError } from "@/lib/demo/filesystem";
import { crawlWebsite } from "@/lib/enrichment/crawl";
import { isDemoMode } from "@/lib/env";
import { logInfo } from "@/lib/log";
import { recognizeImage } from "@/lib/ocr";
import { scrapeSiteProducts, type ProductCrawlResult } from "@/lib/scrapegraph/catalog";
import { extractCardWithScrapeGraph, type ScrapeGraphCardResult } from "@/lib/scrapegraph/extract";
import { UPLOAD_PRODUCT_CRAWL_MS, type CatalogReason } from "@/lib/scrapegraph/products";
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

export async function deleteCompany(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await directory.deleteCompany(id);
  revalidatePath("/admin/companies");
  revalidatePath("/directory");
  redirect("/admin/companies");
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

function rethrowNavigation(error: unknown): void {
  if (typeof error !== "object" || error === null || !("digest" in error)) return;
  const digest = String((error as { digest?: unknown }).digest ?? "");
  if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")) throw error;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 180) : "upload_failed";
}

async function structureCard(text: string): Promise<ScrapeGraphCardResult> {
  try {
    return await extractCardWithScrapeGraph({ text, image: null, timeoutMs: 12_000 });
  } catch (error) {
    logInfo("mammouth_card_threw", { error: errorText(error) });
    return { attempted: true, extraction: null, rawText: text, error: "extract_failed" };
  }
}

async function storeCardImage(id: string, ext: string, bytes: Buffer, mime: string): Promise<string | null> {
  if (isDemoMode()) {
    if (!(await isDirectoryWritable(process.cwd()))) return null;
    try {
      const dir = path.join(process.cwd(), "data", "demo-uploads");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `${id}.${ext}`), bytes);
      return `local:${id}.${ext}`;
    } catch (error) {
      if (isReadOnlyFsError(error)) return null;
      logInfo("card_image_store_failed", { error: errorText(error) });
      return null;
    }
  }
  try {
    return await supabaseStore.uploadCard(`${id}.${ext}`, bytes, mime);
  } catch (error) {
    logInfo("card_image_store_failed", { error: errorText(error) });
    return null;
  }
}

function scrapeStatus(reason: CatalogReason): "succeeded" | "failed" | "skipped" {
  if (reason === "failed") return "failed";
  if (reason === "saved" || reason === "empty") return "succeeded";
  return "skipped";
}

export async function uploadCards(formData: FormData) {
  await requireAdmin();
  try {
    await ingestCards(formData);
  } catch (error) {
    rethrowNavigation(error);
    logInfo("upload_failed", { error: errorText(error) });
    redirect("/admin/upload?error=failed");
  }
}

async function ingestCards(formData: FormData) {
  const textOverride = String(formData.get("raw_text") ?? "");
  const files = formData.getAll("cards").filter((item): item is File => item instanceof File && item.size > 0);
  if (!files.length && !textOverride.trim()) redirect("/admin/upload?error=empty");
  const categories = await directory.listCategories();
  const pastedWebsite = textOverride.trim() ? extractCard(textOverride).website : null;
  const targets = files.length ? files : [null];
  const created: string[] = [];
  let scrapeGraphFallback = false;
  let anyOcrEmpty = false;
  let anyOcrFailed = false;
  let saveFailed = false;
  let skippedInvalid = false;
  const catalogs: { reason: CatalogReason; count: number }[] = [];

  for (const file of targets) {
    if (file && (file.size > 8_000_000 || !IMAGE_MIME_TYPES.includes(file.type as (typeof IMAGE_MIME_TYPES)[number]))) {
      skippedInvalid = true;
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
      urlRef = await storeCardImage(id, ext, bytes, file.type);
    }
    let ocrEmpty = false;
    let ocrFailed = false;
    let scraped: ScrapeGraphCardResult = textOverride.trim()
      ? await structureCard(textOverride.trim())
      : { attempted: false, extraction: null, rawText: null, error: null };
    let extraction: CardExtraction | null = scraped.extraction;
    if (textOverride.trim() && extraction) {
      provider = "mammouth";
      recognized = scraped.rawText || recognized;
    } else if (file && bytes && !textOverride.trim()) {
      const ocr = await recognizeImage(bytes, file.type);
      recognized = ocr.text;
      provider = ocr.provider;
      if (ocr.provider === "tesseract_error") {
        ocrFailed = true;
        anyOcrFailed = true;
        extraction = extractCard("");
      } else if (recognized) {
        const fromText = await structureCard(recognized);
        scraped = fromText;
        if (fromText.extraction) {
          extraction = fromText.extraction;
          provider = "mammouth";
          recognized = fromText.rawText || recognized;
        } else {
          extraction = extractCard(recognized);
        }
      } else {
        ocrEmpty = true;
        anyOcrEmpty = true;
        extraction = extractCard("");
      }
    } else {
      extraction = extractCard(recognized ?? "");
    }
    if (!extraction) extraction = extractCard(recognized ?? "");
    if (scraped.attempted && provider !== "mammouth") scrapeGraphFallback = true;
    if (extraction.website) extraction.website = normalizeWebsite(extraction.website);
    const website = pastedWebsite ?? extraction.website;
    const raw = recognized ?? "";
    let companyId: string;
    try {
      const company = await directory.createFromCard(extraction, {
        url_or_ref: urlRef,
        raw_text: raw,
        payload: {
          provider,
          confidence: extraction.confidence,
          needs_text: !raw,
          ocr_empty: ocrEmpty,
          ocr_failed: ocrFailed,
          mammouth_error: scraped.error,
        },
      });
      companyId = company.id;
    } catch (error) {
      rethrowNavigation(error);
      saveFailed = true;
      logInfo("draft_save_failed", { error: errorText(error) });
      continue;
    }
    let crawl: ProductCrawlResult = { reason: "no_website", products: [] };
    try {
      crawl = await scrapeSiteProducts(website, categories, { budgetMs: UPLOAD_PRODUCT_CRAWL_MS });
    } catch (error) {
      logInfo("product_crawl_failed", { error: errorText(error) });
      crawl = { reason: "failed", products: [] };
    }
    let savedCount = 0;
    let catalogReason = crawl.reason;
    try {
      const saved = await directory.addProducts(companyId, crawl.products, scrapeStatus(crawl.reason));
      savedCount = saved.length;
      if (website) {
        await directory.addSource({
          company_id: companyId,
          source_type: "website",
          url_or_ref: website,
          raw_text: null,
          payload: { catalog: crawl.reason, products: saved.length },
        });
      }
    } catch (error) {
      catalogReason = "failed";
      logInfo("product_save_failed", { error: errorText(error) });
    }
    catalogs.push({ reason: catalogReason, count: savedCount });
    created.push(companyId);
    logInfo("card_ingested", { companyId, provider, hasText: Boolean(raw), products: savedCount });
  }

  if (!created.length) {
    if (saveFailed) redirect("/admin/upload?error=save");
    if (skippedInvalid) redirect("/admin/upload?error=invalid");
    redirect("/admin/upload?error=empty");
  }

  revalidatePath("/admin/companies");
  revalidatePath("/directory");
  const params = new URLSearchParams();
  if (scrapeGraphFallback) params.set("warning", "scrapegraph");
  if (anyOcrFailed) params.set("ocr", "failed");
  else if (anyOcrEmpty) params.set("ocr", "empty");
  const reasons = new Set(catalogs.map((item) => item.reason));
  if (reasons.size === 1 && catalogs[0]) {
    params.set("catalog", catalogs[0].reason);
    params.set("products", String(catalogs.reduce((sum, item) => sum + item.count, 0)));
  } else if (reasons.size > 1) {
    params.set("catalog", "mixed");
  }
  const query = params.toString();
  if (created.length === 1) redirect(`/admin/companies/${created[0]}${query ? `?${query}` : ""}`);
  redirect(`/admin/upload?created=${created.length}${query ? `&${query}` : ""}`);
}
