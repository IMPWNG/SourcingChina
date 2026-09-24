import assert from "node:assert/strict";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { SUPABASE_SIGNUP_REQUIRED, demoSignupBlockReason, isDirectoryWritable, isReadOnlyFsError, shouldPersistDemoSeed } from "./filesystem";

test("supabase signup does not fall back to the demo database", () => {
  assert.equal(demoSignupBlockReason(true, false), null);
  assert.equal(demoSignupBlockReason(true, true), null);
});

test("a writable disk without supabase keeps local demo signup", () => {
  assert.equal(demoSignupBlockReason(false, true), null);
});

test("a read-only disk without supabase asks for configuration in French", () => {
  const reason = demoSignupBlockReason(false, false);
  assert.equal(reason, SUPABASE_SIGNUP_REQUIRED);
  assert.match(reason ?? "", /Supabase/);
  assert.equal(reason?.includes("EROFS"), false);
  assert.equal(reason?.includes("demo-db"), false);
});

test("writability follows the directory and read-only errors are recognized", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "sc-fs-"));
  try {
    assert.equal(await isDirectoryWritable(dir), true);
    await chmod(dir, 0o555);
    assert.equal(await isDirectoryWritable(dir), false);
  } finally {
    await chmod(dir, 0o755);
    await rm(dir, { recursive: true });
  }
  assert.equal(isReadOnlyFsError(Object.assign(new Error("fail"), { code: "EROFS" })), true);
  assert.equal(isReadOnlyFsError(new Error("other")), false);
  const readOnly = Object.assign(new Error("fail"), { code: "EROFS" });
  assert.equal(shouldPersistDemoSeed(false, Object.assign(new Error("missing"), { code: "ENOENT" })), false);
  assert.equal(shouldPersistDemoSeed(true, readOnly), false);
  assert.equal(shouldPersistDemoSeed(true, Object.assign(new Error("missing"), { code: "ENOENT" })), true);
});
