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
  assert.equal("sku" in extracted, false);
  assert.equal(extracted.families.some((family) => /sku|price|\$|€/i.test(family.name)), false);
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
