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

/** Share of the tree target placed on sand. */
const TREE_SAND_SHARE = 0.15;
/** Share of the tree target placed on dirt, the clay ground. */
const TREE_DIRT_SHARE = 0.05;
/** Rolls below this are new trees. The next band is growing. The rest are mature. */
const TREE_STAGE_NEW = 15;
const TREE_STAGE_GROWING = 30;

/**
 * Places one plant on a tile, up to each percent of the land.
 * Trees sit mostly on grass, rarely on sand, and least often on dirt.
 * Shrubs, flowers, and grass tufts sit only on grass. Water stays empty.
 * A target that cannot fit is filled only as far as the open tiles allow.
 */
export function assignVegetation(grid: MapGrid, seed: bigint, settings: VegetationSettings = DEFAULT_VEGETATION_SETTINGS): void {
  assertSettings(settings);
  const land = grid.samples.filter((sample) => sample.terrain !== "water");
  const target = (percent: number) => Math.round((land.length * percent) / 100);
  const treeTarget = target(settings.tree.percent);
  const dirtCount = Math.floor(treeTarget * TREE_DIRT_SHARE);
  const sandCount = Math.floor(treeTarget * TREE_SAND_SHARE);
  const grassCount = treeTarget - dirtCount - sandCount;

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
