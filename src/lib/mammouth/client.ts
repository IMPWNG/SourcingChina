import "server-only";

/** Official OpenAI-compatible base from https://info.mammouth.ai/docs/api-quick-start/ */
export const MAMMOUTH_BASE_URL = "https://api.mammouth.ai/v1";

export type MammouthContent =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

export function mammouthConfig(): { apiKey: string; model: string } | null {
  const apiKey = process.env.MAMMOUTH_API_KEY?.trim() ?? "";
  if (!apiKey || /your-|placeholder/i.test(apiKey)) return null;
  const model = process.env.MAMMOUTH_MODEL?.trim() || "gpt-4.1-nano";
  return { apiKey, model };
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "request_failed";
  return message.replace(/sk-[a-z0-9_-]{6,}/gi, "[redacted]").slice(0, 180);
}

function imageRejected(status: number, body: string): boolean {
  if (status !== 400 && status !== 415 && status !== 422) return false;
  return /image|vision|multimodal|unsupported|content type|invalid content/i.test(body);
}

export async function mammouthJson(input: {
  system: string;
  user: MammouthContent;
  timeoutMs?: number;
}): Promise<{ ok: true; json: unknown; raw: string } | { ok: false; error: string; imageRejected: boolean }> {
  const config = mammouthConfig();
  if (!config) return { ok: false, error: "missing_key", imageRejected: false };
  try {
    const response = await fetch(`${MAMMOUTH_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 25_000),
    });
    const body = await response.text();
    if (!response.ok) {
      return { ok: false, error: `http_${response.status}`, imageRejected: imageRejected(response.status, body) };
    }
    const payload = JSON.parse(body) as { choices?: { message?: { content?: string | null } }[] };
    const raw = payload.choices?.[0]?.message?.content?.trim() ?? "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end < start) return { ok: false, error: "no_json", imageRejected: false };
    return { ok: true, json: JSON.parse(raw.slice(start, end + 1)) as unknown, raw };
  } catch (error) {
    return { ok: false, error: safeError(error), imageRejected: false };
  }
}
