"use client";

import { usePathname } from "next/navigation";
import { hueFor, itemFor } from "@/components/shell/nav";
import { Info } from "@/components/ui/info";
import { cn } from "@/lib/utils";

/**
 * The same title block on every page: a section-coloured icon, the title, one short line, and the page's actions.
 * Anything longer than a line goes in `info`, which opens from a small button instead of sitting on the page.
 */
export function PageHeader({ title, description, info, children, className }: { title: string; description?: React.ReactNode; info?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  const path = usePathname();
  const Icon = itemFor(path)?.icon;
  return (
    <div className={cn("tone flex flex-wrap items-center justify-between gap-x-6 gap-y-3", className)} style={{ "--h": hueFor(path) } as React.CSSProperties}>
      <div className="flex min-w-0 items-center gap-3.5">
        {Icon && <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--tone-soft)] text-[var(--tone)]"><Icon className="size-5" strokeWidth={2} /></span>}
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-[1.6rem] font-semibold leading-tight">{title}{info && <Info title={title} align="start">{info}</Info>}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** A titled block of a page. Quieter than a card: a heading, an optional aside, then the content. */
export function Section({ title, aside, info, children, className }: { title: string; aside?: React.ReactNode; info?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold">{title}{info && <Info title={title}>{info}</Info>}</h2>
        {aside && <div className="text-sm text-muted-foreground">{aside}</div>}
      </div>
      {children}
    </section>
  );
}
