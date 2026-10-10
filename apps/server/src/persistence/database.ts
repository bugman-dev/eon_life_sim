import { Pool } from "pg";
import type { AppLogger } from "../observability/logger.js";

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function createPool(databaseUrl: string, logger: AppLogger, attempts: number) {
  const pool = new Pool({ connectionString: databaseUrl, max: 10 });

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      return pool;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown database error";
      logger.warn({ attempt, attempts, message }, "database not ready");
      if (attempt === attempts) {
        await pool.end();
        throw new Error(`Database is unavailable: ${message}`);
      }
      await wait(1000);
    }
  }

  await pool.end();
  throw new Error("Database is unavailable.");
}
