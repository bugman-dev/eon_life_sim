import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { WorldTile } from "@life-simulator/shared";
import { createStream } from "./prng.js";
import { generateWorld, type GeneratedWorld } from "./generate.js";

describe("seeded random streams", () => {
  it("repeats a stream and keeps stages apart", () => {
    const first = createStream(42n, "elevation");
    const second = createStream(42n, "elevation");
    const sequence = [first(), first(), first(), first()];
    expect([second(), second(), second(), second()]).toEqual(sequence);

    const other = createStream(42n, "vegetation");
    expect([other(), other(), other(), other()]).not.toEqual(sequence);
  });
});

describe("world generation", () => {
  it("repeats a world for the same seed and changes it for another seed", () => {
    const first = generateWorld({ seed: 7n });
    const second = generateWorld({ seed: 7n });
    const other = generateWorld({ seed: 8n });

    expect(second).toEqual(first);
    expect(other.tiles).not.toEqual(first.tiles);
    expect(first.width).toBe(128);
    expect(first.height).toBe(128);
    expect(first.tiles).toHaveLength(128 * 128);
    expect(new Set(first.tiles.map((tile) => tile.terrainType))).toEqual(new Set(["grass", "dirt", "sand", "water"]));
    expect(first.tiles.some((tile) => tile.waterType === "coast")).toBe(true);
    expect(first.tiles.some((tile) => tile.waterType === "river")).toBe(true);
    expect(first.tiles.some((tile) => tile.waterType === "lake")).toBe(true);
    const border = first.tiles.filter((tile) => tile.x === 0 || tile.y === 0 || tile.x === 127 || tile.y === 127);
    expect(border.every((tile) => tile.terrainType === "water")).toBe(true);
    const land = first.tiles.filter((tile) => tile.terrainType !== "water");
    const grass = land.filter((tile) => tile.terrainType === "grass").length;
    expect(grass).toBeGreaterThan(land.length / 2);
    expect(
      first.tiles.every(
        (tile) => tile.elevation === 0 && tile.fertility === 0 && tile.vegetationType === "none" && tile.vegetationDensity === 0,
      ),
    ).toBe(true);
  });

  it("places stone and ore mostly on grass, and clay only on dirt near water", () => {
    for (const seed of [7n, 8n, 11n]) {
      expectDepositPlacement(generateWorld({ seed }));
    }

    const mapped = generateWorld({ seed: 7n });
    expect(mapped.tiles.some((tile) => tile.deposits[0] === "stone")).toBe(true);
    expect(mapped.tiles.some((tile) => tile.deposits[0] === "ore")).toBe(true);
    expect(mapped.tiles.some((tile) => tile.deposits[0] === "clay")).toBe(true);
  });

  it("builds a small grid and rejects dimensions outside the supported range", () => {
    const small = generateWorld({ seed: 3n, width: 8, height: 8 });
    expect(small.tiles).toHaveLength(64);
    expect(new Set(small.tiles.map((tile) => `${tile.x},${tile.y}`)).size).toBe(64);

    expect(() => generateWorld({ seed: 3n, width: 0, height: 8 })).toThrow(/Width/);
    expect(() => generateWorld({ seed: 3n, width: 501, height: 8 })).toThrow(/Width/);
  });

  it("does not read the clock or an unseeded random source", () => {
    const directory = dirname(fileURLToPath(new URL("./generate.ts", import.meta.url)));
    const sources = readdirSync(directory).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"));
    for (const name of sources) {
      const source = readFileSync(join(directory, name), "utf8");
      expect(source, name).not.toContain("Math.random");
      expect(source, name).not.toContain("Date.now");
    }
  });
});

function expectDepositPlacement(world: GeneratedWorld) {
  const distance = stepsFromWater(world.tiles);
  const stone = world.tiles.filter((tile) => tile.deposits[0] === "stone");
  const ore = world.tiles.filter((tile) => tile.deposits[0] === "ore");
  const clay = world.tiles.filter((tile) => tile.deposits[0] === "clay");

  expect(world.tiles.every((tile) => tile.deposits.length <= 1)).toBe(true);
  expect(world.tiles.filter((tile) => tile.terrainType === "water").every((tile) => tile.deposits.length === 0)).toBe(true);
  expect(mostlyGrass(stone)).toBe(true);
  expect(mostlyGrass(ore)).toBe(true);
  expect(clay.every((tile) => tile.terrainType === "dirt")).toBe(true);
  if (clay.length > 0) {
    const near = clay.filter((tile) => (distance.get(`${tile.x},${tile.y}`) ?? 99) <= 12).length;
    expect(near).toBeGreaterThan(clay.length / 2);
  }
}

function mostlyGrass(tiles: WorldTile[]) {
  if (tiles.length === 0) {
    return true;
  }
  return tiles.filter((tile) => tile.terrainType === "grass").length > tiles.length / 2;
}

/** Steps of land from the nearest water tile. Water itself is 0. */
function stepsFromWater(tiles: WorldTile[]) {
  const byKey = new Map(tiles.map((tile) => [`${tile.x},${tile.y}`, tile]));
  const distance = new Map<string, number>();
  const queue: WorldTile[] = [];
  for (const tile of tiles) {
    if (tile.terrainType === "water") {
      distance.set(`${tile.x},${tile.y}`, 0);
      queue.push(tile);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const tile = queue[head];
    head += 1;
    const steps = distance.get(`${tile.x},${tile.y}`) ?? 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const key = `${tile.x + dx},${tile.y + dy}`;
      if (distance.has(key) || !byKey.has(key)) {
        continue;
      }
      distance.set(key, steps + 1);
      const next = byKey.get(key);
      if (next) {
        queue.push(next);
      }
    }
  }
  return distance;
}
