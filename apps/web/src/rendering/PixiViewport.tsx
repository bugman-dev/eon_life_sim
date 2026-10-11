import { useEffect, useRef, useState } from "react";
import type { TerrainType, WorldMap } from "@life-simulator/shared";
import type { Container, Texture } from "pixi.js";
import tilesetUrl from "../assets/images/IsometricTerrainAtlas.png";

const TILE_WIDTH = 64;
const VARIANT_COUNT = 6;
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

/** Owns the keyed sheet and the frame textures cut from it. */
type TerrainSheet = {
  cut: (pixi: Pixi, source: Texture) => Record<TerrainType, Texture[]>;
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

/**
 * Fills the map area with one PixiJS application.
 * Sprites are built once when a map arrives. Dragging pans and the wheel zooms.
 */
export function PixiViewport({ map, status }: PixiViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<Container | null>(null);
  const cameraRef = useRef<Camera>(emptyCamera());
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let cancelled = false;
    let stop: (() => void) | undefined;

    void startApplication(host, worldRef, cameraRef, () => cancelled, (release) => {
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
    const sheet = createTerrainSheet();
    const camera = cameraRef.current;
    void paintMap(host, world, map, camera, sheet, () => cancelled || worldRef.current !== world).catch(
      (caught: unknown) => {
        if (!cancelled) {
          setError(errorMessage(caught, "Map textures failed to load."));
        }
      },
    );

    return () => {
      cancelled = true;
      clearSprites(world);
      sheet.release();
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
  const unbindCamera = bindCamera(host, worldRef, cameraRef);

  onReady(() => {
    unbindCamera();
    worldRef.current = null;
    application.destroy();
  });
}

/** Dragging pans the map. The wheel zooms toward the pointer. */
function bindCamera(host: HTMLElement, worldRef: RefBox<Container | null>, cameraRef: RefBox<Camera>) {
  const drag = { active: false, x: 0, y: 0 };

  const onDown = (event: PointerEvent) => {
    if (cameraRef.current.pixelWidth === 0) {
      return;
    }
    drag.active = true;
    drag.x = event.clientX;
    drag.y = event.clientY;
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
  const onUp = () => {
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
  host.addEventListener("pointercancel", onUp);
  host.addEventListener("wheel", onWheel, { passive: false });

  return () => {
    host.removeEventListener("pointerdown", onDown);
    host.removeEventListener("pointermove", onMove);
    host.removeEventListener("pointerup", onUp);
    host.removeEventListener("pointercancel", onUp);
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
  sheet: TerrainSheet,
  isStale: () => boolean,
) {
  const pixi = await import("pixi.js");
  const source = await loadTerrainSheet(tilesetUrl, pixi);
  const textures = sheet.cut(pixi, source);
  if (isStale()) {
    sheet.release();
    return;
  }

  world.addChild(buildTileLayer(pixi, map, textures));
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
function createTerrainSheet(): TerrainSheet {
  const frames: Texture[] = [];
  let sheet: Texture | null = null;

  return {
    cut(pixi, source) {
      sheet = source;
      return Object.fromEntries(
        (Object.entries(terrainFrames) as [TerrainType, Frame[]][]).map(([terrain, variants]) => [
          terrain,
          variants.map((frame) => {
            const texture = new pixi.Texture({
              source: source.source,
              frame: new pixi.Rectangle(frame.x, frame.y, frame.width, frame.height),
            });
            frames.push(texture);
            return texture;
          }),
        ]),
      ) as Record<TerrainType, Texture[]>;
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

/** Builds the map in painter order so nearer tiles cover farther ones. */
function buildTileLayer(pixi: Pixi, map: WorldMap, textures: Record<TerrainType, Texture[]>) {
  const layer = new pixi.Container();
  forEachTile(map, (x, y, terrain) => {
    const texture = textures[terrain][frameIndex(terrain, map.seed, x, y)];
    layer.addChild(createTileSprite(pixi, texture, x, y, map.height));
  });
  return layer;
}

/** Walks stored tiles from back to front. The diagonal sum x + y is the draw order. */
function forEachTile(map: WorldMap, visit: (x: number, y: number, terrain: TerrainType) => void) {
  const tiles = new Map(map.tiles.map((tile) => [`${tile.x},${tile.y}`, tile.terrainType]));
  for (let sum = 0; sum < map.width + map.height - 1; sum += 1) {
    const xStart = Math.max(0, sum - (map.height - 1));
    const xEnd = Math.min(sum, map.width - 1);
    for (let x = xStart; x <= xEnd; x += 1) {
      const terrain = tiles.get(`${x},${sum - x}`);
      if (terrain) {
        visit(x, sum - x, terrain);
      }
    }
  }
}

/**
 * Anchors the sprite on the diamond peak so neighboring tiles share edges.
 * Scale is the same for every frame, so a taller picture does not shrink the ground.
 */
function createTileSprite(pixi: Pixi, texture: Texture, x: number, y: number, mapHeight: number) {
  const sprite = new pixi.Sprite(texture);
  const point = isoPoint(x, y, mapHeight);
  sprite.anchor.set(0.5, 0);
  sprite.scale.set(TILE_SCALE);
  sprite.position.set(point.x, point.y);
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

/** Same seed and coordinate always pick the same variation. */
function variantIndex(seed: string, x: number, y: number): number {
  let hash = 2166136261;
  const text = `${seed}:${x}:${y}`;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % VARIANT_COUNT;
}

/** Decodes the atlas and removes its flat background. */
async function loadTerrainSheet(url: string, pixi: Pixi) {
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
    pixelHeight: (span * TILE_HEIGHT) / 2 + skirtHeight(),
  };
}

/** Space below the ground diamond so a bush on a tall frame is not clipped. */
function skirtHeight() {
  return Math.max(...Object.values(terrainFrames).flat().map((frame) => frame.height * TILE_SCALE - TILE_HEIGHT));
}

/** Places a tile's top corner. X grows down-right and Y grows down-left. */
function isoPoint(gridX: number, gridY: number, mapHeight: number): Point {
  return {
    x: (gridX - gridY) * (TILE_WIDTH / 2) + mapHeight * (TILE_WIDTH / 2),
    y: (gridX + gridY) * (TILE_HEIGHT / 2),
  };
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
