import type { Pool } from "pg";

export type WorldSessionStatus = "paused" | "running";

export type WorldSessionRecord = {
  id: string;
  name: string;
  status: WorldSessionStatus;
  simulationTick: bigint;
  gameDay: number;
  gameHour: number;
  gameMinute: number;
  gameSecond: number;
  tickRate: number;
  seed: bigint | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewWorldSession = {
  id: string;
  name: string;
  status: WorldSessionStatus;
  simulationTick: bigint;
  gameDay: number;
  gameHour: number;
  gameMinute: number;
  gameSecond: number;
  tickRate: number;
  seed: bigint | null;
};

export interface WorldSessionRepository {
  insert(session: NewWorldSession): Promise<WorldSessionRecord>;
  findById(id: string): Promise<WorldSessionRecord | null>;
  updateRuntime(
    session: Pick<
      WorldSessionRecord,
      "id" | "status" | "simulationTick" | "gameDay" | "gameHour" | "gameMinute" | "gameSecond"
    >,
  ): Promise<WorldSessionRecord>;
  pauseAllRunning(): Promise<void>;
  deleteById(id: string): Promise<boolean>;
}

export type WorldSessionRow = {
  id: string;
  name: string;
  status: string;
  simulation_tick: string;
  game_day: number;
  game_hour: number;
  game_minute: number;
  game_second: number;
  tick_rate: number;
  seed: string | null;
  created_at: Date;
  updated_at: Date;
};

export const returningColumns =
  "id, name, status, simulation_tick, game_day, game_hour, game_minute, game_second, tick_rate, seed, created_at, updated_at";

function mapStatus(status: string): WorldSessionStatus {
  if (status === "paused" || status === "running") {
    return status;
  }
  throw new Error(`Unexpected world session status: ${status}`);
}

export function mapRow(row: WorldSessionRow): WorldSessionRecord {
  return {
    id: row.id,
    name: row.name,
    status: mapStatus(row.status),
    simulationTick: BigInt(row.simulation_tick),
    gameDay: row.game_day,
    gameHour: row.game_hour,
    gameMinute: row.game_minute,
    gameSecond: row.game_second,
    tickRate: row.tick_rate,
    seed: row.seed === null ? null : BigInt(row.seed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PgWorldSessionRepository implements WorldSessionRepository {
  constructor(private readonly pool: Pool) {}

  async insert(session: NewWorldSession): Promise<WorldSessionRecord> {
    const result = await this.pool.query<WorldSessionRow>(
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

  async findById(id: string): Promise<WorldSessionRecord | null> {
    const result = await this.pool.query<WorldSessionRow>(
      `SELECT ${returningColumns} FROM world_sessions WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
  }

  async updateRuntime(
    session: Pick<
      WorldSessionRecord,
      "id" | "status" | "simulationTick" | "gameDay" | "gameHour" | "gameMinute" | "gameSecond"
    >,
  ): Promise<WorldSessionRecord> {
    const result = await this.pool.query<WorldSessionRow>(
      `UPDATE world_sessions
       SET status = $2,
           simulation_tick = $3,
           game_day = $4,
           game_hour = $5,
           game_minute = $6,
           game_second = $7,
           updated_at = now()
       WHERE id = $1
       RETURNING ${returningColumns}`,
      [
        session.id,
        session.status,
        session.simulationTick.toString(),
        session.gameDay,
        session.gameHour,
        session.gameMinute,
        session.gameSecond,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error(`World session ${session.id} was not found.`);
    }
    return mapRow(row);
  }

  async pauseAllRunning(): Promise<void> {
    await this.pool.query(
      `UPDATE world_sessions
       SET status = 'paused', updated_at = now()
       WHERE status = 'running'`,
    );
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM world_sessions WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
