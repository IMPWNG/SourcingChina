import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addCert,
  addContact,
  addFactory,
  addFamily,
  applyScrape,
  deleteCert,
  deleteContact,
  deleteFactory,
  deleteFamily,
  runScrape,
  setContactPublic,
  setPublished,
  updateCompany,
} from "@/app/actions/admin";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProductList } from "@/components/product-list";
import { catalogNotice } from "@/lib/scrapegraph/catalog-message";
import { directory } from "@/lib/store";

const selectClass = "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const company = await directory.adminGet(id);
  return { title: company?.name_en || company?.name_zh || "Company" };
}

export default async function AdminCompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const [company, categories] = await Promise.all([directory.adminGet(id), directory.listCategories()]);
  if (!company) notFound();
  const notice = catalogNotice(query.catalog, query.products);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <p className="text-sm">
        <Link href="/admin/companies" className="text-muted-foreground hover:text-foreground">
          All companies
        </Link>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{company.name_en || company.name_zh || "Unnamed draft"}</h1>
        <Badge variant={company.is_published ? "default" : "secondary"}>{company.is_published ? "Published" : "Draft"}</Badge>
      </div>
      {query.warning === "scrapegraph" ? (
        <Alert variant="destructive">
          <AlertDescription>
            ScrapeGraphAI could not read this card. The draft used Google Vision when that key is set, or the pasted text.
          </AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      {query.saved ? <Alert><AlertDescription>Saved.</AlertDescription></Alert> : null}
      {query.applied ? <Alert><AlertDescription>Scrape proposal applied to empty fields.</AlertDescription></Alert> : null}
      {query.error === "recent" ? (
        <Alert>
          <AlertDescription>This website was scraped in the last 7 days. Tick “Scrape again” to run it anyway.</AlertDescription>
        </Alert>
      ) : null}
      {query.error === "noweb" ? (
        <Alert variant="destructive">
          <AlertDescription>Add a website before scraping. The crawler will not invent one.</AlertDescription>
        </Alert>
      ) : null}
      {query.scrape === "failed" || query.scrape === "skipped" ? (
        <Alert>
          <AlertDescription>Scrape {query.scrape}. Existing card data was left as-is.</AlertDescription>
        </Alert>
      ) : null}

      <form action={setPublished}>
        <input type="hidden" name="id" value={company.id} />
        <input type="hidden" name="published" value={company.is_published ? "false" : "true"} />
        <SubmitButton variant="outline">{company.is_published ? "Unpublish" : "Publish"}</SubmitButton>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateCompany} className="space-y-3">
            <input type="hidden" name="id" value={company.id} />
            <Pair label="English name" name="name_en" value={company.name_en} />
            <Pair label="Chinese name" name="name_zh" value={company.name_zh} />
            <Pair label="Brand" name="brand" value={company.brand} />
            <div className="space-y-2">
              <Label htmlFor="company_type">Type</Label>
              <select id="company_type" name="company_type" className={selectClass} defaultValue={company.company_type}>
                <option value="factory">Factory</option>
                <option value="trading">Trading</option>
                <option value="mixed">Mixed</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <Pair label="Address" name="address" value={company.address} />
            <Pair label="City" name="city" value={company.city} />
            <Pair label="Province" name="province" value={company.province} />
            <Pair label="Country" name="country" value={company.country} />
            <Pair label="Website" name="website" value={company.website} />
            <Pair label="WeChat" name="wechat" value={company.wechat} />
            <Pair label="Phone" name="phone" value={company.phone} />
            <Pair label="Email" name="email" value={company.email} />
            <Pair label="Export markets" name="export_markets" value={company.export_markets.join(", ")} />
            <div className="grid grid-cols-2 gap-2 text-sm">
              {categories.map((category) => (
                <label key={category.id} className="flex items-center gap-2">
                  <input type="checkbox" name="category_id" value={category.id} defaultChecked={company.category_ids.includes(category.id)} />
                  {category.name_en}
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Admin notes</Label>
              <Textarea id="notes" name="notes" defaultValue={company.notes ?? ""} />
            </div>
            <SubmitButton>Save changes</SubmitButton>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductList products={company.products} categories={categories} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Product families</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {company.families.length === 0 ? <p className="text-muted-foreground">None yet.</p> : null}
          {company.families.map((family) => (
            <form key={family.id} action={deleteFamily} className="flex items-center justify-between gap-2">
              <input type="hidden" name="company_id" value={company.id} />
              <input type="hidden" name="id" value={family.id} />
              <span>{family.name}</span>
              <SubmitButton variant="ghost" size="sm">Remove</SubmitButton>
            </form>
          ))}
          <form action={addFamily} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <input type="hidden" name="company_id" value={company.id} />
            <Input name="name" placeholder="Family name" required />
            <Input name="description" placeholder="Short description" />
            <SubmitButton size="sm">Add</SubmitButton>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Certifications and factories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            {company.certifications.map((cert) => (
              <form key={cert.id} action={deleteCert}>
                <input type="hidden" name="company_id" value={company.id} />
                <input type="hidden" name="id" value={cert.id} />
                <SubmitButton variant="outline" size="sm">{cert.code} ×</SubmitButton>
              </form>
            ))}
          </div>
          <form action={addCert} className="flex gap-2">
            <input type="hidden" name="company_id" value={company.id} />
            <Input name="code" placeholder="CCC, CE, ISO9001" />
            <SubmitButton size="sm">Add code</SubmitButton>
          </form>
          {company.factories.map((factory) => (
            <form key={factory.id} action={deleteFactory} className="flex items-center justify-between">
              <input type="hidden" name="company_id" value={company.id} />
              <input type="hidden" name="id" value={factory.id} />
              <span>{factory.name}</span>
              <SubmitButton variant="ghost" size="sm">Remove</SubmitButton>
            </form>
          ))}
          <form action={addFactory} className="grid gap-2 md:grid-cols-3">
            <input type="hidden" name="company_id" value={company.id} />
            <Input name="name" placeholder="Factory name" required />
            <Input name="address" placeholder="Address" />
            <Input name="city" placeholder="City" />
            <SubmitButton size="sm">Add factory</SubmitButton>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>People</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">Hidden on the public profile until you mark a contact public.</p>
          {company.contacts.map((contact) => (
            <div key={contact.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {contact.name}
                {contact.title ? `, ${contact.title}` : ""} {contact.is_public ? "(public)" : "(hidden)"}
              </span>
              <form action={setContactPublic}>
                <input type="hidden" name="company_id" value={company.id} />
                <input type="hidden" name="id" value={contact.id} />
                <input type="hidden" name="is_public" value={contact.is_public ? "false" : "true"} />
                <SubmitButton variant="outline" size="sm">{contact.is_public ? "Hide" : "Make public"}</SubmitButton>
              </form>
              <form action={deleteContact}>
                <input type="hidden" name="company_id" value={company.id} />
                <input type="hidden" name="id" value={contact.id} />
                <SubmitButton variant="ghost" size="sm">Remove</SubmitButton>
              </form>
            </div>
          ))}
          <form action={addContact} className="grid gap-2 md:grid-cols-2">
            <input type="hidden" name="company_id" value={company.id} />
            <Input name="name" placeholder="Name" required />
            <Input name="title" placeholder="Title" />
            <Input name="phone" placeholder="Phone" />
            <Input name="email" placeholder="Email" />
            <label className="flex items-center gap-2 md:col-span-2">
              <input type="checkbox" name="is_public" /> Show on the public profile
            </label>
            <SubmitButton size="sm">Add contact</SubmitButton>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Website enrichment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Last scrape: {company.last_scrape_status}
            {company.last_scraped_at ? ` · ${new Date(company.last_scraped_at).toLocaleString()}` : ""}
          </p>
          <form action={runScrape} className="space-y-2">
            <input type="hidden" name="company_id" value={company.id} />
            <label className="flex items-center gap-2">
              <input type="checkbox" name="force" /> Scrape again even if it ran this week
            </label>
            <SubmitButton pendingLabel="Fetching pages…">Run scrape</SubmitButton>
          </form>
          {company.scrape_jobs.filter((job) => job.status === "proposed").map((job) => (
            <form key={job.id} action={applyScrape} className="rounded-lg border border-border p-3">
              <input type="hidden" name="company_id" value={company.id} />
              <input type="hidden" name="job_id" value={job.id} />
              <p className="mb-2 text-muted-foreground">Proposed patch. Applying fills empty fields only and adds new families and codes.</p>
              <pre className="mb-3 max-h-48 overflow-auto font-mono text-xs">{JSON.stringify(job.proposed_patch, null, 2)}</pre>
              <SubmitButton size="sm">Apply proposal</SubmitButton>
            </form>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {company.sources.length === 0 ? <p className="text-muted-foreground">No card or website source yet.</p> : null}
          {company.sources.map((source) => (
            <details key={source.id} className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer">
                {source.source_type} · {source.url_or_ref || "no file"} · {new Date(source.captured_at).toLocaleString()}
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs">{source.raw_text || "No text stored."}</pre>
            </details>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}

function Pair({ label, name, value }: { label: string; name: string; value: string | null }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={value ?? ""} />
    </div>
  );
}
