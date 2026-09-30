import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

const TRANSIENT =
  /ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EPIPE|EAI_AGAIN|UND_ERR|SSL|TLS|network|fetch failed|socket|other side closed|terminated|CONNECT tunnel/i;

export function isTransientSupabaseError(error: unknown): boolean {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (current instanceof Error) {
      parts.push(current.message);
      if ("code" in current && current.code) parts.push(String(current.code));
      current = current.cause;
      continue;
    }
    parts.push(String(current));
    break;
  }
  return TRANSIENT.test(parts.join(" "));
}

export async function supabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const attempts = 8;
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      last = error;
      if (attempt === attempts - 1 || !isTransientSupabaseError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw last instanceof Error ? last : new Error("request_failed");
}

/** Retry a Supabase call when TLS drops (common on flaky routes to *.supabase.co). */
export async function withSupabaseRetry<T>(label: string, run: () => Promise<T>, attempts = 6): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      last = error;
      const transient = isTransientSupabaseError(error);
      if (!transient || attempt === attempts - 1) {
        if (!transient) throw error;
        break;
      }
      if (attempt >= 1) {
        const message = error instanceof Error ? error.message : String(error);
        const cause =
          error instanceof Error && error.cause instanceof Error
            ? `${error.cause.message}${"code" in error.cause ? ` (${String((error.cause as { code?: string }).code)})` : ""}`
            : "";
        console.error(`${label}: attempt ${attempt + 1}/${attempts} failed — ${message}${cause ? ` — ${cause}` : ""}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
  const detail = last instanceof Error ? last.message : "request_failed";
  throw new Error(
    `${label} failed after ${attempts} tries (${detail}). Your network cannot complete TLS to Supabase — use a VPN or another network, then re-run.`,
  );
}
