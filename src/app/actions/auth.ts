"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientKey, promoteIfAllowlisted } from "@/lib/auth";
import { safeNext } from "@/lib/domain";
import { SUPABASE_SIGNUP_REQUIRED, demoSignupBlockReason, isDirectoryWritable, isReadOnlyFsError } from "@/lib/demo/filesystem";
import { clearDemoSession, setDemoSession } from "@/lib/demo/session";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode, isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation";

export type AuthState = { error: string } | null;

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and a password of at least 8 characters." };
  if (!rateLimit(`login:${await clientKey()}`, 10, 10 * 60 * 1000)) {
    return { error: "Too many sign-in attempts. Wait a few minutes and try again." };
  }
  const next = safeNext(formData.get("next"));

  if (isDemoMode()) {
    const user = await demoStore.authenticate(parsed.data.email, parsed.data.password);
    if (!user) return { error: "Those credentials do not match a demo account." };
    await setDemoSession(user.id);
    redirect(next);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { error: "Sign-in failed. Check the email and password, or confirm the address if your project requires it." };
  }
  await promoteIfAllowlisted(data.user.id, data.user.email ?? parsed.data.email);
  redirect(next);
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and a password of at least 8 characters." };
  if (!rateLimit(`signup:${await clientKey()}`, 8, 10 * 60 * 1000)) {
    return { error: "Too many sign-up attempts. Wait a few minutes and try again." };
  }

  if (isDemoMode()) {
    const block = demoSignupBlockReason(isSupabaseConfigured(), await isDirectoryWritable(process.cwd()));
    if (block) return { error: block };
    try {
      const user = await demoStore.register(parsed.data.email, parsed.data.password);
      await setDemoSession(user.id);
    } catch (error) {
      if (isReadOnlyFsError(error)) return { error: SUPABASE_SIGNUP_REQUIRED };
      return { error: error instanceof Error ? error.message : "Could not create the demo account." };
    }
    redirect("/pricing");
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=/pricing` },
  });
  if (error) return { error: "Sign-up failed. If the email is already registered, sign in instead." };
  if (data.session && data.user) {
    await promoteIfAllowlisted(data.user.id, data.user.email ?? parsed.data.email);
    redirect("/pricing");
  }
  redirect("/login?notice=confirm");
}

export async function enterDemo(formData: FormData) {
  if (!isDemoMode()) redirect("/login");
  const role = formData.get("role") === "admin" ? "admin" : "subscriber";
  const email = role === "admin" ? "demo.admin@sourcingchina.example" : "demo.subscriber@sourcingchina.example";
  const password = role === "admin" ? "demo-admin" : "demo-subscriber";
  const user = await demoStore.authenticate(email, password);
  if (!user) redirect("/login?error=demo");
  await setDemoSession(user.id);
  redirect(role === "admin" ? "/admin" : "/pricing");
}

export async function signOut() {
  if (isDemoMode()) {
    await clearDemoSession();
    redirect("/");
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
