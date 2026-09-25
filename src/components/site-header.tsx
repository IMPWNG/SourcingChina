import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { LocaleSwitch } from "@/components/locale-switch";
import { MobileNav } from "@/components/mobile-nav";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";
import { hasDirectoryAccess } from "@/lib/domain";
import { isDemoMode } from "@/lib/env";
import { getLocale, getMessages } from "@/lib/i18n-server";

export async function SiteHeader() {
  const [user, locale, t] = await Promise.all([getSessionUser(), getLocale(), getMessages()]);
  const access = hasDirectoryAccess(user);
  const links = [
    { href: "/pricing", label: t.pricing },
    ...(access ? [{ href: "/directory", label: t.directory }] : []),
    ...(user?.role === "admin" ? [{ href: "/admin", label: t.admin }] : []),
    ...(user ? [{ href: "/account", label: t.account }] : [{ href: "/login", label: t.signIn }]),
  ];

  return (
    <header className="border-b border-border bg-background/90 backdrop-blur">
      {isDemoMode() ? (
        <p className="bg-accent px-4 py-2 text-center text-xs text-accent-foreground">
          {t.demo}
        </p>
      ) : null}
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          SourcingChina
        </Link>
        <div className="flex items-center gap-2">
          <LocaleSwitch locale={locale} />
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Button key={link.href} variant="ghost" asChild>
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
          {user ? (
            <form action={signOut}>
              <Button type="submit" variant="outline">
                {t.signOut}
              </Button>
            </form>
          ) : (
            <Button asChild>
              <Link href="/signup">{t.createAccount}</Link>
            </Button>
          )}
        </nav>
        <MobileNav links={user ? links : [...links, { href: "/signup", label: t.createAccount }]} menuLabel={t.openMenu} />
        </div>
      </div>
    </header>
  );
}
