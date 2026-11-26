const IST = 19800;
const istDay = (sec: number) => Math.floor((sec + IST) / 86400);

/**
 * Previous session's close from a series of daily bars.
 * Yahoo's `chartPreviousClose` is the close BEFORE THE CHART RANGE STARTS, which is not the previous
 * session (for Nifty it was several days stale). The reliable number is the daily bar before today's.
 * If the last bar is today's session, the previous close is the bar before it; otherwise the last bar IS
 * the previous session (e.g. before the open, or on a holiday).
 */
export function prevCloseFromDaily(timestamps: number[], closes: (number | null)[], marketTimeSec: number): number | undefined {
  const bars: { day: number; close: number }[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (typeof c === "number" && Number.isFinite(c) && c > 0) bars.push({ day: istDay(timestamps[i]), close: c });
  }
  if (!bars.length) return undefined;
  const today = istDay(marketTimeSec);
  const last = bars.at(-1)!;
  if (last.day === today) return bars.length >= 2 ? bars.at(-2)!.close : undefined;
  return last.day < today ? last.close : bars.filter((b) => b.day < today).at(-1)?.close;
}
