import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { missingSupabaseKeys, parseCardArgs, supabaseKeyMessage, type CardRecord } from "@/lib/cards/batch";
import { scrapeSiteProducts } from "@/lib/scrapegraph/catalog";
import { CATEGORIES } from "@/lib/seed";
import { translateCard } from "@/lib/translate";
import { cardsSupabase, upsertCompany, upsertProducts } from "./import-cards";
import { loadEnvLocal } from "./load-env";

function pythonBin(): string {
  const candidates = [
    path.join(process.cwd(), ".venv", "bin", "python3"),
    path.join(process.cwd(), ".venv", "bin", "python"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return "python3";
}

function cardSites(card: CardRecord): string[] {
  return (card.company.websites?.length ? card.company.websites : [card.company.website]).filter((site): site is string => Boolean(site));
}

async function saveCardThenCrawl(cards: CardRecord[]): Promise<{ dbOk: boolean }> {
  const categories = CATEGORIES.map((item) => ({ id: item.id, slug: item.slug, name_en: item.name_en, name_zh: item.name_zh }));
  const slugById = new Map<string, string>(categories.map((item) => [item.id, item.slug]));
  let dbOk = true;
  let supabase: ReturnType<typeof cardsSupabase> | null = null;
  try {
    supabase = cardsSupabase();
  } catch {
    dbOk = false;
  }
  for (const card of cards) {
    const sites = cardSites(card);
    if (!sites.length) {
      card.catalog = "no_website";
      card.products = [];
    }
    let companyId: string | null = null;
    if (supabase && dbOk) {
      try {
        companyId = await upsertCompany(supabase, { ...card, products: [] }, sites.length ? "never" : "skipped");
        console.log(`${card.source}: saved company ${companyId}`);
      } catch (error) {
        dbOk = false;
        console.error(error instanceof Error ? error.message : "Could not reach Supabase.");
        console.error(`${card.source}: continuing with the site crawl into cards.json only.`);
      }
    } else {
      console.error(`${card.source}: Supabase unreachable — crawl will only update the JSON file.`);
    }
    if (!sites.length) {
      console.log(`${card.source}: no website on the card, crawl skipped`);
      continue;
    }
    console.log(`${card.source}: crawling ${sites[0]} for a products page`);
    try {
      let crawl = await scrapeSiteProducts(sites[0] ?? null, categories);
      for (const site of sites.slice(1)) {
        if (crawl.reason === "saved") break;
        console.log(`${card.source}: crawling ${site} for a products page`);
        const next = await scrapeSiteProducts(site, categories);
        if (next.reason === "saved" || crawl.reason === "failed") crawl = next;
      }
      card.catalog = crawl.reason;
      card.products = crawl.products.map((item) => ({
        name: item.name,
        description: item.description,
        image_url: item.image_url,
        source_url: item.source_url,
        category: item.category_id ? slugById.get(item.category_id) ?? null : null,
        details: item.details,
      }));
    } catch (error) {
      card.catalog = "failed";
      card.products = [];
      console.error(`${card.source}: ${error instanceof Error ? error.message : "The website could not be crawled."}`);
    }
    console.log(`${card.source}: translating into English and French`);
    await translateCard(card);
    if (supabase && dbOk && companyId) {
      try {
        await upsertCompany(supabase, card);
        const saved = await upsertProducts(supabase, companyId, card);
        console.log(`${card.source}: saved ${saved} product${saved === 1 ? "" : "s"}`);
      } catch (error) {
        dbOk = false;
        console.error(error instanceof Error ? error.message : "Could not save products to Supabase.");
      }
    } else {
      console.log(`${card.source}: crawled ${card.products.length} product${card.products.length === 1 ? "" : "s"} into the JSON file`);
    }
  }
  return { dbOk };
}

async function main(): Promise<void> {
  loadEnvLocal();
  const parsed = parseCardArgs(process.argv.slice(2));
  if ("error" in parsed) {
    console.error(parsed.error);
    console.error("Usage: npm run cards -- <folder-or-photos...> --out cards.json");
    process.exit(1);
  }
  const script = path.join(process.cwd(), "scripts", "read_cards.py");
  const child = spawnSync(pythonBin(), ["-u", script, ...process.argv.slice(2)], { stdio: "inherit", env: process.env });
  if (child.error) {
    console.error("Python is required to read card photos. Install it, then run: pip install -r requirements-cards.txt");
    process.exit(1);
  }
  if ((child.status ?? 1) !== 0) process.exit(child.status ?? 1);
  const raw = JSON.parse(await readFile(parsed.out, "utf8")) as { cards?: CardRecord[] };
  const cards = raw.cards ?? [];
  const missing = missingSupabaseKeys(process.env);
  if (missing.length) {
    console.error(supabaseKeyMessage(missing));
    console.error("The card text is in the JSON file. The site was not crawled because the company row could not be saved.");
    process.exit(1);
  }
  const { dbOk } = await saveCardThenCrawl(cards);
  await writeFile(parsed.out, `${JSON.stringify(raw, null, 2)}\n`);
  console.log(`Wrote ${cards.length} card${cards.length === 1 ? "" : "s"} to ${parsed.out}`);
  if (!dbOk) {
    console.error("Supabase was unreachable (TLS reset to *.supabase.co). Turn on a VPN, then run: npm run cards:import -- cards.json");
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The command failed.");
  process.exit(1);
});
