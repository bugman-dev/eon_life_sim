import { DEFAULT_WORLD_SIZE, WORLD_GENERATION_VERSION, WORLD_TILE_SIZE, type WorldTile } from "@life-simulator/shared";
import { DEFAULT_ANIMAL_SETTINGS, spawnRabbits, type AnimalSettings } from "./animals.js";
import { assignDeposits, DEFAULT_DEPOSIT_SETTINGS, type DepositSettings } from "./deposits.js";
import { assignVegetation, DEFAULT_VEGETATION_SETTINGS, type VegetationSettings } from "./vegetation.js";
import { assignElevation } from "./elevation.js";
import type { Sample } from "./grid.js";
import { buildIsland } from "./island.js";
import { carveRivers } from "./rivers.js";
import { assignCoastSand, assignDryLand } from "./surface.js";
import { assertDimensions, assertWorld, type GeneratedWorld } from "./validate.js";
import { fillEnclosedLand, labelWater, removeIsolatedWater } from "./water.js";

export { GenerationError, assertWorld } from "./validate.js";
export type { GeneratedWorld } from "./validate.js";

export type GenerateWorldInput = {
  seed: bigint;
  width?: number;
  height?: number;
  /** How many stone, ore, and clay piles to place, and the amount range for each. Omitted calls use the shipped defaults. */
  deposits?: DepositSettings;
  /** How many trees, shrubs, flowers, and grass tufts to place. Omitted calls use the shipped defaults. */
  vegitation?: VegetationSettings;
  /** How many rabbits to place. Omitted calls place none. */
  animals?: AnimalSettings;
};

/**
 * Builds a seeded island of grass, dirt, sand, and water.
 * The same seed and size always produce the same tiles.
 * Stored elevation stays 0.
 * Stone, ore, and clay are static deposits. How many piles appear is a percent of the land.
 * Each pile stores a harvestable amount inside that deposit's configured range, and a mature growth stage.
 * Trees, shrubs, flowers, and grass tufts are one plant per tile. Only trees store a harvestable amount.
 */
export function generateWorld(input: GenerateWorldInput): GeneratedWorld {
  const width = input.width ?? DEFAULT_WORLD_SIZE;
  const height = input.height ?? DEFAULT_WORLD_SIZE;
  assertDimensions(width, height);

  const grid = buildIsland(input.seed, width, height);
  labelWater(grid);
  assignElevation(grid, input.seed);
  carveRivers(grid, input.seed);
  removeIsolatedWater(grid);
  fillEnclosedLand(grid);
  assignCoastSand(grid, input.seed);
  assignDryLand(grid, input.seed);
  assignDeposits(grid, input.seed, input.deposits ?? DEFAULT_DEPOSIT_SETTINGS);
  assignVegetation(grid, input.seed, input.vegitation ?? DEFAULT_VEGETATION_SETTINGS);

  const tiles = grid.samples.map((sample) => toTile(sample));
  const animals = input.animals ?? DEFAULT_ANIMAL_SETTINGS;
  const world: GeneratedWorld = {
    seed: input.seed,
    generationVersion: WORLD_GENERATION_VERSION,
    width,
    height,
    tileSize: WORLD_TILE_SIZE,
    tiles,
    animals: spawnRabbits(tiles, input.seed, animals.rabbit.count),
  };
  assertWorld(world);
  return world;
}

/** Copies a working sample into the tile stored and sent to the client. */
function toTile(sample: Sample): WorldTile {
  const water = sample.terrain === "water";
  return {
    x: sample.x,
    y: sample.y,
    terrainType: sample.terrain,
    elevation: 0,
    waterType: water ? sample.waterType : "none",
    soilType: water ? "poor" : "normal",
    fertility: 0,
    vegitation: [...sample.vegitation],
    deposits: [...sample.deposits],
  };
}
