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
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      {isDemoMode() ? (
        <p className="bg-accent px-4 py-2 text-center text-xs text-accent-foreground">
          {t.demo}
        </p>
      ) : null}
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          SourcingChina
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex" aria-label="Main">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <LocaleSwitch locale={locale} />
          {user ? (
            <form action={signOut} className="hidden md:block">
              <Button type="submit" variant="outline" size="sm">
                {t.signOut}
              </Button>
            </form>
          ) : (
            <Button size="sm" className="hidden md:inline-flex" asChild>
              <Link href="/signup">{t.createAccount}</Link>
            </Button>
          )}
          <MobileNav links={user ? links : [...links, { href: "/signup", label: t.createAccount }]} menuLabel={t.openMenu} />
        </div>
      </div>
    </header>
  );
}
