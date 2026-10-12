import { useEffect, useRef, useState } from "react";
import { hashTile, type DepositType, type TerrainType, type VegetationType, type WorldMap, type WorldTile } from "@life-simulator/shared";
import type { Container, Texture } from "pixi.js";
import flowersUrl from "../assets/images/FlowersAtlas.png";
import grassPlantsUrl from "../assets/images/GrassAtlas.png";
import tilesetUrl from "../assets/images/IsometricTerrainAtlas.png";
import depositUrl from "../assets/images/ResourceDepositAtlas.png";
import shrubsUrl from "../assets/images/ShrubsAtlas.png";
import treesUrl from "../assets/images/TreesAtlas.png";
import type { Selection } from "../state/app-state";
import { useAppState } from "../state/app-state";
import { footDepth } from "../world/feet";
import { sortByFeet } from "../world/draw-order";
import { useWorldStage } from "./world-stage";

const TILE_WIDTH = 64;
const VARIANT_COUNT = 6;
const DEPOSIT_VARIANT_COUNT = 3;
const PLANT_VARIANT_COUNT = 6;
/** Shared ground size of a diamond in the atlas, in source pixels. */
const DIAMOND_WIDTH = 217;
const DIAMOND_HALF = 71;
const TILE_SCALE = TILE_WIDTH / DIAMOND_WIDTH;
const TILE_HEIGHT = DIAMOND_HALF * 2 * TILE_SCALE;
/**
 * The bottom of each plant sits on the middle of the diamond.
 * Piles stay a little further forward, toward the front corner.
 */
const PLANT_GROUND_AT = 0.65;
const RESOURCE_GROUND_AT = 0.75;

const VIEWPORT_BACKGROUND = "#d7efc8";
/** Wheel zoom stays between half and sixty-four times the fitted view. */
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 64;
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

/** Keyed atlas canvases, kept so a click can copy the same pixels the map drew. */
type KeyedCanvases = {
  terrain: HTMLCanvasElement;
  deposits: HTMLCanvasElement;
  trees: HTMLCanvasElement;
  shrubs: HTMLCanvasElement;
  flowers: HTMLCanvasElement;
  grass: HTMLCanvasElement;
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

/** Tall trees across the top of TreesAtlas.png, then the short trees along the bottom. Stage 3 uses the tall row. */
const largeTreeFrames: Frame[] = [
  { x: 34, y: 122, width: 233, height: 433 },
  { x: 291, y: 122, width: 227, height: 434 },
  { x: 539, y: 122, width: 199, height: 435 },
  { x: 762, y: 122, width: 198, height: 437 },
  { x: 980, y: 122, width: 267, height: 438 },
  { x: 1264, y: 122, width: 244, height: 437 },
];
const smallTreeFrames: Frame[] = [
  { x: 59, y: 664, width: 191, height: 271 },
  { x: 307, y: 664, width: 193, height: 271 },
  { x: 571, y: 664, width: 152, height: 271 },
  { x: 801, y: 664, width: 182, height: 271 },
  { x: 1058, y: 664, width: 173, height: 271 },
  { x: 1302, y: 664, width: 173, height: 270 },
];
const treeFrames = { large: largeTreeFrames, small: smallTreeFrames };

/** Six shrubs, left to right, in ShrubsAtlas.png. */
const shrubFrames: Frame[] = [
  { x: 30, y: 260, width: 265, height: 319 },
  { x: 314, y: 260, width: 271, height: 325 },
  { x: 603, y: 260, width: 274, height: 325 },
  { x: 894, y: 260, width: 271, height: 324 },
  { x: 1185, y: 260, width: 269, height: 319 },
  { x: 1473, y: 260, width: 275, height: 325 },
];

/** Six flower clumps, left to right, in FlowersAtlas.png. */
const flowerFrames: Frame[] = [
  { x: 63, y: 182, width: 259, height: 365 },
  { x: 417, y: 182, width: 263, height: 367 },
  { x: 769, y: 181, width: 271, height: 366 },
  { x: 1125, y: 182, width: 271, height: 366 },
  { x: 1475, y: 182, width: 278, height: 382 },
  { x: 1842, y: 181, width: 264, height: 367 },
];

/** Six grass tufts, left to right, in GrassAtlas.png. */
const grassPlantFrames: Frame[] = [
  { x: 72, y: 182, width: 253, height: 355 },
  { x: 427, y: 182, width: 248, height: 358 },
  { x: 771, y: 182, width: 264, height: 358 },
  { x: 1120, y: 182, width: 277, height: 360 },
  { x: 1479, y: 182, width: 269, height: 360 },
  { x: 1853, y: 182, width: 260, height: 358 },
];

/** The widest tall tree is one tile across. Shorter plants use a smaller share of that tile. */
const TREE_SCALE = TILE_WIDTH / 267;
const SHRUB_SCALE = (TILE_WIDTH * 0.72) / 275;
const FLOWER_SCALE = (TILE_WIDTH * 0.58) / 278;
const GRASS_PLANT_SCALE = (TILE_WIDTH * 0.5) / 277;

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
  const canvasesRef = useRef<KeyedCanvases | null>(null);
  const mapLayerRef = useRef<Container | null>(null);
  const propsRef = useRef<Container | null>(null);
  const entitiesRef = useRef<Map<Container, Point | null>>(new Map());
  const overlayRef = useRef<Container | null>(null);
  const { select, clearSelection, registerViewInWorld } = useAppState();
  const { registerStage, noteViewFitted } = useWorldStage();
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

    void startApplication(host, worldRef, cameraRef, mapRef, canvasesRef, selectRef, () => cancelled, (release) => {
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
    registerViewInWorld((x, y) => {
      const host = hostRef.current;
      const world = worldRef.current;
      const currentMap = mapRef.current;
      const camera = cameraRef.current;
      if (!host || !world || !currentMap || camera.pixelWidth === 0) {
        return;
      }
      const scale = camera.fit * ZOOM_MAX;
      const peak = isoPoint(x, y, currentMap.height);
      const centerX = peak.x;
      const centerY = peak.y + TILE_HEIGHT / 2 + sceneryOverhang();
      world.scale.set(scale);
      world.position.set(host.clientWidth / 2 - centerX * scale, host.clientHeight / 2 - centerY * scale);
      clampPan(host, world, camera);
    });
    return () => registerViewInWorld(null);
  }, [registerViewInWorld]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    registerStage({
      attachEntity(container) {
        const world = worldRef.current;
        if (!world) {
          return;
        }
        const point = entitiesRef.current.get(container);
        if (point === undefined) {
          entitiesRef.current.set(container, null);
          return;
        }
        if (point) {
          sortByFeet(container, point.x, point.y, propsRef.current, world);
        }
      },
      detachEntity(container) {
        if (!entitiesRef.current.has(container)) {
          return;
        }
        entitiesRef.current.delete(container);
        container.removeFromParent();
        container.destroy({ children: true });
      },
      attachOverlay(container) {
        const world = worldRef.current;
        const currentMap = mapRef.current;
        if (!world || !currentMap) {
          return;
        }
        if (overlayRef.current && overlayRef.current !== container) {
          overlayRef.current.destroy({ children: true });
        }
        overlayRef.current = container;
        pinOverlay(container, currentMap.height, world);
      },
      detachOverlay() {
        const overlay = overlayRef.current;
        overlayRef.current = null;
        if (!overlay) {
          return;
        }
        overlay.removeFromParent();
        overlay.destroy({ children: true });
      },
      placeEntity(container, x, y) {
        const currentMap = mapRef.current;
        const world = worldRef.current;
        if (!currentMap || !world || !entitiesRef.current.has(container)) {
          return;
        }
        const grid = { x, y };
        entitiesRef.current.set(container, grid);
        positionEntity(container, grid, currentMap.height, propsRef.current, world);
      },
      centerView(x, y) {
        const host = hostRef.current;
        const world = worldRef.current;
        const currentMap = mapRef.current;
        const camera = cameraRef.current;
        if (!host || !world || !currentMap || camera.pixelWidth === 0) {
          return;
        }
        const point = tileCenter(x, y, currentMap.height);
        const scale = world.scale.x;
        world.position.set(host.clientWidth / 2 - point.x * scale, host.clientHeight / 2 - point.y * scale);
        clampPan(host, world, camera);
      },
    });
    return () => {
      entitiesRef.current.clear();
      overlayRef.current = null;
      registerStage(null);
    };
  }, [ready, registerStage]);

  useEffect(() => {
    const host = hostRef.current;
    const world = worldRef.current;
    if (!ready || !host || !world) {
      return;
    }

    clearMapLayer(mapLayerRef, propsRef, entitiesRef);
    if (!map) {
      cameraRef.current = emptyCamera();
      return;
    }

    let cancelled = false;
    const terrainSheet = createSpriteSheet(terrainFrames);
    const depositSheet = createSpriteSheet(depositFrames);
    const treeSheet = createSpriteSheet(treeFrames);
    const shrubSheet = createSpriteSheet({ shrubs: shrubFrames });
    const flowerSheet = createSpriteSheet({ flowers: flowerFrames });
    const grassSheet = createSpriteSheet({ grass: grassPlantFrames });
    const sheets = [terrainSheet, depositSheet, treeSheet, shrubSheet, flowerSheet, grassSheet];
    const camera = cameraRef.current;
    void paintMap(
      host,
      world,
      map,
      camera,
      canvasesRef,
      mapLayerRef,
      propsRef,
      { terrain: terrainSheet, deposits: depositSheet, trees: treeSheet, shrubs: shrubSheet, flowers: flowerSheet, grass: grassSheet },
      () => cancelled || worldRef.current !== world,
    )
      .then((fitted) => {
        if (cancelled || !fitted) {
          return;
        }
        restackEntities(entitiesRef.current, map.height, propsRef.current, world);
        const overlay = overlayRef.current;
        if (overlay) {
          pinOverlay(overlay, map.height, world);
        }
        noteViewFitted();
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(errorMessage(caught, "Map textures failed to load."));
        }
      });

    return () => {
      cancelled = true;
      canvasesRef.current = null;
      clearMapLayer(mapLayerRef, propsRef, entitiesRef);
      for (const sheet of sheets) {
        sheet.release();
      }
    };
  }, [map, ready, noteViewFitted]);

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
  canvasesRef: RefBox<KeyedCanvases | null>,
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
  const unbindCamera = bindCamera(host, worldRef, cameraRef, mapRef, canvasesRef, selectRef);

  onReady(() => {
    unbindCamera();
    worldRef.current = null;
    application.destroy();
  });
}

/** Dragging pans the map. A click selects the diamond under the pointer. */
function bindCamera(
  host: HTMLElement,
  worldRef: RefBox<Container | null>,
  cameraRef: RefBox<Camera>,
  mapRef: RefBox<WorldMap | null>,
  canvasesRef: RefBox<KeyedCanvases | null>,
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
      selectAtPointer(host, worldRef.current, mapRef.current, canvasesRef.current, event.clientX, event.clientY, selectRef.current);
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
  canvasesRef: RefBox<KeyedCanvases | null>,
  mapLayerRef: RefBox<Container | null>,
  propsRef: RefBox<Container | null>,
  sheets: {
    terrain: SpriteSheet<TerrainType>;
    deposits: SpriteSheet<DepositType>;
    trees: SpriteSheet<"large" | "small">;
    shrubs: SpriteSheet<"shrubs">;
    flowers: SpriteSheet<"flowers">;
    grass: SpriteSheet<"grass">;
  },
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

/** Removes the map layer. Bodies are lifted off first so the prop list does not destroy them. */
function clearMapLayer(
  mapLayerRef: RefBox<Container | null>,
  propsRef: RefBox<Container | null>,
  entitiesRef: RefBox<Map<Container, Point | null>>,
) {
  for (const container of entitiesRef.current.keys()) {
    container.removeFromParent();
  }
  propsRef.current = null;
  const layer = mapLayerRef.current;
  mapLayerRef.current = null;
  layer?.destroy({ children: true, texture: false, textureSource: false });
}

/** Puts every placed body back on the prop list after the map is rebuilt. */
function restackEntities(entities: Map<Container, Point | null>, mapHeight: number, props: Container | null, world: Container) {
  for (const [container, grid] of entities) {
    if (grid) {
      positionEntity(container, grid, mapHeight, props, world);
    }
  }
}

/** Moves a body to the screen point of its feet and sorts it with the props. */
function positionEntity(container: Container, grid: Point, mapHeight: number, props: Container | null, world: Container) {
  const point = tileCenter(grid.x, grid.y, mapHeight);
  container.position.set(point.x, point.y);
  sortByFeet(container, grid.x, grid.y, props, world);
}

/** Pins a test drawing to the foot of grid (0, 0) and keeps it above the map. */
function pinOverlay(overlay: Container, mapHeight: number, world: Container) {
  const origin = tileCenter(0, 0, mapHeight);
  overlay.position.set(origin.x, origin.y);
  overlay.eventMode = "none";
  world.addChild(overlay);
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

function groundY(peakY: number, lift: number, groundAt: number) {
  return peakY + TILE_HEIGHT * groundAt + lift;
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
  return hashTile(seed, "terrain", x, y) % VARIANT_COUNT;
}

/** Same seed, coordinate, and deposit always pick the same pile. */
function depositVariant(seed: string, x: number, y: number, deposit: DepositType): number {
  return hashTile(seed, deposit, x, y) % DEPOSIT_VARIANT_COUNT;
}

/** Same seed, coordinate, and plant always pick the same picture. */
function plantVariant(seed: string, x: number, y: number, plant: VegetationType): number {
  return hashTile(seed, plant, x, y) % PLANT_VARIANT_COUNT;
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

/** Pixel size of the whole diamond grid, including the tallest frame's extra skirt. */
function mapPixelSize(map: WorldMap) {
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
function sceneryOverhang() {
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

/** The middle of a tile diamond, in the same space the camera pans. */
function tileCenter(gridX: number, gridY: number, mapHeight: number): Point {
  const peak = isoPoint(gridX, gridY, mapHeight);
  return {
    x: peak.x,
    y: peak.y + TILE_HEIGHT / 2 + sceneryOverhang(),
  };
}

/** Places a tile's top corner. X grows down-right and Y grows down-left. */
function isoPoint(gridX: number, gridY: number, mapHeight: number): Point {
  return {
    x: (gridX - gridY) * (TILE_WIDTH / 2) + mapHeight * (TILE_WIDTH / 2),
    y: (gridX + gridY) * (TILE_HEIGHT / 2),
  };
}

/** Stores the diamond under the pointer, plus the sprites drawn on it. Pictures do not take the click. */
function selectAtPointer(
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
