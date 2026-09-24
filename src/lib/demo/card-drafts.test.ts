import assert from "node:assert/strict";
import test from "node:test";
import type { Company, Source } from "@/lib/records";
import { mergeCardDrafts, packCardDrafts, unpackCardDrafts } from "./card-drafts";

function company(id: string, name: string): Company {
  const now = "2026-09-24T00:00:00.000Z";
  return {
    id,
    name_zh: null,
    name_en: name,
    brand: null,
    company_type: "unknown",
    address: null,
    city: null,
    province: null,
    country: "CN",
    website: null,
    wechat: null,
    phone: null,
    email: null,
    export_markets: [],
    is_published: false,
    merged_into_id: null,
    last_scrape_status: "never",
    last_scraped_at: null,
    created_at: now,
    updated_at: now,
    category_ids: [],
  };
}

function source(id: string, companyId: string, raw: string): Source {
  return {
    id,
    company_id: companyId,
    source_type: "card",
    url_or_ref: null,
    raw_text: raw,
    payload: { ocr_empty: false },
    captured_at: "2026-09-24T00:00:00.000Z",
  };
}

test("card drafts round-trip through a cookie-sized payload", () => {
  const bundle = {
    companies: [company("c1", "Harbor Parts")],
    sources: [source("s1", "c1", "Harbor Parts\n+86 13800000000")],
    contacts: [],
    products: [],
  };
  const packed = packCardDrafts(bundle);
  assert.ok(packed);
  assert.ok(packed.length < 4000);
  const unpacked = unpackCardDrafts(packed);
  assert.equal(unpacked?.companies[0]?.name_en, "Harbor Parts");
  assert.equal(unpacked?.sources[0]?.raw_text?.includes("Harbor Parts"), true);
});

test("a long card keeps the newest draft inside the cookie limit", () => {
  const companies = [company("old", "Old"), company("new", "New")];
  const sources = [source("s-old", "old", "x".repeat(8000)), source("s-new", "new", "New card text")];
  const packed = packCardDrafts({ companies, sources, contacts: [], products: [] });
  assert.ok(packed);
  assert.ok(packed.length <= 3500);
  const unpacked = unpackCardDrafts(packed);
  assert.equal(unpacked?.companies.some((item) => item.id === "new"), true);
});

test("merged drafts show up beside the seed companies", () => {
  const db = {
    companies: [company("seed", "Seed")],
    sources: [] as Source[],
    contacts: [],
    products: [],
  };
  mergeCardDrafts(db, {
    companies: [company("c1", "Draft")],
    sources: [source("s1", "c1", "text")],
    contacts: [],
    products: [],
  });
  assert.deepEqual(
    db.companies.map((item) => item.id),
    ["seed", "c1"],
  );
  assert.equal(db.sources.length, 1);
  mergeCardDrafts(db, {
    companies: [company("c1", "Draft")],
    sources: [source("s1", "c1", "text")],
    contacts: [],
    products: [],
  });
  assert.equal(db.companies.length, 2);
  assert.equal(db.sources.length, 1);
});

test("a broken cookie is ignored", () => {
  assert.equal(unpackCardDrafts("%%%"), null);
  assert.equal(unpackCardDrafts(undefined), null);
});
