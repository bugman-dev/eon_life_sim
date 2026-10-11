import { distanceFrom, type MapGrid, type Sample } from "./grid.js";
import { makeNoise, type NoiseField } from "./noise.js";
import { createStream } from "./prng.js";

/** How far the coastline noise shifts a sample, as a fraction of the shorter side. */
const COAST_WARP = 0.28;
/** Island radius in units of half the shorter side. 1 reaches the middle of each edge. */
const ISLAND_RADIUS = 1.05;
/** How much the coastline noise pushes that radius in or out. */
const RADIUS_SPREAD = 0.48;

const LAKES = [
  { x: 0.02, y: -0.22, scale: 0.16 },
  { x: -0.2, y: 0.16, scale: 0.055 },
] as const;

/**
 * Fills the rectangle with ocean, then raises one island, an optional islet, and two lakes.
 * The map border stays water so the island cannot touch the edge of the grid.
 */
export function buildIsland(seed: bigint, width: number, height: number): MapGrid {
  const span = Math.min(width, height);
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  const coast = makeNoise(seed, "coast", Math.max(8, Math.round(span / 5)), Math.max(4, Math.round(span / 14)));
  const samples: Sample[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const water = edge || outsideIsland(x, y, centerX, centerY, span, coast);
      samples.push(blankSample(x, y, water));
    }
  }

  const grid: MapGrid = { width, height, samples };
  addIslet(grid, seed, centerX, centerY, span, coast);
  carveLakes(grid, seed, centerX, centerY, span);
  return grid;
}

function blankSample(x: number, y: number, water: boolean): Sample {
  return {
    x,
    y,
    height: 0,
    coast: 0,
    terrain: water ? "water" : "grass",
    waterType: water ? "lake" : "none",
    deposits: [],
  };
}

/** True when the warped point sits outside the noisy island radius. */
function outsideIsland(x: number, y: number, centerX: number, centerY: number, span: number, coast: NoiseField): boolean {
  const warped = warp(x, y, span, coast);
  return distanceFromCenter(warped.x, warped.y, centerX, centerY, span) >= outlineRadius(warped.x, warped.y, coast);
}

/**
 * Places a small disk of land in open water, off one corner of the main island.
 * If every candidate overlaps the island or the border, no islet is added.
 */
function addIslet(grid: MapGrid, seed: bigint, centerX: number, centerY: number, span: number, coast: NoiseField): void {
  const stream = createStream(seed, "islet");
  const base = stream() * Math.PI * 2;
  const radius = Math.max(3, span * 0.04);
  let center: { x: number; y: number } | undefined;

  for (let turn = 0; turn < 8; turn += 1) {
    const angle = base + turn * (Math.PI / 4);
    const reach = span * 0.56;
    const x = centerX + Math.cos(angle) * reach;
    const y = centerY + Math.sin(angle) * reach;
    const warped = warp(x, y, span, coast);
    const dist = distanceFromCenter(warped.x, warped.y, centerX, centerY, span);
    const shore = outlineRadius(warped.x, warped.y, coast);
    const inset = x > radius + 1 && y > radius + 1 && x < grid.width - radius - 2 && y < grid.height - radius - 2;
    if (inset && dist > shore + 0.1) {
      center = { x, y };
      break;
    }
  }
  if (!center) {
    return;
  }

  for (const sample of grid.samples) {
    if (Math.hypot(sample.x - center.x, sample.y - center.y) < radius) {
      sample.terrain = "grass";
      sample.waterType = "none";
    }
  }
}

/**
 * Cuts a large northern lake and a smaller southern one into inland grass.
 * A lake that would open onto the ocean is left as land, so it cannot become a bay.
 */
function carveLakes(grid: MapGrid, seed: bigint, centerX: number, centerY: number, span: number): void {
  const inland = distanceFrom(grid, (sample) => sample.terrain === "water");
  const wobble = makeNoise(seed, "lake-edge", Math.max(6, Math.round(span / 10)), 4);
  const jitter = createStream(seed, "lake-jitter");

  for (const blob of LAKES) {
    const lakeX = centerX + (blob.x + (jitter() - 0.5) * 0.1) * span;
    const lakeY = centerY + (blob.y + (jitter() - 0.5) * 0.1) * span;
    const lakeRadius = span * blob.scale;
    for (let index = 0; index < grid.samples.length; index += 1) {
      const sample = grid.samples[index];
      if (!sample || sample.terrain === "water" || (inland[index] ?? 0) < lakeRadius) {
        continue;
      }
      const warpedX = sample.x + (wobble(sample.x, sample.y) - 0.5) * lakeRadius * 0.8;
      const warpedY = sample.y + (wobble(sample.y + 20, sample.x) - 0.5) * lakeRadius * 0.8;
      const dist = Math.hypot(warpedX - lakeX, warpedY - lakeY);
      const limit = lakeRadius * (0.62 + wobble(sample.x, sample.y) * 0.7);
      if (dist < limit) {
        sample.terrain = "water";
        sample.waterType = "lake";
      }
    }
  }
}

function warp(x: number, y: number, span: number, coast: NoiseField): { x: number; y: number } {
  return {
    x: x + (coast(x + span, y) - 0.5) * span * COAST_WARP,
    y: y + (coast(x, y + span) - 0.5) * span * COAST_WARP,
  };
}

function outlineRadius(x: number, y: number, coast: NoiseField): number {
  return ISLAND_RADIUS + (coast(x, y) - 0.5) * RADIUS_SPREAD;
}

function distanceFromCenter(x: number, y: number, centerX: number, centerY: number, span: number): number {
  const dx = (x - centerX) / (span * 0.5);
  const dy = (y - centerY) / (span * 0.5);
  return Math.hypot(dx, dy);
}
