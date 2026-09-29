import Redis from "ioredis";
import { getConfig } from "./config.js";
import { logger } from "./logger.js";

let redis: Redis | undefined;

export function getRedis(): Redis {
  if (!redis) {
    const config = getConfig();
    redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
      lazyConnect: true,
    });

    redis.on("error", (err) => {
      logger.error({ err }, "Redis connection error");
    });

    redis.on("connect", () => {
      logger.info("Redis connected");
    });
  }
  return redis;
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const pong = await getRedis().ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = undefined;
    logger.info("Redis connection closed");
  }
}
