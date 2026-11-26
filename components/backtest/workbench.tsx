"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, Play, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SymbolSearch } from "@/components/symbol-search";
import type { Candle } from "@/lib/data/types";
import { parseCandlesCsv } from "@/lib/data/csv";
import { analyze, type Analysis } from "@/lib/engine/analyze";
import { sampleEvenly, scanSymbol, summarizeScan, type ScanRow, type ScanSummary } from "@/lib/engine/scan";
import { filterUniverse } from "@/lib/universe-lists";
import { DEFAULT_COSTS, DELIVERY_ZERO_BROKERAGE } from "@/lib/engine/costs";
import { PRESETS, getPreset } from "@/lib/engine/presets";
import { StrategyDef } from "@/lib/engine/strategy";
import { useUniverse } from "@/components/use-universe";
import { GroupPicker, type GroupCap } from "./group-picker";
import { ScanResults } from "./scan-results";
import { NumberField } from "./number-field";
import { RiskForm } from "./risk-form";
import { BacktestResults } from "./results";
import { RuleGroupEditor } from "./rule-group-editor";
import { SimpleSelect } from "./simple-select";

const YEARS = [1, 2, 3, 5, 8, 12].map((y) => ({ value: String(y), label: `${y} year${y > 1 ? "s" : ""}` }));
const PRESET_OPTIONS = [...PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: "custom", label: "Custom (edited)" }];

interface Output { analysis: Analysis; candles: Candle[]; label: string }
interface ScanOutput { summary: ScanSummary; rows: ScanRow[]; failed: { symbol: string; error: string }[]; label: string }

export function Workbench() {
  const [symbol, setSymbol] = useState("RELIANCE.NS");
  const [years, setYears] = useState("5");
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [strategy, setStrategy] = useState<StrategyDef>(PRESETS[0].strategy);
  const [slippageBps, setSlippageBps] = useState(DEFAULT_COSTS.slippageBps);
  const [zeroBrokerage, setZeroBrokerage] = useState(true);
  const [running, setRunning] = useState(false);
  const [out, setOut] = useState<Output | null>(null);
  const [csv, setCsv] = useState<{ name: string; candles: Candle[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // "Group of stocks" mode: run the same strategy over many stocks and pool the results.
  const [mode, setMode] = useState<"one" | "group">("one");
  const [cap, setCap] = useState<GroupCap>("large");
  const [sector, setSector] = useState("all");
  const [count, setCount] = useState("20");
  const [scanOut, setScanOut] = useState<ScanOutput | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const stopRef = useRef(false);
  const { stocks, sectors, loading: universeLoading } = useUniverse();
  const matching = useMemo(() => [...filterUniverse(stocks ?? [], { cap, sector })].sort((a, b) => a.name.localeCompare(b.name)), [stocks, cap, sector]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    const r = parseCandlesCsv(await file.text());
    r.warnings.forEach((w) => toast.warning(w));
    if (r.candles.length < 60) {
      toast.error("Need at least 60 valid daily candles");
      return;
    }
    setCsv({ name: file.name.replace(/\.[^.]+$/, ""), candles: r.candles });
    toast.success(`Loaded ${r.candles.length} candles from ${file.name}`);
  }

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

  async function runScan() {
    const parsed = StrategyDef.safeParse(strategy);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid strategy");
      return;
    }
    const picks = sampleEvenly(matching, Number(count));
    if (!picks.length) {
      toast.error("No stocks match this choice");
      return;
    }
    const costs = { ...DEFAULT_COSTS, ...(zeroBrokerage && parsed.data.product === "delivery" ? DELIVERY_ZERO_BROKERAGE : {}), slippageBps };
    stopRef.current = false;
    setRunning(true);
    const rows: ScanRow[] = [];
    const failed: { symbol: string; error: string }[] = [];
    try {
      for (let i = 0; i < picks.length && !stopRef.current; i++) {
        const st = picks[i];
        setProgress({ done: i, total: picks.length, current: st.symbol });
        try {
          const res = await fetch(`/api/candles?symbol=${encodeURIComponent(st.symbol)}&interval=1d&days=${Number(years) * 365}`);
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "no data");
          const candles: Candle[] = json.candles;
          if (candles.length < 150) throw new Error(`only ${candles.length} candles`);
          rows.push(scanSymbol({ symbol: st.symbol, name: st.name, sector: st.sector, cap: st.cap }, candles, parsed.data, costs));
        } catch (e) {
          failed.push({ symbol: st.symbol, error: (e as Error).message });
        }
        await new Promise((r) => setTimeout(r, 0)); // let the progress bar paint
      }
      if (!rows.length) throw new Error("None of the stocks could be tested. Check your connection and try again.");
      const scope = [cap === "all" ? "all sizes" : `${cap} cap`, sector === "all" ? "all sectors" : sector].join(", ");
      setScanOut({ summary: summarizeScan(rows), rows, failed, label: `${parsed.data.name}: ${rows.length} stocks (${scope})` });
      toast.success(stopRef.current ? `Stopped early: ${rows.length} stocks tested` : `${rows.length} stocks tested`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  async function run() {
    if (mode === "group") return runScan();
    const parsed = StrategyDef.safeParse(strategy);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid strategy");
      return;
    }
    setRunning(true);
    try {
      let candles: Candle[];
      if (csv) candles = csv.candles;
      else {
        const res = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&interval=1d&days=${Number(years) * 365}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load price history");
        candles = json.candles;
      }
      if (candles.length < 60) throw new Error(`Only ${candles.length} candles available for ${symbol}`);
      await new Promise((r) => setTimeout(r, 30)); // let the spinner paint before the CPU-heavy part
      const costs = {
        ...DEFAULT_COSTS,
        ...(zeroBrokerage && parsed.data.product === "delivery" ? DELIVERY_ZERO_BROKERAGE : {}),
        slippageBps,
      };
      const name = csv ? csv.name : symbol;
      const analysis = analyze(name, candles, parsed.data, costs);
      setOut({ analysis, candles, label: `${parsed.data.name} on ${name}` });
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
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="What to test">
          {([["one", "One stock"], ["group", "Group of stocks"]] as const).map(([m, label]) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} disabled={running} onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mode === m ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
        {mode === "group" ? (
          <Card>
            <CardHeader>
              <CardTitle>1 · Group &amp; history</CardTitle>
              <CardDescription>Test the strategy on many stocks at once. If it only works on one, it does not work.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <GroupPicker cap={cap} setCap={(c) => { setCap(c); setSector("all"); }} sector={sector} setSector={setSector} count={count} setCount={setCount}
                sectors={sectors ?? []} matching={matching} loading={universeLoading} />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">History</Label>
                <SimpleSelect className="w-full" value={years} options={YEARS} onChange={setYears} />
              </div>
            </CardContent>
          </Card>
        ) : (
        <Card>
          <CardHeader>
            <CardTitle>1 · Stock &amp; history</CardTitle>
            <CardDescription>Daily candles, adjusted for splits and dividends</CardDescription>
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
            <div className="rounded-lg border border-dashed p-3">
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
              {csv ? (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span>Using <b>{csv.name}.csv</b> · {csv.candles.length} candles</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Stop using CSV" onClick={() => setCsv(null)}><X /></Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">Longer history or a data source of your own? Upload daily OHLC as CSV.</p>
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload /> CSV</Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        )}

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

        <div className="sticky bottom-20 space-y-2 md:bottom-4">
          {running && mode === "group" && progress && (
            <div className="rounded-lg border bg-card p-3 text-xs shadow-lg" role="status">
              <div className="mb-1.5 flex justify-between"><span>Testing <b>{progress.current.replace(/\.NS$/, "")}</b></span><span className="font-mono">{progress.done}/{progress.total}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
            </div>
          )}
          <div className="flex gap-2">
            <Button size="lg" className="flex-1 shadow-lg" onClick={run} disabled={running}>
              {running ? <Loader2 className="animate-spin" /> : <Play />}
              {running ? (mode === "group" ? "Scanning…" : "Running backtest…") : mode === "group" ? `Scan ${Math.min(Number(count), matching.length || Number(count))} stocks` : "Run backtest"}
            </Button>
            {running && mode === "group" && <Button size="lg" variant="outline" onClick={() => { stopRef.current = true; }}>Stop</Button>}
          </div>
        </div>
      </div>

      <div className="min-w-0">
        {mode === "group" && scanOut ? (
          <ScanResults summary={scanOut.summary} rows={scanOut.rows} failed={scanOut.failed} label={scanOut.label} />
        ) : mode === "one" && out ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{out.label}</h2>
            <BacktestResults analysis={out.analysis} candles={out.candles} />
          </div>
        ) : (
          <Card className="grid min-h-96 place-items-center text-center">
            <CardContent className="max-w-sm space-y-2">
              <div className="text-lg font-semibold">{mode === "group" ? "Test it on a whole group" : "Test a strategy on real history"}</div>
              <p className="text-sm text-muted-foreground">
                {mode === "group"
                  ? "Choose a size class and sector, then scan. You will see the pooled win probability with a confidence range, how many stocks actually made money, whether it beat simply holding, and whether the edge survives in the later part of history."
                  : "Pick a stock and a preset, then run. You will see the win probability with a confidence range, whether your stop-loss helps, and how lucky or unlucky the result may be."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
