import type { Metadata } from "next";
import Link from "next/link";
import { startCheckout } from "@/app/actions/billing";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth";
import { hasDirectoryAccess, planAmount, planCurrency } from "@/lib/domain";
import { isLiveBilling } from "@/lib/env";

export const metadata: Metadata = { title: "Pricing" };

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const amount = planAmount();
  const currency = planCurrency();
  const live = isLiveBilling();

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Directory access</h1>
        <p className="text-muted-foreground">
          {currency} {amount.toFixed(2)} for 30 days. You are buying a reviewed directory, not a spreadsheet of addresses.
        </p>
      </div>
      {params.reason === "subscribe" ? (
        <Alert>
          <AlertDescription>The directory is open to active subscribers. Admins can review drafts without a subscription.</AlertDescription>
        </Alert>
      ) : null}
      {params.reason === "admin" ? (
        <Alert>
          <AlertDescription>That area is for editors. Subscriber accounts stay on the directory.</AlertDescription>
        </Alert>
      ) : null}
      {params.error === "rate" ? (
        <Alert variant="destructive">
          <AlertDescription>Too many checkout attempts. Wait a few minutes and try again.</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>30-day pass</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-3xl font-semibold">
            {currency} {amount.toFixed(0)}
            <span className="text-base font-normal text-muted-foreground"> / 30 days</span>
          </p>
          <ul className="space-y-1 text-muted-foreground">
            <li>Search by name, brand, city, and product family.</li>
            <li>Open company profiles with the contact channels printed on the card or the company site.</li>
            <li>Renew from this page before the period ends. Access stops when the period ends.</li>
          </ul>
          {!live ? (
            <p className="text-muted-foreground">
              Airwallex keys are not configured, so checkout opens a demo confirmation and does not charge a card.
            </p>
          ) : (
            <p className="text-muted-foreground">Payment is taken by Airwallex. Access is granted only after the signed webhook confirms the exact amount.</p>
          )}
          {user && hasDirectoryAccess(user) ? (
            <Button asChild>
              <Link href="/directory">Your access is active — open the directory</Link>
            </Button>
          ) : user ? (
            <form action={startCheckout}>
              <SubmitButton size="lg" pendingLabel="Starting checkout…">
                {live ? "Continue to Airwallex" : "Continue to demo checkout"}
              </SubmitButton>
            </form>
          ) : (
            <Button asChild>
              <Link href="/login?next=/pricing">Sign in to subscribe</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
