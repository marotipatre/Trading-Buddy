/** Take stocks from three lists in a rhythm of 8 large, 7 mid and 5 small per 20, picking from spread-out positions in each list. */
export function interleaveMixed<T>(large: T[], mid: T[], small: T[]): T[] {
  const spread = <U,>(a: U[]) => { const out: U[] = []; const seen = new Set<number>(); for (let k = 0; k < a.length; k++) { const i = Math.floor((k * 7919) % a.length); if (!seen.has(i)) { seen.add(i); out.push(a[i]); } } for (let i = 0; i < a.length; i++) if (!seen.has(i)) out.push(a[i]); return out; };
  const L = spread(large), M = spread(mid), S = spread(small);
  const out: T[] = [];
  const quota = [8, 7, 5];
  const lists = [L, M, S];
  const pos = [0, 0, 0];
  while (pos[0] < L.length || pos[1] < M.length || pos[2] < S.length) {
    for (let k = 0; k < 3; k++) for (let n = 0; n < quota[k] && pos[k] < lists[k].length; n++) out.push(lists[k][pos[k]++]);
  }
  return out;
}
