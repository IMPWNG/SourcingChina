import { requireDirectory } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";

export default async function DirectoryLayout({ children }: { children: React.ReactNode }) {
  await requireDirectory();
  const top = isDemoMode() ? "top-[5.5rem]" : "top-14";
  return <div className={`fixed inset-x-0 bottom-0 z-10 overflow-hidden bg-background ${top}`}>{children}</div>;
}
