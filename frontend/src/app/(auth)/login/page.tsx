import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/forms/login-form";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Aasrah account.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-headline-lg text-primary">Welcome back</h1>
        <p className="text-body-md text-on-surface-variant">
          Sign in to coordinate reports, cases, and volunteers.
        </p>
      </div>
      {/* LoginForm reads ?next= via useSearchParams, which requires Suspense. */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
