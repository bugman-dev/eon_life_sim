import {
  DEPOSIT_GROWTH_STAGE,
  MAX_WORLD_SIZE,
  MIN_WORLD_SIZE,
  WORLD_GENERATION_VERSION,
  WORLD_TILE_SIZE,
  animalSpeciesSchema,
  type AnimalRecord,
  type WorldTile,
} from "@life-simulator/shared";

/** Thrown when a size is unsupported or a finished map breaks an invariant. */
export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationError";
  }
}

/** A finished map. Elevation, fertility, and vegetation stay unused. Deposits are static. */
export type GeneratedWorld = {
  seed: bigint;
  generationVersion: typeof WORLD_GENERATION_VERSION;
  width: number;
  height: number;
  tileSize: typeof WORLD_TILE_SIZE;
  tiles: WorldTile[];
  animals: AnimalRecord[];
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
 * Both land and water are required. Elevation stays 0.
 * A tile holds at most one deposit and one plant. Clay is only on dirt, and water holds none.
 * A deposit amount is a whole number from the config, and its growth stage is mature.
 * Shrubs, flowers, and grass tufts sit only on grass, with amount 0 and a mature stage.
 * Trees sit on grass, sand, or dirt.
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
    if (tile.elevation !== 0 || tile.fertility !== 0) {
      throw new GenerationError("Elevation and fertility are not generated yet.");
    }
    if (!validPlant(tile)) {
      throw new GenerationError("A tile can hold one plant, and that plant must match its ground.");
    }
    if (tile.deposits.length > 1 || new Set(tile.deposits.map((deposit) => deposit.type)).size !== tile.deposits.length) {
      throw new GenerationError("A tile can hold one deposit.");
    }
    if (tile.deposits.some((deposit) => !validDeposit(deposit))) {
      throw new GenerationError("A deposit amount must be a whole number, and its growth stage is mature.");
    }
    if (tile.terrainType === "water" && tile.deposits.length > 0) {
      throw new GenerationError("A water tile cannot hold a deposit.");
    }
    if (tile.deposits.some((deposit) => deposit.type === "clay") && tile.terrainType !== "dirt") {
      throw new GenerationError("Clay can only sit on dirt.");
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
  assertAnimals(world, seen);

  if (water === 0 || land === 0) {
    throw new GenerationError("The map must contain both land and water.");
  }
}

function assertAnimals(world: GeneratedWorld, tiles: Set<string>) {
  const seen = new Set<string>();
  const spots = new Set<string>();
  for (const animal of world.animals) {
    if (!animalSpeciesSchema.safeParse(animal.species).success) {
      throw new GenerationError("An animal species is not recognized.");
    }
    const spot = `${animal.x},${animal.y}`;
    if (!tiles.has(spot) || seen.has(animal.id) || spots.has(spot)) {
      throw new GenerationError("Each animal stands on its own land tile.");
    }
    const tile = world.tiles.find((entry) => entry.x === animal.x && entry.y === animal.y);
    if (!tile || tile.terrainType === "water") {
      throw new GenerationError("An animal cannot stand on water.");
    }
    seen.add(animal.id);
    spots.add(spot);
  }
}

function validDeposit(deposit: WorldTile["deposits"][number]) {
  return Number.isInteger(deposit.amount) && deposit.growthStage === DEPOSIT_GROWTH_STAGE;
}

function validPlant(tile: WorldTile) {
  if (tile.vegitation.length > 1) {
    return false;
  }
  const plant = tile.vegitation[0];
  if (!plant) {
    return true;
  }
  if (tile.terrainType === "water" || !Number.isInteger(plant.amount)) {
    return false;
  }
  if (plant.type === "tree") {
    return plant.growthStage === 1 || plant.growthStage === 2 || plant.growthStage === 3;
  }
  return plant.amount === 0 && plant.growthStage === DEPOSIT_GROWTH_STAGE && tile.terrainType === "grass";
}
