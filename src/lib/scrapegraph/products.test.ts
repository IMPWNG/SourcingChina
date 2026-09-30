import assert from "node:assert/strict";
import test from "node:test";
import { UPLOAD_PRODUCT_CRAWL_MS, catalogMessage, planSiteCrawl, productsFromPage, productsListedOnPage, uniqueProducts, urlsFromModelPick } from "./products";

const categories = [
  { id: "helmets-id", slug: "helmets", name_en: "Helmets", name_zh: "头盔" },
  { id: "lighting-id", slug: "lighting", name_en: "Lighting", name_zh: "灯具" },
  { id: "batteries-id", slug: "batteries", name_en: "Batteries", name_zh: "电池" },
  { id: "electrical-id", slug: "electrical", name_en: "Electrical", name_zh: "电气" },
];

test("upload crawl stays inside a function budget", () => {
  assert.ok(UPLOAD_PRODUCT_CRAWL_MS <= 60_000);
  assert.ok(UPLOAD_PRODUCT_CRAWL_MS >= 8_000);
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

test("helmet model codes on a catalog page are kept", () => {
  const products = productsListedOnPage({
    text: "HOME PRODUCT CONTACT US Motorcycle Helmet ECE DOT BY-R7S BY-705-DOT",
    html: '<span>BY-111</span><span>BY-166</span><a href="/sys-pr/?g=200">BY-111</a><a href="/sys-pr/?g=12">BY-206 Type 1/2 Helmet Certificate CCC Reservation Now</a>',
    imageUrls: [],
    pageUrl: "https://www.rng-helmets.com/h-col-125.html",
    siteHost: "www.rng-helmets.com",
    categories,
  });
  assert.equal(products.some((item) => item.name === "BY-111"), true);
  assert.equal(products.some((item) => item.name === "BY-166"), true);
  assert.equal(products.some((item) => item.name === "BY-R7S"), true);
  assert.equal(products.some((item) => item.name === "BY-705-DOT"), true);
  assert.equal(products.some((item) => item.name === "BY-206 Type 1/2 Helmet"), true);
  assert.equal(products.some((item) => item.name === "Helmet"), false);
  assert.equal(products.find((item) => item.name === "BY-111")?.category_id, "helmets-id");
});

test("ai cooperate blurbs are not saved as products", () => {
  const products = productsFromPage({
    json: {
      products: [
        { name: "BY-111", description: "Full face helmet." },
        { name: "information与我们共同经营BYB/RNG品牌头盔Co-operate", description: "Partner text." },
        { name: "banner_text_2.png", description: "Homepage slide." },
        { name: "banner_m_3.png", image_url: "/image/banner_m_3.png" },
      ],
    },
    pageUrl: "https://www.rng-helmets.com/sys-pr/?g=6",
    imageUrls: ["https://www.rng-helmets.com/image/banner_m_2.png", "https://www.rng-helmets.com/media/by-111.jpg"],
    siteHost: "www.rng-helmets.com",
    categories,
  });
  assert.equal(products.some((item) => item.name === "BY-111"), true);
  assert.equal(products.some((item) => /co-?operate/i.test(item.name)), false);
  assert.equal(products.some((item) => /banner/i.test(item.name)), false);
  assert.equal(productsListedOnPage({
    text: "banner_text_2.png banner_title_3.png BY-111",
    html: '<img src="/image/banner_text_2.png" alt="banner_text_2.png"><a href="/sys-pr/?g=6">banner_m_2.png</a>',
    imageUrls: ["/image/banner_text_2.png"],
    pageUrl: "https://www.rng-helmets.com/h-col-125.html",
    siteHost: "www.rng-helmets.com",
    categories,
  }).some((item) => /banner|\.png/i.test(item.name)), false);
});

test("json-ld product names are kept and off-site crawl picks are dropped", () => {
  const products = productsListedOnPage({
    text: "Catalog",
    html: `<script type="application/ld+json">{"@type":"Product","name":"Apex full-face helmet"}</script>`,
    imageUrls: [],
    pageUrl: "https://apexride.example/products",
    siteHost: "apexride.example",
    categories,
  });
  assert.equal(products.some((item) => item.name === "Apex full-face helmet"), true);
  assert.deepEqual(
    urlsFromModelPick(
      { urls: ["https://apexride.example/products", "https://other.example/steal", "/contact"] },
      "apexride.example",
    ),
    ["https://apexride.example/products", "https://apexride.example/contact"],
  );
});
