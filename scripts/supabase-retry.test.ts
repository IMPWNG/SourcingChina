import assert from "node:assert/strict";
import test from "node:test";
import { isTransientSupabaseError } from "./supabase-retry";

test("TLS resets and socket drops are retried", () => {
  assert.equal(isTransientSupabaseError(new Error("fetch failed")), true);
  const reset = new Error("request to supabase failed");
  reset.cause = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
  assert.equal(isTransientSupabaseError(reset), true);
  assert.equal(isTransientSupabaseError(new Error("JSON object requested, multiple (or no) rows returned")), false);
});
