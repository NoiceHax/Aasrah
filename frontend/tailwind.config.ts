import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

/**
 * Aasrah design system, ported from the Stitch project export.
 * Foundation: Slate + Navy with an Indigo accent. Material-style tonal
 * surfaces drive depth (tonal layering over heavy shadows).
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Material tonal palette (from Stitch namedColors).
        // `primary` is a readable slate-navy (softened from the original near-black
        // #091426, which read as flat black for headings and buttons). It stays
        // dark enough to anchor white-on-primary brand surfaces (hero, headers).
        primary: "#1e293b",
        "primary-container": "#334155",
        "on-primary": "#ffffff",
        "on-primary-container": "#8590a6",
        "inverse-primary": "#bcc7de",
        "primary-fixed": "#d8e3fb",
        "primary-fixed-dim": "#bcc7de",
        "on-primary-fixed": "#111c2d",
        "on-primary-fixed-variant": "#3c475a",

        secondary: "#4648d4",
        "secondary-container": "#6063ee",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#fffbff",
        "secondary-fixed": "#e1e0ff",
        "secondary-fixed-dim": "#c0c1ff",
        "on-secondary-fixed": "#07006c",
        "on-secondary-fixed-variant": "#2f2ebe",

        tertiary: "#00190e",
        "tertiary-container": "#00301e",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#00a472",
        "tertiary-fixed": "#6ffbbe",
        "tertiary-fixed-dim": "#4edea3",
        "on-tertiary-fixed": "#002113",
        "on-tertiary-fixed-variant": "#005236",

        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",

        background: "#f7f9fb",
        "on-background": "#1e293b",
        surface: "#f7f9fb",
        "surface-dim": "#d8dadc",
        "surface-bright": "#f7f9fb",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f2f4f6",
        "surface-container": "#eceef0",
        "surface-container-high": "#e6e8ea",
        "surface-container-highest": "#e0e3e5",
        "surface-variant": "#e0e3e5",
        "surface-tint": "#545f73",
        "on-surface": "#1e293b",
        "on-surface-variant": "#4b5563",
        "inverse-surface": "#2d3133",
        "inverse-on-surface": "#eff1f3",

        outline: "#75777d",
        "outline-variant": "#c5c6cd",

        // Semantic accents from the design-md spec
        success: "#10b981",
        "success-soft": "#d1fae5",
        "on-success-soft": "#065f46",
        warning: "#f59e0b",
        "warning-soft": "#fef3c7",
        "on-warning-soft": "#92400e",
        danger: "#ef4444",
        "danger-soft": "#fee2e2",
        "on-danger-soft": "#991b1b",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-lg-mobile": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "headline-sm": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "label-md": ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "500" }],
        "label-sm": ["12px", { lineHeight: "16px", fontWeight: "600" }],
      },
      spacing: {
        unit: "4px",
        "stack-sm": "8px",
        "stack-md": "16px",
        "stack-lg": "32px",
        gutter: "24px",
        "margin-mobile": "16px",
        "margin-desktop": "32px",
      },
      maxWidth: {
        "container-max": "1440px",
        content: "1200px",
      },
      borderRadius: {
        DEFAULT: "0.375rem", // 6px, standard for buttons/inputs
        sm: "0.125rem",
        md: "0.375rem",
        lg: "0.5rem", // 8px, KPI cards
        xl: "0.75rem",
        "2xl": "1rem",
        full: "9999px",
      },
      boxShadow: {
        // Diffused low-opacity elevation (design-md "Interaction Shadows")
        raised: "0px 4px 20px rgba(0, 0, 0, 0.05)",
        "raised-lg": "0px 12px 40px rgba(9, 20, 38, 0.10)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(70, 72, 212, 0.4)" },
          "70%": { boxShadow: "0 0 0 10px rgba(70, 72, 212, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(70, 72, 212, 0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out both",
        "fade-up": "fade-up 0.6s ease-out both",
        "pulse-ring": "pulse-ring 1.8s infinite",
      },
      backdropBlur: {
        glass: "8px",
      },
    },
  },
  plugins: [forms({ strategy: "class" })],
};

export default config;
