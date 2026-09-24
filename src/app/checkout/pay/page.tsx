import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readCheckoutCookie } from "@/app/actions/billing";
import { AirwallexPayButton } from "@/components/airwallex-pay-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { planAmount, planCurrency } from "@/lib/domain";
import { appUrlFromEnv } from "@/lib/env";
import { headers } from "next/headers";

export const metadata: Metadata = { title: "Pay" };

export default async function PayPage() {
  const pending = await readCheckoutCookie();
  if (!pending) redirect("/pricing");
  const origin = appUrlFromEnv() ?? (await headers()).get("origin") ?? "";
  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Airwallex checkout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            The amount is fixed at {planCurrency()} {planAmount().toFixed(2)}. The webhook grants access only if Airwallex reports that same amount.
          </p>
          <AirwallexPayButton
            intentId={pending.id}
            clientSecret={pending.clientSecret}
            currency={pending.currency}
            env={pending.env}
            countryCode={process.env.AIRWALLEX_COUNTRY_CODE?.trim() || "FR"}
            successUrl={`${origin}/checkout/return`}
            amountLabel={`${planCurrency()} ${planAmount().toFixed(2)}`}
          />
        </CardContent>
      </Card>
    </main>
  );
}
