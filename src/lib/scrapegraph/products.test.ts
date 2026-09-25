import assert from "node:assert/strict";
import test from "node:test";
import { UPLOAD_PRODUCT_CRAWL_MS, catalogMessage, planSiteCrawl, productsFromPage, productsListedOnPage, uniqueProducts } from "./products";

const categories = [
  { id: "helmets-id", slug: "helmets", name_en: "Helmets", name_zh: "头盔" },
  { id: "lighting-id", slug: "lighting", name_en: "Lighting", name_zh: "灯具" },
  { id: "batteries-id", slug: "batteries", name_en: "Batteries", name_zh: "电池" },
  { id: "electrical-id", slug: "electrical", name_en: "Electrical", name_zh: "电气" },
];

test("upload crawl stays short enough to return the draft", () => {
  assert.ok(UPLOAD_PRODUCT_CRAWL_MS <= 8_000);
  assert.ok(UPLOAD_PRODUCT_CRAWL_MS >= 1_000);
});

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

test("product names printed on a supplier page are kept with a photo", () => {
  const products = productsListedOnPage({
    text: "首页 产品中心 电摩BMS 三电系统之间通过电池管理系统输出电能。 180W-3.3kw智能充电器",
    imageUrls: ["//cdn.example/logo.png", "https://cdn.example/bms.jpg"],
    pageUrl: "http://www.superpowertech.com/h-col-193.html",
    siteHost: "www.superpowertech.com",
    categories,
  });
  assert.equal(products.some((item) => item.name === "电摩BMS"), true);
  assert.equal(products.find((item) => item.name === "电摩BMS")?.category_id, "batteries-id");
  assert.match(products.find((item) => item.name === "电摩BMS")?.description ?? "", /电池管理系统/);
  assert.equal(products.find((item) => item.name === "电摩BMS")?.image_url, null);
  assert.equal(products.some((item) => item.name === "180W-3.3kw智能充电器"), true);
  const charger = productsListedOnPage({
    text: "180W-3.3kw智能充电器 我们的优势 合作伙伴 校企合作 资质认证 制造中心 研发实力 | 新闻资讯 | 关于我们 公司介绍 荣誉资质 联系我们 企业文化 发展历程 常见问题 资料下载 注册 登录 中文 English 关于我们 惠州超力源成立于2014年，是国家级高新技术企业。",
    imageUrls: [],
    pageUrl: "http://www.superpowertech.com/h-col-193.html",
    siteHost: "www.superpowertech.com",
    categories,
  });
  assert.equal(charger[0]?.name, "180W-3.3kw智能充电器");
  assert.equal(charger[0]?.description, null);
  const about = productsListedOnPage({
    text: "智能BMS 惠州超力源在三电控制领域深耕发展，产品涵盖充电器、BMS、电机控制器等，拥有各类发明专利90余项。",
    imageUrls: [],
    pageUrl: "http://www.superpowertech.com/h-col-193.html",
    siteHost: "www.superpowertech.com",
    categories,
  });
  assert.equal(about.find((item) => item.name === "智能BMS")?.description, null);
});
