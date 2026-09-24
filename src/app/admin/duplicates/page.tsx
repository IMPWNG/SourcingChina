import type { Metadata } from "next";
import { mergeCompanies } from "@/app/actions/admin";
import { SubmitButton } from "@/components/submit-button";
import { directory } from "@/lib/store";

export const metadata: Metadata = { title: "Duplicates" };

export default async function DuplicatesPage() {
  const pairs = await directory.duplicates();
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Possible duplicates</h1>
      <p className="text-sm text-muted-foreground">Matched on website host, phone, or email. Merging keeps the first record and fills only its empty fields.</p>
      {pairs.length === 0 ? <p className="text-sm text-muted-foreground">No duplicate pairs in the current set.</p> : null}
      <ul className="space-y-3">
        {pairs.map((pair) => (
          <li key={`${pair.a}-${pair.b}`} className="rounded-xl border border-border bg-card p-4 text-sm">
            <p className="font-medium">Same {pair.reason}</p>
            <p>{pair.left.name_en || pair.left.name_zh} · {pair.left.website || pair.left.phone || pair.left.email}</p>
            <p>{pair.right.name_en || pair.right.name_zh} · {pair.right.website || pair.right.phone || pair.right.email}</p>
            <form action={mergeCompanies} className="mt-3">
              <input type="hidden" name="primary_id" value={pair.a} />
              <input type="hidden" name="duplicate_id" value={pair.b} />
              <SubmitButton size="sm" variant="outline">Merge second into first</SubmitButton>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
