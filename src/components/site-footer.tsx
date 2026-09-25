import Link from "next/link";
import { getMessages } from "@/lib/i18n-server";

export async function SiteFooter() {
  const t = await getMessages();
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>{t.footer}</p>
        <div className="flex gap-4">
          <Link href="/pricing" className="hover:text-foreground">
            {t.pricing}
          </Link>
          <Link href="/login" className="hover:text-foreground">
            {t.signIn}
          </Link>
        </div>
      </div>
    </footer>
  );
}
