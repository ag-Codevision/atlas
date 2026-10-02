// Bounded, promise-aware cache. Failures are never retained as successful results.
export class TTLCache {
  constructor(maxEntries = 400) { this.entries = new Map(); this.maxEntries = maxEntries; }
  async get(key, ttl, loader) {
    const now = Date.now();
    const found = this.entries.get(key);
    if (found?.pending) return found.pending;
    if (found && found.expires > now) return found.value;
    this.entries.delete(key);
    for (const [id, entry] of this.entries) if (!entry.pending && entry.expires <= now) this.entries.delete(id);
    while (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value);
    const entry = {};
    entry.pending = Promise.resolve().then(loader).then(value => {
      if (this.entries.get(key) === entry) this.entries.set(key, {value, expires: Date.now() + ttl});
      return value;
    }).catch(error => { if (this.entries.get(key) === entry) this.entries.delete(key); throw error; });
    this.entries.set(key, entry);
    return entry.pending;
  }
}
export const cache = new TTLCache();
