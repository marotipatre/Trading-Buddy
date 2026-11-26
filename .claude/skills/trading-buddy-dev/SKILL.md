---
name: trading-buddy-dev
description: Conventions, checks and known pitfalls for working on the Trading Buddy NSE paper-trading app. Use when changing code in this repository.
---

# Working on Trading Buddy

Before finishing any change run, in order: `npx tsc --noEmit`, `npx eslint app components lib`, `npx vitest run`, and for anything touching routes or config `npx next build`.
Commit in small, genuine steps. Never commit `.env*` files. The dev server rewrites `AGENTS.md`; leave it out of commits.

## Next.js 16 specifics
- Read `node_modules/next/dist/docs/` before using an API you are unsure of. `proxy.ts` replaces middleware; `cacheComponents` is on.
- Never call `Date.now()` or `new Date()` during render. Use the `useNow` and `useMarketOpen` hooks.
- Client components that depend on browser-only state (a model, localStorage) should render nothing on the first pass, then fill in, to avoid hydration mismatches.
- Never import Node-only modules (`fs`) into code reachable from the client (see `universe-lists.ts` versus `universe-data.ts`).
- Base UI buttons rendered as links need `nativeButton={false}` with `render={<Link />}`; `Button` defaults to `type="button"`.

## Correctness rules for the finance code
- Signals are read at the close and filled at the next open; stops are checked before targets within a bar; no lookahead (pivots are confirmed `strength` bars later).
- A price is only shown if it can be tied to the requested symbol. Tests must not read shared tmp cache files.
- Code computes every figure; a model may only narrate (see `lib/coach.ts` and its number guard). Never let a model produce a price, return or probability.
- Keep honest limits visible: small samples, overlapping windows, survivorship bias, and that nothing is investment advice.

## Where things live
- Engine: `lib/engine` (simulator, rules, presets, lab). Analysis and ideas: `lib/analysis`. Intraday: `lib/intraday`. Paper broker: `lib/paper`. Rule books: `lib/playbook/content.ts`. Data: `lib/data`.
- Optional integrations are off unless configured: FinBERT (browser), `OLLAMA_URL`, `KRONOS_URL`.
