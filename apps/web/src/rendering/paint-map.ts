import type { DepositType, TerrainType, WorldMap, WorldTile } from "@life-simulator/shared";
import type { Container, Texture } from "pixi.js";
import flowersUrl from "../assets/images/FlowersAtlas.png";
import grassPlantsUrl from "../assets/images/GrassAtlas.png";
import tilesetUrl from "../assets/images/IsometricTerrainAtlas.png";
import depositUrl from "../assets/images/ResourceDepositAtlas.png";
import shrubsUrl from "../assets/images/ShrubsAtlas.png";
import treesUrl from "../assets/images/TreesAtlas.png";
import { footDepth } from "../world/feet";
import {
  DEPOSIT_SCALE,
  depositFrames,
  depositVariant,
  flowerFrames,
  FLOWER_SCALE,
  frameIndex,
  grassPlantFrames,
  GRASS_PLANT_SCALE,
  plantVariant,
  shrubFrames,
  SHRUB_SCALE,
  terrainFrames,
  treeFrames,
  TREE_SCALE,
  type Frame,
} from "./atlas-frames";
import type { Camera, RefBox } from "./camera";
import { fitMap } from "./camera";
import { groundY, isoPoint, mapPixelSize, sceneryOverhang, type KeyedCanvases } from "./map-geometry";
import { PLANT_GROUND_AT, RESOURCE_GROUND_AT, TILE_SCALE } from "./metrics";

type Pixi = typeof import("pixi.js");

/** Owns one keyed sheet and the frame textures cut from it. */
type SpriteSheet<Key extends string> = {
  cut: (pixi: Pixi, source: Texture) => Record<Key, Texture[]>;
  release: () => void;
};

type AtlasSheets = {
  terrain: SpriteSheet<TerrainType>;
  deposits: SpriteSheet<DepositType>;
  trees: SpriteSheet<"large" | "small">;
  shrubs: SpriteSheet<"shrubs">;
  flowers: SpriteSheet<"flowers">;
  grass: SpriteSheet<"grass">;
};

/** Sheet background keyed out so neighboring diamonds do not show a dark box. */
const SHEET_BACKGROUND = { red: 24, green: 27, blue: 31 };
/** Pixels this close to the sheet background become fully transparent. */
const KEY_CLEAR = 28;
/** Pixels closer than this fade out, so the diamond edge stays soft. */
const KEY_OPAQUE = 52;

/** One sheet per atlas. release() drops every sheet this call created. */
export function openAtlasSheets() {
  const sheets: AtlasSheets = {
    terrain: createSpriteSheet(terrainFrames),
    deposits: createSpriteSheet(depositFrames),
    trees: createSpriteSheet(treeFrames),
    shrubs: createSpriteSheet({ shrubs: shrubFrames }),
    flowers: createSpriteSheet({ flowers: flowerFrames }),
    grass: createSpriteSheet({ grass: grassPlantFrames }),
  };
  return {
    sheets,
    release() {
      for (const sheet of Object.values(sheets)) {
        sheet.release();
      }
    },
  };
}

/**
 * Loads the atlas, places one sprite per tile, and fits the map in the view.
 * Releases the sheet itself when the view was replaced while the image was loading.
 */
export async function paintMap(
  host: HTMLElement,
  world: Container,
  map: WorldMap,
  camera: Camera,
  canvasesRef: RefBox<KeyedCanvases | null>,
  mapLayerRef: RefBox<Container | null>,
  propsRef: RefBox<Container | null>,
  sheets: AtlasSheets,
  isStale: () => boolean,
) {
  const pixi = await import("pixi.js");
  const [terrainCanvas, depositCanvas, treeCanvas, shrubCanvas, flowerCanvas, grassCanvas] = await Promise.all([
    loadKeyedCanvas(tilesetUrl),
    loadKeyedCanvas(depositUrl),
    loadKeyedCanvas(treesUrl),
    loadKeyedCanvas(shrubsUrl),
    loadKeyedCanvas(flowersUrl),
    loadKeyedCanvas(grassPlantsUrl),
  ]);
  if (isStale()) {
    releaseSheets(sheets);
    return false;
  }
  const terrainTextures = sheets.terrain.cut(pixi, pixi.Texture.from(terrainCanvas));
  const depositTextures = sheets.deposits.cut(pixi, pixi.Texture.from(depositCanvas));
  const treeTextures = sheets.trees.cut(pixi, pixi.Texture.from(treeCanvas));
  const shrubTextures = sheets.shrubs.cut(pixi, pixi.Texture.from(shrubCanvas));
  const flowerTextures = sheets.flowers.cut(pixi, pixi.Texture.from(flowerCanvas));
  const grassTextures = sheets.grass.cut(pixi, pixi.Texture.from(grassCanvas));
  if (isStale()) {
    releaseSheets(sheets);
    return false;
  }
  canvasesRef.current = {
    terrain: terrainCanvas,
    deposits: depositCanvas,
    trees: treeCanvas,
    shrubs: shrubCanvas,
    flowers: flowerCanvas,
    grass: grassCanvas,
  };

  const built = buildTileLayer(pixi, map, terrainTextures, depositTextures, {
    large: treeTextures.large,
    small: treeTextures.small,
    shrubs: shrubTextures.shrubs,
    flowers: flowerTextures.flowers,
    grass: grassTextures.grass,
  });
  mapLayerRef.current = built.layer;
  propsRef.current = built.props;
  world.addChild(built.layer);
  const size = mapPixelSize(map);
  camera.pixelWidth = size.pixelWidth;
  camera.pixelHeight = size.pixelHeight;
  fitMap(host, world, camera);
  return true;
}

function releaseSheets(sheets: { [key: string]: { release: () => void } }) {
  for (const sheet of Object.values(sheets)) {
    sheet.release();
  }
}

/**
 * Holds the keyed sheet and every frame cut from it.
 * release() drops the frames first, then the sheet, and a second call does nothing.
 */
function createSpriteSheet<Key extends string>(framesByKey: Record<Key, Frame[]>): SpriteSheet<Key> {
  const frames: Texture[] = [];
  let sheet: Texture | null = null;

  return {
    cut(pixi, source) {
      sheet = source;
      return Object.fromEntries(
        (Object.entries(framesByKey) as [Key, Frame[]][]).map(([key, variants]) => [
          key,
          variants.map((frame) => {
            const texture = new pixi.Texture({
              source: source.source,
              frame: new pixi.Rectangle(frame.x, frame.y, frame.width, frame.height),
            });
            frames.push(texture);
            return texture;
          }),
        ]),
      ) as Record<Key, Texture[]>;
    },
    release() {
      const source = sheet;
      sheet = null;
      for (const texture of frames.splice(0)) {
        texture.destroy(false);
      }
      source?.destroy(true);
    },
  };
}

/**
 * Draws every ground diamond first, back to front.
 * Plants and deposits share a second list, ordered by the screen depth of their feet.
 */
function buildTileLayer(
  pixi: Pixi,
  map: WorldMap,
  terrainTextures: Record<TerrainType, Texture[]>,
  depositTextures: Record<DepositType, Texture[]>,
  plantTextures: Record<"large" | "small" | "shrubs" | "flowers" | "grass", Texture[]>,
) {
  const layer = new pixi.Container();
  const ground = new pixi.Container();
  const props = new pixi.Container();
  props.sortableChildren = true;
  layer.addChild(ground);
  layer.addChild(props);
  const lift = sceneryOverhang();
  forEachTile(map, (x, y, tile) => {
    const terrain = terrainTextures[tile.terrain][frameIndex(tile.terrain, map.seed, x, y)];
    ground.addChild(createTileSprite(pixi, terrain, x, y, map.height, lift));
    const depth = footDepth(x, y);
    for (const deposit of tile.deposits) {
      const texture = depositTextures[deposit.type][depositVariant(map.seed, x, y, deposit.type)];
      const depositSprite = createDepositSprite(pixi, texture, x, y, map.height, lift);
      depositSprite.zIndex = depth;
      props.addChild(depositSprite);
    }
    for (const plant of tile.vegitation) {
      const look = plantLook(plant);
      const texture = plantTextures[look.key][plantVariant(map.seed, x, y, plant.type)];
      const plantSprite = createPlantSprite(pixi, texture, x, y, map.height, lift, look.scale);
      plantSprite.zIndex = depth;
      props.addChild(plantSprite);
    }
  });
  return { layer, props };
}

/** Walks stored tiles from back to front. The diagonal sum x + y is the draw order. */
function forEachTile(
  map: WorldMap,
  visit: (x: number, y: number, tile: { terrain: TerrainType; deposits: WorldTile["deposits"]; vegitation: WorldTile["vegitation"] }) => void,
) {
  const tiles = new Map(
    map.tiles.map((tile) => [
      `${tile.x},${tile.y}`,
      { terrain: tile.terrainType, deposits: tile.deposits, vegitation: tile.vegitation },
    ]),
  );
  for (let sum = 0; sum < map.width + map.height - 1; sum += 1) {
    const xStart = Math.max(0, sum - (map.height - 1));
    const xEnd = Math.min(sum, map.width - 1);
    for (let x = xStart; x <= xEnd; x += 1) {
      const tile = tiles.get(`${x},${sum - x}`);
      if (tile) {
        visit(x, sum - x, tile);
      }
    }
  }
}

/**
 * Anchors the sprite on the diamond peak so neighboring tiles share edges.
 * Scale is the same for every frame, so a taller picture does not shrink the ground.
 */
function createTileSprite(pixi: Pixi, texture: Texture, x: number, y: number, mapHeight: number, lift: number) {
  const sprite = new pixi.Sprite(texture);
  const point = isoPoint(x, y, mapHeight);
  sprite.anchor.set(0.5, 0);
  sprite.scale.set(TILE_SCALE);
  sprite.position.set(point.x, point.y + lift);
  return sprite;
}

/**
 * Sets the pile a little below the middle of the diamond.
 * The same coordinate keeps the same variant of that deposit.
 */
function createDepositSprite(pixi: Pixi, texture: Texture, x: number, y: number, mapHeight: number, lift: number) {
  return createGroundedSprite(pixi, texture, x, y, mapHeight, lift, DEPOSIT_SCALE, RESOURCE_GROUND_AT);
}

/** Sets the plant's base on the middle of the diamond. Mature trees use the tall picture. */
function createPlantSprite(pixi: Pixi, texture: Texture, x: number, y: number, mapHeight: number, lift: number, scale: number) {
  return createGroundedSprite(pixi, texture, x, y, mapHeight, lift, scale, PLANT_GROUND_AT);
}

function createGroundedSprite(
  pixi: Pixi,
  texture: Texture,
  x: number,
  y: number,
  mapHeight: number,
  lift: number,
  scale: number,
  groundAt: number,
) {
  const sprite = new pixi.Sprite(texture);
  const point = isoPoint(x, y, mapHeight);
  sprite.anchor.set(0.5, 1);
  sprite.scale.set(scale);
  sprite.position.set(point.x, groundY(point.y, lift, groundAt));
  return sprite;
}

function plantLook(plant: WorldTile["vegitation"][number]): { key: "large" | "small" | "shrubs" | "flowers" | "grass"; scale: number } {
  if (plant.type === "tree") {
    return { key: plant.growthStage === 3 ? "large" : "small", scale: TREE_SCALE };
  }
  if (plant.type === "shrubs") {
    return { key: "shrubs", scale: SHRUB_SCALE };
  }
  if (plant.type === "flowers") {
    return { key: "flowers", scale: FLOWER_SCALE };
  }
  return { key: "grass", scale: GRASS_PLANT_SCALE };
}

/** Decodes an atlas and removes its flat background. */
async function loadKeyedCanvas(url: string) {
  const image = new Image();
  image.src = url;
  await image.decode();
  return keyOutBackground(image);
}

function keyOutBackground(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Map textures failed to load.");
  }
  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  applyColorKey(imageData.data);
  context.putImageData(imageData, 0, 0);
  return canvas;
}

/** Clears pixels near the sheet background and fades the ones on the edge. */
function applyColorKey(pixels: Uint8ClampedArray) {
  for (let index = 0; index < pixels.length; index += 4) {
    const distance =
      Math.abs(pixels[index] - SHEET_BACKGROUND.red) +
      Math.abs(pixels[index + 1] - SHEET_BACKGROUND.green) +
      Math.abs(pixels[index + 2] - SHEET_BACKGROUND.blue);
    if (distance < KEY_CLEAR) {
      pixels[index + 3] = 0;
    } else if (distance < KEY_OPAQUE) {
      pixels[index + 3] = Math.round((255 * (distance - KEY_CLEAR)) / (KEY_OPAQUE - KEY_CLEAR));
    }
  }
}
