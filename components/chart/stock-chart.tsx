"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Activity, CandlestickChart, LineChart, X, MousePointer2, Minus, Ruler, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangePill } from "@/components/change-pill";
import { usePaper } from "@/components/paper/paper-provider";
import { moveOver, snapToBar } from "@/lib/chart-ranges";
import { TIMEFRAMES } from "@/lib/chart-timeframes";
import { fmtDate } from "@/lib/format";
import { orderLabel } from "@/lib/paper/broker";
import { cn } from "@/lib/utils";
import { loadDrawings, saveDrawings, type Drawing } from "@/lib/drawings";
import type { Tool } from "./drawing-layer";
import { PriceChart, type ChartLine, type ChartMarker, type Hover, type ScaleMode } from "./price-chart";
import { useChartData } from "./use-chart-data";
import { computeIndicators, loadSpecs, PRESETS, saveSpecs, specId, specLabel, INDICATOR_LABEL, type IndicatorKind, type IndicatorSpec } from "@/lib/chart-indicators";

const compact = (n: number) => (n >= 1e7 ? `${(n / 1e7).toFixed(2)}Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(2)}L` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n)));

/** Price chart with timeframes. Your open positions, stop-loss, take-profit and pending orders are drawn as price lines, and past trades as markers. */
export function StockChart({ symbol }: { symbol: string }) {
  const [tfId, setTfId] = useState("1d");
  const [mode, setMode] = useState<"candles" | "line">("candles");
  const [hover, setHover] = useState<Hover | null>(null);
  const [scale, setScale] = useState<ScaleMode>("price");
  const [tool, setTool] = useState<Tool>("cursor");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loadedFor, setLoadedFor] = useState("");
  const [specs, setSpecs] = useState<IndicatorSpec[]>([]);
  const [menu, setMenu] = useState(false);
  const [custom, setCustom] = useState<{ kind: IndicatorKind; period: number }>({ kind: "ema", period: 21 });
  // eslint-disable-next-line react-hooks/set-state-in-effect -- indicators are remembered in this browser
  useEffect(() => { setSpecs(loadSpecs()); }, []);
  const toggleSpec = (sp: IndicatorSpec) => {
    const next = specs.some((x) => x.id === sp.id) ? specs.filter((x) => x.id !== sp.id) : [...specs, sp].slice(0, 10);
    setSpecs(next);
    saveSpecs(next);
  };
  // Drawings are remembered per stock, in this browser.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load this stock's saved drawings after mount
    setDrawings(loadDrawings(symbol));
    setLoadedFor(symbol);
    setTool("cursor");
  }, [symbol]);
  const updateDrawings = (d: Drawing[]) => { setDrawings(d); if (loadedFor === symbol) saveDrawings(symbol, d); };
  const { resolvedTheme } = useTheme();
  const { state } = usePaper();
  const { candles, loading, error, timeframe } = useChartData(symbol, tfId);
  const intraday = timeframe.intraday;
  const indicatorLines = useMemo(() => computeIndicators(candles, specs), [candles, specs]);

  const lines = useMemo<ChartLine[]>(() => {
    const out: ChartLine[] = [];
    for (const p of state.positions.filter((x) => x.symbol === symbol)) {
      out.push({ price: p.entryPrice, label: `Avg ${p.entryPrice.toFixed(2)} · ${p.qty}`, tone: "primary" });
      if (p.stop) out.push({ price: p.stop, label: `Stop-loss ${p.stop.toFixed(2)}`, tone: "down", dashed: true });
      if (p.target) out.push({ price: p.target, label: `Take-profit ${p.target.toFixed(2)}`, tone: "up", dashed: true });
    }
    for (const o of state.orders.filter((x) => x.symbol === symbol)) {
      const held = state.positions.some((p) => p.symbol === symbol && p.direction === (o.side === "sell" ? "long" : "short"));
      out.push({ price: o.limitPrice, label: `${orderLabel(o.kind, held || (o.side === "sell" && o.product === "delivery"))} ${o.limitPrice.toFixed(2)}`, tone: "muted", dashed: true });
    }
    return out;
  }, [state.positions, state.orders, symbol]);

  const markers = useMemo<ChartMarker[]>(() => {
    const times = candles.map((c) => c.time);
    const out: ChartMarker[] = [];
    for (const t of state.trades.filter((x) => x.symbol === symbol)) {
      const long = t.direction === "long";
      const entry = snapToBar(times, t.entryTime);
      const exit = snapToBar(times, t.exitTime);
      if (entry !== null) out.push({ time: entry, position: long ? "belowBar" : "aboveBar", shape: long ? "arrowUp" : "arrowDown", tone: "primary", text: `${long ? "Buy" : "Sell"} ${t.qty}` });
      if (exit !== null) out.push({ time: exit, position: long ? "aboveBar" : "belowBar", shape: long ? "arrowDown" : "arrowUp", tone: t.netPnl >= 0 ? "up" : "down", text: `${t.netPnl >= 0 ? "+" : "−"}₹${Math.abs(Math.round(t.netPnl)).toLocaleString("en-IN")}` });
    }
    return out;
  }, [state.trades, symbol, candles]);

  const move = moveOver(candles);
  const last = candles.at(-1);
  const shown: Hover | null = hover ?? (last ? { time: last.time, open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume } : null);

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1" role="tablist" aria-label="Candle size">
            {TIMEFRAMES.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={t.id === tfId} onClick={() => setTfId(t.id)}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", t.id === tfId ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {move && <ChangePill pct={move.changePct} amount={move.change} />}
            <div className="flex gap-0.5" role="group" aria-label="Price scale">
              {([["price", "Price"], ["percent", "%"], ["log", "Log"]] as const).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={scale === id} onClick={() => setScale(id)} title={id === "percent" ? "Show percentage change from the first visible candle" : id === "log" ? "Logarithmic price scale" : "Actual prices"}
                  className={cn("rounded-md px-2 py-1 text-xs font-medium transition-colors", scale === id ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>{label}</button>
              ))}
            </div>
            <div className="flex gap-0.5">
              <Button variant={mode === "candles" ? "secondary" : "ghost"} size="icon-sm" aria-label="Candlestick chart" onClick={() => setMode("candles")}><CandlestickChart /></Button>
              <Button variant={mode === "line" ? "secondary" : "ghost"} size="icon-sm" aria-label="Line chart" onClick={() => setMode("line")}><LineChart /></Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Drawing tools">
          {([["cursor", MousePointer2, "Cursor"], ["hline", Minus, "Horizontal line"], ["trend", TrendingUp, "Trendline"], ["measure", Ruler, "Measure % change"]] as const).map(([id, Icon, label]) => (
            <Button key={id} size="sm" variant={tool === id ? "secondary" : "ghost"} aria-pressed={tool === id} title={label} onClick={() => setTool(id)}>
              <Icon /> <span className="hidden sm:inline">{label}</span>
            </Button>
          ))}
          <div className="relative">
            <Button size="sm" variant={menu ? "secondary" : "ghost"} aria-expanded={menu} onClick={() => setMenu((m) => !m)}><Activity /> <span className="hidden sm:inline">Indicators</span></Button>
            {menu && (
              <div className="absolute left-0 top-9 z-40 w-72 space-y-3 rounded-lg border bg-popover p-3 shadow-xl">
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((sp) => {
                    const on = specs.some((x) => x.id === sp.id);
                    return <button key={sp.id} type="button" aria-pressed={on} onClick={() => toggleSpec(sp)}
                      className={cn("rounded-md border px-2 py-1 text-xs", on ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:text-foreground")}>{specLabel(sp)}</button>;
                  })}
                </div>
                <div className="flex items-center gap-1.5 border-t pt-2.5">
                  <select value={custom.kind} onChange={(e) => setCustom({ ...custom, kind: e.target.value as IndicatorKind })} className="h-8 rounded-md border bg-background px-1.5 text-xs">
                    {(["ema", "sma", "rsi"] as const).map((k) => <option key={k} value={k}>{INDICATOR_LABEL[k]}</option>)}
                  </select>
                  <input type="number" min={2} max={500} value={custom.period} onChange={(e) => setCustom({ ...custom, period: Math.round(Number(e.target.value)) })} className="h-8 w-16 rounded-md border bg-background px-2 text-xs" aria-label="Length" />
                  <Button size="sm" variant="outline" disabled={!(custom.period >= 2 && custom.period <= 500)} onClick={() => { const id = specId(custom.kind, custom.period); if (!specs.some((x) => x.id === id)) toggleSpec({ id, kind: custom.kind, period: custom.period }); }}>Add</Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Indicators are calculated on the candles you see, so they change with the timeframe.</p>
              </div>
            )}
          </div>
          {drawings.length > 0 && (
            <Button size="sm" variant="ghost" className="text-muted-foreground" title="Remove all drawings on this stock" onClick={() => updateDrawings([])}><Trash2 /> Clear ({drawings.length})</Button>
          )}
        </div>

        <div className="tabular flex min-h-5 flex-wrap items-center gap-x-4 gap-y-0.5 font-mono text-xs text-muted-foreground">
          {shown ? (
            <>
              <span>{intraday ? new Date((shown.time + (hover ? 19800 : 0)) * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: hover ? "UTC" : "Asia/Kolkata" }) : fmtDate(shown.time)}</span>
              <span>O <b className="text-foreground">{shown.open.toFixed(2)}</b></span>
              <span>H <b className="text-foreground">{shown.high.toFixed(2)}</b></span>
              <span>L <b className="text-foreground">{shown.low.toFixed(2)}</b></span>
              <span>C <b className="text-foreground">{shown.close.toFixed(2)}</b></span>
              {shown.volume ? <span>Vol <b className="text-foreground">{compact(shown.volume)}</b></span> : null}
            </>
          ) : null}
        </div>

        {specs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-xs" aria-label="Active indicators">
            {indicatorLines.filter((l) => !/ (upper|lower)$/.test(l.label)).map((l) => (
              <span key={l.label} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono">
                <span className="size-2 rounded-full" style={{ background: l.color }} />{l.label.replace(/ mid$/, "")}
                <b className="text-foreground">{l.points.at(-1)?.value.toFixed(2) ?? "—"}</b>
              </span>
            ))}
            {specs.map((sp) => <button key={sp.id} type="button" aria-label={`Remove ${specLabel(sp)}`} title={`Remove ${specLabel(sp)}`} onClick={() => toggleSpec(sp)} className="inline-flex items-center rounded-md px-1 text-muted-foreground hover:text-foreground"><X className="size-3" />{sp.kind === "bb" ? "BB" : sp.kind.toUpperCase()}{sp.period}</button>)}
          </div>
        )}
        <div className="relative">
          {error && candles.length === 0 ? (
            <div className="grid h-[360px] place-items-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground sm:h-[420px]">
              <div className="space-y-2"><p>{error}</p><Button size="sm" variant="outline" onClick={() => setTfId((x) => x)}>Try again</Button></div>
            </div>
          ) : (
            <>
              <PriceChart candles={candles} intraday={intraday} mode={mode} dark={resolvedTheme !== "light"} lines={lines} markers={markers}
                resetKey={`${symbol}|${tfId}`} onHover={setHover}
                scale={scale} tool={tool} onToolChange={setTool} drawings={drawings} onDrawingsChange={updateDrawings} overlays={indicatorLines} />
              {loading && candles.length === 0 && <Skeleton className="absolute inset-0" />}
              {!loading && candles.length === 0 && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">No price data for this period.</div>}
            </>
          )}
        </div>
        {(lines.length > 0 || markers.length > 0) && (
          <p className="text-xs text-muted-foreground">Lines show your average price, stop-loss, take-profit and pending orders for this stock. Arrows mark your past trades.</p>
        )}
      </CardContent>
    </Card>
  );
}
