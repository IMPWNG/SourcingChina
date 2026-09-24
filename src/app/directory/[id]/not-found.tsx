import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-16">
      <h1 className="text-2xl font-semibold">That supplier is not published</h1>
      <p className="text-sm text-muted-foreground">It may be a draft, merged into another record, or the link is wrong.</p>
      <Button asChild>
        <Link href="/directory">Back to the directory</Link>
      </Button>
    </main>
  );
}
