import assert from "node:assert/strict";
import test from "node:test";
import { crawlWebsite } from "./crawl";
import { extractFromHtml } from "./extract";
import { ROBOTS_DENY, SAMPLE_SUPPLIER_HTML } from "./fixture";

test("fixture page yields families and certs without prices or SKUs", () => {
  const extracted = extractFromHtml(SAMPLE_SUPPLIER_HTML, "https://fixture.local/sample-supplier");
  assert.deepEqual(
    extracted.families.map((family) => family.name),
    ["Textile riding jackets", "Protective gloves", "Rain suits"],
  );
  assert.ok(extracted.certifications.includes("CE"));
  assert.ok(extracted.certifications.includes("ISO9001"));
  assert.equal(extracted.email, "hello@liangjiang-apparel.example");
  const office = extractFromHtml(
    "<html><body><p>联系我们 惠州： 惠州市仲恺高新区黄屋路1号超力源科技园 无锡： 无锡市新吴区震泽路18-17号 电话：0752-2318598 邮箱：sp@superpowertech.com</p></body></html>",
    "http://www.superpowertech.com/h-col-185.html",
  );
  assert.equal(office.contacts[0]?.phone, "0752-2318598");
  assert.equal(office.contacts[0]?.email, "sp@superpowertech.com");
  assert.equal(office.factories.some((item) => item.city === "无锡"), true);
  assert.equal("sku" in extracted, false);
  assert.equal(extracted.families.some((family) => /sku|price|\$|€/i.test(family.name)), false);
});

test("wechat digits, whatsapp links, and QR images are kept", () => {
  const page = extractFromHtml(
    `<html><body>
      <p>Wechat：+86 18324278211 乐清市</p>
      <a href="https://wa.me/8618324278211">WhatsApp</a>
      <img alt="service qrcode" src="//cdn.example/wechat-qr.png">
    </body></html>`,
    "https://www.rng-helmets.com/h-col-118.html",
  );
  assert.equal(page.wechat, "+86 18324278211");
  assert.equal(page.phone?.replace(/\D/g, "").slice(-11), "18324278211");
  assert.equal(page.wechat_qr_url, "https://cdn.example/wechat-qr.png");
  assert.equal(page.city, "Yueqing");
  assert.equal(page.province, "Zhejiang");
});

test("courier homepages do not dump menus as the address or invent phones", () => {
  const page = extractFromHtml(
    `<html><head><meta charset="UTF-8"></head><body>
      <p>地址：上海市青浦区华新镇华志路1685号 邮政编码： 201708 物流服务中通普件中通好快我的快递运单查询服务支持ESG报告</p>
      <p>工业制造客户案例 快递 仓库招商</p>
      <p>012345678901 BEARER-TOKEN UTF-8</p>
    </body></html>`,
    "https://www.zto.com/",
  );
  assert.equal(page.address, "上海市青浦区华新镇华志路1685号");
  assert.equal(page.phone, null);
  assert.equal(page.contacts.some((item) => item.phone === "012345678901"), false);
  assert.equal(page.company_type, "unknown");
});

test("crawl respects robots.txt and the local fixture", async () => {
  const fixture = await crawlWebsite("fixture://sample-supplier");
  assert.equal(fixture.status, "succeeded");
  assert.ok((fixture.patch?.families.length ?? 0) >= 1);
  assert.ok(fixture.patch?.phone);

  const blocked = await crawlWebsite("https://blocked.example/", async () => {
    return new Response(ROBOTS_DENY, { status: 200, headers: { "content-type": "text/plain" } });
  });
  assert.equal(blocked.status, "skipped");
  assert.equal(blocked.error, "robots");
});
