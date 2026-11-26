import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** What well-known systematic approaches have actually delivered, so a monthly goal can be set against real numbers. */
export function RealityCheck() {
  const monthly = (pct: number) => (Math.pow(1 + pct / 100, 12) - 1) * 100;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reality check: what a monthly target means</CardTitle>
        <CardDescription>Open-source and published methods are built into the Method list above. Here is what they have achieved, so you can judge your 10% a month goal.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <b>Momentum investing in India.</b> The NSE&apos;s Nifty200 Momentum 30 index (the 30 strongest-trending stocks, rebuilt twice a year) has returned roughly 19–20% a year since 2005 against about 15% for the broad Nifty 200, per{" "}
            <a className="underline" href="https://freefincal.com/nifty200-momentum-30-index-a-new-strategy-index-from-the-nse/" target="_blank" rel="noreferrer noopener">freefincal&apos;s summary</a> of NSE material. That is about 1.5% a month on average, with bad stretches: it can lag the market for months (it fell 1.6% in July 2026 while the Nifty 50 rose 1.1%, per{" "}
            <a className="underline" href="https://www.wrightresearch.in/blog/how-did-the-nifty200-momentum-30-perform-in-july-2026/" target="_blank" rel="noreferrer noopener">Wright Research</a>).
          </li>
          <li>
            <b>Minervini trend template.</b> A rule set for stocks in a strong uptrend near their highs (price above rising 150/200-day averages, 25% above the 52-week low, within 25% of the high). The criteria are published and used by many traders; see the{" "}
            <a className="underline" href="https://www.chartmill.com/documentation/stock-screener/technical-analysis-trading-strategies/496-Mark-Minervini-Trend-Template-A-Step-by-Step-Guide-for-Beginners" target="_blank" rel="noreferrer noopener">ChartMill guide</a>. It picks candidates; the results still depend on entries, stops and the market.
          </li>
          <li><b>The arithmetic of 10% a month.</b> Compounded it is {monthly(10).toFixed(0)}% a year, more than triple your money every year. Even an excellent systematic approach averages low single-digit percent per month, with losing months. A realistic goal for swing trading is a positive expectancy per trade with controlled losses, not a fixed monthly number.</li>
        </ul>
        <p className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">What improves your odds is risk control: small, fixed risk per trade (this page sizes each trade to 1% of capital by default), cutting losers at the stop, a mix of sectors, and checking a method on many stocks over many years on the Backtest page before trusting it.</p>
      </CardContent>
    </Card>
  );
}
