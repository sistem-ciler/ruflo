import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { getConfig } from "./config.js";
import { logger } from "./logger.js";

const { Pool } = pg;

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    const config = getConfig();
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    pool.on("error", (err) => {
      logger.error({ err }, "Unexpected PostgreSQL pool error");
    });
  }
  return pool;
}

export function getDb() {
  return drizzle(getPool());
}

export async function checkDbHealth(): Promise<boolean> {
  try {
    const client = await getPool().connect();
    try {
      await client.query("SELECT 1");
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    logger.info("PostgreSQL pool closed");
  }
}
