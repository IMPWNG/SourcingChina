import assert from "node:assert/strict";
import test from "node:test";
import { companyDirectoryPath, companySlug, matchCompanySlug, uniqueCompanySlug } from "./company-slug";

test("supplier URLs use a slug from the English company name", () => {
  const company = {
    id: "f4405bd4-2fb5-4de6-a729-1cc5826eb288",
    name_en: "Huizhou Superpower Technology Co.，LTD.",
    name_zh: "惠州市超力源科技有限公司",
    brand: "超力源",
  };
  assert.equal(companySlug(company), "huizhou-superpower-technology-co-ltd");
  assert.equal(companyDirectoryPath(company), "/directory/huizhou-superpower-technology-co-ltd");
});

test("a name clash appends a short id", () => {
  const a = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name_en: "Acme Parts", name_zh: null, brand: null };
  const b = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name_en: "Acme Parts", name_zh: null, brand: null };
  assert.equal(uniqueCompanySlug(a, [a, b]), "acme-parts-aaaaaaaa");
  assert.equal(matchCompanySlug("acme-parts-bbbbbbbb", [a, b])?.id, b.id);
});
