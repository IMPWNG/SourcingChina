import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductList } from "@/components/product-list";
import { getLocale, getMessages } from "@/lib/i18n-server";
import { categoryLabel, companyTypeLabel, translated } from "@/lib/i18n";
import { directory } from "@/lib/store";

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const company = await directory.getPublished(id);
  return { title: company?.name_en || company?.name_zh || "Supplier" };
}

export default async function CompanyPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const [company, categories, t, locale] = await Promise.all([
    directory.getPublished(id),
    directory.listCategories(),
    getMessages(),
    getLocale(),
  ]);
  if (!company) notFound();
  const shared = company.products[0]?.details ?? {};
  const title = company.name_en || company.name_zh || company.brand || t.unnamed;
  const city = translated(shared, "city", locale, company.city);
  const website = company.website?.startsWith("fixture:") ? null : company.website;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <p>
        <Link href="/directory" className="text-sm text-muted-foreground hover:text-foreground">
          {t.back}
        </Link>
      </p>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <Badge variant="outline">{companyTypeLabel(company.company_type, locale)}</Badge>
        </div>
        {company.brand ? <p className="text-sm">{t.brand}: {translated(shared, "brand", locale, company.brand)}</p> : null}
      </header>
      <div className="flex flex-wrap gap-2">
        {company.category_ids.map((categoryId) => {
          const category = categories.find((item) => item.id === categoryId);
          return category ? <Badge key={categoryId}>{categoryLabel(category.slug, locale, category.name_en)}</Badge> : null;
        })}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t.company}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{[translated(shared, "address", locale, company.address), city, company.province, company.country].filter(Boolean).join(", ") || t.addressMissing}</p>
          <p>{t.phone}: {company.phone || t.notOnFile}</p>
          <p>{t.email}: {company.email || t.notOnFile}</p>
          <p>{t.wechat}: {company.wechat || t.notOnFile}</p>
          {company.wechat_qr_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.wechat_qr_url} alt={t.wechatQr} width={128} height={128} className="h-32 w-32 rounded-md border object-contain" />
          ) : null}
          <p>
            {t.website}:{" "}
            {website ? (
              <a className="underline" href={website} rel="noreferrer" target="_blank">
                {website.replace(/^https?:\/\//, "")}
              </a>
            ) : company.website?.startsWith("fixture:") ? (
              <Link href="/fixtures/sample-supplier" className="underline">
                {t.samplePage}
              </Link>
            ) : (
              t.notOnFile
            )}
          </p>
          <p>{t.markets}: {company.export_markets.length ? company.export_markets.join(", ") : t.notStated}</p>
        </CardContent>
      </Card>
      {company.products.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.products}</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductList products={company.products} categories={categories} locale={locale} empty={t.noProducts} />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{t.familiesTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {company.families.length === 0 ? (
            <p className="text-muted-foreground">{t.noFamilies}</p>
          ) : (
            company.families.map((family) => (
              <div key={family.id}>
                <p className="font-medium">{family.name}</p>
                {family.description ? <p className="text-muted-foreground">{family.description}</p> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
      {company.certifications.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.certs}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {company.certifications.map((cert) => (
              <Badge key={cert.id} variant="secondary">
                {cert.code}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}
      {company.factories.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.factories}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {company.factories.map((factory) => (
              <p key={factory.id}>
                {factory.name}
                {factory.address ? ` — ${factory.address}` : ""}
                {factory.city ? `, ${factory.city}` : ""}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}
      {company.contacts.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Public contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {company.contacts.map((contact) => (
              <p key={contact.id}>
                {contact.name}
                {contact.title ? `, ${contact.title}` : ""}
                {contact.email ? ` · ${contact.email}` : ""}
                {contact.phone ? ` · ${contact.phone}` : ""}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <p className="text-xs text-muted-foreground">Data as collected from public materials; verify before business use.</p>
    </main>
  );
}
