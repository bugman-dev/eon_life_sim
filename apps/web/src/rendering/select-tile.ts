import type { WorldMap, WorldTile } from "@life-simulator/shared";
import type { Container } from "pixi.js";
import type { Selection } from "../state/app-state";
import {
  depositFrames,
  depositVariant,
  flowerFrames,
  frameIndex,
  grassPlantFrames,
  largeTreeFrames,
  plantVariant,
  shrubFrames,
  smallTreeFrames,
  terrainFrames,
  type Frame,
} from "./atlas-frames";
import { isoPoint, sceneryOverhang, type KeyedCanvases, type Point } from "./map-geometry";
import { TILE_HEIGHT, TILE_WIDTH } from "./metrics";

/** Stores the diamond under the pointer, plus the sprites drawn on it. Pictures do not take the click. */
export function selectAtPointer(
  host: HTMLElement,
  world: Container | null,
  map: WorldMap | null,
  canvases: KeyedCanvases | null,
  clientX: number,
  clientY: number,
  select: (selection: Selection) => void,
) {
  if (!world || !map) {
    return;
  }
  const rect = host.getBoundingClientRect();
  const local = {
    x: (clientX - rect.left - world.x) / world.scale.x,
    y: (clientY - rect.top - world.y) / world.scale.y,
  };
  const tile = tileAtPoint(map, local, sceneryOverhang());
  if (!tile) {
    return;
  }
  const deposit = tile.deposits[0];
  const vegitation = tile.vegitation[0];
  const resource = deposit && vegitation ? { deposit, vegitation } : deposit ? { deposit } : vegitation ? { vegitation } : null;
  select({ tile, pictures: tilePictures(canvases, map, tile), resource });
}

/** Copies the terrain, deposit, and plant frames that this tile uses on the map. */
function tilePictures(canvases: KeyedCanvases | null, map: WorldMap, tile: WorldTile): Selection["pictures"] {
  if (!canvases) {
    return { terrain: null, deposit: null, vegetation: null };
  }
  const ground = terrainFrames[tile.terrainType][frameIndex(tile.terrainType, map.seed, tile.x, tile.y)];
  const deposit = tile.deposits[0];
  const plant = tile.vegitation[0];
  return {
    terrain: frameDataUrl(canvases.terrain, ground),
    deposit: deposit
      ? frameDataUrl(canvases.deposits, depositFrames[deposit.type][depositVariant(map.seed, tile.x, tile.y, deposit.type)])
      : null,
    vegetation: plant ? vegetationDataUrl(canvases, map.seed, tile.x, tile.y, plant) : null,
  };
}

function vegetationDataUrl(canvases: KeyedCanvases, seed: string, x: number, y: number, plant: WorldTile["vegitation"][number]) {
  const index = plantVariant(seed, x, y, plant.type);
  if (plant.type === "tree") {
    const frames = plant.growthStage === 3 ? largeTreeFrames : smallTreeFrames;
    return frameDataUrl(canvases.trees, frames[index]);
  }
  if (plant.type === "shrubs") {
    return frameDataUrl(canvases.shrubs, shrubFrames[index]);
  }
  if (plant.type === "flowers") {
    return frameDataUrl(canvases.flowers, flowerFrames[index]);
  }
  return frameDataUrl(canvases.grass, grassPlantFrames[index]);
}

/** Crops one atlas frame into a PNG the card can show. */
function frameDataUrl(sheet: HTMLCanvasElement, frame: Frame) {
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.drawImage(sheet, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
  return canvas.toDataURL("image/png");
}

/** The diamond that contains the point, when the point is inside that diamond. */
function tileAtPoint(map: WorldMap, local: Point, lift: number) {
  const grid = gridAt(local, map.height, lift);
  const tile = tileAt(map, grid.x, grid.y);
  if (!tile || !insideDiamond(local, grid.x, grid.y, map.height, lift)) {
    return undefined;
  }
  return tile;
}

function gridAt(local: Point, mapHeight: number, lift: number) {
  const halfWidth = TILE_WIDTH / 2;
  const halfHeight = TILE_HEIGHT / 2;
  const centeredX = (local.x - mapHeight * halfWidth) / halfWidth;
  const centeredY = (local.y - lift - halfHeight) / halfHeight;
  return {
    x: Math.round((centeredY + centeredX) / 2),
    y: Math.round((centeredY - centeredX) / 2),
  };
}

function insideDiamond(local: Point, gridX: number, gridY: number, mapHeight: number, lift: number) {
  const point = isoPoint(gridX, gridY, mapHeight);
  const dx = Math.abs(local.x - point.x) / (TILE_WIDTH / 2);
  const dy = Math.abs(local.y - (point.y + TILE_HEIGHT / 2 + lift)) / (TILE_HEIGHT / 2);
  return dx + dy <= 1;
}

function tileAt(map: WorldMap, x: number, y: number): WorldTile | undefined {
  return map.tiles.find((tile) => tile.x === x && tile.y === y);
}
