import { IdeasView } from "@/components/ideas/ideas-view";

export const metadata = { title: "Ideas — Trading Buddy" };

export default function IdeasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Ideas</h1>
        <p className="text-sm text-muted-foreground">Scan the index or market you choose: the strongest sectors, the best setups, and exactly where to enter, stop and take profit</p>
      </div>
      <IdeasView />
    </div>
  );
}
