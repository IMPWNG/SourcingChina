import { setLocale } from "@/app/actions/locale";
import type { Locale } from "@/lib/i18n";

export function LocaleSwitch({ locale }: { locale: Locale }) {
  return (
    <form action={setLocale} className="flex items-center rounded-md border border-border text-xs">
      <button
        type="submit"
        name="locale"
        value="en"
        aria-pressed={locale === "en"}
        className={`px-2 py-1 ${locale === "en" ? "bg-foreground text-background" : "text-muted-foreground"}`}
      >
        EN
      </button>
      <button
        type="submit"
        name="locale"
        value="fr"
        aria-pressed={locale === "fr"}
        className={`px-2 py-1 ${locale === "fr" ? "bg-foreground text-background" : "text-muted-foreground"}`}
      >
        FR
      </button>
    </form>
  );
}
