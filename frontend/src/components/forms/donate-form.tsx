"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { FormSuccess } from "./form-success";
import { donationTiers } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useForm, compose, required, email } from "@/lib/use-form";

type DonateValues = {
  name: string;
  email: string;
};

const initial: DonateValues = { name: "", email: "" };
const presets = donationTiers.map((t) => t.amount);

export function DonateForm() {
  const [frequency, setFrequency] = useState<"once" | "monthly">("monthly");
  const [amount, setAmount] = useState<number>(donationTiers.find((t) => t.popular)?.amount ?? 75);
  const [custom, setCustom] = useState("");

  const form = useForm<DonateValues>(initial, {
    name: required("Please enter your name"),
    email: compose(required("Email is required"), email()),
  });

  const effectiveAmount = custom ? Number(custom) || 0 : amount;

  if (form.submitted) {
    return (
      <Card className="p-stack-lg">
        <FormSuccess
          title="Thank you for your generosity"
          description={`Your ${frequency === "monthly" ? "monthly" : "one-time"} gift of $${effectiveAmount} will help us respond faster. A receipt is on its way to your inbox.`}
          onReset={() => {
            form.reset();
            setCustom("");
          }}
          resetLabel="Make another donation"
        />
      </Card>
    );
  }

  return (
    <Card className="p-stack-lg">
      <form noValidate onSubmit={form.handleSubmit(() => {})} className="flex flex-col gap-6">
        {/* Frequency toggle */}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-container-high p-1">
          {(["monthly", "once"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFrequency(f)}
              className={cn(
                "rounded-md py-2 text-label-md font-semibold transition-colors",
                frequency === f
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-primary",
              )}
            >
              {f === "monthly" ? "Monthly" : "One-time"}
            </button>
          ))}
        </div>

        {/* Amount presets */}
        <div>
          <p className="mb-2 text-label-md text-on-surface-variant">Choose an amount</p>
          <div className="grid grid-cols-3 gap-2">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setAmount(p);
                  setCustom("");
                }}
                className={cn(
                  "rounded-lg border py-3 text-label-md font-bold transition-all",
                  !custom && amount === p
                    ? "border-secondary bg-secondary-fixed text-on-secondary-fixed-variant"
                    : "border-outline-variant text-primary hover:border-secondary/50",
                )}
              >
                ${p}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <Input
              name="custom"
              type="number"
              min={1}
              leadingIcon="payments"
              placeholder="Custom amount"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            name="name"
            label="Full name"
            required
            leadingIcon="person"
            placeholder="Your name"
            value={form.values.name}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.touched.name ? form.errors.name : undefined}
          />
          <Input
            name="email"
            label="Email"
            type="email"
            required
            leadingIcon="mail"
            placeholder="you@example.com"
            value={form.values.email}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            error={form.touched.email ? form.errors.email : undefined}
          />
        </div>

        <Button
          type="submit"
          variant="secondary"
          size="lg"
          fullWidth
          disabled={form.submitting || effectiveAmount <= 0}
          leadingIcon={form.submitting ? undefined : "favorite"}
        >
          {form.submitting
            ? "Processing…"
            : `Donate $${effectiveAmount}${frequency === "monthly" ? "/mo" : ""}`}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-label-sm text-on-surface-variant">
          <Icon name="lock" className="text-[16px]" />
          Demo only. No payment is processed in Phase 1.
        </p>
      </form>
    </Card>
  );
}
