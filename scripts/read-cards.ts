import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCardArgs, type CardRecord } from "@/lib/cards/batch";
import { scrapeSiteProducts } from "@/lib/scrapegraph/catalog";
import { CATEGORIES } from "@/lib/seed";
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

async function crawlCards(cards: CardRecord[]): Promise<void> {
  const categories = CATEGORIES.map((item) => ({ id: item.id, slug: item.slug, name_en: item.name_en, name_zh: item.name_zh }));
  const slugById = new Map<string, string>(categories.map((item) => [item.id, item.slug]));
  for (const card of cards) {
    const sites = (card.company.websites?.length ? card.company.websites : [card.company.website]).filter(
      (site): site is string => Boolean(site),
    );
    if (!sites.length) {
      card.catalog = "no_website";
      card.products = [];
      continue;
    }
    try {
      let crawl = await scrapeSiteProducts(sites[0] ?? null, categories);
      for (const site of sites.slice(1)) {
        if (crawl.reason === "saved") break;
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
  }
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
  await crawlCards(cards);
  await writeFile(parsed.out, `${JSON.stringify(raw, null, 2)}\n`);
  console.log(`Wrote ${cards.length} card${cards.length === 1 ? "" : "s"} to ${parsed.out}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The command failed.");
  process.exit(1);
});
