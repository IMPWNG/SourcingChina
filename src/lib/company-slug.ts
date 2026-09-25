const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCompanyId(value: string): boolean {
  return UUID.test(value);
}

export function slugifyCompanyName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[，。、]/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function companySlug(company: {
  id: string;
  name_en: string | null;
  name_zh: string | null;
  brand: string | null;
}): string {
  const base =
    slugifyCompanyName(company.name_en ?? "") ||
    slugifyCompanyName(company.brand ?? "") ||
    slugifyCompanyName(company.name_zh ?? "");
  return base || `supplier-${company.id.slice(0, 8)}`;
}

/** Prefer the bare name slug; append a short id only when another company shares it. */
export function uniqueCompanySlug(
  company: { id: string; name_en: string | null; name_zh: string | null; brand: string | null },
  others: { id: string; name_en: string | null; name_zh: string | null; brand: string | null }[],
): string {
  const base = companySlug(company);
  const clash = others.some((item) => item.id !== company.id && companySlug(item) === base);
  return clash ? `${base}-${company.id.slice(0, 8)}` : base;
}

export function companyDirectoryPath(
  company: { id: string; name_en: string | null; name_zh: string | null; brand: string | null },
  others: { id: string; name_en: string | null; name_zh: string | null; brand: string | null }[] = [],
): string {
  return `/directory/${uniqueCompanySlug(company, others)}`;
}

export function matchCompanySlug<
  T extends { id: string; name_en: string | null; name_zh: string | null; brand: string | null },
>(slug: string, companies: T[]): T | null {
  const exact = companies.find((item) => uniqueCompanySlug(item, companies) === slug);
  if (exact) return exact;
  return companies.find((item) => companySlug(item) === slug) ?? null;
}
