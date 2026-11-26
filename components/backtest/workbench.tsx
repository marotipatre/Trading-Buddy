"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { evalStrategy, GRIDS, PARAM_LABEL, pickRobust, sweepParam, walkForward, type Objective, type ParamKey, type Series } from "@/lib/engine/optimize";
import { filterUniverse } from "@/lib/universe-lists";
import { DEFAULT_COSTS, DELIVERY_ZERO_BROKERAGE } from "@/lib/engine/costs";
import { PRESETS, getPreset } from "@/lib/engine/presets";
import { StrategyDef } from "@/lib/engine/strategy";
import { useUniverse } from "@/components/use-universe";
import { GroupPicker, type GroupCap } from "./group-picker";
import { ScanResults } from "./scan-results";
import { fmtVal, OptimizeResults, type OptimizeOutput } from "./optimize-results";
import { SaveRunBar } from "./save-run-bar";
import { SavedRuns } from "./saved-runs";
import { useSavedRuns } from "./use-saved-runs";
import { summaryFromAnalysis, summaryFromOptimize, summaryFromScan, type SavedConfig, type Summary } from "@/lib/saved-backtests";
import { NumberField } from "./number-field";
import { RiskForm } from "./risk-form";
import { BacktestResults } from "./results";
import { RuleGroupEditor } from "./rule-group-editor";
import { SimpleSelect } from "./simple-select";
import { aggregateWeekly } from "@/lib/chart-timeframes";
import { BacktestChart } from "./backtest-chart";
import { displaySymbol } from "@/lib/symbols";
import { EmaBuilderForm } from "./ema-builder-form";
import { buildEmaStrategy, DEFAULT_EMA_SPEC, type EmaSpec } from "@/lib/engine/ema-builder";

const YEARS = [1, 2, 3, 5, 8, 12].map((y) => ({ value: String(y), label: `${y} year${y > 1 ? "s" : ""}` }));
const PRESET_OPTIONS = [...PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: "custom", label: "Custom (edited)" }];

interface Output { analysis: Analysis; candles: Candle[]; label: string; strategy: StrategyDef }
interface ScanOutput { summary: ScanSummary; rows: ScanRow[]; failed: { symbol: string; error: string }[]; label: string }

export function Workbench() {
  const [symbol, setSymbol] = useState("RELIANCE.NS");
  const [years, setYears] = useState("5");
  const [frame, setFrame] = useState<"daily" | "weekly">("daily");
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [strategy, setStrategy] = useState<StrategyDef>(() => buildEmaStrategy(DEFAULT_EMA_SPEC));
  const [builder, setBuilder] = useState<"simple" | "advanced">("simple");
  const [emaSpec, setEmaSpec] = useState<EmaSpec>(DEFAULT_EMA_SPEC);
  const [slippageBps, setSlippageBps] = useState(DEFAULT_COSTS.slippageBps);
  const [zeroBrokerage, setZeroBrokerage] = useState(true);
  const [preview, setPreview] = useState<{ key: string; candles: Candle[] } | null>(null);
  const [running, setRunning] = useState(false);
  const [out, setOut] = useState<Output | null>(null);
  const [csv, setCsv] = useState<{ name: string; candles: Candle[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // "Group of stocks" mode: run the same strategy over many stocks and pool the results.
  const [mode, setMode] = useState<"one" | "group" | "optimize">("one");
  const [optScope, setOptScope] = useState<"one" | "group">("one");
  const [optParam, setOptParam] = useState<ParamKey>("stopPct");
  const [optObjective, setOptObjective] = useState<Objective>("expectancy");
  const [optOut, setOptOut] = useState<OptimizeOutput | null>(null);
  const saved = useSavedRuns();
  const showGroup = mode === "group" || (mode === "optimize" && optScope === "group");
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

  // A chart of the chosen stock with the strategy's averages, before you run anything.
  const previewKey = `${symbol}|${years}|${frame}`;
  useEffect(() => {
    if (mode !== "one" || csv) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&interval=1d&days=${Number(years) * 365}&fast=1`, { signal: ctl.signal });
        const j = await res.json();
        if (res.ok) setPreview({ key: previewKey, candles: frame === "weekly" ? aggregateWeekly(j.candles) : j.candles });
      } catch { /* the preview is optional */ }
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [mode, csv, symbol, years, frame, previewKey]);

  const edit = (s: StrategyDef) => {
    setStrategy(s);
    setPresetId("custom");
  };

  function editSpec(s: EmaSpec) {
    setEmaSpec(s);
    setStrategy((cur) => ({ ...buildEmaStrategy(s), sizing: cur.sizing, product: cur.product, direction: cur.direction, initialCapital: cur.initialCapital }));
  }
  function chooseBuilder(b: "simple" | "advanced") {
    setBuilder(b);
    if (b === "simple") setStrategy((cur) => ({ ...buildEmaStrategy(emaSpec), sizing: cur.sizing, product: cur.product, direction: cur.direction, initialCapital: cur.initialCapital }));
  }

  function pickPreset(id: string) {
    const p = getPreset(id);
    if (!p) return;
    setPresetId(id);
    setStrategy(p.strategy);
  }

  function currentConfig(): SavedConfig | null {
    const parsed = StrategyDef.safeParse(strategy);
    if (!parsed.success) return null;
    return {
      mode, symbol: mode === "group" || (mode === "optimize" && optScope === "group") ? undefined : symbol, years: Number(years), strategy: parsed.data,
      slippageBps, zeroBrokerage, group: { cap, sector, count: Number(count) }, optimize: { scope: optScope, param: optParam, objective: optObjective },
    };
  }

  function loadConfig(c: SavedConfig) {
    setMode(c.mode);
    if (c.symbol) setSymbol(c.symbol);
    setYears(String(c.years));
    setStrategy(c.strategy);
    setPresetId("custom");
    setSlippageBps(c.slippageBps);
    setZeroBrokerage(c.zeroBrokerage);
    if (c.group) { setCap(c.group.cap); setSector(c.group.sector); setCount(String(c.group.count)); }
    if (c.optimize) { setOptScope(c.optimize.scope); setOptParam(c.optimize.param); setOptObjective(c.optimize.objective); }
    toast.success("Settings loaded. Press the run button to test again on fresh data.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const hasResult = (mode === "one" && !!out) || (mode === "group" && !!scanOut) || (mode === "optimize" && !!optOut);
  const resultLabel = mode === "optimize" ? optOut?.label : mode === "group" ? scanOut?.label : out?.label;

  async function saveCurrent(name: string): Promise<{ error?: string }> {
    const cfg = currentConfig();
    if (!cfg) return { error: "The strategy is not valid yet" };
    let summary: Summary;
    if (mode === "one" && out) summary = summaryFromAnalysis(out.analysis, out.label);
    else if (mode === "group" && scanOut) summary = summaryFromScan(scanOut.summary, scanOut.label);
    else if (mode === "optimize" && optOut) {
      const r = optOut.robust.robust;
      const unseen = r ? optOut.outSample.find((p) => p.value === r.value) : undefined;
      summary = summaryFromOptimize(optOut.label, r ? fmtVal(optOut.param, r.value) : null, unseen && unseen.trades ? unseen.expectancyPct : null, unseen?.trades ?? 0, optOut.stocks);
    } else return { error: "Run a test first" };
    return saved.save(name, cfg, summary);
  }

  async function loadSeries(symbols: { symbol: string }[], strat: StrategyDef): Promise<{ series: Series[]; failed: number }> {
    void strat;
    const series: Series[] = [];
    let failed = 0;
    for (let i = 0; i < symbols.length && !stopRef.current; i++) {
      setProgress({ done: i, total: symbols.length, current: symbols[i].symbol });
      try {
        const res = await fetch(`/api/candles?symbol=${encodeURIComponent(symbols[i].symbol)}&interval=1d&days=${Number(years) * 365}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "no data");
        if ((json.candles as Candle[]).length < 300) throw new Error("too little history");
        series.push({ symbol: symbols[i].symbol, candles: json.candles });
      } catch {
        failed++;
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    return { series, failed };
  }

  async function runOptimize() {
    const parsed = StrategyDef.safeParse(strategy);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid strategy"); return; }
    const group = optScope === "group";
    const picks = group ? sampleEvenly(matching, Number(count)) : [{ symbol }];
    if (!picks.length) { toast.error("No stocks match this choice"); return; }
    const strat = parsed.data;
    const costs = { ...DEFAULT_COSTS, ...(zeroBrokerage && strat.product === "delivery" ? DELIVERY_ZERO_BROKERAGE : {}), slippageBps };
    stopRef.current = false;
    setRunning(true);
    try {
      const { series, failed } = await loadSeries(picks, strat);
      if (!series.length) throw new Error("No price history could be loaded. Check your connection and try again.");
      setProgress(null);
      await new Promise((r) => setTimeout(r, 30));
      const values = GRIDS[optParam];
      const minTrades = group ? 15 : 8;
      const inSample = sweepParam(series, strat, optParam, values, costs, { objective: optObjective, minTrades, slice: [0, 0.7] });
      const outSample = sweepParam(series, strat, optParam, values, costs, { objective: optObjective, minTrades: 1, slice: [0.7, 1] });
      const robust = pickRobust(inSample);
      const baselineOut = evalStrategy(series, strat, costs, { objective: optObjective, minTrades: 1, slice: [0.7, 1] });
      const bars = series[0].candles.length;
      const walk = !group && bars >= 1250 ? walkForward(series[0].candles, strat, optParam, values, costs, { train: 750, test: 250, step: 250, objective: optObjective, minTrades: 6, symbol: series[0].symbol }) : null;
      const current = optParam === "stopPct" ? (strat.stopLoss?.type === "percent" ? strat.stopLoss.value : null)
        : optParam === "stopAtr" ? (strat.stopLoss?.type === "atr" ? strat.stopLoss.value : null)
        : optParam === "maxHold" ? strat.maxHoldBars ?? null : (strat.target?.type === "percent" ? strat.target.value : null);
      const warnings: string[] = [];
      if (!group) warnings.push("One stock is a small sample. Run it on a group of stocks before trusting a result.");
      if (failed) warnings.push(`${failed} stock${failed > 1 ? "s" : ""} could not be loaded and were skipped.`);
      if (!group && !walk) warnings.push("Walk-forward needs at least 5 years of history; pick a longer period.");
      setOptOut({
        label: `${strat.name}: ${PARAM_LABEL[optParam]} on ${group ? `${series.length} stocks` : symbol}`,
        param: optParam, stocks: series.length, inSample, outSample, robust, baselineOut, currentValue: current, walk, warnings,
      });
      toast.success("Optimization finished");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
      setProgress(null);
    }
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
    if (mode === "optimize") return runOptimize();
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
      if (frame === "weekly") candles = aggregateWeekly(candles);
      if (candles.length < 60) throw new Error(`Only ${candles.length} ${frame} candles available for ${symbol}. Pick a longer history${frame === "weekly" ? " (3+ years)" : ""}.`);
      await new Promise((r) => setTimeout(r, 30)); // let the spinner paint before the CPU-heavy part
      const costs = {
        ...DEFAULT_COSTS,
        ...(zeroBrokerage && parsed.data.product === "delivery" ? DELIVERY_ZERO_BROKERAGE : {}),
        slippageBps,
      };
      const name = (csv ? csv.name : symbol) + (frame === "weekly" ? " (weekly)" : "");
      const analysis = analyze(name, candles, parsed.data, costs);
      setOut({ analysis, candles, label: `${parsed.data.name} on ${name}`, strategy: parsed.data });
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
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="What to do">
          {([["one", "One stock"], ["group", "Group"], ["optimize", "Optimize"]] as const).map(([m, label]) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} disabled={running} onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mode === m ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
        {showGroup ? (
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
        ) : mode === "optimize" ? (
          <Card>
            <CardHeader><CardTitle>1 · History</CardTitle><CardDescription>Optimizing needs plenty of history: 8 to 12 years is best.</CardDescription></CardHeader>
            <CardContent><SimpleSelect className="w-full" value={years} options={YEARS} onChange={setYears} /></CardContent>
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
                <div className="font-mono text-lg font-semibold">{displaySymbol(symbol)}</div>
                <div className="text-xs text-muted-foreground">selected</div>
              </div>
              <SymbolSearch onPick={(h) => setSymbol(h.symbol)} placeholder="Change symbol…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">History</Label>
              <SimpleSelect className="w-full" value={years} options={YEARS} onChange={setYears} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Candle size the strategy trades on</Label>
              <SimpleSelect className="w-full" value={frame} onChange={setFrame} options={[{ value: "daily", label: "Daily candles (swing, days to weeks)" }, { value: "weekly", label: "Weekly candles (slower, weeks to months)" }]} />
              {frame === "weekly" && <p className="text-xs text-muted-foreground">Signals, EMAs and the hold limit now count in weeks. Use 5+ years so there are enough trades.</p>}
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

        {mode === "optimize" && (
          <Card>
            <CardHeader>
              <CardTitle>What to optimize</CardTitle>
              <CardDescription>Tries each value on the earlier 70% of history, then checks the winner on the later 30% it has never seen.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Test on</Label>
                  <SimpleSelect className="w-full" value={optScope} onChange={setOptScope} options={[{ value: "one", label: "One stock (+ walk-forward)" }, { value: "group", label: "A group (recommended)" }]} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Setting</Label>
                  <SimpleSelect className="w-full" value={optParam} onChange={setOptParam} options={(Object.keys(GRIDS) as ParamKey[]).map((k) => ({ value: k, label: PARAM_LABEL[k] }))} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs text-muted-foreground">Goal</Label>
                  <SimpleSelect className="w-full" value={optObjective} onChange={setOptObjective} options={[{ value: "expectancy", label: "Best average result per trade" }, { value: "profitFactor", label: "Best profit factor" }]} />
                </div>
              </div>
              {optScope === "one" && <div className="space-y-1"><Label className="text-xs text-muted-foreground">Stock</Label><div className="flex items-center justify-between gap-3"><span className="font-mono text-lg font-semibold">{symbol}</span><SymbolSearch onPick={(h) => setSymbol(h.symbol)} placeholder="Change stock…" className="w-56" /></div></div>}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>2 · Strategy</CardTitle>
            <CardDescription>Pick the simple moving-average builder, or use ready-made presets and your own rules</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Strategy style">
              {([["simple", "Simple (EMA)"], ["advanced", "Presets & rules"]] as const).map(([b, label]) => (
                <button key={b} type="button" role="tab" aria-selected={builder === b} onClick={() => chooseBuilder(b)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${builder === b ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
              ))}
            </div>
            {builder === "simple" ? (
              <EmaBuilderForm spec={emaSpec} onChange={editSpec} />
            ) : (<>
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
            </>)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3 · Position size &amp; costs</CardTitle>
            <CardDescription>Stops, targets, sizing and Indian transaction charges</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {builder === "advanced" ? <RiskForm strategy={strategy} onChange={edit} /> : <RiskForm strategy={strategy} onChange={edit} sizingOnly />}
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
          {running && progress && (
            <div className="rounded-lg border bg-card p-3 text-xs shadow-lg" role="status">
              <div className="mb-1.5 flex justify-between"><span>Testing <b>{progress.current.replace(/\.NS$/, "")}</b></span><span className="font-mono">{progress.done}/{progress.total}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
            </div>
          )}
          <div className="flex gap-2">
            <Button size="lg" className="flex-1 shadow-lg" onClick={run} disabled={running}>
              {running ? <Loader2 className="animate-spin" /> : <Play />}
              {running ? (mode === "one" ? "Running backtest…" : mode === "group" ? "Scanning…" : "Optimizing…") : mode === "group" ? `Scan ${Math.min(Number(count), matching.length || Number(count))} stocks` : mode === "optimize" ? "Find the best setting" : "Run backtest"}
            </Button>
            {running && mode !== "one" && <Button size="lg" variant="outline" onClick={() => { stopRef.current = true; }}>Stop</Button>}
          </div>
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        {hasResult && <SaveRunBar defaultName={resultLabel ?? "My backtest"} onSave={saveCurrent} />}
        {mode === "optimize" && optOut ? (
          <OptimizeResults o={optOut} />
        ) : mode === "group" && scanOut ? (
          <ScanResults summary={scanOut.summary} rows={scanOut.rows} failed={scanOut.failed} label={scanOut.label} />
        ) : mode === "one" && out ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{out.label}</h2>
            <BacktestResults analysis={out.analysis} candles={out.candles} strategy={out.strategy} />
          </div>
        ) : mode === "one" && preview?.key === previewKey && !csv ? (
          <div className="space-y-3">
            <BacktestChart candles={preview.candles} trades={[]} strategy={strategy} />
            <p className="text-center text-sm text-muted-foreground">This is the chart your strategy will run on, with its averages. Press <b>Run backtest</b> to see every buy and exit marked on it.</p>
          </div>
        ) : (
          <Card className="grid min-h-96 place-items-center text-center">
            <CardContent className="max-w-sm space-y-2">
              <div className="text-lg font-semibold">{mode === "optimize" ? "Find settings that hold up" : mode === "group" ? "Test it on a whole group" : "Test a strategy on real history"}</div>
              <p className="text-sm text-muted-foreground">
                {mode === "optimize"
                  ? "Pick a setting such as the stop-loss distance. The app tries many values on past data, recommends one that works across a range of values, and shows how it did on data it never saw. A big gap means overfitting."
                  : mode === "group"
                  ? "Choose a size class and sector, then scan. You will see the pooled win probability with a confidence range, how many stocks actually made money, whether it beat simply holding, and whether the edge survives in the later part of history."
                  : "Pick a stock and a preset, then run. You will see the win probability with a confidence range, whether your stop-loss helps, and how lucky or unlucky the result may be."}
              </p>
            </CardContent>
          </Card>
        )}
        <SavedRuns runs={saved.runs} ready={saved.ready} localOnly={saved.localOnly} onLoad={loadConfig} onRemove={saved.remove} />
      </div>
    </div>
  );
}
