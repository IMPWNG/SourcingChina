import type { Metadata } from "next";
import Link from "next/link";
import { DirectorySearch } from "@/components/directory-search";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { directory } from "@/lib/store";
import type { DirectoryFilters } from "@/lib/records";

export const metadata: Metadata = { title: "Directory" };

const TYPES = new Set(["factory", "trading", "mixed", "unknown"]);

function title(company: { name_en: string | null; name_zh: string | null; brand: string | null }) {
  return company.name_en || company.name_zh || company.brand || "Unnamed supplier";
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const filters: DirectoryFilters = {
    q: one("q") || undefined,
    category: one("category") || undefined,
    companyType: TYPES.has(one("companyType") ?? "") ? one("companyType") : undefined,
    province: one("province") || undefined,
    city: one("city") || undefined,
    hasEmail: one("hasEmail") === "1",
    hasWebsite: one("hasWebsite") === "1",
  };
  const [categories, companies] = await Promise.all([directory.listCategories(), directory.search(filters)]);
  const all = filters.q || filters.category || filters.companyType || filters.province || filters.city || filters.hasEmail || filters.hasWebsite
    ? await directory.search({})
    : companies;
  const provinceOptions = Array.from(new Set(all.map((company) => company.province).filter(Boolean) as string[])).sort();
  const cityOptions = Array.from(new Set(all.map((company) => company.city).filter(Boolean) as string[])).sort();

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[260px_1fr]">
      <aside className="md:sticky md:top-6 md:self-start">
        <DirectorySearch categories={categories} provinces={provinceOptions} cities={cityOptions} initial={filters} />
      </aside>
      <section className="space-y-4">
        {params.access === "demo" ? (
          <Alert>
            <AlertDescription>Demo access is active on this machine for 30 days. It is not an Airwallex payment.</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">{companies.length} published</p>
        </div>
        {companies.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No suppliers match</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Try another city or category. Unpublished drafts are hidden until an editor publishes them.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {companies.map((company) => (
              <li key={company.id}>
                <Link href={`/directory/${company.id}`} className="block rounded-xl border border-border bg-card p-4 transition hover:bg-accent">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium">{title(company)}</h2>
                    <Badge variant="outline">{company.company_type}</Badge>
                  </div>
                  {company.name_zh ? <p className="mt-1 text-sm text-muted-foreground">{company.name_zh}</p> : null}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {[company.city, company.province].filter(Boolean).join(", ") || "Location not on file"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {company.category_ids.map((id) => {
                      const category = categories.find((item) => item.id === id);
                      return category ? (
                        <Badge key={id} variant="secondary">
                          {category.name_en}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Data as collected from public materials; verify before business use.</p>
      </section>
    </main>
  );
}
