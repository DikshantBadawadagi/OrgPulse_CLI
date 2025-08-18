import Redis from "ioredis";

let redis;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
  redis.on("connect", () => console.log("Connected to Redis"));
  redis.on("error", (err) => console.warn("Redis connection error:", err.message));
}

/**
 * @param {string} key
 * @returns {Promise<string|null>}
 */
export async function getCache(key) {
  if (!redis) return null;
  return await redis.get(key);
}

/**
 * @param {string} key
 * @param {string} value
 * @param {number} ttlSeconds
 */
export async function setCache(key, value, ttlSeconds = 3600) {
  if (!redis) return;
  await redis.set(key, value, "EX", ttlSeconds);
}


export async function closeCache() {
  if (!redis) return;
  try {
    if (typeof redis.quit === 'function') await redis.quit();
  } catch (err) {
    try { redis.disconnect(); } catch (e) {}
  } finally {
    redis = undefined;
  }
}
