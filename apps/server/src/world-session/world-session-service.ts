import type { WorldMapRepository } from "../persistence/world-map-repository.js";
import type { WorldSessionRecord, WorldSessionRepository } from "../persistence/world-session-repository.js";
import { clockFromTick } from "../simulation/clock.js";
import type { SimulationRuntime } from "../simulation/runtime.js";
import type { AnimalSettings } from "../world/animals.js";
import type { DepositSettings } from "../world/deposits.js";
import type { VegetationSettings } from "../world/vegetation.js";
import { generateWorld, GenerationError } from "../world/generate.js";

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
    private readonly maps: WorldMapRepository,
    private readonly runtime: SimulationRuntime,
    private readonly tickRate: number,
    private readonly gameSecondsPerTick: number,
    private readonly worldWidth: number,
    private readonly worldHeight: number,
    private readonly deposits: DepositSettings,
    private readonly vegitation: VegetationSettings,
    private readonly animals: AnimalSettings,
  ) {}

  async create(input: { name: string; seed?: number }): Promise<WorldSessionRecord> {
    if (input.seed !== undefined && !Number.isSafeInteger(input.seed)) {
      throw new ServiceError("invalid_seed", "Seed must be a whole number.");
    }
    const seed = input.seed === undefined ? randomSeed() : input.seed;
    let world;
    try {
      world = generateWorld({
        seed: BigInt(seed),
        width: this.worldWidth,
        height: this.worldHeight,
        deposits: this.deposits,
        vegitation: this.vegitation,
        animals: this.animals,
      });
    } catch (error) {
      const message = error instanceof GenerationError ? error.message : "World generation failed.";
      throw new ServiceError("generation_failed", message);
    }

    const clock = clockFromTick(0n, this.gameSecondsPerTick);
    return this.maps.saveNewWorld(
      {
        id: crypto.randomUUID(),
        name: input.name.trim(),
        status: "paused",
        simulationTick: 0n,
        gameDay: clock.day,
        gameHour: clock.hour,
        gameMinute: clock.minute,
        gameSecond: clock.second,
        tickRate: this.tickRate,
        seed: BigInt(seed),
      },
      world,
    );
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

  async delete(worldId: string): Promise<void> {
    await this.runtime.forget(worldId);
    const removed = await this.repository.deleteById(worldId);
    if (!removed) {
      throw new ServiceError("not_found", "World session was not found.");
    }
  }
}

function randomSeed() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] ?? 1;
}
