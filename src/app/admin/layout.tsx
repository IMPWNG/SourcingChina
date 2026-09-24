import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/companies", label: "Companies" },
  { href: "/admin/upload", label: "Upload cards" },
  { href: "/admin/duplicates", label: "Duplicates" },
  { href: "/admin/taxonomy", label: "Taxonomy" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div>
      <nav className="border-b border-border">
        <div className="mx-auto flex max-w-6xl gap-4 overflow-x-auto px-4 py-3 text-sm">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap text-muted-foreground hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </div>
  );
}
