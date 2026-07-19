"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

type Variant = "primary" | "secondary" | "success" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-label-md font-semibold whitespace-nowrap transition-all active:scale-[0.98] focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  // Primary CTA uses the indigo accent so buttons read as coloured, not black.
  primary: "bg-secondary text-on-secondary hover:bg-secondary-container shadow-sm",
  secondary: "bg-secondary text-on-secondary hover:bg-secondary-container shadow-sm",
  success: "bg-success text-white hover:bg-emerald-600 shadow-sm",
  outline:
    "border border-outline text-primary bg-surface-container-lowest hover:bg-surface-container-low",
  ghost: "text-primary hover:bg-surface-container-high",
  danger: "bg-error text-on-error hover:opacity-90 shadow-sm",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-label-md",
  md: "h-11 px-6 text-label-md",
  lg: "h-12 px-8 text-body-md",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  leadingIcon?: string;
  trailingIcon?: string;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      leadingIcon,
      trailingIcon,
      fullWidth,
      className,
      children,
      ...props
    },
    ref,
  ) {
    const classes = cn(base, variants[variant], sizes[size], fullWidth && "w-full", className);
    const inner = (
      <>
        {leadingIcon && <Icon name={leadingIcon} className="text-[20px]" />}
        {children}
        {trailingIcon && <Icon name={trailingIcon} className="text-[20px]" />}
      </>
    );

    if ("href" in props && props.href !== undefined) {
      const { href, ...rest } = props as ButtonAsLink;
      return (
        <Link
          href={href}
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={classes}
          {...rest}
        >
          {inner}
        </Link>
      );
    }

    const { type, ...rest } = props as ButtonAsButton;
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={type ?? "button"}
        className={classes}
        {...rest}
      >
        {inner}
      </button>
    );
  },
);
