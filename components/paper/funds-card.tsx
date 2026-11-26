"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowRightLeft, Landmark, LineChart, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NumberField } from "@/components/backtest/number-field";
import { SimpleSelect } from "@/components/backtest/simple-select";
import { fmtDate, fmtInr } from "@/lib/format";
import { bankOf, capitalOf, TRANSFER_LABEL } from "@/lib/paper/funds";
import type { Pot } from "@/lib/paper/types";
import { usePaper } from "./paper-provider";

type Mode = "add" | "move" | "withdraw";
const QUICK = [5_000, 10_000, 50_000, 100_000, 500_000];

export function FundsCard() {
  const { state, equity, addMoney, withdraw, transfer } = usePaper();
  const [mode, setMode] = useState<Mode>("add");
  const [pot, setPot] = useState<Pot>("trading");
  const [amount, setAmount] = useState(50_000);
  const bank = bankOf(state);
  const invested = Math.max(0, equity - state.cash);
  const history = [...(state.transfers ?? [])].reverse().slice(0, 8);

  function submit() {
    const r =
      mode === "add" ? addMoney(pot, amount) :
      mode === "withdraw" ? withdraw(pot, amount) :
      transfer(pot, amount); // in "move" mode `pot` is the SOURCE pot
    if (r.error) toast.error(r.error);
    else toast.success(mode === "add" ? `Added ${fmtInr(amount)} to your ${pot} pot` : mode === "withdraw" ? `Withdrew ${fmtInr(amount)}` : `Moved ${fmtInr(amount)} ${pot === "bank" ? "to Trading" : "to Bank"}`);
  }

  const modes: { id: Mode; label: string; icon: typeof Plus }[] = [
    { id: "add", label: "Add money", icon: Plus },
    { id: "move", label: "Move", icon: ArrowRightLeft },
    { id: "withdraw", label: "Withdraw", icon: ArrowDownToLine },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><LineChart className="size-4" /> Trading balance</div>
            <div className="font-mono text-3xl font-semibold tracking-tight">{fmtInr(equity)}</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><div className="text-muted-foreground">Available to trade</div><div className="font-mono text-sm">{fmtInr(state.cash)}</div></div>
              <div><div className="text-muted-foreground">Invested</div><div className="font-mono text-sm">{fmtInr(invested)}</div></div>
            </div>
            <div className="text-xs text-muted-foreground">Capital put in: <span className="font-mono text-foreground">{fmtInr(capitalOf(state))}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Landmark className="size-4" /> Bank balance</div>
            <div className="font-mono text-3xl font-semibold tracking-tight">{fmtInr(bank)}</div>
            <p className="text-xs text-muted-foreground">Set aside, never traded. Move money to your trading balance when you want to use it.</p>
            <div className="text-xs text-muted-foreground">Total net worth: <span className="font-mono text-foreground">{fmtInr(equity + bank)}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manage funds</CardTitle>
          <CardDescription>This is virtual money. Adding to your trading balance is not counted as profit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {modes.map((m) => (
              <Button key={m.id} size="sm" variant={mode === m.id ? "default" : "outline"} onClick={() => { setMode(m.id); if (m.id === "move") setPot("bank"); }}>
                <m.icon /> {m.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[220px_1fr] sm:items-end">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{mode === "add" ? "Add to" : mode === "move" ? "Move from" : "Withdraw from"}</div>
              <SimpleSelect className="w-full" value={pot} onChange={setPot}
                options={mode === "move"
                  ? [{ value: "bank", label: "Bank → Trading" }, { value: "trading", label: "Trading → Bank" }]
                  : [{ value: "trading", label: "Trading balance" }, { value: "bank", label: "Bank balance" }]} />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Amount (₹)</div>
              <NumberField min={1} step={1000} value={amount} onChange={setAmount} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <Button key={q} size="xs" variant="outline" onClick={() => setAmount(q)}>{fmtInr(q)}</Button>
            ))}
            <Button size="xs" variant="ghost" onClick={() => setAmount(Math.floor(pot === "bank" ? bank : state.cash))}>Max available</Button>
          </div>
          <Button onClick={submit}>{mode === "add" ? "Add money" : mode === "move" ? "Move money" : "Withdraw"}</Button>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card className="py-0">
          <CardHeader className="pt-4"><CardTitle className="text-sm">Money history</CardTitle></CardHeader>
          <Table>
            <TableHeader>
              <TableRow><TableHead className="pl-4">Date</TableHead><TableHead>Type</TableHead><TableHead className="pr-4 text-right">Amount</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {history.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="pl-4 text-xs">{fmtDate(t.time)}</TableCell>
                  <TableCell>{TRANSFER_LABEL[t.type]}{t.type === "deposit" || t.type === "withdraw" ? <span className="text-muted-foreground"> · {t.pot}</span> : null}</TableCell>
                  <TableCell className={`pr-4 text-right font-mono ${t.type === "deposit" ? "text-up" : t.type === "withdraw" ? "text-down" : ""}`}>
                    {t.type === "deposit" ? "+" : t.type === "withdraw" ? "-" : ""}{fmtInr(t.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
