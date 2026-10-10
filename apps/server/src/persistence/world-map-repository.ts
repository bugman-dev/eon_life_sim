import type { WorldMap, WorldTile } from "@life-simulator/shared";
import type { Pool, PoolClient } from "pg";
import type { GeneratedWorld } from "../world/generate.js";
import {
  type NewWorldSession,
  type WorldSessionRecord,
  type WorldSessionRow,
  mapRow,
  returningColumns,
} from "./world-session-repository.js";

export interface WorldMapRepository {
  saveNewWorld(session: NewWorldSession, world: GeneratedWorld): Promise<WorldSessionRecord>;
  findMap(worldId: string): Promise<WorldMap | null>;
}

type GenerationRow = {
  generation_version: number;
  width: number;
  height: number;
  tile_size: number;
  seed: string | null;
};

type TileRow = {
  x: number;
  y: number;
  terrain_type: WorldTile["terrainType"];
  elevation: number;
  water_type: WorldTile["waterType"];
  soil_type: WorldTile["soilType"];
  fertility: number;
  vegetation_type: WorldTile["vegetationType"];
  vegetation_density: number;
};

type DepositRow = {
  x: number;
  y: number;
  deposit_type: WorldTile["deposits"][number];
};

export class PgWorldMapRepository implements WorldMapRepository {
  constructor(private readonly pool: Pool) {}

  async saveNewWorld(session: NewWorldSession, world: GeneratedWorld): Promise<WorldSessionRecord> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await insertSession(client, session);
      await client.query(
        `INSERT INTO world_generation (world_id, generation_version, width, height, tile_size)
         VALUES ($1, $2, $3, $4, $5)`,
        [session.id, world.generationVersion, world.width, world.height, world.tileSize],
      );
      await insertTiles(client, session.id, world.tiles);
      await insertDeposits(client, session.id, world.tiles);
      await client.query("COMMIT");
      return inserted;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findMap(worldId: string): Promise<WorldMap | null> {
    const generation = await this.pool.query<GenerationRow>(
      `SELECT g.generation_version, g.width, g.height, g.tile_size, s.seed
       FROM world_generation g
       JOIN world_sessions s ON s.id = g.world_id
       WHERE g.world_id = $1`,
      [worldId],
    );
    const meta = generation.rows[0];
    if (!meta || meta.seed === null || meta.generation_version !== 1 || meta.tile_size !== 1) {
      return null;
    }

    const tileRows = await this.pool.query<TileRow>(
      `SELECT x, y, terrain_type, elevation, water_type, soil_type, fertility, vegetation_type, vegetation_density
       FROM world_tiles
       WHERE world_id = $1
       ORDER BY y, x`,
      [worldId],
    );
    const depositRows = await this.pool.query<DepositRow>(
      `SELECT x, y, deposit_type
       FROM world_resource_deposits
       WHERE world_id = $1
       ORDER BY y, x, deposit_type`,
      [worldId],
    );
    const deposits = new Map<string, WorldTile["deposits"]>();
    for (const row of depositRows.rows) {
      const key = `${row.x},${row.y}`;
      const current = deposits.get(key) ?? [];
      current.push(row.deposit_type);
      deposits.set(key, current);
    }

    return {
      worldId,
      seed: meta.seed,
      generationVersion: 1,
      width: meta.width,
      height: meta.height,
      tileSize: 1,
      tiles: tileRows.rows.map((row) => ({
        x: row.x,
        y: row.y,
        terrainType: row.terrain_type,
        elevation: roundStored(row.elevation),
        waterType: row.water_type,
        soilType: row.soil_type,
        fertility: Number(row.fertility),
        vegetationType: row.vegetation_type,
        vegetationDensity: roundStored(row.vegetation_density),
        deposits: deposits.get(`${row.x},${row.y}`) ?? [],
      })),
    };
  }
}

async function insertSession(client: PoolClient, session: NewWorldSession): Promise<WorldSessionRecord> {
  const result = await client.query<WorldSessionRow>(
    `INSERT INTO world_sessions (
       id, name, status, simulation_tick, game_day, game_hour, game_minute, game_second, tick_rate, seed
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${returningColumns}`,
    [
      session.id,
      session.name,
      session.status,
      session.simulationTick.toString(),
      session.gameDay,
      session.gameHour,
      session.gameMinute,
      session.gameSecond,
      session.tickRate,
      session.seed === null ? null : session.seed.toString(),
    ],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("World session insert did not return a row.");
  }
  return mapRow(row);
}

async function insertTiles(client: PoolClient, worldId: string, tiles: WorldTile[]) {
  await client.query(
    `INSERT INTO world_tiles (
       world_id, x, y, terrain_type, elevation, water_type, soil_type, fertility, vegetation_type, vegetation_density
     )
     SELECT $1, tile.x, tile.y, tile.terrain_type, tile.elevation, tile.water_type, tile.soil_type,
            tile.fertility, tile.vegetation_type, tile.vegetation_density
     FROM unnest(
       $2::int[], $3::int[], $4::text[], $5::float8[], $6::text[], $7::text[], $8::int[], $9::text[], $10::float8[]
     ) AS tile(x, y, terrain_type, elevation, water_type, soil_type, fertility, vegetation_type, vegetation_density)`,
    [
      worldId,
      tiles.map((tile) => tile.x),
      tiles.map((tile) => tile.y),
      tiles.map((tile) => tile.terrainType),
      tiles.map((tile) => tile.elevation),
      tiles.map((tile) => tile.waterType),
      tiles.map((tile) => tile.soilType),
      tiles.map((tile) => tile.fertility),
      tiles.map((tile) => tile.vegetationType),
      tiles.map((tile) => tile.vegetationDensity),
    ],
  );
}

async function insertDeposits(client: PoolClient, worldId: string, tiles: WorldTile[]) {
  const points = tiles.flatMap((tile) => tile.deposits.map((deposit) => ({ x: tile.x, y: tile.y, deposit })));
  if (points.length === 0) {
    return;
  }
  await client.query(
    `INSERT INTO world_resource_deposits (world_id, x, y, deposit_type)
     SELECT $1, deposit.x, deposit.y, deposit.deposit_type
     FROM unnest($2::int[], $3::int[], $4::text[]) AS deposit(x, y, deposit_type)`,
    [worldId, points.map((point) => point.x), points.map((point) => point.y), points.map((point) => point.deposit)],
  );
}

function roundStored(value: number) {
  return Math.round(Number(value) * 10000) / 10000;
}
