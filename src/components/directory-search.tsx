"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { categoryLabel, companyTypeLabel, type Locale, type Messages } from "@/lib/i18n";
import type { Category } from "@/lib/records";
import type { DirectoryFilters } from "@/lib/records";

const selectClass = "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm";

export function DirectorySearch({
  categories,
  provinces,
  cities,
  initial,
  locale,
  labels,
  mode = "both",
}: {
  categories: Category[];
  provinces: string[];
  cities: string[];
  initial: DirectoryFilters;
  locale: Locale;
  labels: Messages;
  mode?: "both" | "panel" | "sheet";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of ["q", "category", "companyType", "province", "city"]) {
      const value = String(data.get(key) ?? "").trim();
      if (value) params.set(key, value);
    }
    if (data.get("hasEmail") === "on") params.set("hasEmail", "1");
    if (data.get("hasWebsite") === "on") params.set("hasWebsite", "1");
    const href = params.size ? `/directory?${params}` : "/directory";
    startTransition(() => router.replace(href));
  }

  function apply(event: FormEvent<HTMLSelectElement | HTMLInputElement>) {
    event.currentTarget.form?.requestSubmit();
  }

  const prefix = mode === "sheet" ? "sheet-" : "";
  const fields = (
    <form onSubmit={submit} className="space-y-4" aria-busy={pending} data-pending={pending ? "" : undefined}>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}q`}>{labels.searchLabel}</Label>
        <Input id={`${prefix}q`} name="q" defaultValue={initial.q ?? ""} placeholder={labels.searchPlaceholder} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}category`}>{labels.category}</Label>
        <select id={`${prefix}category`} name="category" defaultValue={initial.category ?? ""} className={selectClass} onChange={apply}>
          <option value="">{labels.anyCategory}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {categoryLabel(category.slug, locale, category.name_en)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}companyType`}>{labels.companyType}</Label>
        <select id={`${prefix}companyType`} name="companyType" defaultValue={initial.companyType ?? ""} className={selectClass} onChange={apply}>
          <option value="">{labels.anyType}</option>
          <option value="factory">{companyTypeLabel("factory", locale)}</option>
          <option value="trading">{companyTypeLabel("trading", locale)}</option>
          <option value="mixed">{companyTypeLabel("mixed", locale)}</option>
          <option value="unknown">{companyTypeLabel("unknown", locale)}</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}province`}>{labels.province}</Label>
        <select id={`${prefix}province`} name="province" defaultValue={initial.province ?? ""} className={selectClass} onChange={apply}>
          <option value="">{labels.anyProvince}</option>
          {provinces.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}city`}>{labels.city}</Label>
        <select id={`${prefix}city`} name="city" defaultValue={initial.city ?? ""} className={selectClass} onChange={apply}>
          <option value="">{labels.anyCity}</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="hasEmail" defaultChecked={initial.hasEmail} onChange={apply} />
        {labels.hasEmail}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="hasWebsite" defaultChecked={initial.hasWebsite} onChange={apply} />
        {labels.hasWebsite}
      </label>
      <div className="flex gap-2">
        <Button type="submit">{labels.search}</Button>
        <Button type="button" variant="outline" onClick={() => router.push("/directory")}>
          {labels.clear}
        </Button>
      </div>
    </form>
  );

  return (
    <>
      {mode !== "sheet" ? <div className={mode === "panel" ? undefined : "hidden md:block"}>{fields}</div> : null}
      {mode !== "panel" ? <div className={mode === "sheet" ? undefined : "md:hidden"}>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">{labels.filters}</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{labels.filterSuppliers}</SheetTitle>
            </SheetHeader>
            <div className="px-4">{fields}</div>
          </SheetContent>
        </Sheet>
      </div> : null}
    </>
  );
}
