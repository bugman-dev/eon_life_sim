import type { DepositType } from "@life-simulator/shared";
import { distanceFrom, type MapGrid } from "./grid.js";
import { makeNoise } from "./noise.js";

/** Noise above this on grass becomes that mineral. */
const ON_GRASS = { stone: 0.78, ore: 0.86 } as const;
/** The same minerals on sand or dirt. The bar is higher so grass holds most of them. */
const ON_OTHER_LAND = { stone: 0.86, ore: 0.9 } as const;
/** Clay on dirt within this many steps of water. */
const CLAY_NEAR = 0.55;
/** Clay on dirt farther from water. Most clay stays inside the near band. */
const CLAY_FAR = 0.9;
const NEAR_WATER_STEPS = 12;

/**
 * Places one static deposit on some land tiles.
 * Stone and ore can sit on any land, and most of them sit on grass.
 * Clay sits only on dirt, and most of it sits near a water body.
 * A tile keeps a single deposit. Water stays empty.
 */
export function assignDeposits(grid: MapGrid, seed: bigint): void {
  const span = Math.min(grid.width, grid.height);
  const patch = Math.max(8, Math.round(span / 10));
  const stone = makeNoise(seed, "deposit-stone", patch, 4);
  const ore = makeNoise(seed, "deposit-ore", patch, 4);
  const clay = makeNoise(seed, "deposit-clay", Math.max(6, Math.round(span / 16)), 3);
  const waterSteps = distanceFrom(grid, (sample) => sample.terrain === "water");

  for (let index = 0; index < grid.samples.length; index += 1) {
    const sample = grid.samples[index];
    if (!sample || sample.terrain === "water") {
      continue;
    }

    const steps = waterSteps[index] ?? -1;
    if (sample.terrain === "dirt" && clay(sample.x, sample.y) > clayThreshold(steps)) {
      sample.deposits = ["clay"];
      continue;
    }

    const placed = mineralAt(sample.terrain === "grass", stone(sample.x, sample.y), ore(sample.x, sample.y));
    if (placed) {
      sample.deposits = [placed];
    }
  }
}

/** Picks stone or ore when the noise clears the bar for this ground. One mineral wins a shared tile. */
function mineralAt(grass: boolean, stoneNoise: number, oreNoise: number): DepositType | undefined {
  const stoneCut = grass ? ON_GRASS.stone : ON_OTHER_LAND.stone;
  const oreCut = grass ? ON_GRASS.ore : ON_OTHER_LAND.ore;
  const stoneHit = stoneNoise > stoneCut;
  const oreHit = oreNoise > oreCut;
  if (stoneHit && oreHit) {
    return stoneNoise >= oreNoise ? "stone" : "ore";
  }
  if (stoneHit) {
    return "stone";
  }
  if (oreHit) {
    return "ore";
  }
  return undefined;
}

function clayThreshold(steps: number): number {
  return steps > 0 && steps <= NEAR_WATER_STEPS ? CLAY_NEAR : CLAY_FAR;
}
