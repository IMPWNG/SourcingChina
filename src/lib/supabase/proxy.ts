import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/domain";
import { isSupabaseConfigured, supabasePublishableKey } from "@/lib/env";

function copyAuth(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header);
    if (value) to.headers.set(header, value);
  }
  return to;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (isSupabaseConfigured()) {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, supabasePublishableKey(), {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => supabaseResponse.headers.set(key, value));
        },
      },
    });
    await supabase.auth.getClaims();
  }

  const path = request.nextUrl.pathname;
  const guarded =
    path.startsWith("/directory") ||
    path.startsWith("/admin") ||
    path.startsWith("/account") ||
    path.startsWith("/checkout");
  if (!guarded) return supabaseResponse;

  const authed = isSupabaseConfigured()
    ? request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.value)
    : Boolean(request.cookies.get("sc_session")?.value);

  if (!authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", safeNext(path));
    return copyAuth(supabaseResponse, NextResponse.redirect(url));
  }

  return supabaseResponse;
}
