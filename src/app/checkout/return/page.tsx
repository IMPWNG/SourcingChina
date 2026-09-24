import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth";
import { hasDirectoryAccess } from "@/lib/domain";

export const metadata: Metadata = { title: "Payment return" };

export default async function CheckoutReturnPage() {
  const user = await getSessionUser();
  const access = hasDirectoryAccess(user);
  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>{access ? "Access is active" : "Waiting for confirmation"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            {access
              ? "The directory is open on this account."
              : "Airwallex sends a signed webhook after payment. Refresh this page once that event has been processed. The return URL alone does not unlock the directory."}
          </p>
          <Button asChild>
            <Link href={access ? "/directory" : "/account"}>{access ? "Open the directory" : "Check account"}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
