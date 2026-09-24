"use client";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-16">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        {error.message === "Failed to fetch"
          ? "The server did not finish this request. Check Companies for a new draft, or paste the card text and try again."
          : error.message || "The page could not be loaded."}
      </p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
