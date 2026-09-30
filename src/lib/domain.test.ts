import assert from "node:assert/strict";
import test from "node:test";
import { extractCard, fillEmptyFields, findDuplicatePairs, hasDirectoryAccess, inferCompanyType, isPlausibleAddress, isPlausiblePhone, normalizeWebsite, paymentMatchesPlan, phonesMatch } from "./domain";
import { SAMPLE_CARD_TEXT } from "./seed";

test("sample card keeps Chinese and English names and strips tracking params", () => {
  const card = extractCard(SAMPLE_CARD_TEXT);
  assert.equal(card.name_zh, "重庆庆岭顶点头盔有限公司");
  assert.match(card.name_en ?? "", /QINGLING APEX HELMETS/i);
  assert.equal(card.brand, "ApexRide");
  assert.equal(card.website, "https://apexride.example");
  assert.equal(card.email, "sales@apexride.example");
  assert.equal(card.wechat, "ApexRideHelmets");
  assert.ok(card.phone?.includes("+86 23 6500 2210"));
  assert.deepEqual(card.export_markets, ["EU", "US"]);
  assert.equal(card.company_type, "factory");
  assert.equal(card.city, "Chongqing");
  assert.equal(card.contact?.name, "Li Wei");
  assert.equal(card.contact?.title, "Export Manager");
});

test("a card without a website does not invent one", () => {
  const card = extractCard(`温州火花灯具厂
WENZHOU SPARK LIGHTING FACTORY
地址：浙江省温州市瓯海区
电话：0577-88881234
微信：SparkLight`);
  assert.equal(card.website, null);
  assert.equal(card.email, null);
  assert.equal(card.wechat, "SparkLight");
  assert.ok(card.phone);
  assert.equal(card.name_zh, "温州火花灯具厂");
  assert.equal(card.city, "Wenzhou");
});

test("website host and phone matching", () => {
  assert.equal(normalizeWebsite("www.Example.com/path/?utm_source=card"), "https://example.com/path");
  assert.equal(phonesMatch("+86 23 6500 2210", "862365002210"), true);
  const pairs = findDuplicatePairs([
    { id: "a", website: "https://apexride.example", phone: null, email: null },
    { id: "b", website: "https://www.apexride.example/about", phone: null, email: null },
  ]);
  assert.equal(pairs[0]?.reason, "website");
});

test("directory access follows role and period end", () => {
  const now = Date.parse("2026-09-24T00:00:00Z");
  assert.equal(hasDirectoryAccess(null, now), false);
  assert.equal(
    hasDirectoryAccess({ role: "subscriber", subscriptionStatus: "active", currentPeriodEnd: "2026-09-23T00:00:00Z" }, now),
    false,
  );
  assert.equal(
    hasDirectoryAccess({ role: "subscriber", subscriptionStatus: "active", currentPeriodEnd: "2026-10-24T00:00:00Z" }, now),
    true,
  );
  assert.equal(
    hasDirectoryAccess({ role: "admin", subscriptionStatus: "none", currentPeriodEnd: null }, now),
    true,
  );
});

test("plan amount is compared on the server, not trusted from the client", () => {
  const previousAmount = process.env.AIRWALLEX_PLAN_AMOUNT;
  const previousCurrency = process.env.AIRWALLEX_PLAN_CURRENCY;
  process.env.AIRWALLEX_PLAN_AMOUNT = "79";
  process.env.AIRWALLEX_PLAN_CURRENCY = "EUR";
  assert.equal(paymentMatchesPlan(79, "eur"), true);
  assert.equal(paymentMatchesPlan("79.00", "EUR"), true);
  assert.equal(paymentMatchesPlan(1, "EUR"), false);
  assert.equal(paymentMatchesPlan(79, "USD"), false);
  process.env.AIRWALLEX_PLAN_AMOUNT = previousAmount;
  process.env.AIRWALLEX_PLAN_CURRENCY = previousCurrency;
});

test("courier pages are not factories and junk addresses stay off the card", () => {
  assert.equal(inferCompanyType("中通快递 物流服务 工业制造客户案例 仓库招商"), "unknown");
  assert.equal(inferCompanyType("Chongqing helmet factory 制造 工厂 ECE DOT"), "factory");
  assert.equal(isPlausiblePhone("012345678901"), false);
  assert.equal(isPlausiblePhone("95311"), true);
  assert.equal(isPlausibleAddress("上海市青浦区华新镇华志路1685号"), true);
  assert.equal(
    isPlausibleAddress("上海市青浦区华新镇华志路1685号 邮政编码： 201708 物流服务中通普件我的快递运单查询ESG报告"),
    false,
  );
  const patch = fillEmptyFields(
    {
      name_zh: null,
      name_en: "ZTO",
      brand: null,
      company_type: "unknown",
      address: null,
      city: null,
      province: null,
      country: "CN",
      website: "https://www.zto.com",
      wechat: null,
      phone: null,
      email: null,
      export_markets: [],
    },
    {
      address: "上海市青浦区华新镇华志路1685号 我的快递运单查询",
      phone: "012345678901",
      export_markets: ["Global"],
    },
  );
  assert.equal(patch.address, undefined);
  assert.equal(patch.phone, undefined);
  assert.equal(patch.export_markets, undefined);
});
