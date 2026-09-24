import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { directory } from "@/lib/store";

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const company = await directory.getPublished(id);
  return { title: company?.name_en || company?.name_zh || "Supplier" };
}

export default async function CompanyPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const [company, categories] = await Promise.all([directory.getPublished(id), directory.listCategories()]);
  if (!company) notFound();
  const title = company.name_en || company.name_zh || company.brand || "Unnamed supplier";
  const website = company.website?.startsWith("fixture:") ? null : company.website;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <p>
        <Link href="/directory" className="text-sm text-muted-foreground hover:text-foreground">
          Back to search
        </Link>
      </p>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <Badge variant="outline">{company.company_type}</Badge>
        </div>
        {company.name_zh && company.name_en ? <p className="text-muted-foreground">{company.name_zh}</p> : null}
        {company.brand ? <p className="text-sm">Brand: {company.brand}</p> : null}
      </header>
      <div className="flex flex-wrap gap-2">
        {company.category_ids.map((categoryId) => {
          const category = categories.find((item) => item.id === categoryId);
          return category ? <Badge key={categoryId}>{category.name_en}</Badge> : null;
        })}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{[company.address, company.city, company.province, company.country].filter(Boolean).join(", ") || "Address not on file."}</p>
          <p>Phone: {company.phone || "Not on file"}</p>
          <p>Email: {company.email || "Not on file"}</p>
          <p>WeChat: {company.wechat || "Not on file"}</p>
          <p>
            Website:{" "}
            {website ? (
              <a className="underline" href={website} rel="noreferrer" target="_blank">
                {website.replace(/^https?:\/\//, "")}
              </a>
            ) : company.website?.startsWith("fixture:") ? (
              <Link href="/fixtures/sample-supplier" className="underline">
                Sample page used to demonstrate enrichment
              </Link>
            ) : (
              "Not on file"
            )}
          </p>
          <p>Export markets: {company.export_markets.length ? company.export_markets.join(", ") : "Not stated"}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Product families</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {company.families.length === 0 ? (
            <p className="text-muted-foreground">No product families have been reviewed for this company yet.</p>
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
            <CardTitle>Certifications named on file</CardTitle>
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
            <CardTitle>Factory addresses</CardTitle>
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
