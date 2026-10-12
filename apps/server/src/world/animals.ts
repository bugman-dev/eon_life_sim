import { animalSpeciesSchema, hashTile, type AnimalRecord, type AnimalSpecies, type WorldTile } from "@life-simulator/shared";

/** How many of each species to place. The numbers come from worldConfig.json. */
export type AnimalSettings = Record<AnimalSpecies, { count: number }>;

/** Callers that omit a config place no animals. */
export const DEFAULT_ANIMAL_SETTINGS: AnimalSettings = Object.fromEntries(
  animalSpeciesSchema.options.map((species) => [species, { count: 0 }]),
) as AnimalSettings;

/** A living body. The species name says which kind. The point is where it stands. */
export class Animal {
  constructor(
    readonly id: string,
    readonly species: AnimalSpecies,
    readonly x: number,
    readonly y: number,
  ) {}
}

/**
 * Places each configured species on land.
 * Empty land is used first, so an animal does not start on a plant or a pile.
 * A tile is used once. The same seed always picks the same tiles and the same ids.
 */
export function spawnAnimals(tiles: WorldTile[], seed: bigint, settings: AnimalSettings): AnimalRecord[] {
  const claimed = new Set<string>();
  const animals: AnimalRecord[] = [];
  for (const species of animalSpeciesSchema.options) {
    animals.push(...placeSpecies(tiles, seed, species, settings[species].count, claimed));
  }
  return animals;
}

function placeSpecies(tiles: WorldTile[], seed: bigint, species: AnimalSpecies, count: number, claimed: Set<string>) {
  if (count <= 0) {
    return [];
  }
  const land = tiles.filter((tile) => tile.terrainType !== "water" && !claimed.has(`${tile.x},${tile.y}`));
  const open = land.filter((tile) => tile.vegitation.length === 0 && tile.deposits.length === 0);
  const occupied = land.filter((tile) => tile.vegitation.length > 0 || tile.deposits.length > 0);
  const spots = [...byHash(seed, species, open), ...byHash(seed, species, occupied)].slice(0, count);
  return spots.map((tile, index) => {
    claimed.add(`${tile.x},${tile.y}`);
    const animal = new Animal(animalId(seed, species, index), species, tile.x, tile.y);
    return { id: animal.id, species: animal.species, x: animal.x, y: animal.y };
  });
}

function byHash(seed: bigint, species: AnimalSpecies, tiles: WorldTile[]) {
  return [...tiles].sort(
    (a, b) => hashTile(seed, species, a.x, a.y) - hashTile(seed, species, b.x, b.y) || a.x - b.x || a.y - b.y,
  );
}

/** A stable id for this seed, species, and spawn slot. It is not a new id on every load. */
function animalId(seed: bigint, species: AnimalSpecies, index: number) {
  const hex = [0, 1, 2, 3]
    .map((part) => hashTile(seed, `${species}-id`, index, part).toString(16).padStart(8, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
