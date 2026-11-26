"use client";

import { Label } from "@/components/ui/label";
import { describeEmaSpec, type EmaSpec } from "@/lib/engine/ema-builder";
import { NumberField } from "./number-field";
import { SimpleSelect } from "./simple-select";

const EMA_CHOICES = [10, 20, 50, 100, 200];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

/** Moving-average strategy in plain choices: when to buy, where the stop goes, where the target goes. */
export function EmaBuilderForm({ spec, onChange }: { spec: EmaSpec; onChange: (s: EmaSpec) => void }) {
  const set = (p: Partial<EmaSpec>) => onChange({ ...spec, ...p });
  const toggleTarget = (n: number) => {
    const has = spec.targetEmas.includes(n);
    const next = has ? spec.targetEmas.filter((x) => x !== n) : [...spec.targetEmas, n];
    if (next.length) set({ targetEmas: next });
  };
  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border p-3">
        <div className="text-sm font-medium">1. When do I buy?</div>
        <SimpleSelect className="w-full" value={spec.entry} onChange={(entry) => set({ entry })} options={[
          { value: "cross", label: "Fast EMA crosses above slow EMA" },
          { value: "price_cross", label: "Price closes above an EMA" },
          { value: "pullback", label: "Pullback to an EMA in an uptrend (bounce)" },
        ]} />
        <div className="grid grid-cols-2 gap-2.5">
          {spec.entry !== "price_cross" && <Field label={spec.entry === "pullback" ? "Pullback EMA" : "Fast EMA"}><NumberField min={2} max={400} value={spec.fast} onChange={(v) => set({ fast: Math.round(v) })} /></Field>}
          <Field label={spec.entry === "price_cross" ? "EMA" : spec.entry === "pullback" ? "Trend EMA (stay above)" : "Slow EMA"}><NumberField min={3} max={500} value={spec.slow} onChange={(v) => set({ slow: Math.round(v) })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={spec.exitOnReverse} onChange={(e) => set({ exitOnReverse: e.target.checked })} />
          Also sell when the signal reverses
        </label>
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <div className="text-sm font-medium">2. Where is my stop-loss?</div>
        <SimpleSelect className="w-full" value={spec.stop} onChange={(stop) => set({ stop, stopPct: stop === "atr" ? 2.5 : 6 })} options={[
          { value: "percent", label: "% below my entry" },
          { value: "ema", label: "Just below an EMA" },
          { value: "atr", label: "ATR multiple (volatility)" },
        ]} />
        {spec.stop === "ema"
          ? <Field label="Stop under this EMA"><SimpleSelect className="w-full" value={String(spec.stopEma)} onChange={(v) => set({ stopEma: Number(v) })} options={EMA_CHOICES.map((n) => ({ value: String(n), label: `${n} EMA` }))} /></Field>
          : <Field label={spec.stop === "atr" ? "ATR multiple" : "Distance (%)"}><NumberField min={0.1} step={0.5} value={spec.stopPct} onChange={(stopPct) => set({ stopPct })} /></Field>}
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <div className="text-sm font-medium">3. Where do I take profit?</div>
        <SimpleSelect className="w-full" value={spec.target} onChange={(target) => set({ target })} options={[
          { value: "none", label: "No fixed target (let the exit signal decide)" },
          { value: "next_ema", label: "At the next EMA above price" },
          { value: "percent", label: "% above my entry" },
          { value: "rr", label: "Multiple of my risk (R)" },
        ]} />
        {spec.target === "percent" && <Field label="Target (%)"><NumberField min={0.1} step={0.5} value={spec.targetPct} onChange={(targetPct) => set({ targetPct })} /></Field>}
        {spec.target === "rr" && <Field label="Target (× risk)"><NumberField min={0.5} step={0.5} value={spec.targetRr} onChange={(targetRr) => set({ targetRr })} /></Field>}
        {spec.target === "next_ema" && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">The target is the closest of these EMAs that sits above your entry price. If none is above, that trade is skipped.</p>
            <div className="flex flex-wrap gap-1.5">
              {EMA_CHOICES.map((n) => (
                <button key={n} type="button" onClick={() => toggleTarget(n)} aria-pressed={spec.targetEmas.includes(n)}
                  className={`rounded-md border px-2.5 py-1 text-xs ${spec.targetEmas.includes(n) ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground"}`}>
                  {n} EMA
                </button>
              ))}
            </div>
          </div>
        )}
        <Field label="Give up after (days)"><NumberField min={2} max={250} value={spec.maxHold} onChange={(v) => set({ maxHold: Math.round(v) })} /></Field>
      </div>
      <p className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground"><b>Your strategy in words:</b> {describeEmaSpec(spec)}</p>
    </div>
  );
}
