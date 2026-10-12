import type { Container } from "pixi.js";
import type { WorldMap } from "@life-simulator/shared";
import { sortByFeet } from "../world/draw-order";
import { centerOn, type Camera, type RefBox } from "./camera";
import { tileCenter, type Point } from "./map-geometry";
import type { WorldStage } from "./world-stage";

type StageRefs = {
  hostRef: RefBox<HTMLElement | null>;
  worldRef: RefBox<Container | null>;
  mapRef: RefBox<WorldMap | null>;
  cameraRef: RefBox<Camera>;
  propsRef: RefBox<Container | null>;
  entitiesRef: RefBox<Map<Container, Point | null>>;
  overlayRef: RefBox<Container | null>;
};

/** The stage methods a body uses to stand on the map and follow the camera. */
export function createStageBindings(refs: StageRefs): WorldStage {
  return {
    attachEntity(container) {
      const world = refs.worldRef.current;
      if (!world) {
        return;
      }
      const point = refs.entitiesRef.current.get(container);
      if (point === undefined) {
        refs.entitiesRef.current.set(container, null);
        return;
      }
      if (point) {
        sortByFeet(container, point.x, point.y, refs.propsRef.current, world);
      }
    },
    detachEntity(container) {
      if (!refs.entitiesRef.current.has(container)) {
        return;
      }
      refs.entitiesRef.current.delete(container);
      container.removeFromParent();
      container.destroy({ children: true });
    },
    attachOverlay(container) {
      const world = refs.worldRef.current;
      const currentMap = refs.mapRef.current;
      if (!world || !currentMap) {
        return;
      }
      if (refs.overlayRef.current && refs.overlayRef.current !== container) {
        refs.overlayRef.current.destroy({ children: true });
      }
      refs.overlayRef.current = container;
      pinOverlay(container, currentMap.height, world);
    },
    detachOverlay() {
      const overlay = refs.overlayRef.current;
      refs.overlayRef.current = null;
      if (!overlay) {
        return;
      }
      overlay.removeFromParent();
      overlay.destroy({ children: true });
    },
    placeEntity(container, x, y) {
      const currentMap = refs.mapRef.current;
      const world = refs.worldRef.current;
      if (!currentMap || !world || !refs.entitiesRef.current.has(container)) {
        return;
      }
      const grid = { x, y };
      refs.entitiesRef.current.set(container, grid);
      positionEntity(container, grid, currentMap.height, refs.propsRef.current, world);
    },
    centerView(x, y) {
      const host = refs.hostRef.current;
      const world = refs.worldRef.current;
      const currentMap = refs.mapRef.current;
      if (!host || !world || !currentMap) {
        return;
      }
      centerOn(host, world, refs.cameraRef.current, currentMap.height, x, y);
    },
  };
}

/** Removes the map layer. Bodies are lifted off first so the prop list does not destroy them. */
export function clearMapLayer(
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
export function restackEntities(entities: Map<Container, Point | null>, mapHeight: number, props: Container | null, world: Container) {
  for (const [container, grid] of entities) {
    if (grid) {
      positionEntity(container, grid, mapHeight, props, world);
    }
  }
}

/** Pins a test drawing to the foot of grid (0, 0) and keeps it above the map. */
export function pinOverlay(overlay: Container, mapHeight: number, world: Container) {
  const origin = tileCenter(0, 0, mapHeight);
  overlay.position.set(origin.x, origin.y);
  overlay.eventMode = "none";
  world.addChild(overlay);
}

/** Moves a body to the screen point of its feet and sorts it with the props. */
function positionEntity(container: Container, grid: Point, mapHeight: number, props: Container | null, world: Container) {
  const point = tileCenter(grid.x, grid.y, mapHeight);
  container.position.set(point.x, point.y);
  sortByFeet(container, grid.x, grid.y, props, world);
}
