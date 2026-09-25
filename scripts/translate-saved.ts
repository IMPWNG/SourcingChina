import { createClient } from "@supabase/supabase-js";
import type { CardRecord } from "@/lib/cards/batch";
import { translateCard } from "@/lib/translate";
import { loadEnvLocal } from "./load-env";

type ProductRow = { id: string; name: string; description: string | null; details: Record<string, string> | null };
type CompanyRow = {
  id: string;
  name_zh: string | null;
  name_en: string | null;
  address: string | null;
  city: string | null;
  brand: string | null;
};

async function withRetry<T>(label: string, run: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw new Error(label);
}

async function main(): Promise<void> {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase URL or secret.");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const companies = await withRetry("companies", async () => {
    const result = await supabase.from("companies").select("id, name_zh, name_en, address, city, brand");
    if (result.error) throw new Error(result.error.message);
    return (result.data ?? []) as CompanyRow[];
  });
  for (const company of companies) {
    const rows = await withRetry("products", async () => {
      const products = await supabase.from("products").select("id, name, description, details").eq("company_id", company.id);
      if (products.error) throw new Error(products.error.message);
      return (products.data ?? []) as ProductRow[];
    });
    const card = {
      source: company.id,
      company: { address: company.address, city: company.city, brand: company.brand, contact_title: null },
      products: rows.map((row) => ({
        name: row.name,
        description: row.description,
        details: row.details ?? {},
      })),
    } as CardRecord;
    await translateCard(card);
    const sample = card.products[0]?.details.name_en;
    if (rows.length && !sample) throw new Error(`No English product name saved for ${company.name_en || company.id}`);
    for (const [index, row] of rows.entries()) {
      const next = card.products[index];
      if (!next) continue;
      const updated = await withRetry("update", async () => {
        const result = await supabase.from("products").update({ details: next.details }).eq("id", row.id);
        if (result.error) throw new Error(result.error.message);
        return result;
      });
      void updated;
      console.log(`${row.name} => ${next.details.name_en}`);
    }
    console.log(`${company.name_en || company.name_zh || company.id}: ${rows.length} products translated`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "The command failed.";
  console.error(message);
  if (error instanceof Error) console.error(error.cause);
  process.exit(1);
});
