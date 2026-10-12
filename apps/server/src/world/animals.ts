import { hashTile, type AnimalRecord, type WorldTile } from "@life-simulator/shared";

/** How many rabbits to place. The number comes from worldConfig.json. */
export type AnimalSettings = {
  rabbit: {
    count: number;
  };
};

/** Callers that omit a config place no animals. */
export const DEFAULT_ANIMAL_SETTINGS: AnimalSettings = {
  rabbit: { count: 0 },
};

/** A living body. A species supplies the kind. The point is where it stands. */
export class Animal {
  constructor(
    readonly id: string,
    readonly species: AnimalRecord["species"],
    readonly x: number,
    readonly y: number,
  ) {}
}

/** The first species. It stands on one land tile. */
export class Rabbit extends Animal {
  constructor(id: string, x: number, y: number) {
    super(id, "rabbit", x, y);
  }
}

/**
 * Places up to `count` rabbits on land.
 * Empty land is used first, so a rabbit does not start on a plant or a pile.
 * The same seed always picks the same tiles and the same ids.
 */
export function spawnRabbits(tiles: WorldTile[], seed: bigint, count: number): AnimalRecord[] {
  if (count <= 0) {
    return [];
  }
  const land = tiles.filter((tile) => tile.terrainType !== "water");
  const open = land.filter((tile) => tile.vegitation.length === 0 && tile.deposits.length === 0);
  const occupied = land.filter((tile) => tile.vegitation.length > 0 || tile.deposits.length > 0);
  const spots = [...byHash(seed, open), ...byHash(seed, occupied)].slice(0, count);
  return spots.map((tile, index) => {
    const rabbit = new Rabbit(rabbitId(seed, index), tile.x, tile.y);
    return { id: rabbit.id, species: rabbit.species, x: rabbit.x, y: rabbit.y };
  });
}

function byHash(seed: bigint, tiles: WorldTile[]) {
  return [...tiles].sort(
    (a, b) => hashTile(seed, "rabbit", a.x, a.y) - hashTile(seed, "rabbit", b.x, b.y) || a.x - b.x || a.y - b.y,
  );
}

/** A stable id for this seed and spawn slot. It is not a new id on every load. */
function rabbitId(seed: bigint, index: number) {
  const hex = [0, 1, 2, 3].map((part) => hashTile(seed, "rabbit-id", index, part).toString(16).padStart(8, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
