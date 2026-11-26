"use client";

import { AlertTriangle, Info } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtNum, fmtPct } from "@/lib/format";
import { PARAM_LABEL, type GridPoint, type ParamKey, type Robust, type WalkForwardResult } from "@/lib/engine/optimize";
import { AXIS, GRID, TooltipBox } from "./chart-tooltip";
import { MetricCard } from "./metric-card";

export interface OptimizeOutput {
  label: string;
  param: ParamKey;
  stocks: number;
  inSample: GridPoint[];
  outSample: GridPoint[];
  robust: Robust;
  baselineOut: GridPoint;
  currentValue: number | null;
  walk: WalkForwardResult | null;
  warnings: string[];
}

const fmtVal = (p: ParamKey, v: number) => (p === "stopPct" || p === "targetPct" ? `${v}%` : p === "stopAtr" ? `${v}×ATR` : `${v} days`);

export function verdictFor(o: OptimizeOutput): { tone: "up" | "warn" | "down"; title: string; body: string } {
  const r = o.robust.robust;
  if (!r) return { tone: "warn", title: "Not enough trades to judge", body: "No setting produced enough trades on the earlier history. Use more years or a bigger group of stocks." };
  const inn = o.inSample.find((p) => p.value === r.value)!;
  const out = o.outSample.find((p) => p.value === r.value)!;
  const label = fmtVal(o.param, r.value);
  if (out.trades < 5) return { tone: "warn", title: `${label} looked best, but there are too few unseen trades`, body: `Only ${out.trades} trades in the later 30% of history, so it cannot be confirmed. Add more stocks or years.` };
  if (out.expectancyPct <= 0) return { tone: "down", title: `Overfit: ${label} made money on past data and lost on unseen data`, body: `Earlier history: ${fmtPct(inn.expectancyPct, 2, { sign: true })} per trade. Later history: ${fmtPct(out.expectancyPct, 2, { sign: true })}. Tuning found a pattern that did not last.` };
  const kept = out.expectancyPct / Math.max(inn.expectancyPct, 1e-9);
  const vsBase = Number.isFinite(o.baselineOut.expectancyPct) ? out.expectancyPct - o.baselineOut.expectancyPct : NaN;
  const base = Number.isFinite(vsBase) ? ` That is ${vsBase >= 0 ? "better" : "worse"} than your current setting${o.currentValue !== null ? ` (${fmtVal(o.param, o.currentValue)})` : ""} by ${fmtPct(Math.abs(vsBase), 2)} per trade on the same unseen period.` : "";
  return {
    tone: kept >= 0.5 && o.robust.plateau ? "up" : "warn",
    title: `${label} held up on unseen data${o.robust.plateau ? "" : ", but it is not on a stable plateau"}`,
    body: `Earlier history: ${fmtPct(inn.expectancyPct, 2, { sign: true })} per trade. Later history: ${fmtPct(out.expectancyPct, 2, { sign: true })} (${fmtPct(kept * 100, 0)} of it kept).${base}${o.robust.plateau ? " Nearby values also worked, which is what a real effect looks like." : " Neighbouring values did not behave similarly, so treat it with suspicion."}`,
  };
}

export function OptimizeResults({ o }: { o: OptimizeOutput }) {
  const v = verdictFor(o);
  const rows = o.inSample.map((p, i) => ({ label: fmtVal(o.param, p.value), value: p.value, inn: Number.isFinite(p.score) ? p.expectancyPct : null, out: o.outSample[i].trades >= 5 ? o.outSample[i].expectancyPct : null, innP: p, outP: o.outSample[i] }));
  const w = o.walk;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{o.label}</h2>
      {o.warnings.length > 0 && (
        <div className="space-y-1 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
          {o.warnings.map((x) => <p key={x} className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{x}</p>)}
        </div>
      )}

      <Card className={v.tone === "up" ? "border-up/40" : v.tone === "down" ? "border-down/40" : "border-warn/40"}>
        <CardHeader>
          <CardTitle>{v.title}</CardTitle>
          <CardDescription>{PARAM_LABEL[o.param]} · tuned on the earlier 70% of history, checked on the later 30% it had never seen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed">
          <p>{v.body}</p>
          {o.robust.peak && o.robust.robust && o.robust.peak.value !== o.robust.robust.value && (
            <p className="flex gap-2 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" />The single best value on past data was {fmtVal(o.param, o.robust.peak.value)}, but it sits next to weaker values, so the app recommends {fmtVal(o.param, o.robust.robust.value)} instead.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Recommended" value={o.robust.robust ? fmtVal(o.param, o.robust.robust.value) : "—"} sub={o.robust.plateau ? "on a stable plateau" : "no stable plateau"} tone={o.robust.plateau ? "up" : "warn"} />
        <MetricCard label="Stocks tested" value={String(o.stocks)} sub={`${o.inSample[0]?.trades ?? 0} trades at the first value`} />
        <MetricCard label="Your current setting" value={o.currentValue !== null ? fmtVal(o.param, o.currentValue) : "none"} sub={`unseen: ${fmtPct(o.baselineOut.expectancyPct, 2, { sign: true })} / trade`} />
        <MetricCard label="Settings tried" value={String(o.inSample.length)} sub="each on the same trades" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Past data versus unseen data</CardTitle>
          <CardDescription>Average result per trade at each value. A big gap between the two bars is overfitting.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full" role="img" aria-label="Expectancy per trade at each setting, on earlier and on unseen history">
            <ResponsiveContainer>
              <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="label" {...AXIS} tickLine={false} />
                <YAxis {...AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={(x: number) => `${x}%`} />
                <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
                <Tooltip cursor={{ fill: "color-mix(in oklch, var(--foreground) 6%, transparent)" }} content={({ active, payload }) => {
                  const r = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                  if (!active || !r) return null;
                  return <TooltipBox title={r.label} rows={[
                    { label: "Earlier (tuned on)", value: `${fmtPct(r.innP.expectancyPct, 2, { sign: true })} · ${r.innP.trades} trades`, color: "var(--series-1)" },
                    { label: "Later (unseen)", value: `${fmtPct(r.outP.expectancyPct, 2, { sign: true })} · ${r.outP.trades} trades`, color: "var(--series-2)" },
                  ]} />;
                }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
                <Bar name="Earlier 70% (tuned on)" dataKey="inn" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                <Bar name="Later 30% (unseen)" dataKey="out" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">{PARAM_LABEL[o.param]}</TableHead>
              <TableHead className="text-right">Trades</TableHead><TableHead className="text-right">Earlier avg</TableHead><TableHead className="text-right">Earlier PF</TableHead>
              <TableHead className="text-right">Unseen trades</TableHead><TableHead className="text-right">Unseen avg</TableHead><TableHead className="pr-4 text-right">Unseen PF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.value} className={r.value === o.robust.robust?.value ? "bg-primary/10" : undefined}>
                <TableCell className="pl-4 font-medium">{r.label}{r.value === o.robust.robust?.value && <Badge className="ml-2" variant="default">recommended</Badge>}{r.value === o.robust.peak?.value && r.value !== o.robust.robust?.value && <Badge className="ml-2" variant="outline">best on past data</Badge>}{r.value === o.currentValue && <Badge className="ml-2" variant="secondary">yours</Badge>}</TableCell>
                <TableCell className="text-right font-mono">{r.innP.trades}</TableCell>
                <TableCell className={`text-right font-mono ${r.innP.expectancyPct >= 0 ? "text-up" : "text-down"}`}>{fmtPct(r.innP.expectancyPct, 2, { sign: true })}</TableCell>
                <TableCell className="text-right font-mono">{fmtNum(r.innP.profitFactor)}</TableCell>
                <TableCell className="text-right font-mono">{r.outP.trades}</TableCell>
                <TableCell className={`text-right font-mono ${r.outP.expectancyPct >= 0 ? "text-up" : "text-down"}`}>{r.outP.trades ? fmtPct(r.outP.expectancyPct, 2, { sign: true }) : "—"}</TableCell>
                <TableCell className="pr-4 text-right font-mono">{fmtNum(r.outP.profitFactor)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {w && (
        <Card className="py-0">
          <CardHeader className="pt-4">
            <CardTitle>Walk-forward test</CardTitle>
            <CardDescription>Re-tune on 3 years, trade the next year, roll forward. Stitching the unseen years together is the honest result of tuning on the past.</CardDescription>
          </CardHeader>
          <div className="grid grid-cols-2 gap-3 px-4 pb-3 lg:grid-cols-4">
            <MetricCard label="Walk-forward result" value={fmtPct(w.oos.expectancyPct, 2, { sign: true })} sub={`${w.oos.trades} trades on unseen years`} tone={w.oos.expectancyPct > 0 ? "up" : "down"} />
            <MetricCard label="Your current setting" value={fmtPct(w.baseline.expectancyPct, 2, { sign: true })} sub="same unseen years" />
            <MetricCard label="Winning years" value={Number.isFinite(w.positiveShare) ? fmtPct(w.positiveShare * 100, 0) : "—"} sub={`${w.windows.length} windows`} tone={w.positiveShare >= 0.6 ? "up" : "warn"} />
            <MetricCard label="Efficiency" value={Number.isFinite(w.efficiency) ? fmtPct(w.efficiency * 100, 0) : "—"} sub="unseen ÷ tuned result" tone={w.efficiency >= 0.5 ? "up" : "warn"} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Window</TableHead><TableHead className="text-right">Chosen</TableHead>
                <TableHead className="text-right">Tuned score</TableHead><TableHead className="text-right">Unseen trades</TableHead>
                <TableHead className="text-right">Unseen avg</TableHead><TableHead className="pr-4 text-right">Your setting</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {w.windows.map((x) => (
                <TableRow key={x.index}>
                  <TableCell className="pl-4">#{x.index + 1}</TableCell>
                  <TableCell className="text-right font-mono">{x.chosen !== null ? fmtVal(o.param, x.chosen) : "—"}</TableCell>
                  <TableCell className="text-right font-mono">{Number.isFinite(x.trainScore) ? fmtPct(x.trainScore, 2, { sign: true }) : "—"}</TableCell>
                  <TableCell className="text-right font-mono">{x.testTrades}</TableCell>
                  <TableCell className={`text-right font-mono ${x.testExpectancyPct >= 0 ? "text-up" : "text-down"}`}>{x.testTrades ? fmtPct(x.testExpectancyPct, 2, { sign: true }) : "—"}</TableCell>
                  <TableCell className="pr-4 text-right font-mono text-muted-foreground">{Number.isFinite(x.baselineExpectancyPct) ? fmtPct(x.baselineExpectancyPct, 2, { sign: true }) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="px-4 py-3 text-xs text-muted-foreground">{w.distinctChoices} different value{w.distinctChoices === 1 ? " was" : "s were"} chosen across windows{w.distinctChoices > 2 ? ", which means the best setting keeps moving: a sign it is mostly noise" : ""}.</p>
        </Card>
      )}
    </div>
  );
}
