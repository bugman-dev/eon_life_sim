import { DEFAULT_WORLD_SIZE, WORLD_GENERATION_VERSION, WORLD_TILE_SIZE, type WorldTile } from "@life-simulator/shared";
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
};

/**
 * Builds a seeded island of grass, dirt, sand, and water.
 * The same seed and size always produce the same tiles.
 * Stored elevation stays 0. Vegetation and deposits stay empty.
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

  const world: GeneratedWorld = {
    seed: input.seed,
    generationVersion: WORLD_GENERATION_VERSION,
    width,
    height,
    tileSize: WORLD_TILE_SIZE,
    tiles: grid.samples.map((sample) => toTile(sample)),
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
    vegetationType: "none",
    vegetationDensity: 0,
    deposits: [],
  };
}
