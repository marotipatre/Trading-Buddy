export type AlertDirection = "above" | "below";
export type AlertStatus = "active" | "triggered" | "cancelled";

export interface PriceAlert {
  id: string;
  symbol: string;
  direction: AlertDirection;
  price: number;
  note?: string;
  status: AlertStatus;
  createdAt: number;
  triggeredAt?: number;
  triggeredPrice?: number;
}

/** An alert must be on the far side of the current price, or it would fire immediately. */
export function validateAlert(direction: AlertDirection, price: number, ltp: number | undefined): string | undefined {
  if (!Number.isFinite(price) || price <= 0) return "Enter a price greater than zero";
  if (ltp && direction === "above" && price <= ltp) return `An "above" alert must be higher than the current price (${ltp.toFixed(2)})`;
  if (ltp && direction === "below" && price >= ltp) return `A "below" alert must be lower than the current price (${ltp.toFixed(2)})`;
  return undefined;
}

/** Which active alerts have been hit by these prices. "Above" fires at or over the price, "below" at or under it. */
export function evaluateAlerts(alerts: PriceAlert[], prices: Record<string, number>): { alert: PriceAlert; price: number }[] {
  const hits: { alert: PriceAlert; price: number }[] = [];
  for (const a of alerts) {
    if (a.status !== "active") continue;
    const p = prices[a.symbol];
    if (typeof p !== "number" || !Number.isFinite(p)) continue;
    if ((a.direction === "above" && p >= a.price) || (a.direction === "below" && p <= a.price)) hits.push({ alert: a, price: p });
  }
  return hits;
}

export const activeSymbols = (alerts: PriceAlert[]) => [...new Set(alerts.filter((a) => a.status === "active").map((a) => a.symbol))];

export function describeAlert(a: Pick<PriceAlert, "direction" | "price">): string {
  return `${a.direction === "above" ? "rises to" : "falls to"} ${a.price.toFixed(2)}`;
}

/** How far the price still has to move, as a percentage of the current price (positive = still to go). */
export function distanceToAlert(a: Pick<PriceAlert, "direction" | "price">, ltp: number): number {
  return ltp ? (a.direction === "above" ? (a.price - ltp) / ltp : (ltp - a.price) / ltp) * 100 : NaN;
}

/** Parse a stored row defensively. */
export function parseAlert(row: Record<string, unknown>): PriceAlert | null {
  const dir = row.direction, status = row.status;
  if (typeof row.id !== "string" || typeof row.symbol !== "string" || (dir !== "above" && dir !== "below")) return null;
  if (typeof row.price !== "number" || !(row.price > 0)) return null;
  if (status !== "active" && status !== "triggered" && status !== "cancelled") return null;
  const sec = (v: unknown) => (typeof v === "string" ? Date.parse(v) / 1000 : undefined);
  return {
    id: row.id, symbol: row.symbol, direction: dir, price: row.price, status, note: typeof row.note === "string" ? row.note : undefined,
    createdAt: sec(row.created_at) ?? 0, triggeredAt: sec(row.triggered_at), triggeredPrice: typeof row.triggered_price === "number" ? row.triggered_price : undefined,
  };
}
