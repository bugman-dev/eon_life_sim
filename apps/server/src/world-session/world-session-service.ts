import type { WorldSessionRecord, WorldSessionRepository } from "../persistence/world-session-repository.js";
import { clockFromTick } from "../simulation/clock.js";
import type { SimulationRuntime } from "../simulation/runtime.js";

export class ServiceError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}

export class WorldSessionService {
  constructor(
    private readonly repository: WorldSessionRepository,
    private readonly runtime: SimulationRuntime,
    private readonly tickRate: number,
    private readonly gameSecondsPerTick: number,
  ) {}

  async create(input: { name: string; seed?: number }): Promise<WorldSessionRecord> {
    const clock = clockFromTick(0n, this.gameSecondsPerTick);
    return this.repository.insert({
      id: crypto.randomUUID(),
      name: input.name.trim(),
      status: "paused",
      simulationTick: 0n,
      gameDay: clock.day,
      gameHour: clock.hour,
      gameMinute: clock.minute,
      gameSecond: clock.second,
      tickRate: this.tickRate,
      seed: input.seed === undefined ? null : BigInt(input.seed),
    });
  }

  async get(worldId: string): Promise<WorldSessionRecord> {
    const live = this.runtime.getLive(worldId);
    if (live) {
      return live;
    }

    const stored = await this.repository.findById(worldId);
    if (!stored) {
      throw new ServiceError("not_found", "World session was not found.");
    }
    return stored;
  }

  async start(worldId: string): Promise<WorldSessionRecord> {
    return this.runtime.start(await this.get(worldId));
  }

  async pause(worldId: string): Promise<WorldSessionRecord> {
    return this.runtime.pause(await this.get(worldId));
  }

  async resume(worldId: string): Promise<WorldSessionRecord> {
    return this.start(worldId);
  }
}
