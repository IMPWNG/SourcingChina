import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getLocale, getMessages } from "@/lib/i18n-server";
import { categoryLabel } from "@/lib/i18n";
import { CATEGORIES } from "@/lib/seed";

export default async function HomePage() {
  const [t, locale] = await Promise.all([getMessages(), getLocale()]);
  const facts = [t.profile1, t.profile2, t.profile3, t.profile4, t.profile5];
  const limits = [t.noPrices, t.noSkus, t.noStands, t.noOutreach, t.unpublished];
  const steps = [
    { title: t.step1, body: t.step1Body },
    { title: t.step2, body: t.step2Body },
    { title: t.step3, body: t.step3Body },
  ];
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
      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-16 md:py-24">
          <p className="text-sm font-medium text-muted-foreground">{t.badge}</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">{t.hero}</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{t.heroBody}</p>
          <p className="mt-3 max-w-2xl text-muted-foreground">{t.heroSupport}</p>
          <div className="mt-8">
            <Button size="lg" asChild>
              <Link href="/directory">{t.seeAccess}</Link>
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{t.heroNote}</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight">{t.problemTitle}</h2>
        <p className="mt-4 text-muted-foreground">{t.problemBody}</p>
        <p className="mt-4">{t.gather}</p>
        <p className="mt-3 text-muted-foreground">{t.reviewed}</p>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">{t.profileTitle}</h2>
          <p className="mt-4 text-muted-foreground">{t.profileLead}</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
            {facts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-6">{t.recordClose}</p>
          <Button className="mt-6" variant="outline" asChild>
            <Link href="/pricing">{t.seeTerms}</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight">{t.notMarket}</h2>
        <p className="mt-4 text-muted-foreground">{t.notMarketLead}</p>
        <ul className="mt-4 space-y-2 text-sm">
          {limits.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-6">{t.decide}</p>
      </section>

      <section className="border-y border-border">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">{t.how}</h2>
          <ol className="mt-6 space-y-5">
            {steps.map((step, index) => (
              <li key={step.title}>
                <p className="font-medium">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight">{t.families}</h2>
        <p className="mt-4 text-muted-foreground">{t.familiesLead}</p>
        <p className="mt-4 text-sm leading-7">
          {CATEGORIES.map((category, index) => (
            <span key={category.slug}>
              {index > 0 ? " · " : null}
              <Link href={`/directory?category=${category.slug}`} className="underline-offset-4 hover:underline">
                {categoryLabel(category.slug, locale, category.name_en)}
              </Link>
            </span>
          ))}
        </p>
        <Button className="mt-6" asChild>
          <Link href="/directory">{t.openCatalog}</Link>
        </Button>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">{t.faqTitle}</h2>
          <div className="mt-6 space-y-6">
            {questions.map((item) => (
              <div key={item.q}>
                <h3 className="font-medium">{item.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">{t.closeTitle}</h2>
        <p className="mt-4 text-muted-foreground">{t.closeBody}</p>
        <Button className="mt-6" size="lg" asChild>
          <Link href="/pricing">{t.buyAccess}</Link>
        </Button>
        <p className="mt-3 text-sm text-muted-foreground">{t.closeNote}</p>
      </section>
    </main>
  );
}
