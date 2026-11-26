import { MultibaggerView } from "@/components/multibagger/multibagger-view";

export const metadata = { title: "Multibagger — Trading Buddy" };

export default function MultibaggerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Multibagger hunt</h1>
        <p className="text-sm text-muted-foreground">Every listed small, micro and penny stock, checked on both the business and the chart</p>
      </div>
      <MultibaggerView />
    </div>
  );
}
