import { isBorder, neighbors4, type MapGrid } from "./grid.js";

/**
 * Marks ocean that touches the map border as coast, and every other water body as a lake.
 * Rivers are not present yet. A later stage overwrites some water with river.
 */
export function labelWater(grid: MapGrid): void {
  const seen = new Uint8Array(grid.samples.length);
  const queue: number[] = [];

  for (const sample of grid.samples) {
    if (sample.terrain !== "water") {
      sample.waterType = "none";
      continue;
    }
    const edge = isBorder(grid, sample.x, sample.y);
    sample.waterType = edge ? "coast" : "lake";
    if (edge) {
      const index = sample.y * grid.width + sample.x;
      seen[index] = 1;
      queue.push(index);
    }
  }

  while (queue.length > 0) {
    const index = queue.pop();
    if (index === undefined) {
      break;
    }
    const sample = grid.samples[index];
    if (!sample) {
      continue;
    }
    for (const point of neighbors4(grid, sample.x, sample.y)) {
      const next = point.y * grid.width + point.x;
      const other = grid.samples[next];
      if (!other || other.terrain !== "water" || other.waterType === "coast" || seen[next]) {
        continue;
      }
      other.waterType = "coast";
      seen[next] = 1;
      queue.push(next);
    }
  }
}

/** Turns a lone water tile that is not a river back into grass. */
export function removeIsolatedWater(grid: MapGrid): void {
  const clear = grid.samples.filter((sample) => {
    if (sample.terrain !== "water" || sample.waterType === "river") {
      return false;
    }
    return !neighbors4(grid, sample.x, sample.y).some((point) => {
      return grid.samples[point.y * grid.width + point.x]?.terrain === "water";
    });
  });

  for (const sample of clear) {
    sample.terrain = "grass";
    sample.waterType = "none";
    sample.height = 0.05;
  }
}

/** Turns a land tile whose four neighbors are water into the water beside it. */
export function fillEnclosedLand(grid: MapGrid): void {
  const fill = grid.samples.filter((sample) => {
    if (sample.terrain === "water") {
      return false;
    }
    const around = neighbors4(grid, sample.x, sample.y);
    return around.length > 0 && around.every((point) => grid.samples[point.y * grid.width + point.x]?.terrain === "water");
  });

  for (const sample of fill) {
    const besideCoast = neighbors4(grid, sample.x, sample.y).some((point) => {
      return grid.samples[point.y * grid.width + point.x]?.waterType === "coast";
    });
    sample.terrain = "water";
    sample.waterType = besideCoast ? "coast" : "lake";
    sample.height = 0;
  }
}
