import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { directory } from "@/lib/store";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHome() {
  const counts = await directory.counts();
  const items = [
    { label: "Companies", value: counts.companies, href: "/admin/companies" },
    { label: "Published", value: counts.published, href: "/admin/companies?status=published" },
    { label: "Drafts", value: counts.drafts, href: "/admin/companies?status=draft" },
    { label: "Categories", value: counts.categories, href: "/admin/taxonomy" },
  ];
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Editorial desk</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <Link key={item.label} href={item.href}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold">{item.value}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Upload a card, check the draft, then publish. Subscribers never see a company while it is unpublished.
      </p>
    </main>
  );
}
