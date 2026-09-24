import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { directory } from "@/lib/store";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = params.status === "draft" || params.status === "published" ? params.status : "all";
  const companies = await directory.adminList(status);
  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        <Button asChild>
          <Link href="/admin/companies/new">New company</Link>
        </Button>
      </div>
      <div className="flex gap-2 text-sm">
        {(["all", "draft", "published"] as const).map((item) => (
          <Link key={item} href={item === "all" ? "/admin/companies" : `/admin/companies?status=${item}`} className={item === status ? "underline" : "text-muted-foreground"}>
            {item}
          </Link>
        ))}
      </div>
      {companies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No companies in this view.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {companies.map((company) => (
            <li key={company.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <Link href={`/admin/companies/${company.id}`} className="font-medium hover:underline">
                  {company.name_en || company.name_zh || "Unnamed draft"}
                </Link>
                <p className="text-xs text-muted-foreground">{company.name_zh}</p>
              </div>
              <Badge variant={company.is_published ? "default" : "secondary"}>{company.is_published ? "Published" : "Draft"}</Badge>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
