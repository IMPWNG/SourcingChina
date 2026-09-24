import { extendPeriod, paymentMatchesPlan, PLAN_PERIOD_DAYS } from "@/lib/domain";

export type BillingEvent = {
  id: string;
  name: string;
  object: {
    id?: string;
    amount?: number | string;
    currency?: string;
    metadata?: Record<string, string | undefined>;
    merchant_order_id?: string;
  };
};

export type BillingPort = {
  claimEvent(id: string, name: string): Promise<"new" | "duplicate">;
  finishEvent(id: string, granted: boolean, reason: string): Promise<void>;
  currentPeriodEnd(userId: string): Promise<string | null>;
  grantAccess(input: {
    userId: string;
    intentId: string | null;
    amount: number;
    currency: string;
    periodEnd: string;
  }): Promise<void>;
  cancelAccess(userId: string): Promise<void>;
};

export type BillingResult = { granted: boolean; reason: string };

function userIdFromObject(object: BillingEvent["object"]): string | null {
  const fromMeta = object.metadata?.user_id?.trim();
  if (fromMeta) return fromMeta;
  const order = object.merchant_order_id ?? "";
  const match = order.match(/^user:([0-9a-f-]{36})/i);
  return match?.[1] ?? null;
}

export async function processBillingEvent(event: BillingEvent, port: BillingPort, now = new Date()): Promise<BillingResult> {
  if (!event.id || !event.name) {
    return { granted: false, reason: "invalid_event" };
  }
  const claim = await port.claimEvent(event.id, event.name);
  if (claim === "duplicate") return { granted: false, reason: "duplicate" };

  const userId = userIdFromObject(event.object);
  if (event.name === "payment_intent.succeeded") {
    if (!userId) {
      await port.finishEvent(event.id, false, "missing_user");
      return { granted: false, reason: "missing_user" };
    }
    if (!paymentMatchesPlan(event.object.amount, event.object.currency)) {
      await port.finishEvent(event.id, false, "amount_mismatch");
      return { granted: false, reason: "amount_mismatch" };
    }
    const periodEnd = extendPeriod(await port.currentPeriodEnd(userId), PLAN_PERIOD_DAYS, now);
    await port.grantAccess({
      userId,
      intentId: event.object.id ?? null,
      amount: Number(event.object.amount),
      currency: String(event.object.currency).toUpperCase(),
      periodEnd,
    });
    await port.finishEvent(event.id, true, "granted");
    return { granted: true, reason: "granted" };
  }

  if (event.name === "refund.settled" && userId) {
    await port.cancelAccess(userId);
    await port.finishEvent(event.id, false, "refunded");
    return { granted: false, reason: "refunded" };
  }

  await port.finishEvent(event.id, false, "ignored");
  return { granted: false, reason: "ignored" };
}
