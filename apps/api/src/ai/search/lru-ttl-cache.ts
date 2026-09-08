interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * A minimal in-process LRU+TTL cache. Used ONLY to cache the AI search
 * TRANSLATION (query text -> SearchFilter), never search RESULTS — results
 * must always reflect live inventory and "today" for the validity filter,
 * so caching them would be a correctness bug, not a performance win. The
 * translation itself is deterministic-ish and safe to reuse: "dinner
 * buffets in colombo" means the same filter object an hour from now.
 *
 * A dedicated caching library (@nestjs/cache-manager + cache-manager +
 * keyv) is unnecessary machinery for one narrow, single-process,
 * fixed-size use case this small — this is the entire implementation.
 */
export class LruTtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    // Touch for recency: delete + re-set moves it to the end of Map's
    // iteration order, which is what makes the eviction below "least
    // recently used" rather than "oldest inserted".
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    if (this.store.size > this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
  }

  get size(): number {
    return this.store.size;
  }
}
