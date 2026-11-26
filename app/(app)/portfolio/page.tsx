import { PortfolioView } from "@/components/paper/portfolio-view";

export const metadata = { title: "Portfolio — Trading Buddy" };

export default function PortfolioPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Portfolio</h1>
        <p className="text-sm text-muted-foreground">Your paper-trading account, positions and trade journal</p>
      </div>
      <PortfolioView />
    </div>
  );
}
