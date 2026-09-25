import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocale, getMessages } from "@/lib/i18n-server";
import { categoryLabel } from "@/lib/i18n";
import { CATEGORIES } from "@/lib/seed";

export default async function HomePage() {
  const [t, locale] = await Promise.all([getMessages(), getLocale()]);
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      { "@type": "Question", name: t.q1, acceptedAnswer: { "@type": "Answer", text: t.a1 } },
      { "@type": "Question", name: t.q2, acceptedAnswer: { "@type": "Answer", text: t.a2 } },
      { "@type": "Question", name: t.q3, acceptedAnswer: { "@type": "Answer", text: t.a3 } },
    ],
  };
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.3fr_0.7fr] md:py-24">
        <div className="space-y-6">
          <Badge variant="secondary">{t.badge}</Badge>
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">{t.hero}</h1>
          <p className="max-w-xl text-lg text-muted-foreground">{t.heroBody}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/pricing">{t.seeAccess}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">{t.signIn}</Link>
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t.profileTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{t.profile1}</p>
            <p>{t.profile2}</p>
            <p>{t.profile3}</p>
          </CardContent>
        </Card>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{t.notMarket}</h2>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>{t.noPrices}</li>
              <li>{t.noStands}</li>
              <li>{t.noOutreach}</li>
              <li>{t.unpublished}</li>
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{t.how}</h2>
            <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>{t.step1}</li>
              <li>{t.step2}</li>
              <li>{t.step3}</li>
            </ol>
            <p className="mt-4 text-sm">{t.show}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight">{t.faqTitle}</h2>
        <div className="mt-6 space-y-6 text-sm">
          <div>
            <h3 className="font-medium">{t.q1}</h3>
            <p className="mt-2 text-muted-foreground">{t.a1}</p>
          </div>
          <div>
            <h3 className="font-medium">{t.q2}</h3>
            <p className="mt-2 text-muted-foreground">{t.a2}</p>
          </div>
          <div>
            <h3 className="font-medium">{t.q3}</h3>
            <p className="mt-2 text-muted-foreground">{t.a3}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight">{t.families}</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {CATEGORIES.map((category) => (
            <div key={category.slug} className="rounded-lg border border-border bg-card px-3 py-3">
              <p className="text-sm font-medium">{categoryLabel(category.slug, locale, category.name_en)}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
