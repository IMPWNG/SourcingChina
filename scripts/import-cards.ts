import { readFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { missingSupabaseKeys, parseCardBatch, supabaseKeyMessage, type CardCompanyRecord, type CardRecord } from "@/lib/cards/batch";
import type { CatalogReason } from "@/lib/scrapegraph/products";
import { loadEnvLocal } from "./load-env";

function scrapeStatus(reason: CatalogReason): "succeeded" | "failed" | "skipped" | "never" {
  if (reason === "saved" || reason === "empty") return "succeeded";
  if (reason === "failed") return "failed";
  if (reason === "no_key" || reason === "no_website") return "skipped";
  return "never";
}

function filledCompany(company: CardCompanyRecord): Record<string, unknown> {
  const row: Record<string, unknown> = { country: company.country || "CN" };
  if (company.company_type !== "unknown") row.company_type = company.company_type;
  const text: (keyof CardCompanyRecord)[] = [
    "name_zh",
    "name_en",
    "brand",
    "address",
    "city",
    "province",
    "website",
    "wechat",
    "phone",
    "email",
  ];
  for (const key of text) {
    if (company[key]) row[key] = company[key];
  }
  if (company.export_markets.length) row.export_markets = company.export_markets;
  return row;
}

async function findCompany(supabase: SupabaseClient, company: CardCompanyRecord): Promise<string | null> {
  let query = supabase.from("companies").select("id").order("created_at", { ascending: true }).limit(1);
  if (company.website) query = query.eq("website", company.website);
  else if (company.name_en || company.name_zh) {
    if (company.name_en) query = query.eq("name_en", company.name_en);
    if (company.name_zh) query = query.eq("name_zh", company.name_zh);
  } else return null;
  const found = await query;
  if (found.error) throw new Error(found.error.message);
  const row = (found.data ?? [])[0] as { id: string } | undefined;
  return row?.id ?? null;
}

async function upsertCompany(supabase: SupabaseClient, card: CardRecord): Promise<string> {
  const existing = await findCompany(supabase, card.company);
  const status = scrapeStatus(card.catalog);
  const patch = {
    ...filledCompany(card.company),
    last_scrape_status: status,
    last_scraped_at: status === "never" ? null : new Date().toISOString(),
  };
  if (existing) {
    const updated = await supabase.from("companies").update(patch).eq("id", existing).select("id").single();
    if (updated.error) throw new Error(updated.error.message);
    return existing;
  }
  const inserted = await supabase
    .from("companies")
    .insert({ ...patch, is_published: false })
    .select("id")
    .single();
  if (inserted.error) throw new Error(inserted.error.message);
  return (inserted.data as { id: string }).id;
}

async function upsertProducts(supabase: SupabaseClient, companyId: string, card: CardRecord): Promise<number> {
  if (!card.products.length) return 0;
  const slugs = [...new Set(card.products.map((item) => item.category).filter((item): item is string => Boolean(item)))];
  const categories = slugs.length
    ? await supabase.from("product_categories").select("id, slug").in("slug", slugs)
    : { data: [], error: null };
  if (categories.error) throw new Error(categories.error.message);
  const categoryId = new Map(((categories.data ?? []) as { id: string; slug: string }[]).map((item) => [item.slug, item.id]));
  const existing = await supabase.from("products").select("id, name").eq("company_id", companyId);
  if (existing.error) throw new Error(existing.error.message);
  const byName = new Map(((existing.data ?? []) as { id: string; name: string }[]).map((item) => [item.name.toLowerCase(), item.id]));
  let count = 0;
  const linked = new Set<string>();
  for (const product of card.products) {
    const category_id = product.category ? categoryId.get(product.category) ?? null : null;
    if (category_id) linked.add(category_id);
    const row = {
      company_id: companyId,
      category_id,
      name: product.name,
      description: product.description,
      image_url: product.image_url,
      source_url: product.source_url,
      details: product.details,
    };
    const id = byName.get(product.name.toLowerCase());
    if (id) {
      const updated = await supabase.from("products").update(row).eq("id", id);
      if (updated.error) throw new Error(updated.error.message);
    } else {
      const inserted = await supabase.from("products").insert(row).select("id").single();
      if (inserted.error) throw new Error(inserted.error.message);
      byName.set(product.name.toLowerCase(), (inserted.data as { id: string }).id);
    }
    count += 1;
  }
  if (linked.size) {
    const links = [...linked].map((category_id) => ({ company_id: companyId, category_id }));
    const joined = await supabase.from("company_categories").upsert(links);
    if (joined.error) throw new Error(joined.error.message);
  }
  return count;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const file = process.argv[2];
  if (!file || file.startsWith("-")) {
    console.error("Usage: npm run cards:import -- cards.json");
    process.exit(1);
  }
  const missing = missingSupabaseKeys(process.env);
  if (missing.length) {
    console.error(supabaseKeyMessage(missing));
    process.exit(1);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Could not read the JSON file.");
    process.exit(1);
  }
  const batch = parseCardBatch(parsed);
  if (!batch) {
    console.error("That file is not a card batch. Expected a JSON object with a cards array.");
    process.exit(1);
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let companies = 0;
  let products = 0;
  for (const card of batch.cards) {
    try {
      const id = await upsertCompany(supabase, card);
      const saved = await upsertProducts(supabase, id, card);
      companies += 1;
      products += saved;
      console.log(`${card.source}: company ${id}, ${saved} product${saved === 1 ? "" : "s"}`);
    } catch (error) {
      console.error(`${card.source}: ${error instanceof Error ? error.message : "Could not save this card."}`);
      process.exitCode = 1;
    }
  }
  if (process.exitCode) return;
  console.log(`Upserted ${companies} compan${companies === 1 ? "y" : "ies"} and ${products} product${products === 1 ? "" : "s"}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The command failed.");
  process.exit(1);
});
