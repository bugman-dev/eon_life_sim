import { distanceFrom, type MapGrid } from "./grid.js";
import { makeNoise } from "./noise.js";

/** Grass this close to fresh water stays grass, even inside a dry patch. */
const MOIST_STEPS = 8;
/** Noise above this, and beyond the moist band, becomes a dirt patch. */
const DRY_ABOVE = 0.74;

/**
 * Paints a sandy shore on grass facing the ocean.
 * The beach is two to eight tiles wide and follows the shore noise.
 */
export function assignCoastSand(grid: MapGrid, seed: bigint): void {
  const shore = makeNoise(seed, "shore", 5, 3);
  const distance = distanceFrom(grid, (sample) => sample.waterType === "coast");

  for (let index = 0; index < grid.samples.length; index += 1) {
    const sample = grid.samples[index];
    const steps = distance[index] ?? -1;
    if (!sample || sample.terrain !== "grass" || steps <= 0) {
      continue;
    }
    const beachWidth = 2 + Math.round(shore(sample.x, sample.y) * 6);
    if (steps <= beachWidth) {
      sample.terrain = "sand";
    }
  }
}

/**
 * Turns a few inland grass tiles into dirt.
 * The patches are the dry peaks of the noise, not a ring around the whole island.
 */
export function assignDryLand(grid: MapGrid, seed: bigint): void {
  const span = Math.min(grid.width, grid.height);
  const dry = makeNoise(seed, "dry", Math.max(10, Math.round(span / 8)), 5);
  const distance = distanceFrom(grid, (sample) => sample.waterType === "river" || sample.waterType === "lake");

  for (let index = 0; index < grid.samples.length; index += 1) {
    const sample = grid.samples[index];
    const steps = distance[index] ?? -1;
    if (!sample || sample.terrain !== "grass" || steps <= MOIST_STEPS) {
      continue;
    }
    if (dry(sample.x, sample.y) > DRY_ABOVE) {
      sample.terrain = "dirt";
    }
  }
}
