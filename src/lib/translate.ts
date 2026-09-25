import "server-only";

import type { CardRecord } from "@/lib/cards/batch";
import { mammouthJson } from "@/lib/mammouth/client";

const SYSTEM =
  "You translate supplier facts into English and French. Reply with one JSON object only: {\"items\":[{\"id\":\"\",\"en\":\"\",\"fr\":\"\"}]}. Keep company names, people names, phone numbers, emails, and URLs unchanged. Translate addresses, cities, job titles, and product names and descriptions. Do not invent facts.";

type Item = { id?: unknown; en?: unknown; fr?: unknown };

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function translateCard(card: CardRecord): Promise<void> {
  const lines: { id: string; text: string }[] = [];
  const push = (id: string, value: string | null) => {
    if (value) lines.push({ id, text: value });
  };
  push("address", card.company.address);
  push("city", card.company.city);
  push("title", card.company.contact_title);
  card.products.forEach((product, index) => {
    push(`name:${index}`, product.name);
    push(`description:${index}`, product.description);
  });
  if (!lines.length) return;
  const result = await mammouthJson({
    system: SYSTEM,
    user: lines.map((line) => `${line.id}: ${line.text}`).join("\n"),
  });
  if (!result.ok) return;
  const record = result.json && typeof result.json === "object" ? (result.json as { items?: unknown }) : {};
  const items = Array.isArray(record.items) ? record.items : [];
  const byId = new Map<string, { en: string; fr: string }>();
  for (const item of items) {
    const row = item as Item;
    const id = text(row.id);
    const en = text(row.en);
    const fr = text(row.fr);
    if (id && en && fr) byId.set(id, { en, fr });
  }
  const shared: Record<string, string> = {};
  for (const key of ["address", "city", "title"] as const) {
    const hit = byId.get(key);
    if (hit) {
      shared[`${key}_en`] = hit.en;
      shared[`${key}_fr`] = hit.fr;
    }
  }
  card.products = card.products.map((product, index) => {
    const name = byId.get(`name:${index}`);
    const description = byId.get(`description:${index}`);
    return {
      ...product,
      details: {
        ...product.details,
        ...shared,
        ...(name ? { name_en: name.en, name_fr: name.fr } : {}),
        ...(description ? { description_en: description.en, description_fr: description.fr } : {}),
      },
    };
  });
}
