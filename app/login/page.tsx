"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { data, error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) return setMsg(error.message);
    if (mode === "up" && !data.session) {
      return setMsg("Account created. Confirm via the email Supabase sent, then sign in.");
    }
    router.replace("/dashboard");
    router.refresh();
  }

  const features = [
    ["Paper trade with live prices", "Practise on NSE stocks with virtual money, stop-losses and targets, and a separate 5x intraday pot."],
    ["Test ideas on real history", "Backtest strategies, see the win rate with its confidence range, and check whether your stop-loss really helps."],
    ["Daily ideas with the odds", "Sector strength, entries, stops and targets, and how often a similar move actually happened for each stock."],
    ["A rule book from the pros", "Swing and intraday rules, checklists and calculators to protect you from the usual psychological mistakes."],
  ];
  return (
    <main className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden flex-col justify-center gap-8 bg-primary/[0.06] p-12 lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground"><TrendingUp size={22} /></span>
          <span className="text-2xl font-semibold tracking-tight">Trading Buddy</span>
        </div>
        <div className="space-y-2">
          <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">Learn to trade the Indian market without risking a rupee.</h1>
          <p className="max-w-md text-muted-foreground">Free, private and built for learning. Make your mistakes on paper money first.</p>
        </div>
        <ul className="max-w-md space-y-4">
          {features.map(([t, d]) => (
            <li key={t} className="flex gap-3"><span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"><Check className="size-3" /></span><span><b className="block text-sm">{t}</b><span className="text-sm text-muted-foreground">{d}</span></span></li>
          ))}
        </ul>
        <p className="max-w-md text-xs text-muted-foreground">For education only. Nothing here is investment advice, and no real orders are ever placed.</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <div className="mb-2 grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground lg:hidden"><TrendingUp size={20} /></div>
            <CardTitle className="text-lg">{mode === "in" ? "Welcome back" : "Create your account"}</CardTitle>
            <CardDescription>{mode === "in" ? "Sign in to continue to Trading Buddy" : "It takes a minute. Your paper account is private to you."}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={show ? "text" : "password"} required minLength={6} autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                  <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                </div>
                {mode === "up" && <p className="text-xs text-muted-foreground">At least 6 characters.</p>}
              </div>
              {msg && <p role="alert" className="text-sm text-warn">{msg}</p>}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
              </Button>
              <Button type="button" variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }}>
                {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
