"use client";

import { useState, useCallback } from "react";

export type Validator<T> = (value: string, values: T) => string | undefined;
export type ValidationSchema<T> = Partial<Record<keyof T, Validator<T>>>;

/**
 * Minimal client-side form state + validation. Phase 1 has no backend, so
 * `onValidSubmit` simply receives the validated values (e.g. to show a success state).
 */
export function useForm<T extends Record<string, string>>(
  initial: T,
  schema: ValidationSchema<T>,
) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validateField = useCallback(
    (name: keyof T, next: T) => {
      const validator = schema[name];
      return validator ? validator(next[name], next) : undefined;
    },
    [schema],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setValues((prev) => {
        const next = { ...prev, [name]: value };
        if (touched[name as keyof T]) {
          setErrors((prevErr) => ({ ...prevErr, [name]: validateField(name as keyof T, next) }));
        }
        return next;
      });
    },
    [touched, validateField],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const name = e.target.name as keyof T;
      setTouched((prev) => ({ ...prev, [name]: true }));
      setErrors((prev) => ({ ...prev, [name]: validateField(name, values) }));
    },
    [values, validateField],
  );

  const validateAll = useCallback(() => {
    const nextErrors: Partial<Record<keyof T, string>> = {};
    (Object.keys(schema) as (keyof T)[]).forEach((key) => {
      const err = validateField(key, values);
      if (err) nextErrors[key] = err;
    });
    setErrors(nextErrors);
    setTouched(
      (Object.keys(initial) as (keyof T)[]).reduce(
        (acc, k) => ({ ...acc, [k]: true }),
        {} as Partial<Record<keyof T, boolean>>,
      ),
    );
    return Object.keys(nextErrors).length === 0;
  }, [schema, values, validateField, initial]);

  const handleSubmit = useCallback(
    (onValidSubmit: (values: T) => void) => (e: React.FormEvent) => {
      e.preventDefault();
      if (!validateAll()) return;
      setSubmitting(true);
      // No backend in Phase 1. Simulate an async round-trip then surface success.
      window.setTimeout(() => {
        setSubmitting(false);
        setSubmitted(true);
        onValidSubmit(values);
      }, 700);
    },
    [validateAll, values],
  );

  const reset = useCallback(() => {
    setValues(initial);
    setErrors({});
    setTouched({});
    setSubmitted(false);
  }, [initial]);

  return {
    values,
    errors,
    touched,
    submitting,
    submitted,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setValues,
  };
}

/* ---- Reusable validators ---- */

export const required =
  (message = "This field is required"): Validator<Record<string, string>> =>
  (v) =>
    v.trim() ? undefined : message;

export const email =
  (message = "Enter a valid email address"): Validator<Record<string, string>> =>
  (v) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? undefined : message;

export const minLength =
  (n: number, message?: string): Validator<Record<string, string>> =>
  (v) =>
    v.trim().length >= n ? undefined : (message ?? `Must be at least ${n} characters`);

export const phone =
  (message = "Enter a valid phone number"): Validator<Record<string, string>> =>
  (v) =>
    !v.trim() || /^[+]?[\d\s()-]{7,}$/.test(v.trim()) ? undefined : message;

/** Compose multiple validators; first failure wins. */
export const compose =
  <T extends Record<string, string>>(...validators: Validator<T>[]): Validator<T> =>
  (value, values) => {
    for (const v of validators) {
      const err = v(value, values);
      if (err) return err;
    }
    return undefined;
  };
