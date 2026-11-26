"use client";

import { defaultIndicator, indicatorMeta, INDICATORS } from "@/lib/engine/indicator-meta";
import type { IndicatorName, Operand } from "@/lib/engine/strategy";
import { NumberField } from "./number-field";
import { SimpleSelect } from "./simple-select";

type Kind = "indicator" | "price" | "number";
const KINDS = [
  { value: "indicator", label: "Indicator" },
  { value: "price", label: "Price" },
  { value: "number", label: "Number" },
] as const;
const FIELDS = ["close", "open", "high", "low", "volume"].map((f) => ({ value: f, label: f[0].toUpperCase() + f.slice(1) }));
const INDICATOR_OPTIONS = INDICATORS.map((i) => ({ value: i.name, label: `${i.label}` }));

export function OperandEditor({ value, onChange }: { value: Operand; onChange: (o: Operand) => void }) {
  const switchKind = (k: Kind) => {
    if (k === value.kind) return;
    if (k === "indicator") onChange(defaultIndicator("sma"));
    else if (k === "price") onChange({ kind: "price", field: "close", shift: 0 });
    else onChange({ kind: "number", value: 0 });
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <SimpleSelect size="sm" className="w-24" value={value.kind} onChange={switchKind} options={[...KINDS]} />
      {value.kind === "number" && (
        <NumberField className="h-7 w-20" value={value.value} step={0.1} onChange={(v) => onChange({ kind: "number", value: v })} />
      )}
      {value.kind === "price" && (
        <>
          <SimpleSelect size="sm" className="w-24" value={value.field} options={FIELDS}
            onChange={(f) => onChange({ ...value, field: f as typeof value.field })} />
          <Shift value={value.shift} onChange={(shift) => onChange({ ...value, shift })} />
        </>
      )}
      {value.kind === "indicator" && (
        <>
          <SimpleSelect size="sm" className="w-44" value={value.name} options={INDICATOR_OPTIONS}
            onChange={(n) => onChange({ ...defaultIndicator(n as IndicatorName), shift: value.shift })} />
          {indicatorMeta(value.name).params.map((p) => (
            <label key={p.key} className="flex items-center gap-1 text-[11px] text-muted-foreground">
              {p.label}
              <NumberField className="h-7 w-16" min={p.min} step={p.step ?? 1} value={value[p.key] ?? p.default}
                onChange={(v) => onChange({ ...value, [p.key]: v })} />
            </label>
          ))}
          <Shift value={value.shift} onChange={(shift) => onChange({ ...value, shift })} />
        </>
      )}
    </div>
  );
}

function Shift({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center gap-1 text-[11px] text-muted-foreground" title="Read the value from N bars ago (0 = current bar)">
      Bars ago
      <NumberField className="h-7 w-14" min={0} max={250} value={value} onChange={(v) => onChange(Math.max(0, Math.round(v)))} />
    </label>
  );
}
