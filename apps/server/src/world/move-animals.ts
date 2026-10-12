import { gridStep, hashTile, moveThroughWorld, type AnimalRecord, type Ground, type WorldMap } from "@life-simulator/shared";

/** Grid units one animal walks during a tick. Every species uses this until a species profile says otherwise. */
export const WALK_DISTANCE = 1;

/** Screen radius of an animal body. The picture does not decide this. */
export const ANIMAL_RADIUS = 6;

/** Ticks that keep the same heading, so a step is a walk and not a twitch. */
const HEADING_TICKS = 4;

/** Screen directions. x is right and y is down. */
const SCREEN_HEADINGS = [
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
];

/**
 * Moves every animal one step.
 * The heading comes from the seed and the tick, so the same world always walks the same path.
 * Water, the map edge, and solid bases refuse the step. A blocked heading tries the next one.
 */
export function stepAnimals(map: WorldMap, ground: Ground, animals: AnimalRecord[], seed: string | bigint, tick: bigint): AnimalRecord[] {
  return animals.map((animal) => stepOne(map, ground, animal, seed, tick));
}

function stepOne(map: WorldMap, ground: Ground, animal: AnimalRecord, seed: string | bigint, tick: bigint): AnimalRecord {
  const bucket = Number(tick / BigInt(HEADING_TICKS));
  const start = hashTile(seed, animal.id, bucket, 0) % SCREEN_HEADINGS.length;
  for (let offset = 0; offset < SCREEN_HEADINGS.length; offset += 1) {
    const heading = SCREEN_HEADINGS[(start + offset) % SCREEN_HEADINGS.length];
    if (!heading) {
      return animal;
    }
    const delta = gridStep(heading.x, heading.y, WALK_DISTANCE);
    const next = moveThroughWorld(map, ground, ANIMAL_RADIUS, animal, delta.x, delta.y);
    if (next.x !== animal.x || next.y !== animal.y) {
      return { ...animal, x: next.x, y: next.y };
    }
  }
  return animal;
}
