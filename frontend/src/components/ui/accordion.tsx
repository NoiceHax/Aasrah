"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

type AccordionItem = { id: string; question: string; answer: string };

export function Accordion({ items }: { items: AccordionItem[] }) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className="divide-y divide-outline-variant overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <div key={item.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : item.id)}
              className="flex w-full items-center justify-between gap-4 px-stack-md py-4 text-left transition-colors hover:bg-surface-container-low"
              aria-expanded={open}
            >
              <span className="text-label-md font-semibold text-primary">{item.question}</span>
              <Icon
                name="expand_more"
                className={cn(
                  "shrink-0 text-[22px] text-on-surface-variant transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <p className="px-stack-md pb-4 text-body-sm text-on-surface-variant">
                    {item.answer}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
