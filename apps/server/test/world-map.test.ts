import { beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createApp } from "../src/app.js";
import { applyMigrations } from "../src/persistence/migrate.js";
import { WorldSessionService } from "../src/world-session/world-session-service.js";
import { generateWorld } from "../src/world/generate.js";
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

describe("world map persistence", () => {
  it("stores the generated map, keeps a legacy world empty, and rolls back a failed save", async () => {
    const context = await createApp({ env: testProcessEnv(databaseUrl), scheduler: new ManualScheduler() });
    const service = new WorldSessionService(
      context.repository,
      context.maps,
      context.runtime,
      context.config.tickRate,
      context.config.tickGameSeconds,
      context.config.worldWidth,
      context.config.worldHeight,
    );

    const created = await service.create({ name: "Mapped", seed: 11 });
    const loaded = await context.maps.findMap(created.id);
    const expected = generateWorld({ seed: 11n });
    expect(loaded).toEqual({
      worldId: created.id,
      seed: "11",
      generationVersion: 1,
      width: expected.width,
      height: expected.height,
      tileSize: 1,
      tiles: expected.tiles,
    });

    const legacy = await context.repository.insert({
      id: crypto.randomUUID(),
      name: "Legacy",
      status: "paused",
      simulationTick: 0n,
      gameDay: 1,
      gameHour: 0,
      gameMinute: 0,
      gameSecond: 0,
      tickRate: 1,
      seed: 4n,
    });
    expect(await context.maps.findMap(legacy.id)).toBeNull();

    const broken = generateWorld({ seed: 5n, width: 8, height: 8 });
    broken.tiles[1] = { ...broken.tiles[0] };
    const failingId = crypto.randomUUID();
    await expect(
      context.maps.saveNewWorld(
        {
          id: failingId,
          name: "Broken",
          status: "paused",
          simulationTick: 0n,
          gameDay: 1,
          gameHour: 0,
          gameMinute: 0,
          gameSecond: 0,
          tickRate: 1,
          seed: 5n,
        },
        broken,
      ),
    ).rejects.toThrow();
    expect(await context.repository.findById(failingId)).toBeNull();

    await context.app.close();
  });

  it("creates a world at the configured width and height", async () => {
    const context = await createApp({
      env: { ...testProcessEnv(databaseUrl), WORLD_WIDTH: "129", WORLD_HEIGHT: "8" },
      scheduler: new ManualScheduler(),
    });
    const service = new WorldSessionService(
      context.repository,
      context.maps,
      context.runtime,
      context.config.tickRate,
      context.config.tickGameSeconds,
      context.config.worldWidth,
      context.config.worldHeight,
    );

    const created = await service.create({ name: "Small", seed: 9 });
    const loaded = await context.maps.findMap(created.id);
    expect(loaded?.width).toBe(129);
    expect(loaded?.height).toBe(8);
    expect(loaded?.tiles).toHaveLength(129 * 8);
    await context.app.close();
  });
});
