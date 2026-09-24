import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_MS = 5 * 60 * 1000;

export function verifyAirwallexSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  secret: string,
  nowMs = Date.now(),
): { ok: true } | { ok: false; reason: string } {
  if (!secret) return { ok: false, reason: "missing_secret" };
  if (!timestamp || !signature) return { ok: false, reason: "missing_signature" };
  if (!/^\d+$/.test(timestamp)) return { ok: false, reason: "bad_timestamp" };
  const sent = Number(timestamp);
  if (!Number.isFinite(sent) || Math.abs(nowMs - sent) > TOLERANCE_MS) {
    return { ok: false, reason: "stale_timestamp" };
  }
  const expected = createHmac("sha256", secret).update(timestamp).update(rawBody).digest("hex");
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(signature.trim().toLowerCase(), "utf8");
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return { ok: false, reason: "bad_signature" };
  }
  return { ok: true };
}
