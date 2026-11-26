import { chargesForLeg, DEFAULT_COSTS, DELIVERY_ZERO_BROKERAGE, type CostConfig, type Product } from "@/lib/engine/costs";
import type { Bar, CloseReason, ClosedTrade, Direction, OrderRequest, PaperPosition, PaperState } from "./types";

export const INTRADAY_SQUAREOFF_MINUTES = 15 * 60 + 15; // 15:15 IST

export function newAccount(initialCapital = 1_000_000, costs: CostConfig = { ...DEFAULT_COSTS, ...DELIVERY_ZERO_BROKERAGE, slippageBps: 2 }): PaperState {
  return { version: 1, initialCapital, cash: initialCapital, nextId: 1, positions: [], orders: [], trades: [], costs };
}

export type Result = { state: PaperState; error?: string; filled?: boolean };

const sgn = (d: Direction) => (d === "long" ? 1 : -1);
const side = (d: Direction, leg: "entry" | "exit") => ((d === "long") === (leg === "entry") ? "buy" : "sell") as "buy" | "sell";
const slip = (price: number, against: "up" | "down", bps: number) => price * (1 + (against === "up" ? 1 : -1) * (bps / 1e4));

/** Total value of the account: cash plus every open position marked to `prices`. */
export function equity(state: PaperState, prices: Record<string, number>): number {
  return state.cash + state.positions.reduce((a, p) => {
    const px = prices[p.symbol] ?? p.entryPrice;
    return a + p.qty * p.entryPrice + sgn(p.direction) * (px - p.entryPrice) * p.qty;
  }, 0);
}

function open(state: PaperState, req: OrderRequest, direction: Direction, rawPrice: number, time: number, slippage: boolean): Result {
  const bps = slippage ? state.costs.slippageBps : 0;
  const fill = slip(rawPrice, direction === "long" ? "up" : "down", bps);
  const charges = chargesForLeg(side(direction, "entry"), req.qty * fill, req.product, state.costs).total;
  const cost = req.qty * fill + charges;
  if (cost > state.cash) return { state, error: `Insufficient funds: need ₹${Math.ceil(cost).toLocaleString("en-IN")}, have ₹${Math.floor(state.cash).toLocaleString("en-IN")}` };
  const sign = sgn(direction);
  if (req.stop !== undefined && sign * (fill - req.stop) <= 0) return { state, error: "Stop-loss must be on the losing side of the entry price" };
  if (req.target !== undefined && sign * (req.target - fill) <= 0) return { state, error: "Target must be on the winning side of the entry price" };

  const existing = state.positions.find((p) => p.symbol === req.symbol && p.direction === direction && p.product === req.product);
  const trailDist = req.trailing && req.stop !== undefined ? Math.abs(fill - req.stop) : undefined;
  let positions: PaperPosition[];
  let nextId = state.nextId;
  if (existing) {
    const qty = existing.qty + req.qty;
    const avg = (existing.entryPrice * existing.qty + fill * req.qty) / qty;
    positions = state.positions.map((p) =>
      p === existing
        ? { ...p, qty, entryPrice: avg, entryCharges: p.entryCharges + charges, stop: req.stop ?? p.stop, target: req.target ?? p.target, trailDist: trailDist ?? p.trailDist, best: sign === 1 ? Math.max(p.best, fill) : Math.min(p.best, fill) }
        : p,
    );
  } else {
    positions = [...state.positions, {
      id: nextId++, symbol: req.symbol, direction, product: req.product, qty: req.qty, entryPrice: fill, entryTime: time,
      entryCharges: charges, stop: req.stop, target: req.target, trailDist, best: fill, lastCheckedAt: time, note: req.note,
    }];
  }
  return { state: { ...state, cash: state.cash - cost, positions, nextId }, filled: true };
}

/** Close `qty` of a position at `rawPrice`. Returns the new state with the trade journalled. */
export function closePosition(state: PaperState, positionId: number, qty: number, rawPrice: number, time: number, reason: CloseReason, slippage = true): Result {
  const pos = state.positions.find((p) => p.id === positionId);
  if (!pos) return { state, error: "Position not found" };
  const q = Math.min(qty, pos.qty);
  const exit = slip(rawPrice, pos.direction === "long" ? "down" : "up", slippage ? state.costs.slippageBps : 0);
  const exitCharges = chargesForLeg(side(pos.direction, "exit"), q * exit, pos.product, state.costs).total;
  const entryShare = pos.entryCharges * (q / pos.qty);
  const gross = sgn(pos.direction) * (exit - pos.entryPrice) * q;
  const charges = entryShare + exitCharges;
  const net = gross - charges;
  const trade: ClosedTrade = {
    id: state.nextId, symbol: pos.symbol, direction: pos.direction, product: pos.product, qty: q, entryPrice: pos.entryPrice, exitPrice: exit,
    entryTime: pos.entryTime, exitTime: time, grossPnl: gross, charges, netPnl: net, returnPct: (net / (q * pos.entryPrice)) * 100, reason, note: pos.note,
  };
  const remaining = pos.qty - q;
  const positions = remaining > 0
    ? state.positions.map((p) => (p.id === pos.id ? { ...p, qty: remaining, entryCharges: p.entryCharges - entryShare } : p))
    : state.positions.filter((p) => p.id !== pos.id);
  return {
    state: { ...state, cash: state.cash + q * pos.entryPrice + gross - exitCharges, positions, trades: [...state.trades, trade], nextId: state.nextId + 1 },
    filled: true,
  };
}

export function validateRequest(state: PaperState, req: OrderRequest): string | undefined {
  if (!req.symbol) return "Choose a symbol";
  if (!Number.isInteger(req.qty) || req.qty < 1) return "Quantity must be a whole number of shares";
  if (req.type === "limit" && !(req.limitPrice && req.limitPrice > 0)) return "Enter a limit price";
  void state;
  return undefined;
}

/** Place an order at the current price `ltp`. Market orders fill now; limits fill if marketable, else rest. */
export function placeOrder(state: PaperState, req: OrderRequest, ltp: number, time: number): Result {
  const bad = validateRequest(state, req);
  if (bad) return { state, error: bad };
  if (!(ltp > 0)) return { state, error: "No live price available" };

  const marketable = req.type === "market" || (req.side === "buy" ? req.limitPrice! >= ltp : req.limitPrice! <= ltp);
  const closeDirection: Direction = req.side === "sell" ? "long" : "short";
  const held = state.positions.find((p) => p.symbol === req.symbol && p.direction === closeDirection && p.product === req.product);

  if (!marketable) {
    if (!held && req.side === "sell" && req.product === "delivery") return { state, error: "You do not hold this stock; delivery shorts are not allowed on NSE cash" };
    const order = { id: state.nextId, symbol: req.symbol, side: req.side, qty: req.qty, limitPrice: req.limitPrice!, product: req.product, stop: req.stop, target: req.target, trailing: req.trailing, createdAt: time, note: req.note };
    return { state: { ...state, orders: [...state.orders, order], nextId: state.nextId + 1 } };
  }
  // A marketable limit fills at the (better) current price; only market orders pay slippage.
  const fillPrice = ltp;
  const slippage = req.type === "market";

  if (held) {
    if (req.qty > held.qty) return { state, error: `You only hold ${held.qty} shares` };
    return closePosition(state, held.id, req.qty, fillPrice, time, "manual", slippage);
  }
  const direction: Direction = req.side === "buy" ? "long" : "short";
  if (direction === "short" && req.product !== "intraday") return { state, error: "You do not hold this stock; delivery shorts are not allowed on NSE cash (use intraday)" };
  return open(state, req, direction, fillPrice, time, slippage);
}

export function cancelOrder(state: PaperState, orderId: number): PaperState {
  return { ...state, orders: state.orders.filter((o) => o.id !== orderId) };
}

/** Does this bar trigger the position's stop or target? Stop wins ties; gaps fill at the open. */
export function evaluateBar(pos: PaperPosition, bar: Bar): { pos: PaperPosition; exit?: { price: number; reason: "stop" | "target" } } {
  const s = sgn(pos.direction);
  const adverse = s === 1 ? bar.low : bar.high;
  const favourable = s === 1 ? bar.high : bar.low;
  if (pos.stop !== undefined && s * (adverse - pos.stop) <= 0) {
    return { pos, exit: { price: s * (bar.open - pos.stop) <= 0 ? bar.open : pos.stop, reason: "stop" } };
  }
  if (pos.target !== undefined && s * (favourable - pos.target) >= 0) {
    return { pos, exit: { price: s * (bar.open - pos.target) >= 0 ? bar.open : pos.target, reason: "target" } };
  }
  let next = { ...pos, lastCheckedAt: Math.max(pos.lastCheckedAt, bar.time) };
  if (pos.trailDist !== undefined && pos.stop !== undefined) {
    const best = s === 1 ? Math.max(pos.best, bar.high) : Math.min(pos.best, bar.low);
    const candidate = best - s * pos.trailDist;
    next = { ...next, best, stop: s * (candidate - pos.stop) > 0 ? candidate : pos.stop };
  }
  return { pos: next };
}

function applyBars(state: PaperState, symbol: string, bars: Bar[]): PaperState {
  let st = state;
  for (const bar of bars) {
    // resting limit orders first (they were placed before this bar)
    for (const o of st.orders.filter((x) => x.symbol === symbol && x.createdAt < bar.time)) {
      const touched = o.side === "buy" ? bar.low <= o.limitPrice : bar.high >= o.limitPrice;
      if (!touched) continue;
      const px = o.side === "buy" ? Math.min(o.limitPrice, bar.open) : Math.max(o.limitPrice, bar.open);
      const req: OrderRequest = { symbol, side: o.side, qty: o.qty, type: "market", product: o.product, stop: o.stop, target: o.target, trailing: o.trailing, note: o.note };
      const held = st.positions.find((p) => p.symbol === symbol && p.direction === (o.side === "sell" ? "long" : "short") && p.product === o.product);
      const r = held ? closePosition(st, held.id, Math.min(o.qty, held.qty), px, bar.time, "manual", false) : open(st, req, o.side === "buy" ? "long" : "short", px, bar.time, false);
      st = { ...r.state, orders: r.state.orders.filter((x) => x.id !== o.id) };
    }
    for (const p of st.positions.filter((x) => x.symbol === symbol && bar.time > x.lastCheckedAt)) {
      const { pos, exit } = evaluateBar(p, bar);
      if (exit) st = closePosition(st, p.id, p.qty, exit.price, bar.time, exit.reason).state;
      else st = { ...st, positions: st.positions.map((x) => (x.id === p.id ? pos : x)) };
    }
  }
  return st;
}

/** Feed a live tick: fills resting limits and fires stops/targets. */
export function onPrice(state: PaperState, symbol: string, price: number, time: number): PaperState {
  return applyBars(state, symbol, [{ time, open: price, high: price, low: price, close: price }]);
}

/** Replay candles that formed while the app was closed so stops/targets still count. */
export function catchUp(state: PaperState, symbol: string, bars: Bar[]): PaperState {
  return applyBars(state, symbol, [...bars].sort((a, b) => a.time - b.time));
}

/** Close all intraday positions and cancel intraday resting orders at the given prices. */
export function squareOffIntraday(state: PaperState, prices: Record<string, number>, time: number): PaperState {
  let st: PaperState = { ...state, orders: state.orders.filter((o) => o.product !== "intraday") };
  for (const p of st.positions.filter((x) => x.product === "intraday")) {
    const px = prices[p.symbol];
    if (px) st = closePosition(st, p.id, p.qty, px, time, "squareoff").state;
  }
  return st;
}

export function isSquareOffTime(minutesIst: number): boolean {
  return minutesIst >= INTRADAY_SQUAREOFF_MINUTES;
}

export type { Product };

const IST_OFFSET_SEC = 5.5 * 3600;

/** Unix seconds of 00:00 IST for the day containing `sec`. */
export function istStartOfDay(sec: number): number {
  return Math.floor((sec + IST_OFFSET_SEC) / 86400) * 86400 - IST_OFFSET_SEC;
}

/** Minutes since midnight IST. */
export function istMinutes(sec: number): number {
  return Math.floor((((sec + IST_OFFSET_SEC) % 86400) + 86400) % 86400 / 60);
}

/**
 * True when intraday (MIS) positions or orders must be closed: it is past 15:15 IST, or they were
 * opened on an earlier IST day (e.g. the app was closed overnight).
 */
export function intradayDue(state: PaperState, nowSec: number): boolean {
  const today = istStartOfDay(nowSec);
  const stale = state.positions.some((p) => p.product === "intraday" && p.entryTime < today)
    || state.orders.some((o) => o.product === "intraday" && o.createdAt < today);
  const hasIntraday = state.positions.some((p) => p.product === "intraday") || state.orders.some((o) => o.product === "intraday");
  return stale || (hasIntraday && isSquareOffTime(istMinutes(nowSec)));
}
