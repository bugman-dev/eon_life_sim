import type { TerrainType, WaterType } from "@life-simulator/shared";

/**
 * The mutable grid each generation stage reads and updates.
 * Tiles are stored in row-major order, y then x.
 */

export type Sample = {
  x: number;
  y: number;
  /** Temporary height used to place rivers. It is not stored on the finished tile. */
  height: number;
  /** Steps of land from the ocean. Lakes cost nothing to cross. */
  coast: number;
  terrain: TerrainType;
  waterType: WaterType;
};

export type MapGrid = {
  readonly width: number;
  readonly height: number;
  readonly samples: Sample[];
};

export type GridPoint = {
  x: number;
  y: number;
};

/** True for the outer ring of the map. That ring is always ocean. */
export function isBorder(grid: MapGrid, x: number, y: number): boolean {
  return x === 0 || y === 0 || x === grid.width - 1 || y === grid.height - 1;
}

/** The sample at a tile, or undefined when the point is outside the map. */
export function sampleAt(grid: MapGrid, x: number, y: number): Sample | undefined {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) {
    return undefined;
  }
  return grid.samples[y * grid.width + x];
}

/** The four tiles that share an edge, in the order right, left, down, up. */
export function neighbors4(grid: MapGrid, x: number, y: number): GridPoint[] {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ].filter((point) => point.x >= 0 && point.y >= 0 && point.x < grid.width && point.y < grid.height);
}

/** The eight surrounding tiles. Corner tiles come before edge tiles in each row. */
export function neighbors8(grid: MapGrid, x: number, y: number): GridPoint[] {
  const points: GridPoint[] = [];
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      if (offsetX === 0 && offsetY === 0) {
        continue;
      }
      const nextX = x + offsetX;
      const nextY = y + offsetY;
      if (nextX < 0 || nextY < 0 || nextX >= grid.width || nextY >= grid.height) {
        continue;
      }
      points.push({ x: nextX, y: nextY });
    }
  }
  return points;
}

/**
 * Steps across land, starting from every tile where `source` is true.
 * Water is not entered. Unreached tiles stay -1.
 */
export function distanceFrom(grid: MapGrid, source: (sample: Sample) => boolean): Int16Array {
  const distance = new Int16Array(grid.samples.length).fill(-1);
  const queue: number[] = [];
  for (let index = 0; index < grid.samples.length; index += 1) {
    const sample = grid.samples[index];
    if (sample && source(sample)) {
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
      if (distance[next] !== -1) {
        continue;
      }
      const other = grid.samples[next];
      if (!other || other.terrain === "water") {
        continue;
      }
      distance[next] = (distance[index] ?? 0) + 1;
      queue.push(next);
    }
  }
  return distance;
}
