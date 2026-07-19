"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastContextValue {
  notify: (toast: Omit<Toast, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<ToastVariant, { icon: string; classes: string; iconColor: string }> = {
  success: {
    icon: "check_circle",
    classes: "border-success/30 bg-success-soft",
    iconColor: "text-on-success-soft",
  },
  error: {
    icon: "error",
    classes: "border-danger/30 bg-danger-soft",
    iconColor: "text-on-danger-soft",
  },
  warning: {
    icon: "warning",
    classes: "border-warning/30 bg-warning-soft",
    iconColor: "text-on-warning-soft",
  },
  info: {
    icon: "info",
    classes: "border-secondary/30 bg-secondary-fixed",
    iconColor: "text-on-secondary-fixed-variant",
  },
};

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = `t${counter++}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      notify,
      dismiss,
      success: (title, description) => notify({ variant: "success", title, description }),
      error: (title, description) => notify({ variant: "error", title, description }),
      warning: (title, description) => notify({ variant: "warning", title, description }),
      info: (title, description) => notify({ variant: "info", title, description }),
    }),
    [notify, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end"
        role="region"
        aria-label="Notifications"
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const style = variantStyles[toast.variant];
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.96 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={cn(
                  "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-raised",
                  style.classes,
                )}
                role="alert"
              >
                <Icon name={style.icon} className={cn("text-[22px]", style.iconColor)} filled />
                <div className="flex-1">
                  <p className="text-label-md font-semibold text-on-surface">{toast.title}</p>
                  {toast.description && (
                    <p className="mt-0.5 text-body-sm text-on-surface-variant">
                      {toast.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="text-on-surface-variant transition-colors hover:text-on-surface"
                  aria-label="Dismiss notification"
                >
                  <Icon name="close" className="text-[18px]" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
