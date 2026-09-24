import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Use a work email. Directory access starts after checkout, not at sign-up.</p>
          <AuthForm mode="signup" />
          <p className="text-sm text-muted-foreground">
            Already registered? <Link href="/login" className="text-foreground underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
