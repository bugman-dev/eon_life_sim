import { createStream } from "./prng.js";

/** A smooth field in the range 0 to 1. The same seed and stage always return the same values. */
export type NoiseField = (x: number, y: number) => number;

/**
 * Blends a broad lattice with a smaller one.
 * `coarse` and `fine` are the cell sizes, in tiles.
 */
export function makeNoise(seed: bigint, stage: string, coarse: number, fine: number): NoiseField {
  const low = latticeNoise(seed, stage, coarse);
  const high = latticeNoise(seed, `${stage}-detail`, fine);
  return (x, y) => clamp01(low(x, y) * 0.75 + high(x, y) * 0.25);
}

function latticeNoise(seed: bigint, stage: string, cell: number): NoiseField {
  const cache = new Map<string, number>();
  const at = (ix: number, iy: number) => {
    const key = `${ix},${iy}`;
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const value = createStream(seed, `${stage}:${ix}:${iy}`)();
    cache.set(key, value);
    return value;
  };

  return (x, y) => {
    const x0 = Math.floor(x / cell);
    const y0 = Math.floor(y / cell);
    const tx = smooth(x / cell - x0);
    const ty = smooth(y / cell - y0);
    const a = lerp(at(x0, y0), at(x0 + 1, y0), tx);
    const b = lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx);
    return lerp(a, b, ty);
  };
}

function smooth(value: number): number {
  return value * value * (3 - 2 * value);
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
