"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/data/types";

export function PriceChart({ candles, intraday }: { candles: Candle[]; intraday: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#121722" }, textColor: "#8b95a7" },
      grid: { vertLines: { color: "#1a2130" }, horzLines: { color: "#1a2130" } },
      timeScale: { timeVisible: intraday, borderColor: "#1f2837" },
      rightPriceScale: { borderColor: "#1f2837" },
    });
    const price = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      borderVisible: false,
    });
    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "vol" });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    price.setData(
      candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })),
    );
    vol.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "#22c55e55" : "#ef444455",
      })),
    );
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [candles, intraday]);

  return <div ref={ref} className="h-[520px] w-full overflow-hidden rounded-xl border border-line" />;
}
