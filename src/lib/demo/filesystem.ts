import { access, constants } from "node:fs/promises";

export const SUPABASE_SIGNUP_REQUIRED =
  "La création de compte nécessite Supabase. Configurez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, puis redéployez.";

/** Supabase signup never touches the demo file. A missing project only uses the demo file when it can be written. */
export function demoSignupBlockReason(supabaseConfigured: boolean, filesystemWritable: boolean): string | null {
  if (supabaseConfigured || filesystemWritable) return null;
  return SUPABASE_SIGNUP_REQUIRED;
}

export async function isDirectoryWritable(dir: string): Promise<boolean> {
  try {
    await access(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function isReadOnlyFsError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "EROFS";
}

/** A missing demo file is created only when the disk can accept the write. */
export function shouldPersistDemoSeed(writable: boolean, error: unknown): boolean {
  return writable && !isReadOnlyFsError(error);
}
