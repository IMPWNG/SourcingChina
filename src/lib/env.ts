export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim();
  if (!url || !key) return false;
  if (/your-project|placeholder|example/i.test(url)) return false;
  if (/your-|placeholder/i.test(key)) return false;
  return url.startsWith("https://");
}

export function supabasePublishableKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim();
}

export function isServiceRoleConfigured(): boolean {
  const key = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  return Boolean(key) && !/your-|placeholder/i.test(key);
}

export function isAirwallexConfigured(): boolean {
  const id = process.env.AIRWALLEX_CLIENT_ID?.trim() ?? "";
  const key = process.env.AIRWALLEX_API_KEY?.trim() ?? "";
  return Boolean(id && key) && !/your-|placeholder/i.test(id) && !/your-|placeholder/i.test(key);
}

export function isLiveBilling(): boolean {
  return isSupabaseConfigured() && isServiceRoleConfigured() && isAirwallexConfigured();
}

export function isDemoMode(): boolean {
  return !isSupabaseConfigured();
}

export function appUrlFromEnv(): string | null {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!url) return null;
  return url.replace(/\/$/, "");
}
