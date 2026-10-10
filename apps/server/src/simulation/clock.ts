export const HOURS_PER_DAY = 24;
export const SECONDS_PER_HOUR = 3600;
export const SECONDS_PER_MINUTE = 60;

export type GameClock = {
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function advanceOneTick(tick: bigint): bigint {
  return tick + 1n;
}

export function clockFromTick(tick: bigint, gameSecondsPerTick: number): GameClock {
  if (!Number.isSafeInteger(gameSecondsPerTick) || gameSecondsPerTick <= 0) {
    throw new Error("Game seconds per tick must be a positive integer.");
  }
  if (tick < 0n) {
    throw new Error("Simulation tick cannot be negative.");
  }

  const totalSeconds = tick * BigInt(gameSecondsPerTick);
  const secondsPerDay = BigInt(HOURS_PER_DAY * SECONDS_PER_HOUR);
  const dayIndex = totalSeconds / secondsPerDay;
  const secondOfDay = totalSeconds % secondsPerDay;
  const day = Number(dayIndex) + 1;
  if (!Number.isSafeInteger(day) || day > 2_147_483_647) {
    throw new Error("Game day does not fit in the stored clock.");
  }

  return {
    day,
    hour: Number(secondOfDay / BigInt(SECONDS_PER_HOUR)),
    minute: Number((secondOfDay % BigInt(SECONDS_PER_HOUR)) / BigInt(SECONDS_PER_MINUTE)),
    second: Number(secondOfDay % BigInt(SECONDS_PER_MINUTE)),
  };
}

export function shouldPersistTick(tick: bigint, every: number): boolean {
  return tick > 0n && tick % BigInt(every) === 0n;
}

export function isTickLagging(elapsedMs: number, intervalMs: number): boolean {
  return elapsedMs > intervalMs * 2;
}
