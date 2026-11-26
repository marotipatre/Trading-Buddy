"use client";

import { useEffect, useRef, useState } from "react";
import { AlignJustify, ChevronsDown, ChevronsUp, Eye, EyeOff, Layers, Magnet, Minus, MousePointer2, MoveUpRight, Pin, Ruler, SeparatorVertical, Square, Trash2, TrendingUp, Type, ArrowRightFromLine, type LucideIcon } from "lucide-react";
import { TOOL_INFO, type DrawingKind } from "@/lib/drawings";
import { cn } from "@/lib/utils";
import type { Tool } from "./drawing-layer";

const ICON: Record<DrawingKind, LucideIcon> = {
  trend: TrendingUp, ray: MoveUpRight, hline: Minus, hray: ArrowRightFromLine, vline: SeparatorVertical, rect: Square, channel: Layers,
  fib: AlignJustify, text: Type, measure: Ruler, long: ChevronsUp, short: ChevronsDown,
};
/** Grouped like TradingView's left rail: each group shows the tool you used last and opens a flyout with the rest. */
const GROUPS: { id: string; label: string; tools: DrawingKind[] }[] = [
  { id: "lines", label: "Lines", tools: ["trend", "hline", "ray", "hray", "vline", "channel"] },
  { id: "shapes", label: "Shapes and fib", tools: ["fib", "rect"] },
  { id: "note", label: "Notes and measuring", tools: ["text", "measure"] },
  { id: "plan", label: "Trade planning", tools: ["long", "short"] },
];

const base = "grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";
function RailButton({ label, on, onClick, children, danger }: { label: string; on?: boolean; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={on} onClick={onClick} className={cn(base, on && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary", danger && "hover:bg-down/10 hover:text-down")}>{children}</button>
  );
}

function Group({ g, tool, onTool }: { g: (typeof GROUPS)[number]; tool: Tool; onTool: (t: Tool) => void }) {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<DrawingKind>(g.tools[0]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  const active = g.tools.find((k) => k === tool);
  const shown = active ?? last;
  const Icon = ICON[shown];
  return (
    <div ref={ref} className="relative">
      <div className="flex items-center">
        <button type="button" aria-label={`${TOOL_INFO[shown].label} (Alt+${TOOL_INFO[shown].key})`} title={`${TOOL_INFO[shown].label} (Alt+${TOOL_INFO[shown].key})`} aria-pressed={!!active}
          onClick={() => { setLast(shown); onTool(shown); }} className={cn(base, "rounded-r-none", active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary")}><Icon className="size-[17px]" /></button>
        <button type="button" aria-label={`More ${g.label.toLowerCase()}`} aria-expanded={open} onClick={() => setOpen((o) => !o)} className={cn("grid h-8 w-3 place-items-center rounded-r-lg text-muted-foreground hover:bg-muted", active && "bg-primary/10 text-primary")}><span className="size-0 border-y-[3px] border-l-[4px] border-y-transparent border-l-current" /></button>
      </div>
      {open && (
        <div role="menu" className="absolute left-full top-0 z-30 ml-2 w-56 rounded-xl border bg-popover p-1 shadow-xl">
          <div className="px-2 pb-1 pt-1.5 text-xs font-medium text-muted-foreground">{g.label}</div>
          {g.tools.map((k) => { const I = ICON[k]; return (
            <button key={k} type="button" role="menuitem" onClick={() => { setLast(k); onTool(k); setOpen(false); }} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted", tool === k && "bg-primary/10 text-primary")}>
              <I className="size-4" />{TOOL_INFO[k].label}<kbd className="ml-auto rounded border bg-muted px-1.5 text-[10px] text-muted-foreground">Alt {TOOL_INFO[k].key}</kbd>
            </button>
          ); })}
        </div>
      )}
    </div>
  );
}

/** The drawing tools down the left of the chart. */
export function DrawingRail({ tool, onTool, magnet, onMagnet, stay, onStay, hidden, onHidden, count, onClear }: {
  tool: Tool; onTool: (t: Tool) => void; magnet: boolean; onMagnet: () => void; stay: boolean; onStay: () => void; hidden: boolean; onHidden: () => void; count: number; onClear: () => void;
}) {
  return (
    <div role="toolbar" aria-label="Drawing tools" aria-orientation="vertical" className="absolute left-0 top-0 z-20 flex w-11 flex-col items-center gap-0.5 rounded-xl border bg-card py-1.5 pr-1">
      <RailButton label="Cursor (Esc)" on={tool === "cursor"} onClick={() => onTool("cursor")}><MousePointer2 className="size-[17px]" /></RailButton>
      {GROUPS.map((g) => <Group key={g.id} g={g} tool={tool} onTool={onTool} />)}
      <div className="mt-0.5 flex flex-col items-center gap-0.5 border-t pt-1">
        <RailButton label={magnet ? "Magnet on: snaps to highs, lows and closes" : "Magnet off"} on={magnet} onClick={onMagnet}><Magnet className="size-[17px]" /></RailButton>
        <RailButton label={stay ? "Staying in the tool after each drawing" : "Keep the tool after drawing"} on={stay} onClick={onStay}><Pin className="size-[17px]" /></RailButton>
        <RailButton label={hidden ? "Show drawings" : "Hide drawings"} on={hidden} onClick={onHidden}>{hidden ? <EyeOff className="size-[17px]" /> : <Eye className="size-[17px]" />}</RailButton>
        {count > 0 && <RailButton label={`Remove all ${count} drawings`} danger onClick={onClear}><Trash2 className="size-[17px]" /></RailButton>}
      </div>
    </div>
  );
}
