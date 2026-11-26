import { IdeasView } from "@/components/ideas/ideas-view";

export const metadata = { title: "Ideas — Trading Buddy" };

export default function IdeasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Ideas</h1>
        <p className="text-sm text-muted-foreground">Which sectors have momentum, which stocks are set up for a 1–3 week swing, and where to enter, stop and take profit</p>
      </div>
      <IdeasView />
    </div>
  );
}
