"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { StrategyDef } from "@/lib/engine/strategy";
import { NumberField } from "./number-field";
import { SimpleSelect } from "./simple-select";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** `sizingOnly` hides stop, target and time-stop (the simple builder sets those) and keeps size, capital and product. */
export function RiskForm({ strategy: s, onChange, sizingOnly = false }: { strategy: StrategyDef; onChange: (s: StrategyDef) => void; sizingOnly?: boolean }) {
  const set = (patch: Partial<StrategyDef>) => onChange({ ...s, ...patch });
  return (
    <div className="space-y-5">
      {!sizingOnly && (<>
      <div className="space-y-2.5">
        <Toggle label="Stop-loss" checked={!!s.stopLoss}
          onChange={(on) => set({ stopLoss: on ? { type: "percent", value: 5, trailing: false, atrPeriod: 14 } : undefined,
            ...(on ? {} : { target: s.target?.type === "rr" ? undefined : s.target, sizing: s.sizing.type === "risk_percent" ? { type: "percent_equity", value: 100 } : s.sizing }) })} />
        {s.stopLoss && (
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Type">
              <SimpleSelect className="w-full" value={s.stopLoss.type}
                options={[
                  { value: "percent", label: "% below entry" }, { value: "atr", label: "× ATR" },
                  { value: "support", label: "Below support" }, { value: "swing_low", label: "Below recent low" },
                ]}
                onChange={(type) => set({ stopLoss: { ...s.stopLoss!, type, value: type === "atr" ? 2.5 : type === "support" ? 1.5 : type === "swing_low" ? 1 : 5, period: type === "support" ? 5 : type === "swing_low" ? 10 : undefined } })} />
            </Field>
            <Field label={s.stopLoss.type === "percent" ? "Distance (%)" : s.stopLoss.type === "atr" ? "ATR multiple" : "Buffer beyond the level (%)"}>
              <NumberField min={0.1} step={0.5} value={s.stopLoss.value} onChange={(value) => set({ stopLoss: { ...s.stopLoss!, value } })} />
            </Field>
            {(s.stopLoss.type === "support" || s.stopLoss.type === "swing_low") && (
              <div className="col-span-2">
                <Field label={s.stopLoss.type === "support" ? "Pivot strength (bars each side)" : "Look back (bars)"} hint={s.stopLoss.type === "support" ? "A swing low needs this many higher lows on each side. No level, no trade." : "The lowest low of this many bars."}>
                  <NumberField min={2} max={60} value={s.stopLoss.period ?? (s.stopLoss.type === "support" ? 5 : 10)} onChange={(period) => set({ stopLoss: { ...s.stopLoss!, period: Math.round(period) } })} />
                </Field>
              </div>
            )}
            <div className="col-span-2">
              <Toggle label="Trailing stop" checked={s.stopLoss.trailing} onChange={(trailing) => set({ stopLoss: { ...s.stopLoss!, trailing } })} />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        <Toggle label="Profit target" checked={!!s.target}
          onChange={(on) => set({ target: on ? { type: "percent", value: 10 } : undefined })} />
        {s.target && (
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Type">
              <SimpleSelect className="w-full" value={s.target.type}
                options={[{ value: "percent", label: "% above entry" }, { value: "resistance", label: "At resistance" }, ...(s.stopLoss ? [{ value: "rr" as const, label: "R multiple" }] : [])]}
                onChange={(type) => set({ target: { type, value: type === "rr" ? 2 : type === "resistance" ? 1 : 10 } })} />
            </Field>
            <Field label={s.target.type === "percent" ? "Distance (%)" : s.target.type === "rr" ? "× initial risk" : "Buffer below resistance (%)"}>
              <NumberField min={0.1} step={0.5} value={s.target.value} onChange={(value) => set({ target: { ...s.target!, value } })} />
            </Field>
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        <Toggle label="Time stop" checked={s.maxHoldBars !== undefined} onChange={(on) => set({ maxHoldBars: on ? 15 : undefined })} />
        {s.maxHoldBars !== undefined && (
          <Field label="Max days to hold" hint="Exits at the next open after this many trading days.">
            <NumberField min={1} max={1000} value={s.maxHoldBars} onChange={(v) => set({ maxHoldBars: Math.max(1, Math.round(v)) })} />
          </Field>
        )}
      </div>

      </>)}
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Position size">
          <SimpleSelect className="w-full" value={s.sizing.type}
            options={[
              { value: "percent_equity", label: "% of equity" },
              { value: "fixed_amount", label: "Fixed ₹ amount" },
              ...(s.stopLoss ? [{ value: "risk_percent" as const, label: "Risk % per trade" }] : []),
            ]}
            onChange={(type) => set({ sizing: { type, value: type === "percent_equity" ? 100 : type === "risk_percent" ? 1 : 100000 } })} />
        </Field>
        <Field label={s.sizing.type === "fixed_amount" ? "Amount (₹)" : "Percent"}>
          <NumberField min={0.1} step={s.sizing.type === "fixed_amount" ? 10000 : 0.5} value={s.sizing.value}
            onChange={(value) => set({ sizing: { ...s.sizing, value } })} />
        </Field>
        <Field label="Starting capital (₹)">
          <NumberField min={1000} step={100000} value={s.initialCapital} onChange={(initialCapital) => set({ initialCapital })} />
        </Field>
        <Field label="Product">
          <SimpleSelect className="w-full" value={s.product}
            options={[{ value: "delivery", label: "Delivery (swing)" }, { value: "intraday", label: "Intraday" }]}
            onChange={(product) => set({ product, ...(product === "delivery" ? { direction: "long" as const } : {}) })} />
        </Field>
      </div>
    </div>
  );
}
