import { groundOf, type AnimalRecord, type WorldMap, type WorldTile } from "@life-simulator/shared";
import { describe, expect, it } from "vitest";
import { stepAnimals } from "./move-animals.js";

function tile(x: number, y: number, water: boolean): WorldTile {
  return {
    x,
    y,
    terrainType: water ? "water" : "grass",
    elevation: 0,
    waterType: water ? "lake" : "none",
    soilType: water ? "poor" : "normal",
    fertility: 0,
    vegitation: [],
    deposits: [],
  };
}

function island(): WorldMap {
  const width = 8;
  const height = 8;
  const tiles: WorldTile[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      tiles.push(tile(x, y, x === 0));
    }
  }
  return {
    worldId: "00000000-0000-4000-8000-000000000001",
    seed: "1",
    generationVersion: 1,
    width,
    height,
    tileSize: 1,
    tiles,
    animals: [],
  };
}

const rabbit: AnimalRecord = {
  id: "00000000-0000-4000-8000-000000000002",
  species: "rabbit",
  x: 4,
  y: 4,
};

describe("animal steps", () => {
  it("walks the same path for the same seed and tick, and stays off water", () => {
    const map = island();
    const ground = groundOf(map);
    const once = stepAnimals(map, ground, [rabbit], map.seed, 1n);
    const twice = stepAnimals(map, ground, [rabbit], map.seed, 1n);
    expect(once).toEqual(twice);
    expect(once[0]).not.toEqual(rabbit);

    let herd = [rabbit];
    for (let tick = 1; tick <= 40; tick += 1) {
      herd = stepAnimals(map, ground, herd, map.seed, BigInt(tick));
      const animal = herd[0];
      expect(animal).toBeDefined();
      if (!animal) {
        continue;
      }
      const stood = map.tiles.find((entry) => entry.x === Math.round(animal.x) && entry.y === Math.round(animal.y));
      expect(stood?.terrainType).not.toBe("water");
    }
  });
});
