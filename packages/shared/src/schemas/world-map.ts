import { z } from "zod";

export const WORLD_GENERATION_VERSION = 1;
export const MIN_WORLD_SIZE = 8;
export const MAX_WORLD_SIZE = 500;
export const DEFAULT_WORLD_SIZE = 128;
export const WORLD_TILE_SIZE = 1;

export const terrainTypeSchema = z.enum(["grass", "dirt", "sand", "water"]);

export const waterTypeSchema = z.enum(["none", "lake", "river", "coast"]);

export const soilTypeSchema = z.enum(["poor", "normal", "fertile"]);

export const vegetationTypeSchema = z.enum(["none", "grass", "forest"]);

export const depositTypeSchema = z.enum(["stone", "ore", "clay"]);

export const worldTileSchema = z
  .object({
    x: z.number().int().min(0).max(MAX_WORLD_SIZE - 1),
    y: z.number().int().min(0).max(MAX_WORLD_SIZE - 1),
    terrainType: terrainTypeSchema,
    elevation: z.number().min(0).max(1),
    waterType: waterTypeSchema,
    soilType: soilTypeSchema,
    fertility: z.number().int().min(0).max(100),
    vegetationType: vegetationTypeSchema,
    vegetationDensity: z.number().min(0).max(1),
    deposits: z.array(depositTypeSchema).max(3),
  })
  .strict();

export const worldMapSchema = z
  .object({
    worldId: z.string().uuid(),
    seed: z.string().regex(/^-?\d+$/),
    generationVersion: z.literal(WORLD_GENERATION_VERSION),
    width: z.number().int().min(MIN_WORLD_SIZE).max(MAX_WORLD_SIZE),
    height: z.number().int().min(MIN_WORLD_SIZE).max(MAX_WORLD_SIZE),
    tileSize: z.literal(WORLD_TILE_SIZE),
    tiles: z.array(worldTileSchema),
  })
  .strict()
  .superRefine((map, context) => {
    if (map.tiles.length !== map.width * map.height) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tile count must equal width × height.",
        path: ["tiles"],
      });
    }

    const seen = new Set<string>();
    for (const tile of map.tiles) {
      if (tile.x >= map.width || tile.y >= map.height) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Tile coordinate is outside the map.",
          path: ["tiles"],
        });
        return;
      }
      const key = `${tile.x},${tile.y}`;
      if (seen.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Tile coordinates must be unique.",
          path: ["tiles"],
        });
        return;
      }
      seen.add(key);
    }
  });

export type TerrainType = z.infer<typeof terrainTypeSchema>;
export type WaterType = z.infer<typeof waterTypeSchema>;
export type SoilType = z.infer<typeof soilTypeSchema>;
export type VegetationType = z.infer<typeof vegetationTypeSchema>;
export type DepositType = z.infer<typeof depositTypeSchema>;
export type WorldTile = z.infer<typeof worldTileSchema>;
export type WorldMap = z.infer<typeof worldMapSchema>;
