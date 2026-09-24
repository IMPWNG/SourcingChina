"use client";

import { useRouter } from "next/navigation";
import { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Category } from "@/lib/records";
import type { DirectoryFilters } from "@/lib/records";

const selectClass = "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm";

export function DirectorySearch({
  categories,
  provinces,
  cities,
  initial,
}: {
  categories: Category[];
  provinces: string[];
  cities: string[];
  initial: DirectoryFilters;
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
        <Label htmlFor="q">Name, brand, or city</Label>
        <Input id="q" name="q" defaultValue={initial.q ?? ""} placeholder="Helmets in Chongqing" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <select id="category" name="category" defaultValue={initial.category ?? ""} className={selectClass}>
          <option value="">Any category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name_en}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="companyType">Company type</Label>
        <select id="companyType" name="companyType" defaultValue={initial.companyType ?? ""} className={selectClass}>
          <option value="">Any type</option>
          <option value="factory">Factory</option>
          <option value="trading">Trading company</option>
          <option value="mixed">Factory and trading</option>
          <option value="unknown">Not classified</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="province">Province</Label>
        <select id="province" name="province" defaultValue={initial.province ?? ""} className={selectClass}>
          <option value="">Any province</option>
          {provinces.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="city">City</Label>
        <select id="city" name="city" defaultValue={initial.city ?? ""} className={selectClass}>
          <option value="">Any city</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="hasEmail" defaultChecked={initial.hasEmail} />
        Has an email
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="hasWebsite" defaultChecked={initial.hasWebsite} />
        Has a website
      </label>
      <div className="flex gap-2">
        <Button type="submit">Search</Button>
        <Button type="button" variant="outline" onClick={() => router.push("/directory")}>
          Clear
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
            <Button variant="outline">Filters</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filter suppliers</SheetTitle>
            </SheetHeader>
            <div className="px-4">{fields}</div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
