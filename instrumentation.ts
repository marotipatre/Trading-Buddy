/**
 * Runs once when the server starts. It warms the stock search index and the large/mid/small-cap lists in the
 * background so the first search does not have to wait for a download. Deliberately NOT awaited:
 * `register` must finish before the server accepts requests.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  void import("./lib/instruments").then((m) => m.getInstruments()).catch(() => {});
  void import("./lib/universe-data").then((m) => m.getUniverse()).catch(() => {});
}
