"use client";

import { publishAllDrafts } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

export function PublishAllDrafts({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <form
      action={publishAllDrafts}
      onSubmit={(event) => {
        if (!window.confirm(`Publish ${count} draft ${count === 1 ? "company" : "companies"} to the directory?`)) {
          event.preventDefault();
        }
      }}
    >
      <Button type="submit" variant="outline">
        Publish all drafts
      </Button>
    </form>
  );
}
