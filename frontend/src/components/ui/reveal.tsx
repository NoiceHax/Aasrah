"use client";

import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

const variants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98], delay: i * 0.08 },
  }),
};

type RevealProps = {
  /** Stagger index: multiplies the entrance delay. */
  index?: number;
  as?: "div" | "li" | "section" | "article";
  className?: string;
  children: React.ReactNode;
};

/** Scroll-into-view fade-up. Animates once when it enters the viewport. */
export function Reveal({ index = 0, as = "div", className, children }: RevealProps) {
  const MotionTag = motion[as];
  return (
    <MotionTag
      custom={index}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      className={cn(className)}
    >
      {children}
    </MotionTag>
  );
}
