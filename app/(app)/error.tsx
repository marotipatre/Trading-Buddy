"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <CardContent className="space-y-4 text-center">
        <AlertTriangle className="mx-auto size-8 text-warn" />
        <div>
          <h2 className="text-lg font-semibold">Something went wrong on this page</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your paper account is safe. It is saved separately from what is on screen. Try again, and if it keeps happening, reload the page.</p>
        </div>
        <div className="flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/dashboard" />}>Go to Explore</Button>
        </div>
      </CardContent>
    </Card>
  );
}
