import "server-only";

import { randomUUID } from "node:crypto";
import { planAmount, planCurrency } from "@/lib/domain";
import { appUrlFromEnv } from "@/lib/env";

export type PaymentIntent = {
  id: string;
  clientSecret: string;
  currency: string;
  env: "demo" | "prod";
};

function apiBase(): string {
  if (process.env.AIRWALLEX_API_BASE?.trim()) return process.env.AIRWALLEX_API_BASE.trim().replace(/\/$/, "");
  return process.env.AIRWALLEX_ENV === "prod" ? "https://api.airwallex.com" : "https://api-demo.airwallex.com";
}

export function airwallexEnv(): "demo" | "prod" {
  return process.env.AIRWALLEX_ENV === "prod" ? "prod" : "demo";
}

export async function createPaymentIntent(input: { userId: string; email: string; returnUrl: string }): Promise<PaymentIntent> {
  const clientId = process.env.AIRWALLEX_CLIENT_ID?.trim();
  const apiKey = process.env.AIRWALLEX_API_KEY?.trim();
  if (!clientId || !apiKey) throw new Error("Airwallex is not configured.");

  const login = await fetch(`${apiBase()}/api/v1/authentication/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": clientId,
      "x-api-key": apiKey,
    },
    body: "{}",
    cache: "no-store",
  });
  if (!login.ok) throw new Error(`Airwallex login failed (${login.status}).`);
  const loginJson = (await login.json()) as { token?: string };
  if (!loginJson.token) throw new Error("Airwallex login did not return a token.");

  const amount = planAmount();
  const currency = planCurrency();
  const created = await fetch(`${apiBase()}/api/v1/pa/payment_intents/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${loginJson.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      request_id: randomUUID(),
      amount,
      currency,
      merchant_order_id: `user:${input.userId}:${Date.now()}`,
      descriptor: "SourcingChina Directory",
      return_url: input.returnUrl,
      metadata: { user_id: input.userId, plan: "directory_30d" },
      customer: { email: input.email },
    }),
    cache: "no-store",
  });
  if (!created.ok) throw new Error(`Airwallex payment intent failed (${created.status}).`);
  const intent = (await created.json()) as { id?: string; client_secret?: string; currency?: string };
  if (!intent.id || !intent.client_secret) throw new Error("Airwallex did not return an intent id and client secret.");
  return {
    id: intent.id,
    clientSecret: intent.client_secret,
    currency: intent.currency ?? currency,
    env: airwallexEnv(),
  };
}

export function checkoutReturnUrl(origin: string): string {
  const base = appUrlFromEnv() ?? origin;
  return `${base.replace(/\/$/, "")}/checkout/return`;
}
