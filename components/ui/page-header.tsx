import { cn } from "@/lib/utils";

/** The same title block on every page: title and one plain sentence on the left, the page's actions on the right. */
export function PageHeader({ title, description, children, className }: { title: string; description?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0 max-w-2xl">
        <h1 className="text-[1.75rem] font-semibold leading-tight">{title}</h1>
        {description && <p className="mt-1 text-[15px] leading-snug text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** A titled block of a page. Quieter than a card: a heading, an optional aside, then the content. */
export function Section({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {aside && <div className="text-sm text-muted-foreground">{aside}</div>}
      </div>
      {children}
    </section>
  );
}
