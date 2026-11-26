"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

/** Number input that lets you clear and retype; commits only valid numbers. */
export function NumberField({ value, onChange, min, max, step = 1, className }: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  const [text, setText] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    if (Number(text) !== value) setText(String(value));
  }
  return (
    <Input
      type="number"
      inputMode="decimal"
      className={className}
      value={text}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}
