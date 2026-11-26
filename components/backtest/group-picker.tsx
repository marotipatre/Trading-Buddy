"use client";

import { Label } from "@/components/ui/label";
import { CAP_LABEL, type Cap, type UniverseStock } from "@/lib/universe-lists";
import { SimpleSelect } from "./simple-select";

export type GroupCap = Cap | "all";
const COUNTS = [5, 10, 20, 30, 50].map((n) => ({ value: String(n), label: `${n} stocks` }));

export function GroupPicker({ cap, setCap, sector, setSector, count, setCount, sectors, matching, loading }: {
  cap: GroupCap; setCap: (c: GroupCap) => void;
  sector: string; setSector: (s: string) => void;
  count: string; setCount: (c: string) => void;
  sectors: { name: string; count: number }[];
  matching: UniverseStock[];
  loading: boolean;
}) {
  const n = Math.min(Number(count), matching.length);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Size class</Label>
          <SimpleSelect className="w-full" value={cap} onChange={setCap}
            options={[{ value: "all", label: "All sizes" }, ...(["large", "mid", "small", "micro"] as Cap[]).map((c) => ({ value: c, label: CAP_LABEL[c] }))]} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Sector</Label>
          <SimpleSelect className="w-full" value={sector} onChange={setSector}
            options={[{ value: "all", label: "All sectors" }, ...sectors.map((s) => ({ value: s.name, label: `${s.name} (${s.count})` }))]} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs text-muted-foreground">How many stocks to test</Label>
          <SimpleSelect className="w-full" value={count} onChange={setCount} options={COUNTS} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {loading ? "Loading stock lists…" : matching.length === 0 ? "No stocks match this choice." : `${matching.length} stocks match; ${n} spread evenly through the list will be tested. More stocks give a more trustworthy answer but take longer (about 1 second each).`}
      </p>
    </div>
  );
}
