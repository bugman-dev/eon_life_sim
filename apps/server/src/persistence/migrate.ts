import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Pool } from "pg";
import { loadConfig, loadEnvironment } from "../config/env.js";
import { createLogger } from "../observability/logger.js";
import { createPool } from "./database.js";

export async function applyMigrations(pool: Pool): Promise<string[]> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  const applied: string[] = [];

  for (const file of files) {
    const existing = await pool.query("SELECT 1 FROM schema_migrations WHERE id = $1", [file]);
    if (existing.rowCount) {
      continue;
    }

    const sql = await readFile(join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
      await client.query("COMMIT");
      applied.push(file);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return applied;
}

const entry = process.argv[1];
const isDirectRun = Boolean(entry && import.meta.url === pathToFileURL(resolve(entry)).href);

if (isDirectRun) {
  loadEnvironment();
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const pool = await createPool(config.databaseUrl, logger, config.databaseConnectAttempts);
  try {
    const applied = await applyMigrations(pool);
    logger.info({ applied }, "migrations complete");
  } finally {
    await pool.end();
  }
}
