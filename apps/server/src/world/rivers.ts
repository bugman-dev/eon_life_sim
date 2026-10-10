import { neighbors8, type MapGrid, type Sample } from "./grid.js";
import { makeNoise, type NoiseField } from "./noise.js";

/** Tiles a river may travel along one contour before it must move closer to the ocean. */
const CONTOUR_STEPS = 8;
/** Share of the path, from the source, that stays at the narrower width. */
const NARROW_UNTIL = 0.7;
/** Extra tiles painted on each side of the center line. The mouth uses the wider value. */
const NARROW_RADIUS = 1;
const WIDE_RADIUS = 2;
/** Maps smaller than this keep a one-tile channel so a tiny grid still has land. */
const MIN_SPAN_TO_WIDEN = 24;

/**
 * Cuts a few rivers from high ground down to a lake or the ocean, then widens them.
 * The channel is three tiles across, and five tiles across near the mouth.
 */
export function carveRivers(grid: MapGrid, seed: bigint): void {
  const span = Math.min(grid.width, grid.height);
  const wander = makeNoise(seed, "wander", Math.max(5, Math.round(span / 16)), 4);
  const land = grid.samples.filter((sample) => sample.terrain !== "water");
  const ranked = [...land].sort((left, right) => right.height - left.height || left.y - right.y || left.x - right.x);

  for (const start of riverSources(ranked, span, land.length)) {
    widenRiver(grid, traceRiver(grid, start, wander), span);
  }
}

/**
 * Highest land tiles, spaced apart, and only from the upper part of the height range.
 * The count shrinks on a small map so the rivers cannot erase the island.
 */
function riverSources(ranked: Sample[], span: number, landCount: number): Sample[] {
  const count = Math.min(Math.max(span < 32 ? 1 : 3, Math.round(span / 20)), Math.max(1, Math.floor(landCount / 12)));
  const spacing = span * 0.16;
  const peak = ranked[0]?.height ?? 0;
  const starts: Sample[] = [];

  for (const candidate of ranked) {
    if (starts.length >= count || candidate.height < peak * 0.62) {
      break;
    }
    if (starts.every((start) => Math.hypot(start.x - candidate.x, start.y - candidate.y) >= spacing)) {
      starts.push(candidate);
    }
  }
  return starts;
}

/**
 * Walks from `start` until the next step would enter water.
 * Noise picks the direction. The walk may follow a contour briefly, then it must descend.
 */
function traceRiver(grid: MapGrid, start: Sample, wander: NoiseField): Sample[] {
  const seen = new Set<string>();
  const path: Sample[] = [];
  let current = start;
  let sinceDrop = 0;

  for (let step = 0; step < grid.width + grid.height; step += 1) {
    if (current.terrain === "water") {
      break;
    }
    seen.add(`${current.x},${current.y}`);
    const options = neighbors8(grid, current.x, current.y)
      .map((point) => grid.samples[point.y * grid.width + point.x])
      .filter((sample): sample is Sample => sample !== undefined && !seen.has(`${sample.x},${sample.y}`));

    if (options.some((sample) => sample.terrain === "water")) {
      current.terrain = "water";
      current.waterType = "river";
      path.push(current);
      break;
    }

    const next = chooseStep(current, options, wander, sinceDrop);
    current.terrain = "water";
    current.waterType = "river";
    path.push(current);
    if (!next) {
      break;
    }
    sinceDrop = next.coast < current.coast ? 0 : sinceDrop + 1;
    current = next;
  }
  return path;
}

function chooseStep(current: Sample, options: Sample[], wander: NoiseField, sinceDrop: number): Sample | undefined {
  const landOptions = options.filter((sample) => sample.terrain !== "water");
  const dropping = landOptions.filter((sample) => sample.coast < current.coast);
  const pool = sinceDrop < CONTOUR_STEPS ? landOptions.filter((sample) => sample.coast <= current.coast) : dropping;
  const angle = wander(current.x, current.y) * Math.PI * 2;
  const preferX = Math.cos(angle);
  const preferY = Math.sin(angle);

  return (pool.length > 0 ? pool : dropping)
    .map((sample) => {
      const stepX = sample.x - current.x;
      const stepY = sample.y - current.y;
      const align = (stepX * preferX + stepY * preferY) / Math.hypot(stepX, stepY);
      return { sample, score: -align };
    })
    .sort((left, right) => left.score - right.score || left.sample.y - right.sample.y || left.sample.x - right.sample.x)[0]?.sample;
}

/**
 * Paints land on both sides of the center line.
 * The last stretch of the path uses a wider radius.
 */
function widenRiver(grid: MapGrid, path: Sample[], span: number): void {
  if (span < MIN_SPAN_TO_WIDEN || path.length === 0) {
    return;
  }

  for (let index = 0; index < path.length; index += 1) {
    const sample = path[index];
    if (!sample) {
      continue;
    }
    const progress = index / Math.max(1, path.length - 1);
    const radius = progress > NARROW_UNTIL ? WIDE_RADIUS : NARROW_RADIUS;
    const side = perpendicular(path, index, sample);
    for (const direction of [-1, 1]) {
      for (let step = 1; step <= radius; step += 1) {
        const x = sample.x + side.x * direction * step;
        const y = sample.y + side.y * direction * step;
        if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) {
          continue;
        }
        const other = grid.samples[y * grid.width + x];
        if (!other || other.terrain === "water") {
          continue;
        }
        other.terrain = "water";
        other.waterType = "river";
      }
    }
  }
}

function perpendicular(path: Sample[], index: number, sample: Sample): { x: number; y: number } {
  const before = path[Math.max(0, index - 1)] ?? sample;
  const after = path[Math.min(path.length - 1, index + 1)] ?? sample;
  let sideX = -(after.y - before.y);
  let sideY = after.x - before.x;
  const scale = Math.max(Math.abs(sideX), Math.abs(sideY));
  if (scale === 0) {
    return { x: 0, y: 1 };
  }
  return { x: Math.round(sideX / scale), y: Math.round(sideY / scale) };
}
