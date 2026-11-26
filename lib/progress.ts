/** Tiny "have you done this yet" flags kept in this browser, for the getting-started checklist. */
const K = (k: string) => `tb.done.${k}`;
export function markDone(key: string) { try { localStorage.setItem(K(key), "1"); } catch { /* storage unavailable */ } }
export function isDone(key: string): boolean { try { return localStorage.getItem(K(key)) === "1"; } catch { return false; } }
export const has = (storageKey: string): boolean => { try { return !!localStorage.getItem(storageKey); } catch { return false; } };
