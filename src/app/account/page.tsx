import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { hasDirectoryAccess } from "@/lib/domain";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const access = hasDirectoryAccess(user);
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{user.email}</p>
          <p>Role: {user.role}</p>
          <p>Subscription: {user.subscriptionStatus}</p>
          <p>Access until: {user.currentPeriodEnd ? new Date(user.currentPeriodEnd).toLocaleString() : "Not started"}</p>
          <p>{access ? "Directory access is open." : "Directory access is closed until a 30-day period is active."}</p>
          {!access && user.role !== "admin" ? (
            <Link href="/pricing" className="underline">
              Get access
            </Link>
          ) : null}
          <form action={signOut}>
            <SubmitButton variant="outline">Sign out</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
