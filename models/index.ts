import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { logger } from "../src/lib/logger";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const requiresSsl =
  process.env.DATABASE_URL.includes("sslmode=require") ||
  process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});
export const db = drizzle(pool, { schema });

const rawRetryAttempts = process.env["DB_CONNECT_MAX_ATTEMPTS"] ?? "8";
const rawRetryDelayMs = process.env["DB_CONNECT_RETRY_DELAY_MS"] ?? "5000";

const dbConnectMaxAttempts = Number(rawRetryAttempts);
const dbConnectRetryDelayMs = Number(rawRetryDelayMs);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureDatabaseReady(): Promise<void> {
  const attempts =
    Number.isFinite(dbConnectMaxAttempts) && dbConnectMaxAttempts > 0
      ? Math.floor(dbConnectMaxAttempts)
      : 8;
  const retryDelayMs =
    Number.isFinite(dbConnectRetryDelayMs) && dbConnectRetryDelayMs > 0
      ? dbConnectRetryDelayMs
      : 5000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await pool.query("select 1");
      if (attempt > 1) {
        logger.info({ attempt }, "Database connection recovered");
      }
      return;
    } catch (error) {
      lastError = error;
      logger.warn(
        { attempt, attempts, retryDelayMs, err: error },
        "Database connection attempt failed",
      );

      if (attempt < attempts) {
        await sleep(retryDelayMs);
      }
    }
  }

  throw new Error(
    `Database connection failed after ${attempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

export * from "./schema";
