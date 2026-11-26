import { PageHeader } from "@/components/ui/page-header";
import { MultibaggerView } from "@/components/multibagger/multibagger-view";

export const metadata = { title: "Multibagger — Trading Buddy" };

export default function MultibaggerPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Multibagger hunt" description="Small, micro and penny stocks, checked on the business and the chart." />
      <MultibaggerView />
    </div>
  );
}
