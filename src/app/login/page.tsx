import type { Metadata } from "next";
import Link from "next/link";
import { enterDemo } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth-form";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNext } from "@/lib/domain";
import { isDemoMode } from "@/lib/env";
import { DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD, DEMO_SUBSCRIBER_EMAIL, DEMO_SUBSCRIBER_PASSWORD } from "@/lib/seed";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; notice?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next, "/directory");
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {params.notice === "confirm" ? (
            <Alert>
              <AlertDescription>Check your email and confirm the address before signing in.</AlertDescription>
            </Alert>
          ) : null}
          <AuthForm mode="login" next={next} />
          <p className="text-sm text-muted-foreground">
            New here? <Link href="/signup" className="text-foreground underline">Create an account</Link>
          </p>
          {isDemoMode() ? (
            <div className="space-y-3 border-t border-border pt-4 text-sm">
              <p className="text-muted-foreground">Demo accounts, local only:</p>
              <p className="font-mono text-xs">
                {DEMO_SUBSCRIBER_EMAIL} / {DEMO_SUBSCRIBER_PASSWORD}
                <br />
                {DEMO_ADMIN_EMAIL} / {DEMO_ADMIN_PASSWORD}
              </p>
              <form action={enterDemo} className="flex flex-wrap gap-2">
                <input type="hidden" name="role" value="subscriber" />
                <SubmitButton variant="outline" size="sm">
                  Continue as demo subscriber
                </SubmitButton>
              </form>
              <form action={enterDemo}>
                <input type="hidden" name="role" value="admin" />
                <SubmitButton variant="outline" size="sm">
                  Continue as demo admin
                </SubmitButton>
              </form>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
