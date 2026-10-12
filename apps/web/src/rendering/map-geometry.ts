import type { WorldMap } from "@life-simulator/shared";
import {
  DEPOSIT_SCALE,
  depositFrames,
  flowerFrames,
  FLOWER_SCALE,
  grassPlantFrames,
  GRASS_PLANT_SCALE,
  largeTreeFrames,
  shrubFrames,
  SHRUB_SCALE,
  smallTreeFrames,
  terrainFrames,
  TREE_SCALE,
} from "./atlas-frames";
import { PLANT_GROUND_AT, RESOURCE_GROUND_AT, TILE_HEIGHT, TILE_SCALE, TILE_WIDTH } from "./metrics";

export type Point = {
  x: number;
  y: number;
};

/** Keyed atlas canvases, kept so a click can copy the same pixels the map drew. */
export type KeyedCanvases = {
  terrain: HTMLCanvasElement;
  deposits: HTMLCanvasElement;
  trees: HTMLCanvasElement;
  shrubs: HTMLCanvasElement;
  flowers: HTMLCanvasElement;
  grass: HTMLCanvasElement;
};

/** Places a tile's top corner. X grows down-right and Y grows down-left. */
export function isoPoint(gridX: number, gridY: number, mapHeight: number): Point {
  return {
    x: (gridX - gridY) * (TILE_WIDTH / 2) + mapHeight * (TILE_WIDTH / 2),
    y: (gridX + gridY) * (TILE_HEIGHT / 2),
  };
}

/** The middle of a tile diamond, in the same space the camera pans. */
export function tileCenter(gridX: number, gridY: number, mapHeight: number): Point {
  const peak = isoPoint(gridX, gridY, mapHeight);
  return {
    x: peak.x,
    y: peak.y + TILE_HEIGHT / 2 + sceneryOverhang(),
  };
}

export function groundY(peakY: number, lift: number, groundAt: number) {
  return peakY + TILE_HEIGHT * groundAt + lift;
}

/** Pixel size of the whole diamond grid, including the tallest frame's extra skirt. */
export function mapPixelSize(map: WorldMap) {
  const span = map.width + map.height;
  return {
    pixelWidth: (span * TILE_WIDTH) / 2,
    pixelHeight: (span * TILE_HEIGHT) / 2 + skirtHeight() + sceneryOverhang(),
  };
}

/** Space below the ground diamond so a bush on a tall frame is not clipped. */
function skirtHeight() {
  return Math.max(...Object.values(terrainFrames).flat().map((frame) => frame.height * TILE_SCALE - TILE_HEIGHT));
}

/** Space above the back tiles so a picture that rises past the diamond peak stays inside the camera. */
export function sceneryOverhang() {
  const rises = [
    ...Object.values(depositFrames).flat().map((frame) => frame.height * DEPOSIT_SCALE - TILE_HEIGHT * RESOURCE_GROUND_AT),
    ...largeTreeFrames.map((frame) => frame.height * TREE_SCALE - TILE_HEIGHT * PLANT_GROUND_AT),
    ...smallTreeFrames.map((frame) => frame.height * TREE_SCALE - TILE_HEIGHT * PLANT_GROUND_AT),
    ...shrubFrames.map((frame) => frame.height * SHRUB_SCALE - TILE_HEIGHT * PLANT_GROUND_AT),
    ...flowerFrames.map((frame) => frame.height * FLOWER_SCALE - TILE_HEIGHT * PLANT_GROUND_AT),
    ...grassPlantFrames.map((frame) => frame.height * GRASS_PLANT_SCALE - TILE_HEIGHT * PLANT_GROUND_AT),
  ];
  return Math.max(0, ...rises);
}
