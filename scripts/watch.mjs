#!/usr/bin/env node
/**
 * Local order watcher: calls the app's /api/watch endpoint once a minute so limit, stop and take-profit
 * orders keep executing while the browser is closed. Run the app (npm run dev, or npm run build && npm start)
 * in one terminal and `npm run watch` in another. Needs CRON_SECRET and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
const base = process.env.WATCH_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;
const everyMs = Number(process.env.WATCH_EVERY_SECONDS ?? 60) * 1000;

if (!secret || secret.length < 16) {
  console.error("CRON_SECRET is missing or shorter than 16 characters. Add a long random value to .env.local.");
  process.exit(1);
}

async function tick() {
  const stamp = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata" });
  try {
    const res = await fetch(`${base}/api/watch`, { headers: { authorization: `Bearer ${secret}` } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return console.error(`[${stamp} IST] ${res.status}: ${body.error ?? "request failed"}`);
    if (body.skipped) return console.log(`[${stamp} IST] ${body.skipped}`);
    const bits = [`${body.accounts} account(s)`, body.changedAccounts && `${body.changedAccounts} updated`, body.newEvents && `${body.newEvents} order event(s)`, body.alertsTriggered && `${body.alertsTriggered} alert(s) fired`, body.skippedOpenApp && `${body.skippedOpenApp} left to the open app`, body.conflicts && `${body.conflicts} conflict(s)`, ...(body.errors ?? [])].filter(Boolean);
    console.log(`[${stamp} IST] ${bits.join(", ")}`);
  } catch (e) {
    console.error(`[${stamp} IST] could not reach ${base}: ${e.message}`);
  }
}

console.log(`Order watcher running against ${base} every ${everyMs / 1000}s. Press Ctrl+C to stop.`);
await tick();
setInterval(tick, everyMs);
