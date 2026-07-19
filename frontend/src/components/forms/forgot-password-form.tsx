"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormSuccess } from "./form-success";
import { routes } from "@/lib/routes";
import { authApi } from "@/lib/api/endpoints";
import { normalizeError } from "@/lib/api/client";
import { useToast } from "@/components/notifications/toast";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordForm() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: () => authApi.forgotPassword(email),
    onSuccess: (res) => {
      setDone(true);
      // In dev the backend returns a reset token to ease testing.
      if (res.reset_token) {
        toast.info("Dev reset token", res.reset_token);
      }
    },
    onError: (e) => toast.error("Request failed", normalizeError(e).message),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailRe.test(email)) {
      setError("Enter a valid email address");
      return;
    }
    setError(undefined);
    mutation.mutate();
  };

  if (done) {
    return (
      <FormSuccess
        title="Check your inbox"
        description={`If an account exists for ${email}, we've sent password reset instructions.`}
        onReset={() => {
          setDone(false);
          setEmail("");
        }}
        resetLabel="Use a different email"
      />
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <Input
        name="email"
        label="Email"
        type="email"
        required
        leadingIcon="mail"
        placeholder="you@example.com"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error}
      />

      <Button type="submit" size="lg" fullWidth disabled={mutation.isPending}>
        {mutation.isPending ? "Sending…" : "Send Reset Link"}
      </Button>

      <p className="text-center text-body-sm text-on-surface-variant">
        Remembered it?{" "}
        <Link href={routes.login} className="font-semibold text-secondary hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
