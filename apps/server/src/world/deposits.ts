import type { DepositType } from "@life-simulator/shared";
import { distanceFrom, sampleAt, type MapGrid, type Sample } from "./grid.js";
import { mixSeed } from "./prng.js";

/** Candidate slots. One cell holds at most one deposit. */
const CELL = 6;
/** Chebyshev steps required between two deposits, so piles do not sit on neighboring tiles. */
const MIN_GAP = 3;
/** Chance a cell is left empty, so the scatter is not a perfect lattice. */
const CELL_SKIP = 0.28;
/** Dirt this close to water is the usual place for clay. */
const NEAR_WATER_STEPS = 12;
const CLAY_NEAR_CHANCE = 0.85;
const CLAY_FAR_CHANCE = 0.15;
/** Share of grass placements that are ore instead of stone. */
const ORE_ON_GRASS = 0.18;
/** Sand and dirt receive a mineral less often, and ore less often still. */
const MINERAL_WITHOUT_GRASS = 0.3;
const ORE_ELSEWHERE = 0.08;

/**
 * Scatters one static deposit across the land.
 * Stone and ore can sit on any land, and most of them sit on grass.
 * Clay sits only on dirt, and most of it sits near a water body.
 * A tile keeps a single deposit, and deposits stay a few tiles apart. Water stays empty.
 */
export function assignDeposits(grid: MapGrid, seed: bigint): void {
  const waterSteps = distanceFrom(grid, (sample) => sample.terrain === "water");
  const blocked = new Uint8Array(grid.samples.length);
  const cells = cellOrder(grid, seed);

  for (const cell of cells) {
    const plan = planCell(grid, seed, cell.x, cell.y, waterSteps);
    if (!plan) {
      continue;
    }
    const sample = plan.options.find((option) => blocked[indexOf(grid, option)] === 0);
    if (!sample) {
      continue;
    }
    sample.deposits = [plan.type];
    closeAround(grid, blocked, sample);
  }
}

function cellOrder(grid: MapGrid, seed: bigint) {
  const cells: { x: number; y: number; rank: number }[] = [];
  for (let y = 0; y < grid.height; y += CELL) {
    for (let x = 0; x < grid.width; x += CELL) {
      cells.push({ x, y, rank: mixSeed(seed, `deposit-cell:${x}:${y}`) });
    }
  }
  cells.sort((a, b) => b.rank - a.rank || a.y - b.y || a.x - b.x);
  return cells;
}

/** Decides which deposit a cell wants, and the tiles it may use, best first. */
function planCell(
  grid: MapGrid,
  seed: bigint,
  cellX: number,
  cellY: number,
  waterSteps: Int16Array,
): { type: DepositType; options: Sample[] } | undefined {
  if (unit(seed, `deposit-keep:${cellX}:${cellY}`) < CELL_SKIP) {
    return undefined;
  }

  const land = tilesInCell(grid, cellX, cellY);
  if (land.length === 0) {
    return undefined;
  }

  const dirt = land.filter((sample) => sample.terrain === "dirt");
  const near = dirt.filter((sample) => withinNearWater(grid, waterSteps, sample));
  const kind = unit(seed, `deposit-kind:${cellX}:${cellY}`);
  if (near.length > 0 && kind < CLAY_NEAR_CHANCE) {
    return { type: "clay", options: byWaterThenHash(grid, seed, near, waterSteps) };
  }
  if (near.length === 0 && dirt.length > 0 && kind < CLAY_FAR_CHANCE) {
    return { type: "clay", options: byHash(seed, dirt) };
  }

  const grass = land.filter((sample) => sample.terrain === "grass");
  const elsewhere = land.filter((sample) => sample.terrain !== "grass");
  if (grass.length > 0) {
    return { type: mineralType(seed, cellX, cellY, true), options: byHash(seed, grass) };
  }
  if (elsewhere.length > 0 && unit(seed, `deposit-elsewhere:${cellX}:${cellY}`) < MINERAL_WITHOUT_GRASS) {
    return { type: mineralType(seed, cellX, cellY, false), options: byHash(seed, elsewhere) };
  }
  return undefined;
}

function mineralType(seed: bigint, cellX: number, cellY: number, grass: boolean): DepositType {
  const cut = grass ? ORE_ON_GRASS : ORE_ELSEWHERE;
  return unit(seed, `deposit-ore:${cellX}:${cellY}`) < cut ? "ore" : "stone";
}

function tilesInCell(grid: MapGrid, cellX: number, cellY: number) {
  const found: Sample[] = [];
  const xEnd = Math.min(grid.width, cellX + CELL);
  const yEnd = Math.min(grid.height, cellY + CELL);
  for (let y = cellY; y < yEnd; y += 1) {
    for (let x = cellX; x < xEnd; x += 1) {
      const sample = sampleAt(grid, x, y);
      if (sample && sample.terrain !== "water") {
        found.push(sample);
      }
    }
  }
  return found;
}

function withinNearWater(grid: MapGrid, waterSteps: Int16Array, sample: Sample) {
  const steps = waterSteps[indexOf(grid, sample)] ?? -1;
  return steps > 0 && steps <= NEAR_WATER_STEPS;
}

/** Closest dirt first, so clay gathers beside water. A hash breaks ties. */
function byWaterThenHash(grid: MapGrid, seed: bigint, samples: Sample[], waterSteps: Int16Array) {
  return [...samples].sort((a, b) => {
    const steps = (waterSteps[indexOf(grid, a)] ?? 99) - (waterSteps[indexOf(grid, b)] ?? 99);
    if (steps !== 0) {
      return steps;
    }
    return mixSeed(seed, `deposit-pick:${b.x}:${b.y}`) - mixSeed(seed, `deposit-pick:${a.x}:${a.y}`);
  });
}

function byHash(seed: bigint, samples: Sample[]) {
  return [...samples].sort(
    (a, b) => mixSeed(seed, `deposit-pick:${b.x}:${b.y}`) - mixSeed(seed, `deposit-pick:${a.x}:${a.y}`),
  );
}

function closeAround(grid: MapGrid, blocked: Uint8Array, sample: Sample) {
  const radius = MIN_GAP - 1;
  for (let y = sample.y - radius; y <= sample.y + radius; y += 1) {
    for (let x = sample.x - radius; x <= sample.x + radius; x += 1) {
      if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) {
        continue;
      }
      blocked[y * grid.width + x] = 1;
    }
  }
}

function indexOf(grid: MapGrid, sample: Sample) {
  return sample.y * grid.width + sample.x;
}

function unit(seed: bigint, stage: string) {
  return mixSeed(seed, stage) / 4294967296;
}
