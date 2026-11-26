export type Product = "delivery" | "intraday";
export type Side = "buy" | "sell";

/**
 * Approximate Indian equity charges (typical discount broker). Rates change and
 * differ by broker, so every field is overridable. Verify against your broker's
 * brokerage calculator before trusting small-edge results.
 */
export interface CostConfig {
  brokeragePct: number; // fraction of turnover, per order
  brokerageCap: number; // max brokerage per order in INR (0 = no cap)
  sttDeliveryPct: number; // both sides
  sttIntradaySellPct: number; // sell side only
  exchangeTxnPct: number;
  sebiPct: number;
  stampDeliveryBuyPct: number;
  stampIntradayBuyPct: number;
  gstPct: number; // on brokerage + exchange + sebi
  dpChargePerSell: number; // delivery sell, per scrip (incl. GST)
  slippageBps: number; // applied to fill prices by the simulator
}

export const DEFAULT_COSTS: CostConfig = {
  brokeragePct: 0.0003,
  brokerageCap: 20,
  sttDeliveryPct: 0.001,
  sttIntradaySellPct: 0.00025,
  exchangeTxnPct: 0.0000297,
  sebiPct: 0.000001,
  stampDeliveryBuyPct: 0.00015,
  stampIntradayBuyPct: 0.00003,
  gstPct: 0.18,
  dpChargePerSell: 15.34,
  slippageBps: 5,
};

/** Delivery trades at many discount brokers carry zero brokerage. */
export const DELIVERY_ZERO_BROKERAGE: Partial<CostConfig> = { brokeragePct: 0, brokerageCap: 0 };

export interface ChargeBreakdown {
  brokerage: number;
  stt: number;
  exchange: number;
  sebi: number;
  stamp: number;
  gst: number;
  dp: number;
  total: number;
}

export function chargesForLeg(
  side: Side,
  turnover: number,
  product: Product,
  cfg: CostConfig = DEFAULT_COSTS,
): ChargeBreakdown {
  let brokerage = turnover * cfg.brokeragePct;
  if (cfg.brokerageCap > 0) brokerage = Math.min(brokerage, cfg.brokerageCap);
  const stt =
    product === "delivery"
      ? turnover * cfg.sttDeliveryPct
      : side === "sell"
        ? turnover * cfg.sttIntradaySellPct
        : 0;
  const exchange = turnover * cfg.exchangeTxnPct;
  const sebi = turnover * cfg.sebiPct;
  const stamp =
    side === "buy" ? turnover * (product === "delivery" ? cfg.stampDeliveryBuyPct : cfg.stampIntradayBuyPct) : 0;
  const gst = (brokerage + exchange + sebi) * cfg.gstPct;
  const dp = product === "delivery" && side === "sell" ? cfg.dpChargePerSell : 0;
  const total = brokerage + stt + exchange + sebi + stamp + gst + dp;
  return { brokerage, stt, exchange, sebi, stamp, gst, dp, total };
}

/** Total charges for entering and exiting a position of `qty` shares. */
export function roundTripCharges(
  direction: "long" | "short",
  qty: number,
  entryPrice: number,
  exitPrice: number,
  product: Product,
  cfg: CostConfig = DEFAULT_COSTS,
): number {
  const entrySide: Side = direction === "long" ? "buy" : "sell";
  const exitSide: Side = direction === "long" ? "sell" : "buy";
  return (
    chargesForLeg(entrySide, qty * entryPrice, product, cfg).total +
    chargesForLeg(exitSide, qty * exitPrice, product, cfg).total
  );
}
