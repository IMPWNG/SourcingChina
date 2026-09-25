import type { Metadata } from "next";
import Link from "next/link";
import { DirectorySearch } from "@/components/directory-search";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocale, getMessages } from "@/lib/i18n-server";
import { categoryLabel, companyTypeLabel } from "@/lib/i18n";
import { directory } from "@/lib/store";
import type { DirectoryFilters } from "@/lib/records";

export const metadata: Metadata = { title: "Directory" };

const TYPES = new Set(["factory", "trading", "mixed", "unknown"]);

function title(company: { name_en: string | null; name_zh: string | null; brand: string | null }) {
  return company.name_en || company.name_zh || company.brand || "";
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
  const [categories, companies, places, t, locale] = await Promise.all([
    directory.listCategories(),
    directory.search(filters),
    directory.listPlaces(),
    getMessages(),
    getLocale(),
  ]);

  return (
    <main className="mx-auto grid h-full max-w-6xl md:grid-cols-[260px_1fr]">
      <aside className="hidden h-full md:block">
        <div className="flex h-full items-center px-4">
          <div className="w-full">
            <DirectorySearch mode="panel" categories={categories} provinces={places.provinces} cities={places.cities} initial={filters} locale={locale} labels={t} />
          </div>
        </div>
      </aside>
      <div className="flex h-full min-h-0 flex-col">
        <div className="px-4 pt-4 md:hidden">
          <DirectorySearch mode="sheet" categories={categories} provinces={places.provinces} cities={places.cities} initial={filters} locale={locale} labels={t} />
        </div>
      <section className="h-full min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-8">
        {params.access === "demo" ? (
          <Alert>
            <AlertDescription>{t.demoAccess}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{t.suppliers}</h1>
          <p className="text-sm text-muted-foreground">{companies.length} {t.published}</p>
        </div>
        {companies.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t.noMatch}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {t.noMatchBody}
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {companies.map((company) => (
              <li key={company.id}>
                <Link href={`/directory/${company.id}`} className="block rounded-xl border border-border bg-card p-4 transition hover:bg-accent">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium">{title(company) || t.unnamed}</h2>
                    <Badge variant="outline">{companyTypeLabel(company.company_type, locale)}</Badge>
                  </div>
                  {company.name_zh && !company.name_en ? <p className="mt-1 text-sm text-muted-foreground">{company.name_zh}</p> : null}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {[company.city, company.province].filter(Boolean).join(", ") || t.locationMissing}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {company.category_ids.map((id) => {
                      const category = categories.find((item) => item.id === id);
                      return category ? (
                        <Badge key={id} variant="secondary">
                          {categoryLabel(category.slug, locale, category.name_en)}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{t.disclaimer}</p>
      </section>
      </div>
    </main>
  );
}
