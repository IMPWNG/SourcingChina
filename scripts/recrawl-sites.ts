import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { missingSupabaseKeys, supabaseKeyMessage, type CardRecord } from "@/lib/cards/batch";
import { fillEmptyFields, type CompanyIdentity } from "@/lib/domain";
import { fetchRemoteImage } from "@/lib/enrichment/extract";
import { scrapeSiteProducts } from "@/lib/scrapegraph/catalog";
import { CATEGORIES } from "@/lib/seed";
import { cardsSupabase, upsertProducts, upsertSiteProfile, upsertWechatQr } from "./import-cards";
import { loadEnvLocal } from "./load-env";
import { withSupabaseRetry } from "./supabase-retry";

type CompanyRow = CompanyIdentity & { id: string };

async function saveSiteQr(companyId: string, url: string): Promise<string | null> {
  const image = await fetchRemoteImage(url);
  if (!image) return null;
  const dir = path.join(process.cwd(), "data", "card-qr");
  await mkdir(dir, { recursive: true });
  const dest = path.join(dir, `${companyId}-site.jpg`);
  await writeFile(dest, image.bytes);
  return dest;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const missing = missingSupabaseKeys(process.env);
  if (missing.length) {
    console.error(supabaseKeyMessage(missing));
    process.exit(1);
  }
  const categories = CATEGORIES.map((item) => ({ id: item.id, slug: item.slug, name_en: item.name_en, name_zh: item.name_zh }));
  const slugById = new Map(categories.map((item) => [item.id, item.slug]));
  const supabase = cardsSupabase();
  const listed = await supabase
    .from("companies")
    .select("id, name_zh, name_en, brand, company_type, address, city, province, country, website, wechat, phone, email, export_markets")
    .is("merged_into_id", null)
    .not("website", "is", null)
    .order("created_at", { ascending: true });
  if (listed.error) throw new Error(listed.error.message);
  const filter = process.argv.slice(2).filter((arg) => arg !== "--").join(" ").trim().toLowerCase();
  const SKIP_SITE = /wa\.me|weixin\.qq|wx\.hlcode|mall\.jd\.com\/qr/i;
  const rows = ((listed.data ?? []) as CompanyRow[]).filter((row) => {
    if (SKIP_SITE.test(row.website ?? "")) return false;
    if (!filter) return true;
    return `${row.website} ${row.brand} ${row.name_en} ${row.name_zh} ${row.id}`.toLowerCase().includes(filter);
  });
  console.log(`Crawling ${rows.length} compan${rows.length === 1 ? "y" : "ies"} with a website`);
  for (const row of rows) {
    const label = row.name_zh || row.name_en || row.website || row.id;
    console.log(`${label}: ${row.website}`);
    try {
      const crawl = await scrapeSiteProducts(row.website, categories, { budgetMs: 480_000 });
      console.log(`${label}: crawl ${crawl.reason}, ${crawl.products.length} product${crawl.products.length === 1 ? "" : "s"}`);
      const filled = fillEmptyFields(row, crawl.fill);
      if (
        crawl.fill.company_type === "unknown" &&
        row.company_type === "factory" &&
        /express|logistique|livraison|快递|物流|freight|courier/i.test(crawl.fill.excerpt)
      ) {
        filled.company_type = "unknown";
      }
      const status = crawl.reason === "failed" ? "failed" : crawl.reason === "saved" || crawl.reason === "empty" ? "succeeded" : "skipped";
      const patch = { ...filled, last_scrape_status: status, last_scraped_at: new Date().toISOString() };
      await withSupabaseRetry("update company", async () => {
        const updated = await supabase.from("companies").update(patch).eq("id", row.id);
        if (updated.error) throw new Error(updated.error.message);
      });
      if (crawl.fill.wechat_qr_url) {
        const qr = await saveSiteQr(row.id, crawl.fill.wechat_qr_url);
        if (qr) await upsertWechatQr(supabase, row.id, qr);
      }
      const card: CardRecord = {
        source: row.website ?? row.id,
        ocr_text: null,
        ocr_error: null,
        mammouth_error: null,
        company: {
          name_zh: row.name_zh,
          name_en: row.name_en,
          brand: row.brand,
          company_type: row.company_type,
          address: row.address,
          city: row.city,
          province: row.province,
          country: row.country || "CN",
          website: row.website,
          wechat: row.wechat,
          phone: row.phone,
          email: row.email,
          export_markets: row.export_markets ?? [],
          contact_name: crawl.fill.contacts[0]?.name ?? null,
          contact_title: crawl.fill.contacts[0]?.title ?? null,
        },
        products: crawl.products.map((item) => ({
          name: item.name,
          description: item.description,
          image_url: item.image_url,
          source_url: item.source_url,
          category: item.category_id ? slugById.get(item.category_id) ?? null : null,
          details: item.details,
        })),
        catalog: crawl.reason,
      };
      const saved = await upsertProducts(supabase, row.id, card, { replace: true });
      await upsertSiteProfile(supabase, row.id, {
        families: crawl.fill.families,
        certifications: crawl.fill.certifications,
        factories: crawl.fill.factories,
        contacts: crawl.fill.contacts,
      });
      console.log(`${label}: ${crawl.reason}, ${saved} product${saved === 1 ? "" : "s"}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "crawl failed";
      const cause = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : "";
      console.error(`${label}: ${message}${cause}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The command failed.");
  process.exit(1);
});
