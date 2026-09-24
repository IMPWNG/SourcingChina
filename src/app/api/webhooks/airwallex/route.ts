import { processBillingEvent, type BillingEvent } from "@/lib/billing/process";
import { verifyAirwallexSignature } from "@/lib/billing/signature";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import { logInfo } from "@/lib/log";
import { billingPort } from "@/lib/supabase/store";

export const runtime = "nodejs";

function demoPort() {
  return {
    claimEvent: (id: string, name: string) => demoStore.claimEvent(id, name),
    finishEvent: (id: string, granted: boolean, reason: string) => demoStore.finishEvent(id, granted, reason),
    currentPeriodEnd: (userId: string) => demoStore.currentPeriodEnd(userId),
    grantAccess: async (input: { userId: string; periodEnd: string }) => {
      await demoStore.grantAccess(input.userId, input.periodEnd);
    },
    cancelAccess: (userId: string) => demoStore.cancelAccess(userId),
  };
}

export async function POST(request: Request) {
  const secret = process.env.AIRWALLEX_WEBHOOK_SECRET?.trim() ?? "";
  const raw = await request.text();
  if (!secret) {
    logInfo("webhook_unconfigured", {});
    return Response.json({ error: "webhook_unconfigured" }, { status: 503 });
  }
  const verified = verifyAirwallexSignature(raw, request.headers.get("x-timestamp"), request.headers.get("x-signature"), secret);
  if (!verified.ok) {
    logInfo("webhook_rejected", { reason: verified.reason });
    return Response.json({ error: verified.reason }, { status: 400 });
  }

  let event: BillingEvent;
  try {
    const parsed = JSON.parse(raw) as {
      id?: string;
      name?: string;
      data?: { object?: BillingEvent["object"] };
    };
    event = {
      id: parsed.id ?? "",
      name: parsed.name ?? "",
      object: parsed.data?.object ?? {},
    };
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const port = isDemoMode() ? demoPort() : billingPort();
  if (!port) {
    logInfo("webhook_unconfigured", { eventId: event.id });
    return Response.json({ error: "billing_store_unconfigured" }, { status: 503 });
  }

  const result = await processBillingEvent(event, port);
  logInfo("webhook_processed", { eventId: event.id, name: event.name, granted: result.granted, reason: result.reason });
  return Response.json({ received: true, granted: result.granted });
}
