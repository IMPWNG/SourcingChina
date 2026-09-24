import { catalogMessage, type CatalogReason } from "@/lib/scrapegraph/products";

export function catalogNotice(catalog: string | undefined, products: string | undefined): string | null {
  if (!catalog) return null;
  if (catalog === "mixed") return "Card drafts were saved. Open each company to see whether its site returned products.";
  const count = Number(products ?? "0");
  if (catalog === "no_key" || catalog === "no_website" || catalog === "failed" || catalog === "empty" || catalog === "saved") {
    return catalogMessage(catalog as CatalogReason, Number.isFinite(count) ? count : 0);
  }
  return null;
}
