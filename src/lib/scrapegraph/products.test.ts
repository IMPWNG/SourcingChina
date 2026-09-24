import assert from "node:assert/strict";
import test from "node:test";
import { catalogMessage, planSiteCrawl, productsFromPage, uniqueProducts } from "./products";

const categories = [
  { id: "helmets-id", slug: "helmets", name_en: "Helmets", name_zh: "头盔" },
  { id: "lighting-id", slug: "lighting", name_en: "Lighting", name_zh: "灯具" },
];

test("a missing key or missing website skips the crawl", () => {
  assert.deepEqual(planSiteCrawl({ hasKey: false, website: "https://apexride.example" }), { action: "skip", reason: "no_key" });
  assert.deepEqual(planSiteCrawl({ hasKey: true, website: null }), { action: "skip", reason: "no_website" });
  assert.equal(planSiteCrawl({ hasKey: true, website: "https://apexride.example/path" }).action, "crawl");
  assert.match(catalogMessage("no_key"), /MAMMOUTH_API_KEY/);
  assert.match(catalogMessage("no_website"), /No website/);
});

test("product pages become records with images, descriptions, and a category", () => {
  const products = productsFromPage({
    json: {
      products: [
        {
          name: "Apex full-face helmet",
          description: "Street shell with a clear visor.",
          image_url: "/media/helmet.jpg",
          category: "Helmets",
          details: { material: "ABS", price: "79", sku: "H-1" },
        },
        { name: "Home", description: "Navigation", category: "other" },
        { name: "LED headlamp", description: "12V lamp.", image: "https://cdn.example/lamp.jpg", category: "灯具" },
      ],
    },
    pageUrl: "https://apexride.example/products",
    imageUrls: [],
    siteHost: "apexride.example",
    categories,
  });
  assert.equal(products.length, 2);
  assert.equal(products[0]?.image_url, "https://apexride.example/media/helmet.jpg");
  assert.equal(products[0]?.category_id, "helmets-id");
  assert.deepEqual(products[0]?.details, { material: "ABS" });
  assert.equal(products[1]?.category_id, "lighting-id");
  assert.equal(productsFromPage({
    json: { products: [{ name: "Off-site jacket", description: "Textile." }] },
    pageUrl: "https://other.example/products",
    imageUrls: [],
    siteHost: "apexride.example",
    categories,
  }).length, 0);
  assert.equal(uniqueProducts([...products, products[0]!]).length, 2);
});
