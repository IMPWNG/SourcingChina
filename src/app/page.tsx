import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocale, getMessages } from "@/lib/i18n-server";
import { categoryLabel } from "@/lib/i18n";
import { CATEGORIES } from "@/lib/seed";

export default async function HomePage() {
  const [t, locale] = await Promise.all([getMessages(), getLocale()]);
  const questions = [
    { q: t.q1, a: t.a1 },
    { q: t.q2, a: t.a2 },
    { q: t.q3, a: t.a3 },
    { q: t.q4, a: t.a4 },
  ];
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.3fr_0.7fr] md:py-24">
        <div className="space-y-6">
          <Badge variant="secondary">{t.badge}</Badge>
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">{t.hero}</h1>
          <p className="max-w-xl text-lg text-muted-foreground">{t.heroBody}</p>
          <p className="max-w-xl text-muted-foreground">{t.heroSupport}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/directory">{t.seeAccess}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">{t.signIn}</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t.heroNote}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t.profileTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{t.profile1}</p>
            <p>{t.profile2}</p>
            <p>{t.profile3}</p>
            <p>{t.profile4}</p>
            <p>{t.profile5}</p>
          </CardContent>
        </Card>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{t.notMarket}</h2>
            <p className="mt-4 text-sm text-muted-foreground">{t.notMarketLead}</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>{t.noPrices}</li>
              <li>{t.noSkus}</li>
              <li>{t.noStands}</li>
              <li>{t.noOutreach}</li>
              <li>{t.unpublished}</li>
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{t.how}</h2>
            <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">{t.step1}.</span> {t.step1Body}
              </li>
              <li>
                <span className="font-medium text-foreground">{t.step2}.</span> {t.step2Body}
              </li>
              <li>
                <span className="font-medium text-foreground">{t.step3}.</span> {t.step3Body}
              </li>
            </ol>
            <p className="mt-4 text-sm">{t.decide}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight">{t.faqTitle}</h2>
        <div className="mt-6 space-y-6 text-sm">
          {questions.map((item) => (
            <div key={item.q}>
              <h3 className="font-medium">{item.q}</h3>
              <p className="mt-2 text-muted-foreground">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight">{t.families}</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{t.familiesLead}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              href={`/directory?category=${category.slug}`}
              className="rounded-lg border border-border bg-card px-3 py-3 text-sm font-medium hover:bg-accent"
            >
              {categoryLabel(category.slug, locale, category.name_en)}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
