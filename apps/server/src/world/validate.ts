import {
  MAX_WORLD_SIZE,
  MIN_WORLD_SIZE,
  WORLD_GENERATION_VERSION,
  WORLD_TILE_SIZE,
  type WorldTile,
} from "@life-simulator/shared";

/** Thrown when a size is unsupported or a finished map breaks an invariant. */
export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationError";
  }
}

/** A finished map. Elevation, fertility, vegetation, and deposits are present but unused. */
export type GeneratedWorld = {
  seed: bigint;
  generationVersion: typeof WORLD_GENERATION_VERSION;
  width: number;
  height: number;
  tileSize: typeof WORLD_TILE_SIZE;
  tiles: WorldTile[];
};

/** Rejects sizes outside the range the schema and the database both allow. */
export function assertDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || width < MIN_WORLD_SIZE || width > MAX_WORLD_SIZE) {
    throw new GenerationError(`Width must be an integer from ${MIN_WORLD_SIZE} to ${MAX_WORLD_SIZE}.`);
  }
  if (!Number.isInteger(height) || height < MIN_WORLD_SIZE || height > MAX_WORLD_SIZE) {
    throw new GenerationError(`Height must be an integer from ${MIN_WORLD_SIZE} to ${MAX_WORLD_SIZE}.`);
  }
}

/**
 * Checks the map the pipeline is allowed to emit.
 * Both land and water are required. Elevation and resources must still be empty.
 */
export function assertWorld(world: GeneratedWorld): void {
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
