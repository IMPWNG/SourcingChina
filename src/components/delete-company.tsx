"use client";

import { deleteCompany } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

export function DeleteCompany({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteCompany}
      onSubmit={(event) => {
        if (!window.confirm(`Delete ${name}? The card, products, and contacts are removed.`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="destructive" size="sm">
        Delete
      </Button>
    </form>
  );
}
