import type { Candle } from "@/lib/data/types";
import type { Consensus } from "@/lib/data/news";
import { horizonStats, type HorizonStats } from "./horizon";
import { applyTarget, withOverlay, type StockView } from "./stock-view";
import { bullBear, type BullBear } from "./bullbear";
import type { Regime } from "./regime";
import { verdictOf } from "./stock-view";
import type { Features } from "./features";

export interface BaseIdea {
  symbol: string;
  name: string;
  sector: string;
  cap: "large" | "mid" | "small" | "micro";
  /** Scored on price alone, with relative strength folded in. No target applied yet, so the plan can change without a rescan. */
  view: StockView;
  patterns: { name: string; bias: "bullish" | "bearish" | "neutral" }[];
  /** Facts for the quick screens (near high, volume surge, breakout, pullback). */
  feat?: Features | null;
  overlay?: { mood: number; moodSource: "ai" | "words"; moodCount: number; summary: Consensus };
}

export interface Idea extends BaseIdea {
  /** The view with news and broker overlay and your target applied. */
  v: StockView;
  hz?: HorizonStats;
  bb: BullBear;
  conviction: "high" | "medium" | "low";
}

export interface Plan { days: number; target: number }
export type SectorQuadrant = "leading" | "improving" | "weakening" | "lagging";
/** Points a sector tailwind or headwind adds to a stock's score: the standard top-down idea that sector and stock should agree. */
const TAILWIND: Record<SectorQuadrant, number> = { leading: 6, improving: 3, weakening: -3, lagging: -7 };

export function withSectorView(v: StockView, quadrant: SectorQuadrant, label: string): StockView {
  const points = TAILWIND[quadrant];
  const score = Math.max(0, Math.min(100, v.score + points));
  const text = quadrant === "leading" ? `Sector tailwind: ${label} is a leading sector` : quadrant === "improving" ? `Sector tailwind: ${label} is improving against the market` : quadrant === "weakening" ? `Sector headwind: ${label} is losing momentum` : `Sector headwind: ${label} is lagging the market`;
  return { ...v, score, technical: v.technical, reasons: [...v.reasons, { text, points }], verdict: verdictOf(score, v.plan) };
}

const RANK = { buy: 0, watch: 1, avoid: 2 } as const;
/** Best first: buy setups, then watch, then avoid; within a group by past results over your holding period, then by score. */
export const byEdge = (a: Idea, b: Idea) => RANK[a.v.verdict] - RANK[b.v.verdict] || (b.hz?.expectancyPct ?? -99) - (a.hz?.expectancyPct ?? -99) || b.v.score - a.v.score;

export function conviction(bb: BullBear, v: StockView, hz?: HorizonStats): Idea["conviction"] {
  if (v.verdict !== "buy") return "low";
  const odds = hz ? hz.hitRate >= 0.3 && hz.expectancyPct > 0 : false;
  if (bb.balance >= 5 && odds && v.score >= 75) return "high";
  if (bb.balance >= 2 && (odds || v.score >= 70)) return "medium";
  return "low";
}

/** Turn the scan's base results and your plan (days and target) into ranked ideas. Cheap enough to redo on every change. */
export function deriveIdeas(bases: BaseIdea[], plan: Plan, candlesOf: (symbol: string) => Candle[] | undefined, regime?: Regime, asOf?: number, sectorView?: Record<string, { quadrant: SectorQuadrant; label: string }>): Idea[] {
  const out: Idea[] = bases.map((b) => {
    const withNews = b.overlay ? withOverlay(b.view, { score: b.overlay.mood, count: b.overlay.moodCount }, b.overlay.summary) : b.view;
    const sv = sectorView?.[b.sector];
    const withSector = sv ? withSectorView(withNews, sv.quadrant, sv.label) : withNews;
    const v = applyTarget(withSector, plan.target);
    const c = v.plan ? candlesOf(b.symbol) : undefined;
    const hz = c && v.plan ? horizonStats(c, plan.days, plan.target, v.plan.riskPct) ?? undefined : undefined;
    const bb = bullBear({ view: v, hz, patterns: b.patterns, regime, days: plan.days, target: plan.target, asOf, news: b.overlay ? { mood: b.overlay.mood, moodSource: b.overlay.moodSource, brokersBuy: b.overlay.summary.buy, brokersSell: b.overlay.summary.sell, brokers: b.overlay.summary.brokers } : undefined });
    return { ...b, v, hz, bb, conviction: conviction(bb, v, hz) };
  });
  return out.sort(byEdge);
}
