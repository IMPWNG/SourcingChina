import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORIES } from "@/lib/seed";

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.3fr_0.7fr] md:py-24">
        <div className="space-y-6">
          <Badge variant="secondary">Motorcycle suppliers in China</Badge>
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            Find the factory behind the business card.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            SourcingChina is a paid directory of motorcycle-industry companies: factories, trading houses, and brands. Each record is taken from a card or a public website, then reviewed before it is published.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/pricing">See directory access</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>What a profile contains</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Chinese and English names, kept separate. Brand, city, province, and whether the company builds, trades, or both.</p>
            <p>Company phone, email, WeChat, and website when they appear on the card or the company site.</p>
            <p>Product families — helmets, electrical, batteries — not a parts catalogue.</p>
          </CardContent>
        </Card>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">A directory, not a marketplace</h2>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>No prices, stock, or SKU lists.</li>
              <li>No stand numbers, hall names, or visit dates.</li>
              <li>No outreach tools and no raw email dump.</li>
              <li>Unpublished drafts stay invisible to subscribers.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">How a company gets in</h2>
            <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>1. A business card is uploaded and read into a draft.</li>
              <li>2. If the card has a website, a narrow scrape can fill empty fields and product families.</li>
              <li>3. An editor checks the draft and publishes it.</li>
            </ol>
            <p className="mt-4 text-sm">The first batch comes from the Chongqing motorcycle trade show. The public site does not show the show itself.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight">Product families in the taxonomy</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {CATEGORIES.map((category) => (
            <div key={category.slug} className="rounded-lg border border-border bg-card px-3 py-3">
              <p className="text-sm font-medium">{category.name_en}</p>
              <p className="text-xs text-muted-foreground">{category.name_zh}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
