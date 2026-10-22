import { Redis } from "@upstash/redis";

export interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Atomic get-and-delete, used for one-time `state` records. */
  take(key: string): Promise<string | null>;
  /** Try to take a short lock. True if acquired. */
  lock(key: string, ttlSeconds: number): Promise<boolean>;
}

const MS_PER_SECOND = 1000;

export function memoryStore(): Store {
  const entries = new Map<string, { value: string; expiresAt: number | null }>();
  const live = (key: string) => {
    const entry = entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      entries.delete(key);
      return null;
    }
    return entry.value;
  };
  return {
    async get(key) {
      return live(key);
    },
    async set(key, value, ttlSeconds) {
      entries.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * MS_PER_SECOND : null });
    },
    async del(key) {
      entries.delete(key);
    },
    async take(key) {
      const value = live(key);
      entries.delete(key);
      return value;
    },
    async lock(key, ttlSeconds) {
      if (live(key) !== null) return false;
      entries.set(key, { value: "1", expiresAt: Date.now() + ttlSeconds * MS_PER_SECOND });
      return true;
    },
  };
}

// Values are stored as strings (JSON or ciphertext), so no automatic deserialization.
export function upstashStore(redis: Redis): Store {
  return {
    async get(key) {
      return (await redis.get<string>(key)) ?? null;
    },
    async set(key, value, ttlSeconds) {
      if (ttlSeconds) await redis.set(key, value, { ex: ttlSeconds });
      else await redis.set(key, value);
    },
    async del(key) {
      await redis.del(key);
    },
    async take(key) {
      return (await redis.getdel<string>(key)) ?? null;
    },
    async lock(key, ttlSeconds) {
      return (await redis.set(key, "1", { nx: true, ex: ttlSeconds })) === "OK";
    },
  };
}

export function defaultStore(): Store {
  return upstashStore(Redis.fromEnv());
}
