import { useEffect, useRef, useState } from "react";
import type { Container } from "pixi.js";
import type { WorldMap } from "@life-simulator/shared";
import type { Selection } from "../state/app-state";
import { useAppState } from "../state/app-state";
import { bindCamera, emptyCamera, focusOnTile, type Camera, type RefBox } from "./camera";
import { type KeyedCanvases, type Point } from "./map-geometry";
import { openAtlasSheets, paintMap } from "./paint-map";
import { clearMapLayer, createStageBindings, pinOverlay, restackEntities } from "./stage-bindings";
import { useWorldStage } from "./world-stage";

const VIEWPORT_BACKGROUND = "#d7efc8";

type PixiViewportProps = {
  map: WorldMap | null;
  status: string | null;
};

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
      if (!host || !world || !currentMap) {
        return;
      }
      focusOnTile(host, world, cameraRef.current, currentMap.height, x, y);
    });
    return () => registerViewInWorld(null);
  }, [registerViewInWorld]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    registerStage(
      createStageBindings({
        hostRef,
        worldRef,
        mapRef,
        cameraRef,
        propsRef,
        entitiesRef,
        overlayRef,
      }),
    );
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
    const atlases = openAtlasSheets();
    void paintMap(host, world, map, cameraRef.current, canvasesRef, mapLayerRef, propsRef, atlases.sheets, () => cancelled || worldRef.current !== world)
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
      atlases.release();
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

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}
