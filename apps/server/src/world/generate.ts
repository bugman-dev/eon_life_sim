import {
  DEFAULT_WORLD_SIZE,
  MAX_WORLD_SIZE,
  MIN_WORLD_SIZE,
  WORLD_GENERATION_VERSION,
  WORLD_TILE_SIZE,
  type TerrainType,
  type WorldTile,
} from "@life-simulator/shared";
import { createStream } from "./prng.js";

export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationError";
  }
}

export type GeneratedWorld = {
  seed: bigint;
  generationVersion: typeof WORLD_GENERATION_VERSION;
  width: number;
  height: number;
  tileSize: typeof WORLD_TILE_SIZE;
  tiles: WorldTile[];
};

const MIN_WATER = 0.12;
const MAX_WATER = 0.4;
const WATER_BELOW = 0.38;
const DIRT_BELOW = 0.58;

type Sample = {
  x: number;
  y: number;
  roll: number;
  terrain: TerrainType;
};

export function generateWorld(input: { seed: bigint; width?: number; height?: number }): GeneratedWorld {
  const width = input.width ?? DEFAULT_WORLD_SIZE;
  const height = input.height ?? DEFAULT_WORLD_SIZE;
  assertDimensions(width, height);

  const cover = makeNoise(input.seed, "terrain", 18, 7);
  const samples: Sample[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const roll = cover(x, y);
      samples.push({ x, y, roll, terrain: roll < WATER_BELOW ? "water" : "grass" });
    }
  }

  balanceWater(samples);
  assignShoresAndDirt(samples, width, height);

  const tiles = samples.map((sample) => toTile(sample));
  const world: GeneratedWorld = {
    seed: input.seed,
    generationVersion: WORLD_GENERATION_VERSION,
    width,
    height,
    tileSize: WORLD_TILE_SIZE,
    tiles,
  };
  assertWorld(world);
  return world;
}

function assertDimensions(width: number, height: number) {
  if (!Number.isInteger(width) || width < MIN_WORLD_SIZE || width > MAX_WORLD_SIZE) {
    throw new GenerationError(`Width must be an integer from ${MIN_WORLD_SIZE} to ${MAX_WORLD_SIZE}.`);
  }
  if (!Number.isInteger(height) || height < MIN_WORLD_SIZE || height > MAX_WORLD_SIZE) {
    throw new GenerationError(`Height must be an integer from ${MIN_WORLD_SIZE} to ${MAX_WORLD_SIZE}.`);
  }
}

function balanceWater(samples: Sample[]) {
  const ordered = [...samples].sort((left, right) => left.roll - right.roll || left.y - right.y || left.x - right.x);
  const minimum = Math.floor(samples.length * MIN_WATER);
  const maximum = Math.floor(samples.length * MAX_WATER);
  let water = samples.filter((sample) => sample.terrain === "water").length;

  for (const sample of ordered) {
    if (water >= minimum) {
      break;
    }
    if (sample.terrain !== "water") {
      sample.terrain = "water";
      water += 1;
    }
  }

  for (let index = ordered.length - 1; index >= 0 && water > maximum; index -= 1) {
    const sample = ordered[index];
    if (sample?.terrain === "water") {
      sample.terrain = "grass";
      water -= 1;
    }
  }
}

function assignShoresAndDirt(samples: Sample[], width: number, height: number) {
  const water = samples.map((sample) => sample.terrain === "water");
  for (const sample of samples) {
    if (sample.terrain === "water") {
      continue;
    }
    const shore = neighbors(sample.x, sample.y, width, height).some((point) => water[point.y * width + point.x]);
    if (shore) {
      sample.terrain = "sand";
    } else if (sample.roll < DIRT_BELOW) {
      sample.terrain = "dirt";
    } else {
      sample.terrain = "grass";
    }
  }
}

function toTile(sample: Sample): WorldTile {
  const water = sample.terrain === "water";
  return {
    x: sample.x,
    y: sample.y,
    terrainType: sample.terrain,
    elevation: 0,
    waterType: water ? "lake" : "none",
    soilType: water ? "poor" : "normal",
    fertility: 0,
    vegetationType: "none",
    vegetationDensity: 0,
    deposits: [],
  };
}

export function assertWorld(world: GeneratedWorld) {
  if (world.generationVersion !== WORLD_GENERATION_VERSION) {
    throw new GenerationError("Generation version is not supported.");
  }
  if (world.tiles.length !== world.width * world.height) {
    throw new GenerationError("Tile count must equal width × height.");
  }

  const seen = new Set<string>();
  let water = 0;
  let land = 0;
  for (const tile of world.tiles) {
    const key = `${tile.x},${tile.y}`;
    if (tile.x < 0 || tile.y < 0 || tile.x >= world.width || tile.y >= world.height || seen.has(key)) {
      throw new GenerationError("Tile coordinates must be unique and inside the map.");
    }
    seen.add(key);
    if (tile.elevation !== 0 || tile.fertility !== 0 || tile.vegetationDensity !== 0) {
      throw new GenerationError("Elevation, fertility, and vegetation are not generated yet.");
    }
    if (tile.vegetationType !== "none" || tile.deposits.length > 0) {
      throw new GenerationError("Resources are not generated yet.");
    }
    if ((tile.terrainType === "water") !== (tile.waterType !== "none")) {
      throw new GenerationError("Water and land attributes disagree.");
    }
    if (tile.terrainType === "water") {
      water += 1;
    } else {
      land += 1;
    }
  }

  if (water === 0 || land === 0) {
    throw new GenerationError("The map must contain both land and water.");
  }
}

function makeNoise(seed: bigint, stage: string, coarse: number, fine: number) {
  const low = latticeNoise(seed, stage, coarse);
  const high = latticeNoise(seed, `${stage}-detail`, fine);
  return (x: number, y: number) => clamp01(low(x, y) * 0.75 + high(x, y) * 0.25);
}

function latticeNoise(seed: bigint, stage: string, cell: number) {
  const cache = new Map<string, number>();
  const at = (ix: number, iy: number) => {
    const key = `${ix},${iy}`;
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const value = createStream(seed, `${stage}:${ix}:${iy}`)();
    cache.set(key, value);
    return value;
  };

  return (x: number, y: number) => {
    const x0 = Math.floor(x / cell);
    const y0 = Math.floor(y / cell);
    const tx = smooth(x / cell - x0);
    const ty = smooth(y / cell - y0);
    const a = lerp(at(x0, y0), at(x0 + 1, y0), tx);
    const b = lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx);
    return lerp(a, b, ty);
  };
}

function neighbors(x: number, y: number, width: number, height: number) {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ].filter((point) => point.x >= 0 && point.y >= 0 && point.x < width && point.y < height);
}

function smooth(value: number) {
  return value * value * (3 - 2 * value);
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
