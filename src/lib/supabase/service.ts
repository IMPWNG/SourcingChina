import "server-only";

import { createClient } from "@supabase/supabase-js";
import { isServiceRoleConfigured } from "@/lib/env";

export function createServiceClient() {
  if (!isServiceRoleConfigured()) return null;
  const key = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
