import { DEPOSIT_GROWTH_STAGE, type DepositType, type ResourceDeposit } from "@life-simulator/shared";
import { distanceFrom, type MapGrid, type Sample } from "./grid.js";
import { mixSeed } from "./prng.js";
import { GenerationError } from "./validate.js";

/** How many of one deposit to place, and the harvestable amount each pile can hold. */
export type DepositBand = {
  percent: number;
  minAmount: number;
  maxAmount: number;
};

/** Stone, ore, and clay settings from worldConfig.json. */
export type DepositSettings = {
  stone: DepositBand;
  ore: DepositBand;
  clay: DepositBand;
};

/** Matches worldConfig.json. Callers that omit a config use these settings. */
export const DEFAULT_DEPOSIT_SETTINGS: DepositSettings = {
  stone: { percent: 0.5, minAmount: 1000, maxAmount: 50000 },
  ore: { percent: 0.1, minAmount: 1000, maxAmount: 50000 },
  clay: { percent: 0.2, minAmount: 1, maxAmount: 10 },
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
export function assignDeposits(grid: MapGrid, seed: bigint, settings: DepositSettings = DEFAULT_DEPOSIT_SETTINGS): void {
  assertBands(settings);
  const waterSteps = distanceFrom(grid, (sample) => sample.terrain === "water");
  const land = grid.samples.filter((sample) => sample.terrain !== "water");
  const blocked = new Uint8Array(grid.samples.length);
  const target = (percent: number) => Math.round((land.length * percent) / 100);

  const clayTarget = target(settings.clay.percent);
  const nearClay = clayOptions(grid, seed, land, waterSteps).filter((sample) => withinNearWater(grid, waterSteps, sample));
  const farClay = clayOptions(grid, seed, land, waterSteps).filter((sample) => !withinNearWater(grid, waterSteps, sample));
  placeDeposits(grid, seed, "clay", clayTarget, settings.clay, nearClay, blocked);
  const nearPlaced = grid.samples.filter((sample) => sample.deposits[0]?.type === "clay").length;
  const farRoom = Math.min(Math.max(0, clayTarget - nearPlaced), Math.max(0, nearPlaced - 1));
  placeDeposits(grid, seed, "clay", farRoom, settings.clay, farClay, blocked);
  placeDeposits(grid, seed, "ore", target(settings.ore.percent), settings.ore, mineralOptions(seed, land), blocked);
  placeDeposits(grid, seed, "stone", target(settings.stone.percent), settings.stone, mineralOptions(seed, land), blocked);
}

function placeDeposits(
  grid: MapGrid,
  seed: bigint,
  type: DepositType,
  count: number,
  band: DepositBand,
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
    sample.deposits = [depositRecord(seed, sample, type, band)];
    closeAround(grid, blocked, sample);
    placed += 1;
  }
}

/** A seeded yield inside that deposit's min and max. The same tile and deposit always get the same amount. Growth stays mature. */
function depositRecord(seed: bigint, sample: Sample, type: DepositType, band: DepositBand): ResourceDeposit {
  const span = band.maxAmount - band.minAmount + 1;
  const amount = band.minAmount + (mixSeed(seed, `deposit-amount:${type}:${sample.x}:${sample.y}`) % span);
  return { type, amount, growthStage: DEPOSIT_GROWTH_STAGE };
}

function assertBands(settings: DepositSettings) {
  for (const band of [settings.stone, settings.ore, settings.clay]) {
    const amount = Number.isInteger(band.minAmount) && Number.isInteger(band.maxAmount) && band.minAmount <= band.maxAmount;
    if (!amount || band.percent < 0 || band.percent > 100) {
      throw new GenerationError("Deposit percent must be from 0 to 100, and minAmount and maxAmount must be whole numbers with minAmount at or below maxAmount.");
    }
  }
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
