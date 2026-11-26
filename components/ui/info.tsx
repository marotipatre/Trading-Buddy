"use client";

import { Popover } from "@base-ui/react/popover";
import { Info as InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Keeps the explanation out of the page until someone wants it. A small button opens a panel with the longer text.
 * Use `label` for a text button ("How it works") and leave it off for a bare (i) icon next to a title.
 */
export function Info({ children, label, title, className, align = "start" }: { children: React.ReactNode; label?: string; title?: string; className?: string; align?: "start" | "center" | "end" }) {
  return (
    <Popover.Root>
      <Popover.Trigger aria-label={label ?? title ?? "More information"}
        className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:text-primary",
          label ? "border bg-card px-3 py-1 text-xs font-medium hover:bg-accent" : "size-6 justify-center hover:bg-muted", className)}>
        <InfoIcon className="size-3.5" />{label}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align={align} className="z-50">
          <Popover.Popup className="max-h-[70vh] w-[min(26rem,calc(100vw-2rem))] origin-[var(--transform-origin)] overflow-y-auto rounded-2xl border bg-popover p-4 text-sm leading-relaxed text-popover-foreground shadow-xl outline-none transition-[opacity,transform] duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0">
            {title && <Popover.Title className="mb-1.5 font-heading text-base font-semibold">{title}</Popover.Title>}
            <div className="space-y-2 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_b]:text-foreground">{children}</div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
