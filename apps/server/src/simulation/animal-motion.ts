import { groundOf, type AnimalMove, type AnimalRecord, type Ground, type WorldMap } from "@life-simulator/shared";
import type { WorldMapRepository } from "../persistence/world-map-repository.js";
import { stepAnimals } from "../world/move-animals.js";

type Herd = {
  map: WorldMap;
  ground: Ground;
  animals: AnimalRecord[];
  dirty: boolean;
};

/** The live herd for each running world. One row per animal is overwritten when it walks. */
export class AnimalMotion {
  private readonly herds = new Map<string, Herd>();

  constructor(private readonly maps: WorldMapRepository) {}

  async begin(worldId: string) {
    if (this.herds.has(worldId)) {
      return;
    }
    const map = await this.maps.findMap(worldId);
    if (!map) {
      return;
    }
    this.herds.set(worldId, {
      map,
      ground: groundOf(map),
      animals: map.animals.map((animal) => ({ ...animal })),
      dirty: false,
    });
  }

  async release(worldId: string) {
    const herd = this.herds.get(worldId);
    this.herds.delete(worldId);
    if (herd?.dirty) {
      await this.maps.saveAnimalPositions(worldId, herd.animals);
    }
  }

  async step(worldId: string, tick: bigint): Promise<AnimalMove[]> {
    const herd = this.herds.get(worldId);
    if (!herd || herd.animals.length === 0) {
      return [];
    }
    const next = stepAnimals(herd.map, herd.ground, herd.animals, herd.map.seed, tick);
    const moved: AnimalMove[] = [];
    for (let index = 0; index < next.length; index += 1) {
      const animal = next[index];
      const previous = herd.animals[index];
      if (!animal || !previous) {
        continue;
      }
      if (animal.x !== previous.x || animal.y !== previous.y) {
        moved.push({ id: animal.id, x: animal.x, y: animal.y });
      }
    }
    herd.animals = next;
    if (moved.length > 0) {
      herd.dirty = true;
    }
    if (herd.dirty) {
      await this.maps.saveAnimalPositions(worldId, herd.animals);
      herd.dirty = false;
    }
    return moved;
  }
}
