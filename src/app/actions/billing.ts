"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientKey, requireUser } from "@/lib/auth";
import { extendPeriod, PLAN_PERIOD_DAYS, planAmount, planCurrency } from "@/lib/domain";
import { checkoutReturnUrl, createPaymentIntent } from "@/lib/billing/airwallex";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode, isLiveBilling } from "@/lib/env";
import { logInfo } from "@/lib/log";
import { rateLimit } from "@/lib/rate-limit";
import { setDemoSession } from "@/lib/demo/session";

const CHECKOUT_COOKIE = "sc_checkout";

export async function startCheckout() {
  const user = await requireUser();
  if (user.role === "admin") redirect("/directory");
  if (!rateLimit(`checkout:${user.id}:${await clientKey()}`, 5, 10 * 60 * 1000)) {
    redirect("/pricing?error=rate");
  }
  if (!isLiveBilling()) {
    logInfo("checkout_demo", { userId: user.id });
    redirect("/checkout/demo");
  }
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:43123";
  const intent = await createPaymentIntent({
    userId: user.id,
    email: user.email,
    returnUrl: checkoutReturnUrl(origin),
  });
  const jar = await cookies();
  jar.set(
    CHECKOUT_COOKIE,
    JSON.stringify({
      id: intent.id,
      clientSecret: intent.clientSecret,
      currency: intent.currency,
      env: intent.env,
      amount: planAmount(),
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/checkout",
      maxAge: 60 * 30,
    },
  );
  logInfo("checkout_created", { userId: user.id, intentId: intent.id, currency: intent.currency });
  redirect("/checkout/pay");
}

export async function readCheckoutCookie() {
  const raw = (await cookies()).get(CHECKOUT_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      id: string;
      clientSecret: string;
      currency: string;
      env: "demo" | "prod";
      amount: number;
    };
    if (!parsed.id || !parsed.clientSecret) return null;
    if (parsed.amount !== planAmount() || parsed.currency !== planCurrency()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function activateDemoAccess() {
  if (!isDemoMode()) redirect("/pricing");
  const user = await requireUser();
  const periodEnd = extendPeriod(user.currentPeriodEnd, PLAN_PERIOD_DAYS, new Date());
  await demoStore.grantAccess(user.id, periodEnd);
  await setDemoSession(user.id);
  logInfo("demo_access_granted", { userId: user.id });
  redirect("/directory?access=demo");
}
