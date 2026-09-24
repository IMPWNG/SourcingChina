import type { Metadata } from "next";
import { addCategory } from "@/app/actions/admin";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { directory } from "@/lib/store";

export const metadata: Metadata = { title: "Taxonomy" };

export default async function TaxonomyPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const categories = await directory.listCategories();
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Product categories</h1>
      {params.error ? (
        <Alert variant="destructive">
          <AlertDescription>Use a lowercase slug such as brake-parts, plus an English name.</AlertDescription>
        </Alert>
      ) : null}
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {categories.map((category) => (
          <li key={category.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>{category.name_en}</span>
            <span className="text-muted-foreground">{category.name_zh} · {category.slug}</span>
          </li>
        ))}
      </ul>
      <form action={addCategory} className="grid gap-3">
        <div className="space-y-2">
          <Label htmlFor="name_en">English name</Label>
          <Input id="name_en" name="name_en" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name_zh">Chinese name</Label>
          <Input id="name_zh" name="name_zh" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" name="slug" placeholder="brake-parts" required />
        </div>
        <SubmitButton>Add category</SubmitButton>
      </form>
    </main>
  );
}
