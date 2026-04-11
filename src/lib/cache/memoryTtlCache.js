class MemoryTtlCache {
  constructor({ now = () => Date.now() } = {}) {
    this.store = new Map();
    this.now = now;
  }

  get(key) {
    const entry = this.store.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key, value, ttlMs) {
    const normalizedTtl = Number(ttlMs);

    if (!Number.isFinite(normalizedTtl) || normalizedTtl <= 0) {
      this.store.delete(key);
      return value;
    }

    this.store.set(key, {
      value,
      expiresAt: this.now() + normalizedTtl,
    });

    return value;
  }

  delete(key) {
    return this.store.delete(key);
  }

  deleteMany(keys = []) {
    let deletedCount = 0;

    for (const key of keys) {
      if (this.store.delete(key)) {
        deletedCount += 1;
      }
    }

    return deletedCount;
  }

  clear() {
    this.store.clear();
  }

  clearByPrefix(prefix) {
    let deletedCount = 0;

    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        deletedCount += 1;
      }
    }

    return deletedCount;
  }

  async getOrSet(key, ttlMs, factory) {
    const cachedValue = this.get(key);

    if (cachedValue !== undefined) {
      return cachedValue;
    }

    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }
}

const createMemoryTtlCache = (options) => new MemoryTtlCache(options);

module.exports = {
  MemoryTtlCache,
  createMemoryTtlCache,
};
