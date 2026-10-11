import {
  DEPOSIT_GROWTH_STAGE,
  MAX_DEPOSIT_AMOUNT,
  MIN_DEPOSIT_AMOUNT,
  type DepositType,
  type ResourceDeposit,
} from "@life-simulator/shared";
import { distanceFrom, type MapGrid, type Sample } from "./grid.js";
import { mixSeed } from "./prng.js";

/** Percent of land tiles (grass, dirt, and sand) for each deposit. */
export type DepositPercents = {
  stone: number;
  ore: number;
  clay: number;
};

/** Matches worldConfig.json. Callers that omit a config use these amounts. */
export const DEFAULT_DEPOSIT_PERCENTS: DepositPercents = {
  stone: 2,
  ore: 0.5,
  clay: 0.2,
};

/** Chebyshev steps required between two deposits, so piles do not sit on neighboring tiles. */
const MIN_GAP = 3;
/** Dirt this close to water is preferred for clay. */
const NEAR_WATER_STEPS = 12;

/**
 * Places static deposits up to a percent of the land.
 * Clay is only on dirt. Dirt near water is used first, and farther dirt is added only while most clay stays near water.
 * A tile keeps a single deposit, and deposits stay a few tiles apart. Water stays empty.
 * A target that cannot fit is filled only as far as the terrain and the gap allow.
 */
export function assignDeposits(grid: MapGrid, seed: bigint, percents: DepositPercents = DEFAULT_DEPOSIT_PERCENTS): void {
  const waterSteps = distanceFrom(grid, (sample) => sample.terrain === "water");
  const land = grid.samples.filter((sample) => sample.terrain !== "water");
  const blocked = new Uint8Array(grid.samples.length);
  const target = (percent: number) => Math.round((land.length * percent) / 100);

  const clayTarget = target(percents.clay);
  const nearClay = clayOptions(grid, seed, land, waterSteps).filter((sample) => withinNearWater(grid, waterSteps, sample));
  const farClay = clayOptions(grid, seed, land, waterSteps).filter((sample) => !withinNearWater(grid, waterSteps, sample));
  placeDeposits(grid, seed, "clay", clayTarget, nearClay, blocked);
  const nearPlaced = grid.samples.filter((sample) => sample.deposits[0]?.type === "clay").length;
  const farRoom = Math.min(Math.max(0, clayTarget - nearPlaced), Math.max(0, nearPlaced - 1));
  placeDeposits(grid, seed, "clay", farRoom, farClay, blocked);
  placeDeposits(grid, seed, "ore", target(percents.ore), mineralOptions(seed, land), blocked);
  placeDeposits(grid, seed, "stone", target(percents.stone), mineralOptions(seed, land), blocked);
}

function placeDeposits(
  grid: MapGrid,
  seed: bigint,
  type: DepositType,
  count: number,
  options: Sample[],
  blocked: Uint8Array,
) {
  let placed = 0;
  for (const sample of options) {
    if (placed >= count) {
      return;
    }
    if (sample.deposits.length > 0 || blocked[indexOf(grid, sample)] !== 0) {
      continue;
    }
    sample.deposits = [depositRecord(seed, sample, type)];
    closeAround(grid, blocked, sample);
    placed += 1;
  }
}

/** A seeded yield from 100 through 500. The same tile and deposit always get the same amount. Growth stays mature. */
function depositRecord(seed: bigint, sample: Sample, type: DepositType): ResourceDeposit {
  const span = MAX_DEPOSIT_AMOUNT - MIN_DEPOSIT_AMOUNT + 1;
  const amount = MIN_DEPOSIT_AMOUNT + (mixSeed(seed, `deposit-amount:${type}:${sample.x}:${sample.y}`) % span);
  return { type, amount, growthStage: DEPOSIT_GROWTH_STAGE };
}

/** All dirt, closest to water first. A hash spreads tiles that are equally close. */
function clayOptions(grid: MapGrid, seed: bigint, land: Sample[], waterSteps: Int16Array) {
  return land
    .filter((sample) => sample.terrain === "dirt")
    .sort((a, b) => {
      const steps = (waterSteps[indexOf(grid, a)] ?? 99) - (waterSteps[indexOf(grid, b)] ?? 99);
      if (steps !== 0) {
        return steps;
      }
      return mixSeed(seed, `deposit-pick:${b.x}:${b.y}`) - mixSeed(seed, `deposit-pick:${a.x}:${a.y}`);
    });
}

/** Grass first, then sand and dirt, each group in a seeded order. */
function mineralOptions(seed: bigint, land: Sample[]) {
  const grass = land.filter((sample) => sample.terrain === "grass");
  const elsewhere = land.filter((sample) => sample.terrain !== "grass");
  return [...byHash(seed, grass), ...byHash(seed, elsewhere)];
}

function withinNearWater(grid: MapGrid, waterSteps: Int16Array, sample: Sample) {
  const steps = waterSteps[indexOf(grid, sample)] ?? -1;
  return steps > 0 && steps <= NEAR_WATER_STEPS;
}

function byHash(seed: bigint, samples: Sample[]) {
  return [...samples].sort(
    (a, b) => mixSeed(seed, `deposit-pick:${b.x}:${b.y}`) - mixSeed(seed, `deposit-pick:${a.x}:${a.y}`),
  );
}

function closeAround(grid: MapGrid, blocked: Uint8Array, sample: Sample) {
  const radius = MIN_GAP - 1;
  for (let y = sample.y - radius; y <= sample.y + radius; y += 1) {
    for (let x = sample.x - radius; x <= sample.x + radius; x += 1) {
      if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) {
        continue;
      }
      blocked[y * grid.width + x] = 1;
    }
  }
}

function indexOf(grid: MapGrid, sample: Sample) {
  return sample.y * grid.width + sample.x;
}
