import { describe, expect, it } from "vitest";
import { worldMapSchema, type WorldTile } from "./world-map.js";

const worldId = "8b2e4c1a-9d8e-4f7a-b6c5-abcdef123456";

function tile(x: number, y: number, patch: Partial<WorldTile> = {}): WorldTile {
  return {
    x,
    y,
    terrainType: "grassland",
    elevation: 0.5,
    waterType: "none",
    soilType: "normal",
    fertility: 40,
    vegetationType: "none",
    vegetationDensity: 0,
    deposits: [],
    ...patch,
  };
}

function mapOf(tiles: WorldTile[], width = 8, height = 8) {
  return {
    worldId,
    seed: "7",
    generationVersion: 1 as const,
    width,
    height,
    tileSize: 1 as const,
    tiles,
  };
}

describe("world map schema", () => {
  it("accepts a complete grid and rejects a bad tile, a short grid, and an oversized world", () => {
    const tiles = Array.from({ length: 64 }, (_, index) => tile(index % 8, Math.floor(index / 8)));
    expect(worldMapSchema.safeParse(mapOf(tiles)).success).toBe(true);

    const invalid = tiles.map((entry, index) => (index === 0 ? tile(0, 0, { terrainType: "void" as WorldTile["terrainType"] }) : entry));
    expect(worldMapSchema.safeParse(mapOf(invalid)).success).toBe(false);
    expect(worldMapSchema.safeParse(mapOf(tiles.slice(0, 63))).success).toBe(false);
    expect(worldMapSchema.safeParse(mapOf(tiles, 501, 8)).success).toBe(false);
    expect(worldMapSchema.safeParse(mapOf([tile(-1, 0), ...tiles.slice(1)])).success).toBe(false);
  });
});
