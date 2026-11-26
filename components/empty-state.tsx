import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** A friendly "nothing here yet" panel that points to the next useful step. */
export function EmptyState({ icon: Icon, title, text, actions }: { icon: LucideIcon; title: string; text: string; actions?: { label: string; href: string; primary?: boolean }[] }) {
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-6" /></span>
        <div className="space-y-1"><p className="text-base font-semibold">{title}</p><p className="mx-auto max-w-md text-sm text-muted-foreground">{text}</p></div>
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {actions.map((a) => <Button key={a.href} size="sm" variant={a.primary ? "default" : "outline"} nativeButton={false} render={<Link href={a.href} />}>{a.label}</Button>)}
          </div>
        )}
      </div>
    </Card>
  );
}
