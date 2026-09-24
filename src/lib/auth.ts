import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasDirectoryAccess, type SessionUser } from "@/lib/domain";
import { readDemoSessionId } from "@/lib/demo/session";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function getSessionUser(): Promise<SessionUser | null> {
  if (isDemoMode()) {
    const id = await readDemoSessionId();
    if (!id) return null;
    const user = await demoStore.getUser(id);
    if (!user) return null;
    return user;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, role, subscription_status, current_period_end")
    .eq("id", data.claims.sub)
    .maybeSingle();
  if (profileError || !profile) return null;
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role === "admin" ? "admin" : "subscriber",
    subscriptionStatus: profile.subscription_status,
    currentPeriodEnd: profile.current_period_end,
  };
}

export async function promoteIfAllowlisted(userId: string, email: string) {
  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!allow.includes(email.toLowerCase())) return;
  const service = createServiceClient();
  if (!service) return;
  await service.from("profiles").update({ role: "admin" }).eq("id", userId);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireDirectory(): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasDirectoryAccess(user)) redirect("/pricing?reason=subscribe");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/pricing?reason=admin");
  return user;
}

export async function clientKey(): Promise<string> {
  const headerStore = await headers();
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
