import pg from "pg";

export function testDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  url.pathname = "/life_sim_test";
  return url.toString();
}

export function testProcessEnv(databaseUrl: string): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    SERVER_HOST: "127.0.0.1",
    SERVER_PORT: "3001",
    DATABASE_URL: databaseUrl,
    TICK_INTERVAL_MS: "1000",
    TICK_RATE: "1",
    TICK_GAME_SECONDS: "3600",
    PERSIST_EVERY_TICKS: "1",
    DATABASE_CONNECT_ATTEMPTS: "3",
    LOG_LEVEL: "silent",
  };
}

export async function ensureTestDatabase(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const database = url.pathname.replace(/^\//, "");
  if (!/^[a-z0-9_]+$/.test(database)) {
    throw new Error(`Refusing to create database "${database}".`);
  }

  const admin = new URL(databaseUrl);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE ${database}`);
    }
  } finally {
    await client.end();
  }
}
