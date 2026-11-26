"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { defaultIndicator } from "@/lib/engine/indicator-meta";
import type { Condition, ConditionGroup } from "@/lib/engine/strategy";
import { OperandEditor } from "./operand-editor";
import { SimpleSelect } from "./simple-select";

const OPS = [
  { value: ">", label: "is above" },
  { value: "<", label: "is below" },
  { value: ">=", label: "is at or above" },
  { value: "<=", label: "is at or below" },
  { value: "crosses_above", label: "crosses above" },
  { value: "crosses_below", label: "crosses below" },
] as const;

const newCondition = (): Condition => ({
  left: { kind: "price", field: "close", shift: 0 },
  op: "crosses_above",
  right: defaultIndicator("sma"),
});

export function RuleGroupEditor({ value, onChange, optional, onRemove }: {
  value: ConditionGroup;
  onChange: (g: ConditionGroup) => void;
  /** When set, the group can be removed entirely (e.g. the optional exit rule). */
  optional?: boolean;
  onRemove?: () => void;
}) {
  const setCond = (i: number, c: Condition) => onChange({ ...value, conditions: value.conditions.map((x, j) => (j === i ? c : x)) });
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        Trigger when
        <SimpleSelect size="sm" className="w-28" value={value.logic}
          options={[{ value: "all", label: "ALL of" }, { value: "any", label: "ANY of" }]}
          onChange={(logic) => onChange({ ...value, logic })} />
        these hold at the close of a bar
        {optional && onRemove && (
          <Button variant="ghost" size="xs" className="ml-auto" onClick={onRemove}>Remove exit rule</Button>
        )}
      </div>
      {value.conditions.map((c, i) => (
        <div key={i} className="space-y-1.5 rounded-lg border bg-background/40 p-2.5">
          <OperandEditor value={c.left} onChange={(left) => setCond(i, { ...c, left })} />
          <div className="flex items-center gap-2">
            <SimpleSelect size="sm" className="w-40" value={c.op} options={[...OPS]} onChange={(op) => setCond(i, { ...c, op })} />
            {value.conditions.length > 1 && (
              <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Remove condition"
                onClick={() => onChange({ ...value, conditions: value.conditions.filter((_, j) => j !== i) })}>
                <Trash2 />
              </Button>
            )}
          </div>
          <OperandEditor value={c.right} onChange={(right) => setCond(i, { ...c, right })} />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange({ ...value, conditions: [...value.conditions, newCondition()] })}>
        <Plus /> Add condition
      </Button>
    </div>
  );
}
