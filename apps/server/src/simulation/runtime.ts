import type { AnimalMove } from "@life-simulator/shared";
import type { WorldSessionRecord, WorldSessionRepository } from "../persistence/world-session-repository.js";
import type { AnimalMotion } from "./animal-motion.js";
import { advanceOneTick, clockFromTick, isTickLagging, shouldPersistTick } from "./clock.js";

export type ScheduledTask = {
  cancel(): void;
};

export type TickScheduler = {
  schedule(delayMs: number, run: () => void | Promise<void>): ScheduledTask;
};

type Loop = {
  running: boolean;
  handle: ScheduledTask | null;
};

export type RuntimeOptions = {
  intervalMs: number;
  persistEveryTicks: number;
  gameSecondsPerTick: number;
};

export function createTimeoutScheduler(): TickScheduler {
  return {
    schedule(delayMs, run) {
      const timer = setTimeout(() => {
        void run();
      }, delayMs);
      return {
        cancel() {
          clearTimeout(timer);
        },
      };
    },
  };
}

export class SimulationRuntime {
  private readonly loops = new Map<string, Loop>();
  private readonly live = new Map<string, WorldSessionRecord>();
  private readonly tails = new Map<string, Promise<unknown>>();

  constructor(
    private readonly repository: WorldSessionRepository,
    private readonly scheduler: TickScheduler,
    private readonly options: RuntimeOptions,
    private readonly onChange: (session: WorldSessionRecord) => void,
    private readonly onLag: (worldId: string, elapsedMs: number) => void,
    private readonly onError: (worldId: string, error: unknown) => void,
    private readonly motion: AnimalMotion | null = null,
    private readonly onAnimals: (worldId: string, moves: AnimalMove[]) => void = () => undefined,
  ) {}

  getLive(worldId: string): WorldSessionRecord | null {
    const session = this.live.get(worldId);
    return session ? { ...session } : null;
  }

  async restorePaused(): Promise<void> {
    await this.repository.pauseAllRunning();
  }

  async start(session: WorldSessionRecord): Promise<WorldSessionRecord> {
    return this.enqueue(session.id, async () => {
      const loop = this.loops.get(session.id);
      if (loop?.running) {
        return this.requireLive(session.id);
      }

      const current = this.live.get(session.id) ?? session;
      await this.motion?.begin(session.id);
      const running = await this.repository.updateRuntime({ ...current, status: "running" });
      this.live.set(session.id, running);
      const nextLoop: Loop = { running: true, handle: null };
      this.loops.set(session.id, nextLoop);
      this.arm(session.id, nextLoop);
      this.onChange(running);
      return { ...running };
    });
  }

  async pause(session: WorldSessionRecord): Promise<WorldSessionRecord> {
    return this.enqueue(session.id, async () => {
      const loop = this.loops.get(session.id);
      if (loop) {
        loop.running = false;
        loop.handle?.cancel();
        loop.handle = null;
        this.loops.delete(session.id);
      }

      const current = this.live.get(session.id) ?? session;
      const paused = await this.repository.updateRuntime({ ...current, status: "paused" });
      await this.motion?.release(session.id);
      this.live.delete(session.id);
      this.onChange(paused);
      return { ...paused };
    });
  }

  async forget(worldId: string): Promise<void> {
    await this.enqueue(worldId, async () => {
      const loop = this.loops.get(worldId);
      if (loop) {
        loop.running = false;
        loop.handle?.cancel();
        loop.handle = null;
        this.loops.delete(worldId);
      }
      this.live.delete(worldId);
      await this.motion?.release(worldId);
    });
  }

  async stopAll(): Promise<void> {
    const running = [...this.live.values()].map((session) => ({ ...session }));
    for (const session of running) {
      await this.pause(session);
    }
  }

  private requireLive(worldId: string): WorldSessionRecord {
    const session = this.live.get(worldId);
    if (!session) {
      throw new Error(`Running world session ${worldId} has no live state.`);
    }
    return { ...session };
  }

  private enqueue<T>(worldId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(worldId) ?? Promise.resolve();
    const result = previous.then(task, task);
    this.tails.set(
      worldId,
      result.then(
        () => undefined,
        () => undefined,
      ),
    );
    return result;
  }

  private arm(worldId: string, loop: Loop) {
    const started = Date.now();
    loop.handle = this.scheduler.schedule(this.options.intervalMs, () =>
      this.enqueue(worldId, () => this.handleTick(worldId, loop, started)),
    );
  }

  private async handleTick(worldId: string, loop: Loop, started: number) {
    if (!loop.running) {
      return;
    }

    const elapsedMs = Date.now() - started;
    if (isTickLagging(elapsedMs, this.options.intervalMs)) {
      this.onLag(worldId, elapsedMs);
    }

    const current = this.live.get(worldId);
    if (!current || !loop.running) {
      return;
    }

    const simulationTick = advanceOneTick(current.simulationTick);
    const clock = clockFromTick(simulationTick, this.options.gameSecondsPerTick);
    let next: WorldSessionRecord = {
      ...current,
      simulationTick,
      gameDay: clock.day,
      gameHour: clock.hour,
      gameMinute: clock.minute,
      gameSecond: clock.second,
    };
    this.live.set(worldId, next);

    if (shouldPersistTick(simulationTick, this.options.persistEveryTicks)) {
      try {
        next = await this.repository.updateRuntime(next);
        if (!loop.running) {
          return;
        }
        this.live.set(worldId, next);
      } catch (error) {
        this.onError(worldId, error);
      }
    }

    if (!loop.running) {
      return;
    }

    try {
      const moved = await this.motion?.step(worldId, simulationTick);
      if (moved && moved.length > 0 && loop.running) {
        this.onAnimals(worldId, moved);
      }
    } catch (error) {
      this.onError(worldId, error);
    }

    if (!loop.running) {
      return;
    }

    this.onChange(this.live.get(worldId) ?? next);
    if (loop.running) {
      this.arm(worldId, loop);
    }
  }
}
