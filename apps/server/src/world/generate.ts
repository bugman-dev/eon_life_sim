import {
  DEFAULT_WORLD_SIZE,
  MAX_WORLD_SIZE,
  MIN_WORLD_SIZE,
  WORLD_GENERATION_VERSION,
  WORLD_TILE_SIZE,
  type DepositType,
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

export function generateWorld(input: { seed: bigint; width?: number; height?: number }): GeneratedWorld {
  const width = input.width ?? DEFAULT_WORLD_SIZE;
  const height = input.height ?? DEFAULT_WORLD_SIZE;
  assertDimensions(width, height);

  const elevationAt = makeNoise(input.seed, "elevation", 16, 8);
  const tiles: WorldTile[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const elevation = round4(elevationAt(x, y));
      tiles.push(blankTile(x, y, elevation));
    }
  }

  classifyWater(tiles, width);
  balanceWater(tiles);
  assignCoast(tiles, width, height);
  carveRiver(tiles, width, height);
  classifyLand(tiles);
  assignSoil(tiles, input.seed);
  assignVegetation(tiles, input.seed);
  assignDeposits(tiles, input.seed, width, height);
  clearWaterFeatures(tiles);

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

function blankTile(x: number, y: number, elevation: number): WorldTile {
  return {
    x,
    y,
    terrainType: "grassland",
    elevation,
    waterType: "none",
    soilType: "normal",
    fertility: 50,
    vegetationType: "none",
    vegetationDensity: 0,
    deposits: [],
  };
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

function classifyWater(tiles: WorldTile[], width: number) {
  for (const tile of tiles) {
    const nx = tile.x / Math.max(1, width - 1) - 0.5;
    const shaped = clamp01(tile.elevation * 0.8 + 0.18 - Math.abs(nx) * 0.22);
    tile.elevation = round4(shaped);
    if (shaped < 0.34) {
      tile.terrainType = "deep_water";
      tile.waterType = "lake";
    } else if (shaped < 0.44) {
      tile.terrainType = "shallow_water";
      tile.waterType = "lake";
    } else {
      tile.terrainType = "grassland";
      tile.waterType = "none";
    }
  }
}

function balanceWater(tiles: WorldTile[]) {
  const ordered = [...tiles].sort((left, right) => left.elevation - right.elevation || left.y - right.y || left.x - right.x);
  const minimum = Math.floor(tiles.length * MIN_WATER);
  const maximum = Math.floor(tiles.length * MAX_WATER);
  let water = tiles.filter((tile) => isWaterTerrain(tile.terrainType)).length;

  for (const tile of ordered) {
    if (water >= minimum) {
      break;
    }
    if (!isWaterTerrain(tile.terrainType)) {
      tile.terrainType = "shallow_water";
      tile.waterType = "lake";
      water += 1;
    }
  }

  for (let index = ordered.length - 1; index >= 0 && water > maximum; index -= 1) {
    const tile = ordered[index];
    if (tile && isWaterTerrain(tile.terrainType)) {
      tile.terrainType = "grassland";
      tile.waterType = "none";
      water -= 1;
    }
  }
}

function assignCoast(tiles: WorldTile[], width: number, height: number) {
  for (const tile of tiles) {
    if (!isWaterTerrain(tile.terrainType) || tile.waterType === "river") {
      continue;
    }
    const edge = tile.x === 0 || tile.y === 0 || tile.x === width - 1 || tile.y === height - 1;
    tile.waterType = edge ? "coast" : "lake";
  }
}

function carveRiver(tiles: WorldTile[], width: number, height: number) {
  const land = tiles.filter((tile) => !isWaterTerrain(tile.terrainType));
  const start = land.sort((left, right) => right.elevation - left.elevation || left.y - right.y || left.x - right.x)[0];
  if (!start) {
    return;
  }

  const visited = new Set<string>();
  let current = start;
  for (let step = 0; step < Math.max(width, height); step += 1) {
    visited.add(`${current.x},${current.y}`);
    const next = neighbors(current.x, current.y, width, height)
      .map((point) => tileAt(tiles, width, point.x, point.y))
      .filter((tile): tile is WorldTile => tile !== undefined && !visited.has(`${tile.x},${tile.y}`))
      .sort((left, right) => left.elevation - right.elevation || left.y - right.y || left.x - right.x)[0];
    if (!next) {
      break;
    }
    if (isWaterTerrain(next.terrainType)) {
      break;
    }
    current = next;
    current.terrainType = "shallow_water";
    current.waterType = "river";
  }
}

function classifyLand(tiles: WorldTile[]) {
  for (const tile of tiles) {
    if (isWaterTerrain(tile.terrainType)) {
      continue;
    }
    if (tile.elevation >= 0.78) {
      tile.terrainType = "mountain";
    } else if (tile.elevation >= 0.66) {
      tile.terrainType = "rocky";
    } else if (tile.elevation < 0.5) {
      tile.terrainType = "sand";
    } else {
      tile.terrainType = "grassland";
    }
  }
}

function assignSoil(tiles: WorldTile[], seed: bigint) {
  const fertilityNoise = makeNoise(seed, "soil", 12, 6);
  for (const tile of tiles) {
    if (isWaterTerrain(tile.terrainType)) {
      tile.soilType = "poor";
      tile.fertility = 0;
      continue;
    }
    const roll = fertilityNoise(tile.x, tile.y);
    if (tile.terrainType === "mountain" || tile.terrainType === "rocky") {
      tile.soilType = "poor";
      tile.fertility = band(roll, 0, 25);
    } else if (tile.terrainType === "sand") {
      tile.soilType = "poor";
      tile.fertility = band(roll, 8, 30);
    } else if (roll > 0.62 && tile.elevation < 0.62) {
      tile.soilType = "fertile";
      tile.fertility = band(roll, 70, 100);
    } else {
      tile.soilType = "normal";
      tile.fertility = band(roll, 35, 69);
    }
  }
}

function assignVegetation(tiles: WorldTile[], seed: bigint) {
  const cover = makeNoise(seed, "vegetation", 10, 5);
  for (const tile of tiles) {
    if (isWaterTerrain(tile.terrainType) || tile.terrainType === "mountain") {
      tile.vegetationType = "none";
      tile.vegetationDensity = 0;
      continue;
    }
    const roll = cover(tile.x, tile.y);
    if (tile.terrainType === "grassland" && roll > 0.62 && tile.elevation < 0.7) {
      tile.vegetationType = "forest";
      tile.vegetationDensity = round4(0.45 + roll * 0.55);
    } else if ((tile.terrainType === "grassland" || tile.terrainType === "sand") && roll > 0.34) {
      tile.vegetationType = "grass";
      tile.vegetationDensity = round4(0.1 + roll * 0.3);
    } else {
      tile.vegetationType = "none";
      tile.vegetationDensity = 0;
    }
  }
}

function assignDeposits(tiles: WorldTile[], seed: bigint, width: number, height: number) {
  const stoneNoise = makeNoise(seed, "stone", 9, 4);
  const oreNoise = makeNoise(seed, "ore", 8, 4);
  const clayNoise = makeNoise(seed, "clay", 9, 4);
  for (const tile of tiles) {
    const deposits: DepositType[] = [];
    if ((tile.terrainType === "rocky" || tile.terrainType === "mountain") && stoneNoise(tile.x, tile.y) > 0.72) {
      deposits.push("stone");
    }
    if (tile.terrainType === "mountain" && oreNoise(tile.x, tile.y) > 0.82) {
      deposits.push("ore");
    }
    if (tile.terrainType === "grassland" && nearWater(tiles, width, height, tile) && clayNoise(tile.x, tile.y) > 0.76) {
      deposits.push("clay");
    }
    tile.deposits = deposits;
  }
}

function clearWaterFeatures(tiles: WorldTile[]) {
  for (const tile of tiles) {
    if (!isWaterTerrain(tile.terrainType)) {
      continue;
    }
    tile.vegetationType = "none";
    tile.vegetationDensity = 0;
    tile.deposits = [];
    tile.soilType = "poor";
    tile.fertility = 0;
  }
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
    if (tile.elevation < 0 || tile.elevation > 1 || tile.fertility < 0 || tile.fertility > 100) {
      throw new GenerationError("Tile numbers are out of range.");
    }
    if (tile.vegetationDensity < 0 || tile.vegetationDensity > 1) {
      throw new GenerationError("Vegetation density is out of range.");
    }

    const waterTerrain = isWaterTerrain(tile.terrainType);
    if (waterTerrain !== (tile.waterType !== "none")) {
      throw new GenerationError("Water and land attributes disagree.");
    }
    if (tile.vegetationType === "forest" && (waterTerrain || tile.terrainType === "mountain")) {
      throw new GenerationError("Forest cannot grow on water or mountains.");
    }
    if (waterTerrain && (tile.vegetationType !== "none" || tile.deposits.length > 0)) {
      throw new GenerationError("Water tiles cannot hold vegetation or deposits.");
    }
    for (const deposit of tile.deposits) {
      if (!depositAllowed(tile.terrainType, deposit)) {
        throw new GenerationError("A deposit is on terrain that cannot hold it.");
      }
    }
    if (new Set(tile.deposits).size !== tile.deposits.length) {
      throw new GenerationError("A tile repeated a deposit.");
    }
    if (waterTerrain) {
      water += 1;
    } else {
      land += 1;
    }
  }

  if (water === 0 || land === 0) {
    throw new GenerationError("The map must contain both land and water.");
  }
}

function depositAllowed(terrain: TerrainType, deposit: DepositType) {
  if (deposit === "stone") {
    return terrain === "rocky" || terrain === "mountain";
  }
  if (deposit === "ore") {
    return terrain === "mountain";
  }
  return terrain === "grassland";
}

function nearWater(tiles: WorldTile[], width: number, height: number, tile: WorldTile) {
  return neighbors(tile.x, tile.y, width, height).some((point) => {
    const other = tileAt(tiles, width, point.x, point.y);
    return other ? isWaterTerrain(other.terrainType) : false;
  });
}

function neighbors(x: number, y: number, width: number, height: number) {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ].filter((point) => point.x >= 0 && point.y >= 0 && point.x < width && point.y < height);
}

function tileAt(tiles: WorldTile[], width: number, x: number, y: number) {
  return tiles[y * width + x];
}

function isWaterTerrain(terrain: TerrainType) {
  return terrain === "deep_water" || terrain === "shallow_water";
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

function round4(value: number) {
  return Math.round(value * 10000) / 10000;
}

function band(value: number, min: number, max: number) {
  return Math.round(min + clamp01(value) * (max - min));
}
