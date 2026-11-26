import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid flex-1 place-items-center p-6 text-center">
      <div className="space-y-4">
        <div className="font-mono text-5xl font-semibold text-muted-foreground">404</div>
        <p className="text-lg font-medium">That page does not exist</p>
        <Button nativeButton={false} render={<Link href="/dashboard" />}>Back to Explore</Button>
      </div>
    </main>
  );
}
