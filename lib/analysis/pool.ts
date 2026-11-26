/** Run `worker` over `items` with at most `n` in flight (server-safe: no browser APIs). */
export async function pool<T>(items: T[], n: number, worker: (item: T) => Promise<void>, stop: () => boolean = () => false): Promise<void> {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
    for (let it = queue.shift(); it !== undefined && !stop(); it = queue.shift()) await worker(it);
  }));
}
