import { isDemoMode } from "@/lib/env";

/** Full-viewport pane under the sticky header — list page only; detail pages scroll normally. */
export function DirectoryShell({ children }: { children: React.ReactNode }) {
  const top = isDemoMode() ? "top-[5.5rem]" : "top-14";
  return <div className={`fixed inset-x-0 bottom-0 z-10 overflow-hidden bg-background ${top}`}>{children}</div>;
}
