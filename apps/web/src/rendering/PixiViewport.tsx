import { useEffect, useRef, useState } from "react";
import type { DepositType, TerrainType, WorldMap, WorldTile } from "@life-simulator/shared";
import type { Container, Texture } from "pixi.js";
import tilesetUrl from "../assets/images/IsometricTerrainAtlas.png";
import depositUrl from "../assets/images/ResourceDepositAtlas.png";
import type { Selection } from "../state/app-state";
import { useAppState } from "../state/app-state";

const TILE_WIDTH = 64;
const VARIANT_COUNT = 6;
const DEPOSIT_VARIANT_COUNT = 3;
/** Shared ground size of a diamond in the atlas, in source pixels. */
const DIAMOND_WIDTH = 217;
const DIAMOND_HALF = 71;
const TILE_SCALE = TILE_WIDTH / DIAMOND_WIDTH;
const TILE_HEIGHT = DIAMOND_HALF * 2 * TILE_SCALE;

const VIEWPORT_BACKGROUND = "#d7efc8";
/** Wheel zoom stays between half and sixteen times the fitted view. */
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 16;
const WHEEL_OUT = 0.9;
const WHEEL_IN = 1.1;
/** Pointer travel below this, in screen pixels, is a click. Past it, the gesture pans. */
const CLICK_SLOP = 4;

/** Sheet background keyed out so neighboring diamonds do not show a dark box. */
const SHEET_BACKGROUND = { red: 24, green: 27, blue: 31 };
/** Pixels this close to the sheet background become fully transparent. */
const KEY_CLEAR = 28;
/** Pixels closer than this fade out, so the diamond edge stays soft. */
const KEY_OPAQUE = 52;

type Frame = { x: number; y: number; width: number; height: number };
type Pixi = typeof import("pixi.js");
type RefBox<T> = { current: T };

type Camera = {
  pixelWidth: number;
  pixelHeight: number;
  fit: number;
};

type Point = {
  x: number;
  y: number;
};

type PixiViewportProps = {
  map: WorldMap | null;
  status: string | null;
};

/** Owns one keyed sheet and the frame textures cut from it. */
type SpriteSheet<Key extends string> = {
  cut: (pixi: Pixi, source: Texture) => Record<Key, Texture[]>;
  release: () => void;
};

/**
 * Six variations of each terrain, left to right, in IsometricTerrainAtlas.png.
 * Water is listed so the cutter stays uniform. The map always draws the first water frame.
 */
const terrainFrames: Record<TerrainType, Frame[]> = {
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
const depositFrames: Record<DepositType, Frame[]> = {
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
const DEPOSIT_SCALE = TILE_WIDTH / Math.max(...Object.values(depositFrames).flat().map((frame) => frame.width));

/**
 * Fills the map area with one PixiJS application.
 * Ground and deposit sprites are built once when a map arrives. Dragging pans and the wheel zooms.
 */
export function PixiViewport({ map, status }: PixiViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<Container | null>(null);
  const cameraRef = useRef<Camera>(emptyCamera());
  const mapRef = useRef<WorldMap | null>(map);
  mapRef.current = map;
  const { select, clearSelection } = useAppState();
  const selectRef = useRef(select);
  selectRef.current = select;
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let cancelled = false;
    let stop: (() => void) | undefined;

    void startApplication(host, worldRef, cameraRef, mapRef, selectRef, () => cancelled, (release) => {
      stop = release;
      setReady(true);
    }).catch((caught: unknown) => {
      if (!cancelled) {
        setError(errorMessage(caught, "Renderer failed to start."));
      }
    });

    return () => {
      cancelled = true;
      stop?.();
      host.replaceChildren();
      setReady(false);
    };
  }, []);

  useEffect(() => {
    clearSelection();
  }, [map, clearSelection]);

  useEffect(() => {
    const host = hostRef.current;
    const world = worldRef.current;
    if (!ready || !host || !world) {
      return;
    }

    clearSprites(world);
    if (!map) {
      cameraRef.current = emptyCamera();
      return;
    }

    let cancelled = false;
    const terrainSheet = createSpriteSheet(terrainFrames);
    const depositSheet = createSpriteSheet(depositFrames);
    const camera = cameraRef.current;
    void paintMap(host, world, map, camera, terrainSheet, depositSheet, () => cancelled || worldRef.current !== world).catch(
      (caught: unknown) => {
        if (!cancelled) {
          setError(errorMessage(caught, "Map textures failed to load."));
        }
      },
    );

    return () => {
      cancelled = true;
      clearSprites(world);
      terrainSheet.release();
      depositSheet.release();
    };
  }, [map, ready]);

  return (
    <section className="eon-viewport" aria-label="World view">
      <div ref={hostRef} className="eon-viewport-canvas" />
      {error || status ? <p className="eon-viewport-status">{error ?? status}</p> : null}
    </section>
  );
}

/**
 * Starts the application, attaches the camera, and reports a function that shuts it down.
 * A cancelled start destroys the application and does not call onReady.
 */
async function startApplication(
  host: HTMLElement,
  worldRef: RefBox<Container | null>,
  cameraRef: RefBox<Camera>,
  mapRef: RefBox<WorldMap | null>,
  selectRef: RefBox<(selection: Selection) => void>,
  isCancelled: () => boolean,
  onReady: (release: () => void) => void,
) {
  const pixi = await import("pixi.js");
  const application = new pixi.Application();
  await application.init({
    resizeTo: host,
    background: VIEWPORT_BACKGROUND,
  });
  if (isCancelled()) {
    application.destroy();
    return;
  }

  const world = new pixi.Container();
  application.stage.addChild(world);
  host.appendChild(application.canvas);
  worldRef.current = world;
  const unbindCamera = bindCamera(host, worldRef, cameraRef, mapRef, selectRef);

  onReady(() => {
    unbindCamera();
    worldRef.current = null;
    application.destroy();
  });
}

/** Dragging pans the map. A click logs the tile, and the deposit when the pointer lands on a pile. */
function bindCamera(
  host: HTMLElement,
  worldRef: RefBox<Container | null>,
  cameraRef: RefBox<Camera>,
  mapRef: RefBox<WorldMap | null>,
  selectRef: RefBox<(selection: Selection) => void>,
) {
  const drag = { active: false, x: 0, y: 0, startX: 0, startY: 0 };

  const onDown = (event: PointerEvent) => {
    if (cameraRef.current.pixelWidth === 0) {
      return;
    }
    drag.active = true;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
  };
  const onMove = (event: PointerEvent) => {
    const world = worldRef.current;
    if (!drag.active || !world) {
      return;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    panBy(host, world, cameraRef.current, dx, dy);
  };
  const onUp = (event: PointerEvent) => {
    if (!drag.active) {
      return;
    }
    drag.active = false;
    const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (moved <= CLICK_SLOP) {
      selectAtPointer(host, worldRef.current, mapRef.current, event.clientX, event.clientY, selectRef.current);
    }
  };
  const onCancel = () => {
    drag.active = false;
  };
  const onWheel = (event: WheelEvent) => {
    const world = worldRef.current;
    if (!world || cameraRef.current.pixelWidth === 0) {
      return;
    }
    event.preventDefault();
    zoomAt(host, world, cameraRef.current, event.clientX, event.clientY, event.deltaY);
  };

  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerup", onUp);
  host.addEventListener("pointercancel", onCancel);
  host.addEventListener("wheel", onWheel, { passive: false });

  return () => {
    host.removeEventListener("pointerdown", onDown);
    host.removeEventListener("pointermove", onMove);
    host.removeEventListener("pointerup", onUp);
    host.removeEventListener("pointercancel", onCancel);
    host.removeEventListener("wheel", onWheel);
  };
}

/**
 * Loads the atlas, places one sprite per tile, and fits the map in the view.
 * Releases the sheet itself when the view was replaced while the image was loading.
 */
async function paintMap(
  host: HTMLElement,
  world: Container,
  map: WorldMap,
  camera: Camera,
  terrainSheet: SpriteSheet<TerrainType>,
  depositSheet: SpriteSheet<DepositType>,
  isStale: () => boolean,
) {
  const pixi = await import("pixi.js");
  const terrainSource = await loadKeyedSheet(tilesetUrl, pixi);
  const terrainTextures = terrainSheet.cut(pixi, terrainSource);
  if (isStale()) {
    terrainSheet.release();
    depositSheet.release();
    return;
  }
  const depositSource = await loadKeyedSheet(depositUrl, pixi);
  const depositTextures = depositSheet.cut(pixi, depositSource);
  if (isStale()) {
    terrainSheet.release();
    depositSheet.release();
    return;
  }

  world.addChild(buildTileLayer(pixi, map, terrainTextures, depositTextures));
  const size = mapPixelSize(map);
  camera.pixelWidth = size.pixelWidth;
  camera.pixelHeight = size.pixelHeight;
  fitMap(host, world, camera);
}

/** Removes sprites without destroying the textures they share. */
function clearSprites(world: Container) {
  for (const child of world.removeChildren()) {
    child.destroy({ children: true, texture: false, textureSource: false });
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

/** Builds the map in painter order so nearer tiles cover farther ones. A deposit is drawn on its own ground. */
function buildTileLayer(
  pixi: Pixi,
  map: WorldMap,
  terrainTextures: Record<TerrainType, Texture[]>,
  depositTextures: Record<DepositType, Texture[]>,
) {
  const layer = new pixi.Container();
  const lift = depositOverhang();
  forEachTile(map, (x, y, tile) => {
    const ground = terrainTextures[tile.terrain][frameIndex(tile.terrain, map.seed, x, y)];
    layer.addChild(createTileSprite(pixi, ground, x, y, map.height, lift));
    for (const deposit of tile.deposits) {
      const texture = depositTextures[deposit.type][depositVariant(map.seed, x, y, deposit.type)];
      layer.addChild(createDepositSprite(pixi, texture, x, y, map.height, lift));
    }
  });
  return layer;
}

/** Walks stored tiles from back to front. The diagonal sum x + y is the draw order. */
function forEachTile(
  map: WorldMap,
  visit: (x: number, y: number, tile: { terrain: TerrainType; deposits: WorldTile["deposits"] }) => void,
) {
  const tiles = new Map(
    map.tiles.map((tile) => [`${tile.x},${tile.y}`, { terrain: tile.terrainType, deposits: tile.deposits }]),
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
 * Sets the pile's base on the middle of the diamond.
 * The same coordinate keeps the same variant of that deposit.
 */
function createDepositSprite(pixi: Pixi, texture: Texture, x: number, y: number, mapHeight: number, lift: number) {
  const sprite = new pixi.Sprite(texture);
  const point = isoPoint(x, y, mapHeight);
  sprite.anchor.set(0.5, 1);
  sprite.scale.set(DEPOSIT_SCALE);
  sprite.position.set(point.x, point.y + TILE_HEIGHT / 2 + lift);
  return sprite;
}

/**
 * Grass, dirt, and sand keep one of six pictures for a coordinate.
 * Water always uses the first picture.
 */
function frameIndex(terrain: TerrainType, seed: string, x: number, y: number): number {
  if (terrain === "water") {
    return 0;
  }
  return variantIndex(seed, x, y);
}

/** Same seed and coordinate always pick the same ground variation. */
function variantIndex(seed: string, x: number, y: number): number {
  return hashVariant(`${seed}:${x}:${y}`, VARIANT_COUNT);
}

/** Same seed, coordinate, and deposit always pick the same pile. */
function depositVariant(seed: string, x: number, y: number, deposit: DepositType): number {
  return hashVariant(`${seed}:${deposit}:${x}:${y}`, DEPOSIT_VARIANT_COUNT);
}

function hashVariant(text: string, count: number): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % count;
}

/** Decodes an atlas and removes its flat background. */
async function loadKeyedSheet(url: string, pixi: Pixi) {
  const image = new Image();
  image.src = url;
  await image.decode();
  return pixi.Texture.from(keyOutBackground(image));
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

/** Pixel size of the whole diamond grid, including the tallest frame's extra skirt. */
function mapPixelSize(map: WorldMap) {
  const span = map.width + map.height;
  return {
    pixelWidth: (span * TILE_WIDTH) / 2,
    pixelHeight: (span * TILE_HEIGHT) / 2 + skirtHeight() + depositOverhang(),
  };
}

/** Space below the ground diamond so a bush on a tall frame is not clipped. */
function skirtHeight() {
  return Math.max(...Object.values(terrainFrames).flat().map((frame) => frame.height * TILE_SCALE - TILE_HEIGHT));
}

/** Space above the back tiles so a pile that rises past the diamond peak stays inside the camera. */
function depositOverhang() {
  const tallest = Math.max(...Object.values(depositFrames).flat().map((frame) => frame.height));
  return Math.max(0, tallest * DEPOSIT_SCALE - TILE_HEIGHT / 2);
}

/** Places a tile's top corner. X grows down-right and Y grows down-left. */
function isoPoint(gridX: number, gridY: number, mapHeight: number): Point {
  return {
    x: (gridX - gridY) * (TILE_WIDTH / 2) + mapHeight * (TILE_WIDTH / 2),
    y: (gridX + gridY) * (TILE_HEIGHT / 2),
  };
}

/** Stores the tile under the pointer. A pile hit is stored as the selected deposit. */
function selectAtPointer(
  host: HTMLElement,
  world: Container | null,
  map: WorldMap | null,
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
  const lift = depositOverhang();
  const depositHit = depositAt(map, local, lift);
  const tile = depositHit ? tileAt(map, depositHit.x, depositHit.y) : tileAtPoint(map, local, lift);
  if (!tile) {
    return;
  }
  select({ tile, deposit: depositHit?.deposit ?? null });
}

/** The front-most pile whose picture contains the point. */
function depositAt(map: WorldMap, local: Point, lift: number): { x: number; y: number; deposit: DepositType } | null {
  const rough = gridAt(local, map.height, lift);
  const candidates: { x: number; y: number }[] = [];
  for (let y = rough.y - 2; y <= rough.y + 2; y += 1) {
    for (let x = rough.x - 2; x <= rough.x + 2; x += 1) {
      if (tileAt(map, x, y)) {
        candidates.push({ x, y });
      }
    }
  }
  candidates.sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);

  let hit: { x: number; y: number; deposit: DepositType } | null = null;
  for (const candidate of candidates) {
    const tile = tileAt(map, candidate.x, candidate.y);
    if (!tile) {
      continue;
    }
    for (const deposit of tile.deposits) {
      if (insideDeposit(map, local, candidate.x, candidate.y, deposit.type, lift)) {
        hit = { x: candidate.x, y: candidate.y, deposit: deposit.type };
      }
    }
  }
  return hit;
}

function insideDeposit(map: WorldMap, local: Point, x: number, y: number, deposit: DepositType, lift: number) {
  const frame = depositFrames[deposit][depositVariant(map.seed, x, y, deposit)];
  if (!frame) {
    return false;
  }
  const width = frame.width * DEPOSIT_SCALE;
  const height = frame.height * DEPOSIT_SCALE;
  const point = isoPoint(x, y, map.height);
  const footX = point.x;
  const footY = point.y + TILE_HEIGHT / 2 + lift;
  return local.x >= footX - width / 2 && local.x <= footX + width / 2 && local.y >= footY - height && local.y <= footY;
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

/** Scales the map to the host and centers it. Records that scale as the zoom baseline. */
function fitMap(host: HTMLElement, world: Container, camera: Camera) {
  const scale = Math.min(host.clientWidth / camera.pixelWidth, host.clientHeight / camera.pixelHeight);
  if (!Number.isFinite(scale) || scale <= 0) {
    return;
  }
  camera.fit = scale;
  world.scale.set(scale);
  world.position.set((host.clientWidth - camera.pixelWidth * scale) / 2, (host.clientHeight - camera.pixelHeight * scale) / 2);
}

function panBy(host: HTMLElement, world: Container, camera: Camera, dx: number, dy: number) {
  world.x += dx;
  world.y += dy;
  clampPan(host, world, camera);
}

/** Zooms around the pointer and keeps the point under the cursor in place. */
function zoomAt(host: HTMLElement, world: Container, camera: Camera, clientX: number, clientY: number, deltaY: number) {
  const next = clamp(world.scale.x * (deltaY > 0 ? WHEEL_OUT : WHEEL_IN), camera.fit * ZOOM_MIN, camera.fit * ZOOM_MAX);
  const rect = host.getBoundingClientRect();
  const localX = (clientX - rect.left - world.x) / world.scale.x;
  const localY = (clientY - rect.top - world.y) / world.scale.y;
  world.scale.set(next);
  world.position.set(clientX - rect.left - localX * next, clientY - rect.top - localY * next);
  clampPan(host, world, camera);
}

function clampPan(host: HTMLElement, world: Container, camera: Camera) {
  world.x = clampAxis(world.x, camera.pixelWidth * world.scale.x, host.clientWidth);
  world.y = clampAxis(world.y, camera.pixelHeight * world.scale.y, host.clientHeight);
}

/** Keeps a fitted map inside the host, and a zoomed map from showing empty margin. */
function clampAxis(value: number, mapSize: number, viewSize: number) {
  if (mapSize <= viewSize) {
    return Math.min(viewSize - mapSize, Math.max(0, value));
  }
  return Math.min(0, Math.max(viewSize - mapSize, value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function emptyCamera(): Camera {
  return { pixelWidth: 0, pixelHeight: 0, fit: 1 };
}

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}
