export default function DirectoryLoading() {
  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[260px_1fr]" aria-busy="true" aria-label="Loading directory">
      <div className="hidden h-80 rounded-lg bg-muted md:block" />
      <div className="space-y-3">
        <div className="h-8 w-40 rounded bg-muted" />
        <div className="h-24 rounded-lg bg-muted" />
        <div className="h-24 rounded-lg bg-muted" />
        <div className="h-24 rounded-lg bg-muted" />
      </div>
    </main>
  );
}
