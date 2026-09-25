import "server-only";

import { cookies } from "next/headers";
import { messagesFor, type Locale, type Messages } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  return jar.get("sc_lang")?.value === "fr" ? "fr" : "en";
}

export async function getMessages(): Promise<Messages> {
  return messagesFor(await getLocale());
}
