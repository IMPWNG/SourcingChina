/** Retry a Supabase call when TLS drops (common on flaky routes to *.supabase.co). */
export async function withSupabaseRetry<T>(label: string, run: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      last = error;
      const message = error instanceof Error ? error.message : String(error);
      const cause =
        error instanceof Error && error.cause instanceof Error
          ? `${error.cause.message}${ "code" in error.cause ? ` (${String((error.cause as { code?: string }).code)})` : ""}`
          : "";
      console.error(`${label}: attempt ${attempt + 1}/${attempts} failed — ${message}${cause ? ` — ${cause}` : ""}`);
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  const detail = last instanceof Error ? last.message : "request_failed";
  throw new Error(
    `${label} failed after ${attempts} tries (${detail}). Your network cannot complete TLS to Supabase — use a VPN or another network, then re-run.`,
  );
}
