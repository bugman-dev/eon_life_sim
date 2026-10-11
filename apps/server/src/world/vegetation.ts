import { DEPOSIT_GROWTH_STAGE, hashTile, type VegetationItem, type VegetationType } from "@life-simulator/shared";
import type { MapGrid, Sample } from "./grid.js";
import { GenerationError } from "./validate.js";

/** Trees have a harvestable amount. The other plants are placed by percent only. */
export type TreeBand = {
  percent: number;
  minAmount: number;
  maxAmount: number;
};

export type PlantBand = {
  percent: number;
};

/** Plant settings from the vegitation section of worldConfig.json. */
export type VegetationSettings = {
  tree: TreeBand;
  shrubs: PlantBand;
  flowers: PlantBand;
  grass: PlantBand;
};

/** Matches worldConfig.json. Callers that omit a config use these settings. */
export const DEFAULT_VEGETATION_SETTINGS: VegetationSettings = {
  tree: { percent: 0.1, minAmount: 10, maxAmount: 100 },
  shrubs: { percent: 0.1 },
  flowers: { percent: 0.1 },
  grass: { percent: 0.1 },
};

/**
 * How many trees sit on sand when the tree percent is 90. Lower percents scale down.
 * 1.5 means one or two trees at 90, and usually none at a small percent.
 */
const SAND_TREES_AT_90 = 1.5;
/** Dirt stays below sand. At a tree percent of 90 this is zero or one tree. */
const DIRT_TREES_AT_90 = 0.5;
/** Rolls below this are new trees. The next band is growing. The rest are mature. */
const TREE_STAGE_NEW = 15;
const TREE_STAGE_GROWING = 30;

/**
 * Places one plant on a tile, up to each percent of the land.
 * Trees sit on grass. Sand gets about one or two when the percent is 90, and dirt gets fewer than that.
 * Shrubs, flowers, and grass tufts sit only on grass. Water stays empty.
 * A target that cannot fit is filled only as far as the open tiles allow.
 */
export function assignVegetation(grid: MapGrid, seed: bigint, settings: VegetationSettings = DEFAULT_VEGETATION_SETTINGS): void {
  assertSettings(settings);
  const land = grid.samples.filter((sample) => sample.terrain !== "water");
  const target = (percent: number) => Math.round((land.length * percent) / 100);
  const treeTarget = target(settings.tree.percent);
  const sandCount = rareTreeCount(seed, "tree-sand", settings.tree.percent, SAND_TREES_AT_90);
  const dirtCount = Math.min(sandCount, rareTreeCount(seed, "tree-dirt", settings.tree.percent, DIRT_TREES_AT_90));
  const grassCount = Math.max(0, treeTarget - sandCount - dirtCount);

  placeTrees(seed, settings.tree, byHash(seed, land.filter((sample) => sample.terrain === "grass"), "tree"), grassCount);
  placeTrees(seed, settings.tree, byHash(seed, land.filter((sample) => sample.terrain === "sand"), "tree"), sandCount);
  placeTrees(seed, settings.tree, byHash(seed, land.filter((sample) => sample.terrain === "dirt"), "tree"), dirtCount);

  const grass = byHash(seed, land.filter((sample) => sample.terrain === "grass"), "cover");
  placeCover(grass, "shrubs", target(settings.shrubs.percent));
  placeCover(grass, "flowers", target(settings.flowers.percent));
  placeCover(grass, "grass", target(settings.grass.percent));
}

function placeTrees(seed: bigint, band: TreeBand, options: Sample[], count: number) {
  let placed = 0;
  for (const sample of options) {
    if (placed >= count) {
      return;
    }
    if (sample.vegitation.length > 0) {
      continue;
    }
    sample.vegitation = [treeRecord(seed, sample, band)];
    placed += 1;
  }
}

function placeCover(options: Sample[], type: Exclude<VegetationType, "tree">, count: number) {
  let placed = 0;
  for (const sample of options) {
    if (placed >= count) {
      return;
    }
    if (sample.vegitation.length > 0 || sample.terrain !== "grass") {
      continue;
    }
    sample.vegitation = [{ type, amount: 0, growthStage: DEPOSIT_GROWTH_STAGE }];
    placed += 1;
  }
}

/** A seeded count that scales with the tree percent. The same seed always picks the same count. */
function rareTreeCount(seed: bigint, label: string, percent: number, atNinety: number) {
  const expected = (percent / 90) * atNinety;
  const whole = Math.floor(expected);
  const fraction = expected - whole;
  const roll = hashTile(seed, label, 0, 0) / 4294967296;
  return whole + (roll < fraction ? 1 : 0);
}

/** A seeded yield inside the tree range. Most trees are mature. The same tile always gets the same record. */
function treeRecord(seed: bigint, sample: Sample, band: TreeBand): VegetationItem {
  const span = band.maxAmount - band.minAmount + 1;
  const amount = band.minAmount + (hashTile(seed, "vegitation-amount:tree", sample.x, sample.y) % span);
  const roll = hashTile(seed, "vegitation-stage:tree", sample.x, sample.y) % 100;
  const growthStage = roll < TREE_STAGE_NEW ? 1 : roll < TREE_STAGE_GROWING ? 2 : 3;
  return { type: "tree", amount, growthStage };
}

/** Orders tiles by a coordinate hash so the first picks are scattered, not lined up. */
function byHash(seed: bigint, samples: Sample[], kind: string) {
  return [...samples].sort((a, b) => hashTile(seed, `vegitation-pick:${kind}`, a.x, a.y) - hashTile(seed, `vegitation-pick:${kind}`, b.x, b.y) || a.x - b.x || a.y - b.y);
}

function assertSettings(settings: VegetationSettings) {
  const bands = [settings.tree, settings.shrubs, settings.flowers, settings.grass];
  for (const band of bands) {
    if (band.percent < 0 || band.percent > 100) {
      throw new GenerationError("Vegetation percent must be from 0 to 100.");
    }
  }
  const trees = settings.tree;
  if (!Number.isInteger(trees.minAmount) || !Number.isInteger(trees.maxAmount) || trees.minAmount > trees.maxAmount) {
    throw new GenerationError("Tree minAmount and maxAmount must be whole numbers with minAmount at or below maxAmount.");
  }
}
