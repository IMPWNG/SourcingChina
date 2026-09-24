import type { Metadata } from "next";
import { createCompany } from "@/app/actions/admin";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { directory } from "@/lib/store";

export const metadata: Metadata = { title: "New company" };

const selectClass = "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm";

export default async function NewCompanyPage() {
  const categories = await directory.listCategories();
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">New draft</h1>
      <form action={createCompany} className="space-y-4">
        <Field name="name_en" label="English name" />
        <Field name="name_zh" label="Chinese name" />
        <Field name="brand" label="Brand" />
        <div className="space-y-2">
          <Label htmlFor="company_type">Type</Label>
          <select id="company_type" name="company_type" className={selectClass} defaultValue="unknown">
            <option value="factory">Factory</option>
            <option value="trading">Trading</option>
            <option value="mixed">Mixed</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        <Field name="city" label="City" />
        <Field name="province" label="Province" />
        <Field name="website" label="Website" />
        <Field name="phone" label="Phone" />
        <Field name="email" label="Email" />
        <div className="space-y-2">
          <Label>Categories</Label>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {categories.map((category) => (
              <label key={category.id} className="flex items-center gap-2">
                <input type="checkbox" name="category_id" value={category.id} />
                {category.name_en}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Admin notes</Label>
          <Textarea id="notes" name="notes" />
        </div>
        <SubmitButton>Save draft</SubmitButton>
      </form>
    </main>
  );
}

function Field({ name, label }: { name: string; label: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} />
    </div>
  );
}
