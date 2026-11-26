"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";
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

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <TrendingUp size={20} />
          </div>
          <CardTitle className="text-lg">Trading Buddy</CardTitle>
          <CardDescription>Paper trading &amp; strategy backtesting for NSE</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {msg && <p className="text-sm text-warn">{msg}</p>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
