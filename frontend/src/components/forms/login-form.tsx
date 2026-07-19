"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { routes, portalPathForRole } from "@/lib/routes";
import { authApi } from "@/lib/api/endpoints";
import { normalizeError } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/notifications/toast";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const mutation = useMutation({
    mutationFn: () => authApi.login({ email, password }),
    onSuccess: (res) => {
      setSession(res);
      toast.success("Welcome back", `Signed in as ${res.user.email}`);
      // Honor an explicit ?next=, else route each role to its portal.
      const next = searchParams.get("next");
      router.push(next || portalPathForRole(res.user.role) || routes.home);
    },
    onError: (e) => toast.error("Sign in failed", normalizeError(e).message),
  });

  const validate = () => {
    const next: typeof errors = {};
    if (!emailRe.test(email)) next.email = "Enter a valid email address";
    if (password.length < 1) next.password = "Password is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) mutation.mutate();
  };

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
        error={errors.email}
      />
      <div className="flex flex-col gap-1.5">
        <Input
          name="password"
          label="Password"
          type="password"
          required
          leadingIcon="lock"
          placeholder="••••••••"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Link
          href={routes.forgotPassword}
          className="self-end text-label-sm font-medium text-secondary hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" size="lg" fullWidth disabled={mutation.isPending}>
        {mutation.isPending ? "Signing in…" : "Sign In"}
      </Button>

      <p className="text-center text-body-sm text-on-surface-variant">
        Don&apos;t have an account?{" "}
        <Link href={routes.register} className="font-semibold text-secondary hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
