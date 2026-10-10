import { useEffect, useRef, useState } from "react";
import type { WorldMap } from "@life-simulator/shared";
import type { Container } from "pixi.js";

const GRID_SIZE = 250;
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

type ViewState = {
  pixelWidth: number;
  pixelHeight: number;
  fit: number;
};

type Point = {
  x: number;
  y: number;
};

function isoPoint(gridX: number, gridY: number): Point {
  return {
    x: (gridX - gridY) * (TILE_WIDTH / 2) + GRID_SIZE * (TILE_WIDTH / 2),
    y: (gridX + gridY) * (TILE_HEIGHT / 2),
  };
}

export function PixiViewport({ map: _map, status }: { map: WorldMap | null; status: string | null }) {
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
          const next = clamp(current.scale.x * (event.deltaY > 0 ? 0.9 : 1.1), view.fit * 0.5, view.fit * 16);
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

    let cancelled = false;
    void (async () => {
      const pixi = await import("pixi.js");
      if (cancelled || worldRef.current !== world) {
        return;
      }

      const top = isoPoint(0, 0);
      const right = isoPoint(GRID_SIZE, 0);
      const bottom = isoPoint(GRID_SIZE, GRID_SIZE);
      const left = isoPoint(0, GRID_SIZE);
      const ground = new pixi.Graphics();
      ground.poly([top.x, top.y, right.x, right.y, bottom.x, bottom.y, left.x, left.y]);
      ground.fill(0xb7d99a);
      world.addChild(ground);

      const grid = new pixi.Graphics();
      for (let x = 0; x <= GRID_SIZE; x += 1) {
        const start = isoPoint(x, 0);
        const end = isoPoint(x, GRID_SIZE);
        grid.moveTo(start.x, start.y);
        grid.lineTo(end.x, end.y);
      }
      for (let y = 0; y <= GRID_SIZE; y += 1) {
        const start = isoPoint(0, y);
        const end = isoPoint(GRID_SIZE, y);
        grid.moveTo(start.x, start.y);
        grid.lineTo(end.x, end.y);
      }
      grid.stroke({ width: 1, color: 0x5f7d52, pixelLine: true });
      world.addChild(grid);

      viewRef.current.pixelWidth = GRID_SIZE * TILE_WIDTH;
      viewRef.current.pixelHeight = GRID_SIZE * TILE_HEIGHT;
      fitMap(host, world, viewRef.current);
    })();

    return () => {
      cancelled = true;
    };
  }, [ready]);

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
