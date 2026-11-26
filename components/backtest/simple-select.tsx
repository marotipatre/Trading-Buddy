"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface Option<T extends string> { value: T; label: string }

/** Thin wrapper so call sites pass plain {value,label} options. */
export function SimpleSelect<T extends string>({ value, onChange, options, className, size = "default" }: {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  className?: string;
  size?: "sm" | "default";
}) {
  return (
    <Select value={value} items={options} onValueChange={(v) => v && onChange(v as T)}>
      <SelectTrigger size={size} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
