import type { Metadata } from "next";
import { activateDemoAccess } from "@/app/actions/billing";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { planAmount, planCurrency } from "@/lib/domain";
import { isDemoMode } from "@/lib/env";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Demo checkout" };

export default async function DemoCheckoutPage() {
  if (!isDemoMode()) redirect("/pricing");
  const user = await requireUser();
  const amount = planAmount();
  const currency = planCurrency();
  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Demo checkout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            No card is charged. Confirming grants {user.email} a 30-day directory pass on this machine, for the same {currency} {amount.toFixed(2)} plan a live Airwallex payment would cover.
          </p>
          <form action={activateDemoAccess}>
            <SubmitButton size="lg">Activate 30-day demo access</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
