import type { PaperState, Pot, Transfer } from "./types";

export const MAX_AMOUNT = 1_000_000_000; // ₹100 crore; stops typo-sized numbers

export type FundsResult = { state: PaperState; error?: string };

/** Bank balance, defaulting to 0 for accounts saved before pots existed. */
export const bankOf = (s: Pick<PaperState, "bank">) => s.bank ?? 0;
/** Net money allocated to trading; falls back to the initial capital for older accounts. */
export const capitalOf = (s: Pick<PaperState, "tradingCapital" | "initialCapital">) => s.tradingCapital ?? s.initialCapital;

const round2 = (x: number) => Math.round(x * 100) / 100;

export function validateAmount(amount: number): string | undefined {
  if (!Number.isFinite(amount) || amount <= 0) return "Enter an amount greater than zero";
  if (amount > MAX_AMOUNT) return "That amount is too large";
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return "Use at most 2 decimal places";
  return undefined;
}

/** Fill in fields that older saved accounts lack. Safe to call repeatedly. */
export function normalizeState(s: PaperState): PaperState {
  return { ...s, bank: s.bank ?? 0, tradingCapital: s.tradingCapital ?? s.initialCapital, transfers: s.transfers ?? [] };
}

function log(s: PaperState, t: Omit<Transfer, "id">): PaperState {
  const transfers = [...(s.transfers ?? []), { ...t, id: s.nextId }];
  return { ...s, transfers: transfers.length > 500 ? transfers.slice(-500) : transfers, nextId: s.nextId + 1 };
}

/** Add new (virtual) money to a pot. */
export function addMoney(state: PaperState, pot: Pot, amount: number, time: number): FundsResult {
  const bad = validateAmount(amount);
  if (bad) return { state, error: bad };
  const a = round2(amount);
  const base = normalizeState(state);
  const next = pot === "trading"
    ? { ...base, cash: round2(base.cash + a), tradingCapital: round2(capitalOf(base) + a) }
    : { ...base, bank: round2(bankOf(base) + a) };
  return { state: log(next, { time, type: "deposit", pot, amount: a }) };
}

/** Take money out of a pot (out of the app entirely). Only free cash can leave the trading pot. */
export function withdrawMoney(state: PaperState, pot: Pot, amount: number, time: number): FundsResult {
  const bad = validateAmount(amount);
  if (bad) return { state, error: bad };
  const a = round2(amount);
  const base = normalizeState(state);
  const available = pot === "trading" ? base.cash : bankOf(base);
  if (a > available + 1e-9) {
    return { state, error: pot === "trading" ? `Only ₹${Math.floor(base.cash).toLocaleString("en-IN")} of the trading pot is free cash; close positions to free more` : `Bank balance is ₹${Math.floor(bankOf(base)).toLocaleString("en-IN")}` };
  }
  const next = pot === "trading"
    ? { ...base, cash: round2(base.cash - a), tradingCapital: round2(capitalOf(base) - a) }
    : { ...base, bank: round2(bankOf(base) - a) };
  return { state: log(next, { time, type: "withdraw", pot, amount: a }) };
}

/** Move money between pots. Moving into trading raises your trading capital; moving out lowers it. */
export function transferMoney(state: PaperState, from: Pot, amount: number, time: number): FundsResult {
  const bad = validateAmount(amount);
  if (bad) return { state, error: bad };
  const a = round2(amount);
  const base = normalizeState(state);
  if (from === "bank") {
    if (a > bankOf(base) + 1e-9) return { state, error: `Bank balance is ₹${Math.floor(bankOf(base)).toLocaleString("en-IN")}` };
    const next = { ...base, bank: round2(bankOf(base) - a), cash: round2(base.cash + a), tradingCapital: round2(capitalOf(base) + a) };
    return { state: log(next, { time, type: "to_trading", pot: "bank", amount: a }) };
  }
  if (a > base.cash + 1e-9) return { state, error: `Only ₹${Math.floor(base.cash).toLocaleString("en-IN")} of the trading pot is free cash; close positions to free more` };
  const next = { ...base, cash: round2(base.cash - a), bank: round2(bankOf(base) + a), tradingCapital: round2(capitalOf(base) - a) };
  return { state: log(next, { time, type: "to_bank", pot: "trading", amount: a }) };
}

/** Profit or loss on the money you allocated to trading: account value minus net capital put in. */
export function tradingPnl(state: PaperState, equity: number): { pnl: number; pct: number } {
  const cap = capitalOf(state);
  return { pnl: equity - cap, pct: cap > 0 ? ((equity - cap) / cap) * 100 : 0 };
}

export const TRANSFER_LABEL: Record<Transfer["type"], string> = {
  deposit: "Money added",
  withdraw: "Money withdrawn",
  to_trading: "Bank → Trading",
  to_bank: "Trading → Bank",
};
