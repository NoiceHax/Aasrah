"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { authApi } from "@/lib/api/endpoints";
import { normalizeError } from "@/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/notifications/toast";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Errors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export function RegisterForm() {
  const router = useRouter();
  const { setSession } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const mutation = useMutation({
    mutationFn: () =>
      authApi.register({
        email,
        password,
        full_name: fullName || undefined,
      }),
    onSuccess: (res) => {
      setSession(res);
      toast.success(
        "Application submitted",
        "Your volunteer account is pending administrator approval.",
      );
      // Volunteers land in their portal, which shows the pending-approval state
      // until an admin approves the application.
      router.push(routes.volunteerPortal);
    },
    onError: (e) => toast.error("Couldn't create account", normalizeError(e).message),
  });

  const validate = () => {
    const next: Errors = {};
    if (!fullName.trim()) next.fullName = "Please enter your name";
    if (!emailRe.test(email)) next.email = "Enter a valid email address";
    if (password.length < 8) next.password = "Use at least 8 characters";
    if (confirmPassword !== password) next.confirmPassword = "Passwords do not match";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) mutation.mutate();
  };

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3">
        <p className="text-body-sm text-on-surface-variant">
          Registration is for <span className="font-semibold text-on-surface">volunteers</span>.
          Your account will be reviewed and approved by an administrator before
          you can accept rescue assignments. NGOs are onboarded directly by the
          Aasrah team. <Link href={routes.contact} className="font-semibold text-secondary hover:underline">Contact us</Link> to apply.
        </p>
      </div>
      <Input
        name="fullName"
        label="Full name"
        required
        leadingIcon="person"
        placeholder="Your name"
        autoComplete="name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        error={errors.fullName}
      />
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
      <Input
        name="password"
        label="Password"
        type="password"
        required
        leadingIcon="lock"
        placeholder="At least 8 characters"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
      />
      <Input
        name="confirmPassword"
        label="Confirm password"
        type="password"
        required
        leadingIcon="lock"
        placeholder="Re-enter your password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={errors.confirmPassword}
      />

      <Button type="submit" size="lg" fullWidth disabled={mutation.isPending}>
        {mutation.isPending ? "Submitting…" : "Apply as Volunteer"}
      </Button>

      <p className="text-center text-body-sm text-on-surface-variant">
        Already have an account?{" "}
        <Link href={routes.login} className="font-semibold text-secondary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
