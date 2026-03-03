const DEFAULT_TTL = 60_000;

type CacheEntry<T> = {
  value?: T;
  expiresAt: number;
  pending?: Promise<T>;
};

export class IntentCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  get(key: string) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async getOrLoad(key: string, loader: () => Promise<T>, ttlMs = DEFAULT_TTL): Promise<T> {
    const existing = this.store.get(key);
    if (existing && existing.value !== undefined && Date.now() <= existing.expiresAt) {
      return existing.value;
    }
    if (existing?.pending) return existing.pending;

    const pending = loader().then((value) => {
      this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    }).finally(() => {
      const entry = this.store.get(key);
      if (entry?.pending) {
        this.store.set(key, { value: entry.value, expiresAt: entry.expiresAt });
      }
    });

    this.store.set(key, { expiresAt: Date.now() + ttlMs, pending });
    return pending;
  }
}
