import Fastify, { type FastifyBaseLogger } from "fastify";
import { loadConfig, type AppConfig } from "./config/env.js";
import { loadWorldConfig } from "./config/world-config.js";
import type { DepositPercents } from "./world/deposits.js";
import { registerHealthRoutes } from "./http/health.js";
import { createLogger } from "./observability/logger.js";
import { createPool } from "./persistence/database.js";
import { PgWorldMapRepository } from "./persistence/world-map-repository.js";
import { PgWorldSessionRepository } from "./persistence/world-session-repository.js";
import { createTimeoutScheduler, SimulationRuntime, type TickScheduler } from "./simulation/runtime.js";
import { toSimulationState } from "./world-session/state.js";
import { ClientHub, registerGateway } from "./websocket/gateway.js";

export type CreateAppOptions = {
  env?: NodeJS.ProcessEnv;
  scheduler?: TickScheduler;
};

export type ServerConfig = AppConfig & { deposits: DepositPercents };

export async function createApp(options: CreateAppOptions = {}) {
  const config: ServerConfig = { ...loadConfig(options.env ?? process.env), deposits: loadWorldConfig() };
  const logger = createLogger(config.logLevel);
  const pool = await createPool(config.databaseUrl, logger, config.databaseConnectAttempts);
  const repository = new PgWorldSessionRepository(pool);
  const maps = new PgWorldMapRepository(pool);
  const scheduler = options.scheduler ?? createTimeoutScheduler();
  const hub = new ClientHub();
  const runtime = new SimulationRuntime(
    repository,
    scheduler,
    { intervalMs: config.tickIntervalMs, persistEveryTicks: config.persistEveryTicks, gameSecondsPerTick: config.tickGameSeconds },
    (session) => {
      hub.publish(session.id, {
        type: "simulation.state",
        payload: toSimulationState(session),
      });
    },
    (worldId, elapsedMs) => {
      logger.warn({ worldId, elapsedMs }, "simulation tick lagged");
    },
    (worldId, error) => {
      logger.error(
        { worldId, message: error instanceof Error ? error.message : "Unknown tick failure" },
        "simulation tick failed to persist",
      );
    },
  );

  await runtime.restorePaused();

  const app = Fastify({ loggerInstance: logger as unknown as FastifyBaseLogger });
  registerHealthRoutes(app, pool);
  await registerGateway(app, {
    hub,
    repository,
    maps,
    runtime,
    tickRate: config.tickRate,
    gameSecondsPerTick: config.tickGameSeconds,
    worldWidth: config.worldWidth,
    worldHeight: config.worldHeight,
    deposits: config.deposits,
    logger,
  });

  app.addHook("onClose", async () => {
    try {
      await runtime.stopAll();
    } finally {
      await pool.end();
    }
  });

  return { app, config, repository, maps, runtime, scheduler };
}

export type AppContext = Awaited<ReturnType<typeof createApp>>;
export type { AppConfig };
