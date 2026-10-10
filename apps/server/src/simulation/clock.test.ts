import { describe, expect, it } from "vitest";
import { ManualScheduler } from "../../test/manual-scheduler.js";
import type { NewWorldSession, WorldSessionRecord, WorldSessionRepository } from "../persistence/world-session-repository.js";
import { advanceOneTick, clockFromTick, isTickLagging } from "./clock.js";
import { SimulationRuntime } from "./runtime.js";

class MemoryRepository implements WorldSessionRepository {
  private readonly rows = new Map<string, WorldSessionRecord>();

  async insert(session: NewWorldSession): Promise<WorldSessionRecord> {
    const now = new Date();
    const row: WorldSessionRecord = { ...session, createdAt: now, updatedAt: now };
    this.rows.set(row.id, row);
    return { ...row };
  }

  async findById(id: string): Promise<WorldSessionRecord | null> {
    const row = this.rows.get(id);
    return row ? { ...row } : null;
  }

  async updateRuntime(
    session: Pick<
      WorldSessionRecord,
      "id" | "status" | "simulationTick" | "gameDay" | "gameHour" | "gameMinute" | "gameSecond"
    >,
  ): Promise<WorldSessionRecord> {
    const existing = this.rows.get(session.id);
    if (!existing) {
      throw new Error(`Missing session ${session.id}`);
    }
    const next = {
      ...existing,
      status: session.status,
      simulationTick: session.simulationTick,
      gameDay: session.gameDay,
      gameHour: session.gameHour,
      gameMinute: session.gameMinute,
      gameSecond: session.gameSecond,
      updatedAt: new Date(),
    };
    this.rows.set(session.id, next);
    return { ...next };
  }

  async pauseAllRunning(): Promise<void> {
    for (const row of this.rows.values()) {
      if (row.status === "running") {
        row.status = "paused";
      }
    }
  }

  async deleteById(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }
}

async function createPausedSession(repository: MemoryRepository): Promise<WorldSessionRecord> {
  return repository.insert({
    id: crypto.randomUUID(),
    name: "Clock",
    status: "paused",
    simulationTick: 0n,
    gameDay: 1,
    gameHour: 0,
    gameMinute: 0,
    gameSecond: 0,
    tickRate: 1,
    seed: null,
  });
}

describe("simulation clock", () => {
  it("advances one tick at a time", () => {
    expect(advanceOneTick(0n)).toBe(1n);
    expect(advanceOneTick(4n)).toBe(5n);
  });

  it("maps the default tick to one in-game hour", () => {
    expect(clockFromTick(0n, 3600)).toEqual({ day: 1, hour: 0, minute: 0, second: 0 });
    expect(clockFromTick(1n, 3600)).toEqual({ day: 1, hour: 1, minute: 0, second: 0 });
    expect(clockFromTick(24n, 3600)).toEqual({ day: 2, hour: 0, minute: 0, second: 0 });
  });

  it("rolls minutes and seconds when a tick is shorter than an hour", () => {
    expect(clockFromTick(1n, 90)).toEqual({ day: 1, hour: 0, minute: 1, second: 30 });
  });

  it("does not advance while paused and does not start a second loop", async () => {
    const repository = new MemoryRepository();
    const scheduler = new ManualScheduler();
    const runtime = new SimulationRuntime(
      repository,
      scheduler,
      { intervalMs: 1000, persistEveryTicks: 5, gameSecondsPerTick: 3600 },
      () => undefined,
      () => undefined,
      () => undefined,
    );
    const session = await createPausedSession(repository);

    await runtime.start(session);
    await runtime.start(session);
    expect(scheduler.pending()).toBe(1);

    await scheduler.flushNext();
    expect(runtime.getLive(session.id)?.simulationTick).toBe(1n);
    expect(runtime.getLive(session.id)?.gameHour).toBe(1);

    await runtime.pause(runtime.getLive(session.id) ?? session);
    expect(scheduler.pending()).toBe(0);
    await scheduler.flushNext();
    expect((await repository.findById(session.id))?.simulationTick).toBe(1n);
    expect((await repository.findById(session.id))?.status).toBe("paused");

    await runtime.start((await repository.findById(session.id)) ?? session);
    await scheduler.flushNext();
    expect(runtime.getLive(session.id)?.simulationTick).toBe(2n);
  });

  it("treats a delayed callback as lag without requesting extra ticks", () => {
    expect(isTickLagging(1000, 1000)).toBe(false);
    expect(isTickLagging(2001, 1000)).toBe(true);
  });
});
