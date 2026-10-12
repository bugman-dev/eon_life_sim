import type { Container } from "pixi.js";
import type { WorldMap } from "@life-simulator/shared";
import type { Selection } from "../state/app-state";
import { tileCenter, type KeyedCanvases } from "./map-geometry";
import { selectAtPointer } from "./select-tile";

export type Camera = {
  pixelWidth: number;
  pixelHeight: number;
  fit: number;
};

export type RefBox<T> = { current: T };

/** Wheel zoom stays between half and sixty-four times the fitted view. */
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 64;
const WHEEL_OUT = 0.9;
const WHEEL_IN = 1.1;
/** Pointer travel below this, in screen pixels, is a click. Past it, the gesture pans. */
const CLICK_SLOP = 4;

export function emptyCamera(): Camera {
  return { pixelWidth: 0, pixelHeight: 0, fit: 1 };
}

/** Scales the map to the host and centers it. Records that scale as the zoom baseline. */
export function fitMap(host: HTMLElement, world: Container, camera: Camera) {
  const scale = Math.min(host.clientWidth / camera.pixelWidth, host.clientHeight / camera.pixelHeight);
  if (!Number.isFinite(scale) || scale <= 0) {
    return;
  }
  camera.fit = scale;
  world.scale.set(scale);
  world.position.set((host.clientWidth - camera.pixelWidth * scale) / 2, (host.clientHeight - camera.pixelHeight * scale) / 2);
}

/** Centers a tile and zooms to the furthest wheel step. */
export function focusOnTile(host: HTMLElement, world: Container, camera: Camera, mapHeight: number, x: number, y: number) {
  if (camera.pixelWidth === 0) {
    return;
  }
  const scale = camera.fit * ZOOM_MAX;
  const center = tileCenter(x, y, mapHeight);
  world.scale.set(scale);
  world.position.set(host.clientWidth / 2 - center.x * scale, host.clientHeight / 2 - center.y * scale);
  clampPan(host, world, camera);
}

/** Keeps the current zoom and centers a point. */
export function centerOn(host: HTMLElement, world: Container, camera: Camera, mapHeight: number, x: number, y: number) {
  if (camera.pixelWidth === 0) {
    return;
  }
  const point = tileCenter(x, y, mapHeight);
  const scale = world.scale.x;
  world.position.set(host.clientWidth / 2 - point.x * scale, host.clientHeight / 2 - point.y * scale);
  clampPan(host, world, camera);
}

/** Dragging pans the map. A click selects the diamond under the pointer. */
export function bindCamera(
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
