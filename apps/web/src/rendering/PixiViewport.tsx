import { useEffect, useRef, useState } from "react";
import type { WorldMap, WorldTile } from "@life-simulator/shared";
import type { Container } from "pixi.js";

const TILE_PX = 8;

const terrainColors: Record<WorldTile["terrainType"], number> = {
  deep_water: 0x1d4e89,
  shallow_water: 0x3d8ec9,
  sand: 0xe6d3a1,
  grassland: 0x7dbe5a,
  rocky: 0x8d8f86,
  mountain: 0x6b635b,
};

const depositColors: Record<WorldTile["deposits"][number], number> = {
  stone: 0xd9dde3,
  ore: 0x6a4c93,
  clay: 0xc47b4a,
};

type ViewState = {
  pixelWidth: number;
  pixelHeight: number;
  fit: number;
};

export function PixiViewport({ map, status }: { map: WorldMap | null; status: string | null }) {
  console.log("PixiViewport", map, status);
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<Container | null>(null);
  const viewRef = useRef<ViewState>({ pixelWidth: 0, pixelHeight: 0, fit: 1 });
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let cancelled = false;
    let destroy: (() => void) | undefined;
    const drag = { active: false, x: 0, y: 0 };

    void (async () => {
      try {
        const pixi = await import("pixi.js");
        const application = new pixi.Application();
        await application.init({
          resizeTo: host,
          background: "#d7efc8",
        });
        if (cancelled) {
          application.destroy();
          return;
        }

        const world = new pixi.Container();
        application.stage.addChild(world);
        host.appendChild(application.canvas);
        worldRef.current = world;

        const onDown = (event: PointerEvent) => {
          if (viewRef.current.pixelWidth === 0) {
            return;
          }
          drag.active = true;
          drag.x = event.clientX;
          drag.y = event.clientY;
        };
        const onMove = (event: PointerEvent) => {
          const current = worldRef.current;
          if (!drag.active || !current) {
            return;
          }
          current.x += event.clientX - drag.x;
          current.y += event.clientY - drag.y;
          drag.x = event.clientX;
          drag.y = event.clientY;
          clampPan(host, current, viewRef.current);
        };
        const onUp = () => {
          drag.active = false;
        };
        const onWheel = (event: WheelEvent) => {
          const current = worldRef.current;
          const view = viewRef.current;
          if (!current || view.pixelWidth === 0) {
            return;
          }
          event.preventDefault();
          const next = clamp(current.scale.x * (event.deltaY > 0 ? 0.9 : 1.1), view.fit * 0.5, view.fit * 6);
          const rect = host.getBoundingClientRect();
          const localX = (event.clientX - rect.left - current.x) / current.scale.x;
          const localY = (event.clientY - rect.top - current.y) / current.scale.y;
          current.scale.set(next);
          current.position.set(event.clientX - rect.left - localX * next, event.clientY - rect.top - localY * next);
          clampPan(host, current, view);
        };

        host.addEventListener("pointerdown", onDown);
        host.addEventListener("pointermove", onMove);
        host.addEventListener("pointerup", onUp);
        host.addEventListener("pointercancel", onUp);
        host.addEventListener("wheel", onWheel, { passive: false });
        setReady(true);

        destroy = () => {
          host.removeEventListener("pointerdown", onDown);
          host.removeEventListener("pointermove", onMove);
          host.removeEventListener("pointerup", onUp);
          host.removeEventListener("pointercancel", onUp);
          host.removeEventListener("wheel", onWheel);
          worldRef.current = null;
          application.destroy();
        };
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Renderer failed to start.");
        }
      }
    })();

    return () => {
      cancelled = true;
      destroy?.();
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

    for (const child of world.removeChildren()) {
      child.destroy();
    }
    viewRef.current = { pixelWidth: 0, pixelHeight: 0, fit: 1 };
    if (!map) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const pixi = await import("pixi.js");
      if (cancelled || worldRef.current !== world) {
        return;
      }

      for (const terrain of Object.keys(terrainColors) as WorldTile["terrainType"][]) {
        const graphic = new pixi.Graphics();
        let used = false;
        for (const tile of map.tiles) {
          if (tile.terrainType !== terrain) {
            continue;
          }
          graphic.rect(tile.x * TILE_PX, tile.y * TILE_PX, TILE_PX, TILE_PX);
          used = true;
        }
        if (used) {
          graphic.fill(terrainColors[terrain]);
          world.addChild(graphic);
        }
      }

      const forest = new pixi.Graphics();
      const grass = new pixi.Graphics();
      let hasForest = false;
      let hasGrass = false;
      for (const tile of map.tiles) {
        if (tile.vegetationType === "forest") {
          forest.rect(tile.x * TILE_PX + 2, tile.y * TILE_PX + 2, 4, 4);
          hasForest = true;
        } else if (tile.vegetationType === "grass") {
          grass.circle(tile.x * TILE_PX + 4, tile.y * TILE_PX + 4, 1.2);
          hasGrass = true;
        }
      }
      if (hasForest) {
        forest.fill(0x1f7a3a);
        world.addChild(forest);
      }
      if (hasGrass) {
        grass.fill(0x3f8f45);
        world.addChild(grass);
      }
      for (const deposit of ["stone", "ore", "clay"] as const) {
        const graphic = new pixi.Graphics();
        let used = false;
        for (const tile of map.tiles) {
          const index = tile.deposits.indexOf(deposit);
          if (index < 0) {
            continue;
          }
          graphic.rect(tile.x * TILE_PX + index * 3, tile.y * TILE_PX, 3, 3);
          used = true;
        }
        if (used) {
          graphic.fill(depositColors[deposit]);
          world.addChild(graphic);
        }
      }

      viewRef.current.pixelWidth = map.width * TILE_PX;
      viewRef.current.pixelHeight = map.height * TILE_PX;
      fitMap(host, world, viewRef.current);
    })();

    return () => {
      cancelled = true;
    };
  }, [map, ready]);

  return (
    <section className="eon-viewport" aria-label="World view">
      <div ref={hostRef} className="eon-viewport-canvas" />
      {error || status ? <p className="eon-viewport-status">{error ?? status}</p> : null}
    </section>
  );
}

function fitMap(host: HTMLElement, world: Container, view: ViewState) {
  const scale = Math.min(host.clientWidth / view.pixelWidth, host.clientHeight / view.pixelHeight);
  if (!Number.isFinite(scale) || scale <= 0) {
    return;
  }
  view.fit = scale;
  world.scale.set(scale);
  world.position.set((host.clientWidth - view.pixelWidth * scale) / 2, (host.clientHeight - view.pixelHeight * scale) / 2);
}

function clampPan(host: HTMLElement, world: Container, view: ViewState) {
  world.x = clampAxis(world.x, view.pixelWidth * world.scale.x, host.clientWidth);
  world.y = clampAxis(world.y, view.pixelHeight * world.scale.y, host.clientHeight);
}

function clampAxis(value: number, mapSize: number, viewSize: number) {
  if (mapSize <= viewSize) {
    return Math.min(viewSize - mapSize, Math.max(0, value));
  }
  return Math.min(0, Math.max(viewSize - mapSize, value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
