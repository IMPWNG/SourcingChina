"use client";

import { useRouter } from "next/navigation";
import { FormEvent } from "react";
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
}: {
  categories: Category[];
  provinces: string[];
  cities: string[];
  initial: DirectoryFilters;
  locale: Locale;
  labels: Messages;
}) {
  const router = useRouter();

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
    router.push(params.size ? `/directory?${params}` : "/directory");
  }

  const fields = (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="q">{labels.searchLabel}</Label>
        <Input id="q" name="q" defaultValue={initial.q ?? ""} placeholder={labels.searchPlaceholder} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="category">{labels.category}</Label>
        <select id="category" name="category" defaultValue={initial.category ?? ""} className={selectClass}>
          <option value="">{labels.anyCategory}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {categoryLabel(category.slug, locale, category.name_en)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="companyType">{labels.companyType}</Label>
        <select id="companyType" name="companyType" defaultValue={initial.companyType ?? ""} className={selectClass}>
          <option value="">{labels.anyType}</option>
          <option value="factory">{companyTypeLabel("factory", locale)}</option>
          <option value="trading">{companyTypeLabel("trading", locale)}</option>
          <option value="mixed">{companyTypeLabel("mixed", locale)}</option>
          <option value="unknown">{companyTypeLabel("unknown", locale)}</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="province">{labels.province}</Label>
        <select id="province" name="province" defaultValue={initial.province ?? ""} className={selectClass}>
          <option value="">{labels.anyProvince}</option>
          {provinces.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="city">{labels.city}</Label>
        <select id="city" name="city" defaultValue={initial.city ?? ""} className={selectClass}>
          <option value="">{labels.anyCity}</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="hasEmail" defaultChecked={initial.hasEmail} />
        {labels.hasEmail}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="hasWebsite" defaultChecked={initial.hasWebsite} />
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
      <div className="hidden md:block">{fields}</div>
      <div className="md:hidden">
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
      </div>
    </>
  );
}
