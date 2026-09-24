import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { MobileNav } from "@/components/mobile-nav";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";
import { hasDirectoryAccess } from "@/lib/domain";
import { isDemoMode } from "@/lib/env";

export async function SiteHeader() {
  const user = await getSessionUser();
  const access = hasDirectoryAccess(user);
  const links = [
    { href: "/pricing", label: "Pricing" },
    ...(access ? [{ href: "/directory", label: "Directory" }] : []),
    ...(user?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
    ...(user ? [{ href: "/account", label: "Account" }] : [{ href: "/login", label: "Sign in" }]),
  ];

  return (
    <header className="border-b border-border bg-background/90 backdrop-blur">
      {isDemoMode() ? (
        <p className="bg-accent px-4 py-2 text-center text-xs text-accent-foreground">
          Demo mode. Supabase is not configured, so you are browsing sample suppliers stored on this machine.
        </p>
      ) : null}
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          SourcingChina
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Button key={link.href} variant="ghost" asChild>
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
          {user ? (
            <form action={signOut}>
              <Button type="submit" variant="outline">
                Sign out
              </Button>
            </form>
          ) : (
            <Button asChild>
              <Link href="/signup">Create account</Link>
            </Button>
          )}
        </nav>
        <MobileNav links={user ? links : [...links, { href: "/signup", label: "Create account" }]} />
      </div>
    </header>
  );
}
