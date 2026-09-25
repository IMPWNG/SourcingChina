import { DirectoryShell } from "@/components/directory-shell";

export default function DirectoryLoading() {
  return (
    <DirectoryShell>
      <main className="mx-auto grid h-full max-w-6xl md:grid-cols-[260px_1fr]" aria-busy="true" aria-label="Loading directory">
        <div className="hidden h-full items-center px-4 md:flex">
          <div className="h-80 w-full rounded-lg bg-muted" />
        </div>
        <div className="space-y-3 overflow-y-auto px-4 py-8">
          <div className="h-8 w-40 rounded bg-muted" />
          <div className="h-24 rounded-lg bg-muted" />
          <div className="h-24 rounded-lg bg-muted" />
          <div className="h-24 rounded-lg bg-muted" />
        </div>
      </main>
    </DirectoryShell>
  );
}
