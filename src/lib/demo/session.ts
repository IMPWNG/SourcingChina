import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const COOKIE = "sc_session";

async function secret(): Promise<string> {
  if (process.env.DEMO_SESSION_SECRET?.trim()) return process.env.DEMO_SESSION_SECRET.trim();
  const file = path.join(process.cwd(), "data", ".demo-secret");
  try {
    return (await readFile(file, "utf8")).trim();
  } catch {
    const { randomBytes } = await import("node:crypto");
    const value = randomBytes(32).toString("hex");
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, value, { mode: 0o600 });
    return value;
  }
}

function sign(body: string, key: string): string {
  return createHmac("sha256", key).update(body).digest("base64url");
}

export async function setDemoSession(userId: string): Promise<void> {
  const key = await secret();
  const body = Buffer.from(JSON.stringify({ id: userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 14 })).toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE, `${body}.${sign(body, key)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearDemoSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function readDemoSessionId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const [body, mac] = raw.split(".");
  if (!body || !mac) return null;
  const key = await secret();
  const expected = sign(body, key);
  const left = Buffer.from(expected);
  const right = Buffer.from(mac);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { id?: string; exp?: number };
    if (!parsed.id || !parsed.exp || parsed.exp < Date.now()) return null;
    return parsed.id;
  } catch {
    return null;
  }
}
