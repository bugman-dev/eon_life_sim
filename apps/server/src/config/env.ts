import { DEFAULT_WORLD_SIZE, MAX_WORLD_SIZE, MIN_WORLD_SIZE } from "@life-simulator/shared";
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

const positiveInt = (fallback: number) =>
  z.preprocess(
    (value) => (value === undefined || value === "" ? fallback : value),
    z.coerce.number().int().positive(),
  );

const worldSize = z.preprocess(
  (value) => (value === undefined || value === "" ? DEFAULT_WORLD_SIZE : value),
  z.coerce.number().int().min(MIN_WORLD_SIZE).max(MAX_WORLD_SIZE),
);

const envSchema = z.object({
  NODE_ENV: z.preprocess(
    (value) => (value === undefined || value === "" ? "development" : value),
    z.enum(["development", "test", "production"]),
  ),
  SERVER_HOST: z.preprocess(
    (value) => (value === undefined || value === "" ? "0.0.0.0" : value),
    z.string().min(1),
  ),
  SERVER_PORT: positiveInt(3000),
  DATABASE_URL: z.string().min(1),
  TICK_INTERVAL_MS: positiveInt(1000),
  TICK_RATE: positiveInt(1),
  TICK_GAME_SECONDS: positiveInt(3600),
  PERSIST_EVERY_TICKS: positiveInt(5),
  WORLD_WIDTH: worldSize,
  WORLD_HEIGHT: worldSize,
  DATABASE_CONNECT_ATTEMPTS: positiveInt(10),
  LOG_LEVEL: z.preprocess(
    (value) => (value === undefined || value === "" ? "info" : value),
    z.string().min(1),
  ),
});

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  serverHost: string;
  serverPort: number;
  databaseUrl: string;
  tickIntervalMs: number;
  tickRate: number;
  tickGameSeconds: number;
  persistEveryTicks: number;
  worldWidth: number;
  worldHeight: number;
  databaseConnectAttempts: number;
  logLevel: string;
};

export function loadEnvironment() {
  const candidates = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")];
  for (const path of candidates) {
    loadDotenv({ path, quiet: true });
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid configuration: ${details}`);
  }

  return {
    nodeEnv: parsed.data.NODE_ENV,
    serverHost: parsed.data.SERVER_HOST,
    serverPort: parsed.data.SERVER_PORT,
    databaseUrl: parsed.data.DATABASE_URL,
    tickIntervalMs: parsed.data.TICK_INTERVAL_MS,
    tickRate: parsed.data.TICK_RATE,
    tickGameSeconds: parsed.data.TICK_GAME_SECONDS,
    persistEveryTicks: parsed.data.PERSIST_EVERY_TICKS,
    worldWidth: parsed.data.WORLD_WIDTH,
    worldHeight: parsed.data.WORLD_HEIGHT,
    databaseConnectAttempts: parsed.data.DATABASE_CONNECT_ATTEMPTS,
    logLevel: parsed.data.LOG_LEVEL,
  };
}
