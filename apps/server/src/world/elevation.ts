import { neighbors4, type MapGrid } from "./grid.js";
import { makeNoise } from "./noise.js";

/** How strongly the relief noise lifts or lowers a tile around its coast distance. */
const RELIEF = 8;

/**
 * Sets each land tile's coast distance and a temporary height.
 * Ocean is the source. Crossing a lake does not add distance, so land beyond a lake stays low.
 */
export function assignElevation(grid: MapGrid, seed: bigint): void {
  const distance = coastDistance(grid);
  const relief = makeNoise(seed, "relief", 6, 3);

  for (let index = 0; index < grid.samples.length; index += 1) {
    const sample = grid.samples[index];
    const here = distance[index] ?? Number.POSITIVE_INFINITY;
    if (!sample || sample.terrain === "water" || !Number.isFinite(here)) {
      continue;
    }
    sample.coast = here;
    sample.height = here + (relief(sample.x, sample.y) - 0.5) * RELIEF;
  }
}

/**
 * Breadth-first distance from coast water.
 * A step onto water costs 0, so the first visit wins when two paths are equal.
 */
function coastDistance(grid: MapGrid): Float64Array {
  const distance = new Float64Array(grid.samples.length).fill(Number.POSITIVE_INFINITY);
  const queue: number[] = [];
  for (let index = 0; index < grid.samples.length; index += 1) {
    if (grid.samples[index]?.waterType === "coast") {
      distance[index] = 0;
      queue.push(index);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const index = queue[head];
    head += 1;
    const sample = grid.samples[index];
    if (!sample) {
      continue;
    }
    for (const point of neighbors4(grid, sample.x, sample.y)) {
      const next = point.y * grid.width + point.x;
      const other = grid.samples[next];
      if (!other) {
        continue;
      }
      const step = other.terrain === "water" ? 0 : 1;
      const nextDistance = (distance[index] ?? 0) + step;
      if (nextDistance < (distance[next] ?? Number.POSITIVE_INFINITY)) {
        distance[next] = nextDistance;
        queue.push(next);
      }
    }
  }
  return distance;
}
