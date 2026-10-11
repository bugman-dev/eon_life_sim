import { beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createApp } from "../src/app.js";
import { applyMigrations } from "../src/persistence/migrate.js";
import { WorldSessionService } from "../src/world-session/world-session-service.js";
import { ensureTestDatabase, testDatabaseUrl, testProcessEnv } from "./database.js";
import { ManualScheduler } from "./manual-scheduler.js";

const databaseUrl = testDatabaseUrl(process.env.DATABASE_URL ?? "");

beforeAll(async () => {
  await ensureTestDatabase(databaseUrl);
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await applyMigrations(pool);
  } finally {
    await pool.end();
  }
});

describe("world session lifecycle", () => {
  it("persists a session and restores it paused after shutdown", async () => {
    const scheduler = new ManualScheduler();
    const env = testProcessEnv(databaseUrl);
    const first = await createApp({ env, scheduler });
    const service = new WorldSessionService(
      first.repository,
      first.maps,
      first.runtime,
      first.config.tickRate,
      first.config.tickGameSeconds,
      first.config.worldWidth,
      first.config.worldHeight,
      first.config.deposits,
      first.config.vegitation,
    );

    const created = await service.create({ name: "Lifecycle", seed: 7 });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.simulationTick).toBe(0n);
    expect(created.gameDay).toBe(1);
    expect(created.gameHour).toBe(0);
    expect(created.gameMinute).toBe(0);
    expect(created.gameSecond).toBe(0);
    expect(created.status).toBe("paused");

    const started = await service.start(created.id);
    expect(started.status).toBe("running");
    await scheduler.flushNext();
    await first.app.close();

    const second = await createApp({ env, scheduler: new ManualScheduler() });
    const loaded = await second.repository.findById(created.id);
    expect(loaded?.status).toBe("paused");
    expect(loaded?.simulationTick).toBe(1n);
    expect(loaded?.gameDay).toBe(1);
    expect(loaded?.gameHour).toBe(1);
    expect(loaded?.gameMinute).toBe(0);
    expect(loaded?.gameSecond).toBe(0);
    expect(loaded?.seed).toBe(7n);
    await second.app.close();
  });
});
