import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { processBillingEvent, type BillingPort } from "./process";
import { verifyAirwallexSignature } from "./signature";

function sign(body: string, timestamp: string, secret: string) {
  return createHmac("sha256", secret).update(timestamp).update(body).digest("hex");
}

test("webhook signature rejects tampering and stale timestamps", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ id: "evt_1", name: "payment_intent.succeeded" });
  const now = 1_700_000_000_000;
  const timestamp = String(now);
  const signature = sign(body, timestamp, secret);
  assert.equal(verifyAirwallexSignature(body, timestamp, signature, secret, now).ok, true);
  assert.equal(verifyAirwallexSignature(body + " ", timestamp, signature, secret, now).ok, false);
  assert.equal(verifyAirwallexSignature(body, String(now - 10 * 60 * 1000), sign(body, String(now - 10 * 60 * 1000), secret), secret, now).ok, false);
  assert.equal(verifyAirwallexSignature(body, timestamp, signature, "").ok, false);
});

test("succeeded payment grants access only when the amount matches the plan", async () => {
  process.env.AIRWALLEX_PLAN_AMOUNT = "79";
  process.env.AIRWALLEX_PLAN_CURRENCY = "EUR";
  const grants: string[] = [];
  const port: BillingPort = {
    async claimEvent() {
      return "new";
    },
    async finishEvent() {},
    async currentPeriodEnd() {
      return null;
    },
    async grantAccess(input) {
      grants.push(`${input.userId}:${input.amount}:${input.currency}`);
    },
    async cancelAccess() {},
  };
  const good = await processBillingEvent(
    {
      id: "evt_good",
      name: "payment_intent.succeeded",
      object: { id: "int_1", amount: 79, currency: "EUR", metadata: { user_id: "user-1" } },
    },
    port,
    new Date("2026-09-24T00:00:00Z"),
  );
  const bad = await processBillingEvent(
    {
      id: "evt_bad",
      name: "payment_intent.succeeded",
      object: { id: "int_2", amount: 1, currency: "EUR", metadata: { user_id: "user-1" } },
    },
    port,
    new Date("2026-09-24T00:00:00Z"),
  );
  assert.equal(good.granted, true);
  assert.equal(bad.reason, "amount_mismatch");
  assert.deepEqual(grants, ["user-1:79:EUR"]);
});
