import type { Metadata } from "next";
import { RegisterForm } from "@/components/forms/register-form";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create an Aasrah account as an individual volunteer or an NGO.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-headline-lg text-primary">Create your account</h1>
        <p className="text-body-md text-on-surface-variant">
          Join as a volunteer or register your organization.
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
