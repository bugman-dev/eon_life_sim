import { z } from "zod";

export const WORLD_GENERATION_VERSION = 1;
export const MIN_WORLD_SIZE = 8;
export const MAX_WORLD_SIZE = 500;
export const DEFAULT_WORLD_SIZE = 128;
export const WORLD_TILE_SIZE = 1;

export const terrainTypeSchema = z.enum(["grass", "dirt", "sand", "water"]);

export const waterTypeSchema = z.enum(["none", "lake", "river", "coast"]);

export const soilTypeSchema = z.enum(["poor", "normal", "fertile"]);

export const depositTypeSchema = z.enum(["stone", "ore", "clay"]);

/**
 * Growth stages are 1 new, 2 growing, and 3 mature.
 * Deposits are stored mature. Trees use all three stages. Other plants are stored mature.
 */
export const DEPOSIT_GROWTH_STAGE = 3 as const;

export const growthStageSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const vegetationTypeSchema = z.enum(["tree", "shrubs", "flowers", "grass"]);

export const resourceDepositSchema = z
  .object({
    type: depositTypeSchema,
    /** Harvestable units. The range comes from worldConfig.json. */
    amount: z.number().int(),
    growthStage: z.literal(DEPOSIT_GROWTH_STAGE),
  })
  .strict();

export const vegetationItemSchema = z
  .object({
    type: vegetationTypeSchema,
    /** Harvestable units. Only trees use the configured range. Other plants store 0. */
    amount: z.number().int(),
    growthStage: growthStageSchema,
  })
  .strict();

export const worldTileSchema = z
  .object({
    x: z.number().int().min(0).max(MAX_WORLD_SIZE - 1),
    y: z.number().int().min(0).max(MAX_WORLD_SIZE - 1),
    terrainType: terrainTypeSchema,
    elevation: z.number().min(0).max(1),
    waterType: waterTypeSchema,
    soilType: soilTypeSchema,
    fertility: z.number().int().min(0).max(100),
    /** One plant at most. The name matches worldConfig.json. */
    vegitation: z.array(vegetationItemSchema).max(1),
    deposits: z.array(resourceDepositSchema).max(1),
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
export type DepositType = z.infer<typeof depositTypeSchema>;
export type ResourceDeposit = z.infer<typeof resourceDepositSchema>;
export type VegetationType = z.infer<typeof vegetationTypeSchema>;
export type VegetationItem = z.infer<typeof vegetationItemSchema>;
export type WorldTile = z.infer<typeof worldTileSchema>;
export type WorldMap = z.infer<typeof worldMapSchema>;
