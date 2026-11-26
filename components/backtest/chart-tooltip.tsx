import type { ReactNode } from "react";

export interface TipRow { label: string; value: string; color?: string }

export function TooltipBox({ title, rows }: { title?: ReactNode; rows: TipRow[] }) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-xl">
      {title && <div className="mb-1 font-medium text-popover-foreground">{title}</div>}
      <div className="space-y-0.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {r.color && <span className="size-2 rounded-full" style={{ background: r.color }} />}
              {r.label}
            </span>
            <span className="font-mono text-popover-foreground">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const AXIS = { stroke: "var(--muted-foreground)", fontSize: 11 } as const;
export const GRID = "color-mix(in oklch, var(--foreground) 8%, transparent)";
