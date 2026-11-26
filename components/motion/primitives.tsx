"use client";

import { createContext, useContext, useId, useState } from "react";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

/** One spring for the whole app so every movement feels like it belongs to the same material. */
export const SPRING = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const;
export const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;

/** Wrap the app once: honours the visitor's "reduce motion" setting everywhere. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={SPRING}>{children}</MotionConfig>;
}

/** A page arrives with a short rise and fade. Used from template.tsx so it plays on every navigation. */
export function PageEnter({ children }: { children: React.ReactNode }) {
  return <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: EASE_OUT }}>{children}</motion.div>;
}

/** A number that rolls to its new value, formatted in rupees with Indian digit grouping. */
export function Money({ value, sign, decimals = 0, className }: { value: number; sign?: boolean; decimals?: number; className?: string }) {
  return (
    <NumberFlow value={value} locales="en-IN" className={className}
      format={{ style: "currency", currency: "INR", maximumFractionDigits: decimals, minimumFractionDigits: decimals, signDisplay: sign ? "exceptZero" : "auto" }} />
  );
}
export function Percent({ value, decimals = 2, sign = true, className }: { value: number; decimals?: number; sign?: boolean; className?: string }) {
  return <NumberFlow value={value / 100} locales="en-IN" className={className} format={{ style: "percent", maximumFractionDigits: decimals, minimumFractionDigits: decimals, signDisplay: sign ? "exceptZero" : "auto" }} />;
}
export function Count({ value, className, decimals = 0 }: { value: number; className?: string; decimals?: number }) {
  return <NumberFlow value={value} locales="en-IN" className={className} format={{ maximumFractionDigits: decimals, minimumFractionDigits: decimals }} />;
}

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } } };
const item: Variants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: EASE_OUT } } };

/** Children rise in one after another, once. Use for card grids and lists that appear together. */
export function Stagger({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "ul" }) {
  const C = as === "ul" ? motion.ul : motion.div;
  return <C className={className} variants={container} initial="hidden" animate="show">{children}</C>;
}
export function StaggerItem({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "li" }) {
  const C = as === "li" ? motion.li : motion.div;
  return <C className={className} variants={item}>{children}</C>;
}

/** Content that opens and closes by height, so an expanding panel pushes the page down smoothly. */
export function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && <motion.div key="c" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.26, ease: EASE_OUT }} style={{ overflow: "hidden" }}>{children}</motion.div>}
    </AnimatePresence>
  );
}

/** Switches between panels with a quick cross-fade and slide, so changing tabs never snaps. */
export function Swap({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={id} className={className} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease: EASE_OUT }}>{children}</motion.div>
    </AnimatePresence>
  );
}

const PillCtx = createContext<string>("pill");

/** Tabs or filter chips with a highlight that glides from one option to the next. */
export function PillTabs<T extends string>({ value, onChange, options, className, size = "md", ariaLabel }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; badge?: React.ReactNode }[]; className?: string; size?: "sm" | "md"; ariaLabel?: string;
}) {
  const id = useId();
  return (
    <PillCtx.Provider value={id}>
      <LayoutGroup id={id}>
        <div role="tablist" aria-label={ariaLabel} className={cn("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl bg-muted p-1", className)}>
          {options.map((o) => {
            const on = o.value === value;
            return (
              <button key={o.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(o.value)}
                className={cn("relative shrink-0 rounded-[9px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm", on ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {on && <motion.span layoutId="pill" className="absolute inset-0 rounded-[9px] bg-card shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-border" transition={SPRING} />}
                <span className="relative z-10 inline-flex items-center gap-1.5">{o.label}{o.badge !== undefined && <span className="rounded-full bg-primary/10 px-1.5 text-[11px] text-primary">{o.badge}</span>}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>
    </PillCtx.Provider>
  );
}
export const usePillId = () => useContext(PillCtx);

/** Small helper for a hover/press response on any clickable block (cards, rows). */
export const pressable = { whileHover: { y: -2 }, whileTap: { scale: 0.985 }, transition: SPRING } as const;

export function useToggle(initial = false) { const [v, set] = useState(initial); return [v, () => set((x) => !x), set] as const; }
