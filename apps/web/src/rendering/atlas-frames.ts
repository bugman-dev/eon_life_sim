import { hashTile, type DepositType, type TerrainType, type VegetationType } from "@life-simulator/shared";
import { TILE_WIDTH } from "./metrics";

export type Frame = { x: number; y: number; width: number; height: number };

const VARIANT_COUNT = 6;
const DEPOSIT_VARIANT_COUNT = 3;
const PLANT_VARIANT_COUNT = 6;

/**
 * Six variations of each terrain, left to right, in IsometricTerrainAtlas.png.
 * Water is listed so the cutter stays uniform. The map always draws the first water frame.
 */
export const terrainFrames: Record<TerrainType, Frame[]> = {
  grass: [
    { x: 133, y: 133, width: 217, height: 157 },
    { x: 362, y: 132, width: 216, height: 158 },
    { x: 588, y: 133, width: 217, height: 157 },
    { x: 816, y: 133, width: 215, height: 157 },
    { x: 1042, y: 133, width: 218, height: 157 },
    { x: 1272, y: 133, width: 217, height: 157 },
  ],
  dirt: [
    { x: 133, y: 324, width: 217, height: 156 },
    { x: 362, y: 324, width: 216, height: 156 },
    { x: 588, y: 324, width: 217, height: 156 },
    { x: 816, y: 324, width: 216, height: 156 },
    { x: 1042, y: 324, width: 218, height: 156 },
    { x: 1272, y: 324, width: 217, height: 156 },
  ],
  sand: [
    { x: 133, y: 515, width: 217, height: 154 },
    { x: 362, y: 516, width: 217, height: 152 },
    { x: 588, y: 515, width: 218, height: 153 },
    { x: 816, y: 516, width: 216, height: 152 },
    { x: 1042, y: 516, width: 219, height: 152 },
    { x: 1272, y: 515, width: 218, height: 153 },
  ],
  water: [
    { x: 133, y: 697, width: 217, height: 155 },
    { x: 362, y: 697, width: 216, height: 155 },
    { x: 589, y: 696, width: 216, height: 156 },
    { x: 815, y: 697, width: 216, height: 155 },
    { x: 1042, y: 697, width: 218, height: 155 },
    { x: 1272, y: 697, width: 217, height: 155 },
  ],
};

/** Three variations of each deposit, left to right, in ResourceDepositAtlas.png. */
export const depositFrames: Record<DepositType, Frame[]> = {
  stone: [
    { x: 329, y: 150, width: 346, height: 162 },
    { x: 831, y: 138, width: 344, height: 180 },
    { x: 1334, y: 179, width: 350, height: 143 },
  ],
  ore: [
    { x: 337, y: 395, width: 342, height: 159 },
    { x: 814, y: 379, width: 365, height: 175 },
    { x: 1334, y: 407, width: 354, height: 149 },
  ],
  clay: [
    { x: 335, y: 630, width: 340, height: 161 },
    { x: 817, y: 618, width: 353, height: 178 },
    { x: 1335, y: 638, width: 353, height: 158 },
  ],
};

/** Scales the widest pile down to one tile, so a deposit sits on its own diamond. */
export const DEPOSIT_SCALE = TILE_WIDTH / Math.max(...Object.values(depositFrames).flat().map((frame) => frame.width));

/** Tall trees across the top of TreesAtlas.png, then the short trees along the bottom. Stage 3 uses the tall row. */
export const largeTreeFrames: Frame[] = [
  { x: 34, y: 122, width: 233, height: 433 },
  { x: 291, y: 122, width: 227, height: 434 },
  { x: 539, y: 122, width: 199, height: 435 },
  { x: 762, y: 122, width: 198, height: 437 },
  { x: 980, y: 122, width: 267, height: 438 },
  { x: 1264, y: 122, width: 244, height: 437 },
];
export const smallTreeFrames: Frame[] = [
  { x: 59, y: 664, width: 191, height: 271 },
  { x: 307, y: 664, width: 193, height: 271 },
  { x: 571, y: 664, width: 152, height: 271 },
  { x: 801, y: 664, width: 182, height: 271 },
  { x: 1058, y: 664, width: 173, height: 271 },
  { x: 1302, y: 664, width: 173, height: 270 },
];
export const treeFrames = { large: largeTreeFrames, small: smallTreeFrames };

/** Six shrubs, left to right, in ShrubsAtlas.png. */
export const shrubFrames: Frame[] = [
  { x: 30, y: 260, width: 265, height: 319 },
  { x: 314, y: 260, width: 271, height: 325 },
  { x: 603, y: 260, width: 274, height: 325 },
  { x: 894, y: 260, width: 271, height: 324 },
  { x: 1185, y: 260, width: 269, height: 319 },
  { x: 1473, y: 260, width: 275, height: 325 },
];

/** Six flower clumps, left to right, in FlowersAtlas.png. */
export const flowerFrames: Frame[] = [
  { x: 63, y: 182, width: 259, height: 365 },
  { x: 417, y: 182, width: 263, height: 367 },
  { x: 769, y: 181, width: 271, height: 366 },
  { x: 1125, y: 182, width: 271, height: 366 },
  { x: 1475, y: 182, width: 278, height: 382 },
  { x: 1842, y: 181, width: 264, height: 367 },
];

/** Six grass tufts, left to right, in GrassAtlas.png. */
export const grassPlantFrames: Frame[] = [
  { x: 72, y: 182, width: 253, height: 355 },
  { x: 427, y: 182, width: 248, height: 358 },
  { x: 771, y: 182, width: 264, height: 358 },
  { x: 1120, y: 182, width: 277, height: 360 },
  { x: 1479, y: 182, width: 269, height: 360 },
  { x: 1853, y: 182, width: 260, height: 358 },
];

/** The widest tall tree is one tile across. Shorter plants use a smaller share of that tile. */
export const TREE_SCALE = TILE_WIDTH / 267;
export const SHRUB_SCALE = (TILE_WIDTH * 0.72) / 275;
export const FLOWER_SCALE = (TILE_WIDTH * 0.58) / 278;
export const GRASS_PLANT_SCALE = (TILE_WIDTH * 0.5) / 277;

/**
 * Grass, dirt, and sand keep one of six pictures for a coordinate.
 * Water always uses the first picture.
 */
export function frameIndex(terrain: TerrainType, seed: string, x: number, y: number): number {
  if (terrain === "water") {
    return 0;
  }
  return variantIndex(seed, x, y);
}

/** Same seed and coordinate always pick the same ground variation. */
function variantIndex(seed: string, x: number, y: number): number {
  return hashTile(seed, "terrain", x, y) % VARIANT_COUNT;
}

/** Same seed, coordinate, and deposit always pick the same pile. */
export function depositVariant(seed: string, x: number, y: number, deposit: DepositType): number {
  return hashTile(seed, deposit, x, y) % DEPOSIT_VARIANT_COUNT;
}

/** Same seed, coordinate, and plant always pick the same picture. */
export function plantVariant(seed: string, x: number, y: number, plant: VegetationType): number {
  return hashTile(seed, plant, x, y) % PLANT_VARIANT_COUNT;
}
