"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SymbolSearch } from "@/components/symbol-search";
import type { Candle } from "@/lib/data/types";
import { analyze, type Analysis } from "@/lib/engine/analyze";
import { DEFAULT_COSTS, DELIVERY_ZERO_BROKERAGE } from "@/lib/engine/costs";
import { PRESETS, getPreset } from "@/lib/engine/presets";
import { StrategyDef } from "@/lib/engine/strategy";
import { NumberField } from "./number-field";
import { RiskForm } from "./risk-form";
import { BacktestResults } from "./results";
import { RuleGroupEditor } from "./rule-group-editor";
import { SimpleSelect } from "./simple-select";

const YEARS = [1, 2, 3, 5, 8, 12].map((y) => ({ value: String(y), label: `${y} year${y > 1 ? "s" : ""}` }));
const PRESET_OPTIONS = [...PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: "custom", label: "Custom (edited)" }];

interface Output { analysis: Analysis; candles: Candle[]; label: string }

export function Workbench() {
  const [symbol, setSymbol] = useState("RELIANCE.NS");
  const [years, setYears] = useState("5");
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [strategy, setStrategy] = useState<StrategyDef>(PRESETS[0].strategy);
  const [slippageBps, setSlippageBps] = useState(DEFAULT_COSTS.slippageBps);
  const [zeroBrokerage, setZeroBrokerage] = useState(true);
  const [running, setRunning] = useState(false);
  const [out, setOut] = useState<Output | null>(null);

  const edit = (s: StrategyDef) => {
    setStrategy(s);
    setPresetId("custom");
  };

  function pickPreset(id: string) {
    const p = getPreset(id);
    if (!p) return;
    setPresetId(id);
    setStrategy(p.strategy);
  }

  async function run() {
    const parsed = StrategyDef.safeParse(strategy);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid strategy");
      return;
    }
    setRunning(true);
    try {
      const res = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&interval=1d&days=${Number(years) * 365}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load price history");
      const candles: Candle[] = json.candles;
      if (candles.length < 60) throw new Error(`Only ${candles.length} candles available for ${symbol}`);
      await new Promise((r) => setTimeout(r, 30)); // let the spinner paint before the CPU-heavy part
      const costs = {
        ...DEFAULT_COSTS,
        ...(zeroBrokerage && parsed.data.product === "delivery" ? DELIVERY_ZERO_BROKERAGE : {}),
        slippageBps,
      };
      const analysis = analyze(symbol, candles, parsed.data, costs);
      setOut({ analysis, candles, label: `${parsed.data.name} on ${symbol}` });
      toast.success(`${analysis.result.trades.length} trades simulated`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>1 · Stock &amp; history</CardTitle>
            <CardDescription>Daily candles from Yahoo Finance (adjusted for splits and dividends)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-lg font-semibold">{symbol}</div>
                <div className="text-xs text-muted-foreground">selected</div>
              </div>
              <SymbolSearch onPick={(h) => setSymbol(h.symbol)} placeholder="Change symbol…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">History</Label>
              <SimpleSelect className="w-full" value={years} options={YEARS} onChange={setYears} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2 · Strategy</CardTitle>
            <CardDescription>Start from a swing preset or build your own rules</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SimpleSelect className="w-full" value={presetId} options={PRESET_OPTIONS} onChange={(id) => id !== "custom" && pickPreset(id)} />
            {getPreset(presetId) && <p className="text-xs text-muted-foreground">{getPreset(presetId)!.description}</p>}
            <div>
              <div className="mb-2 text-sm font-medium">Buy when</div>
              <RuleGroupEditor value={strategy.entry} onChange={(entry) => edit({ ...strategy, entry })} />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium">Sell when</div>
              {strategy.exit ? (
                <RuleGroupEditor value={strategy.exit} optional onChange={(exit) => edit({ ...strategy, exit })}
                  onRemove={() => edit({ ...strategy, exit: undefined })} />
              ) : (
                <Button variant="outline" size="sm" onClick={() => edit({ ...strategy, exit: structuredClone(strategy.entry) })}>
                  Add a signal-based exit
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3 · Risk &amp; costs</CardTitle>
            <CardDescription>Stops, targets, sizing and Indian transaction charges</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <RiskForm strategy={strategy} onChange={edit} />
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Slippage (bps per fill)</Label>
                <NumberField min={0} step={1} value={slippageBps} onChange={setSlippageBps} />
              </div>
              <div className="flex items-end justify-between gap-2 pb-1.5">
                <Label className="text-xs text-muted-foreground">Zero delivery brokerage</Label>
                <Switch checked={zeroBrokerage} onCheckedChange={setZeroBrokerage} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button size="lg" className="sticky bottom-4 w-full shadow-lg" onClick={run} disabled={running}>
          {running ? <Loader2 className="animate-spin" /> : <Play />}
          {running ? "Running backtest…" : "Run backtest"}
        </Button>
      </div>

      <div className="min-w-0">
        {out ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{out.label}</h2>
            <BacktestResults analysis={out.analysis} candles={out.candles} />
          </div>
        ) : (
          <Card className="grid min-h-96 place-items-center text-center">
            <CardContent className="max-w-sm space-y-2">
              <div className="text-lg font-semibold">Test a strategy on real history</div>
              <p className="text-sm text-muted-foreground">
                Pick a stock and a preset, then run. You will see the win probability with a confidence range, whether your stop-loss helps, and how lucky or unlucky the result may be.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
