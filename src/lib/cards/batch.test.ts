import assert from "node:assert/strict";
import test from "node:test";
import { keepPrintedContacts, missingSupabaseKeys, parseCardArgs, parseCardBatch, supabaseKeyMessage } from "./batch";

const company = {
  name_zh: "重庆庆顶",
  name_en: "Qingling Apex",
  brand: null,
  company_type: "factory" as const,
  address: null,
  city: "Chongqing",
  province: null,
  country: "CN",
  website: "https://apexride.example",
  wechat: null,
  phone: "+86 13800002210",
  email: "sales@apexride.example",
  export_markets: [],
};

test("card args accept a folder and an output file", () => {
  assert.deepEqual(parseCardArgs(["./business-cards", "--out", "cards.json"]), {
    paths: ["./business-cards"],
    out: "cards.json",
  });
  assert.deepEqual(parseCardArgs(["a.jpg", "b.png"]), { paths: ["a.jpg", "b.png"], out: "cards.json" });
  assert.equal("error" in parseCardArgs([]), true);
});

test("a website, phone, or email is kept only when the photo text contains it", () => {
  const printed = "Qingling Apex\nhttps://apexride.example\n+86 13800002210";
  const kept = keepPrintedContacts(company, printed);
  assert.equal(kept.website, "https://apexride.example");
  assert.equal(kept.phone, "+86 13800002210");
  assert.equal(kept.email, null);
  assert.equal(keepPrintedContacts({ ...company, email: "shao@superpowertech.com" }, "cyshao@superpowertech.com").email, null);
  assert.equal(
    keepPrintedContacts({ ...company, email: "cyshao@superpowertech.com" }, "cyshao@superpowertech.com").email,
    "cyshao@superpowertech.com",
  );
  assert.equal(keepPrintedContacts(company, "").website, null);
  assert.equal(keepPrintedContacts(company, null).phone, null);
});

test("missing supabase settings name the variables and not a stack", () => {
  assert.deepEqual(missingSupabaseKeys({}), ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"]);
  assert.deepEqual(
    missingSupabaseKeys({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SECRET_KEY: "secret",
    }),
    ["NEXT_PUBLIC_SUPABASE_URL"],
  );
  assert.deepEqual(
    missingSupabaseKeys({
      NEXT_PUBLIC_SUPABASE_URL: "https://abcd.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    }),
    [],
  );
  const message = supabaseKeyMessage(["SUPABASE_SECRET_KEY"]);
  assert.match(message, /SUPABASE_SECRET_KEY/);
  assert.equal(message.includes("at "), false);
});

test("a card batch parses company fields and products", () => {
  const batch = parseCardBatch({
    generated_at: "2026-09-24T00:00:00.000Z",
    cards: [
      {
        source: "cards/front.jpg",
        ocr_text: "Qingling",
        company,
        products: [{ name: "Full-face helmet", description: "Street shell", category: "helmets", image_url: "https://apexride.example/a.jpg" }],
        catalog: "saved",
      },
    ],
  });
  assert.equal(batch?.cards[0]?.products[0]?.name, "Full-face helmet");
  assert.equal(batch?.cards[0]?.products[0]?.category, "helmets");
  assert.equal(parseCardBatch({ cards: "nope" }), null);
});
