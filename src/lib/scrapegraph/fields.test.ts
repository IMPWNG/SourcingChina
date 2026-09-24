import assert from "node:assert/strict";
import test from "node:test";
import { cardFromScrapeGraph, readScrapeGraphApiKey } from "./fields";

test("a missing or placeholder ScrapeGraph key is treated as unset", () => {
  assert.equal(readScrapeGraphApiKey(undefined), null);
  assert.equal(readScrapeGraphApiKey("  "), null);
  assert.equal(readScrapeGraphApiKey("your-sgai-key"), null);
  assert.equal(readScrapeGraphApiKey("sgai-live"), "sgai-live");
});

test("scrapegraph card json maps onto stored company fields and drops blanks", () => {
  const card = cardFromScrapeGraph({
    name_zh: "重庆庆岭顶点头盔有限公司",
    name_en: "QINGLING APEX HELMETS CO., LTD",
    brand: "ApexRide",
    company_type: "Factory",
    address: "No. 18 Yuma Road, Shapingba, Chongqing",
    city: "Chongqing",
    province: "Chongqing",
    country: "CN",
    website: "www.apexride.example/path?utm_source=card",
    wechat: "ApexRideHelmets",
    phone: "+86 23 6500 2210",
    email: "sales@apexride.example",
    export_markets: ["EU", "n/a", "US"],
    contact_name: "Li Wei",
    contact_title: "Export Manager",
    contact_phone: "",
    contact_email: "none",
  });
  assert.ok(card);
  assert.equal(card?.company_type, "factory");
  assert.equal(card?.website, "https://apexride.example/path");
  assert.deepEqual(card?.export_markets, ["EU", "US"]);
  assert.deepEqual(card?.contact, { name: "Li Wei", title: "Export Manager", phone: null, email: null });
  assert.equal(card?.phone, "+86 23 6500 2210");
});

test("an empty scrapegraph result does not invent a company", () => {
  assert.equal(cardFromScrapeGraph({ company_type: "unknown", email: "N/A", website: "" }), null);
  assert.equal(cardFromScrapeGraph(null), null);
});
