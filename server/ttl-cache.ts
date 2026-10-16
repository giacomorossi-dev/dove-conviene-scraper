/**
 * Promises kept for `ttl` ms, by key. A failed load is dropped so the next
 * call retries; expired entries are swept on insert, so the map can't grow
 * forever in a server that runs for days.
 */
export function ttlCache<T>(ttl: number) {
  const entries = new Map<string, { at: number; value: Promise<T> }>();
  return {
    get(key: string, load: () => Promise<T>): Promise<T> {
      const now = Date.now();
      const hit = entries.get(key);
      if (hit && now - hit.at < ttl) return hit.value;
      for (const [k, e] of entries) if (now - e.at >= ttl) entries.delete(k);
      const value = load();
      entries.set(key, { at: now, value });
      value.catch(() => {
        if (entries.get(key)?.value === value) entries.delete(key);
      });
      return value;
    },
    get size() {
      return entries.size;
    },
  };
}
