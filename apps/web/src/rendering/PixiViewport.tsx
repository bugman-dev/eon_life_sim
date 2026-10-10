import { useEffect, useRef, useState } from "react";
import type { TerrainType, WorldMap } from "@life-simulator/shared";
import type { Container } from "pixi.js";
import dirtUrl from "../assets/images/dirt.png";
import grassUrl from "../assets/images/grass.png";
import sandUrl from "../assets/images/sand.png";
import waterUrl from "../assets/images/water.png";

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

const terrainUrls: Record<TerrainType, string> = {
  grass: grassUrl,
  dirt: dirtUrl,
  sand: sandUrl,
  water: waterUrl,
};

type ViewState = {
  pixelWidth: number;
  pixelHeight: number;
  fit: number;
};

type Point = {
  x: number;
  y: number;
};

function isoPoint(gridX: number, gridY: number, mapHeight: number): Point {
  return {
    x: (gridX - gridY) * (TILE_WIDTH / 2) + mapHeight * (TILE_WIDTH / 2),
    y: (gridX + gridY) * (TILE_HEIGHT / 2),
  };
}

export function PixiViewport({ map, status }: { map: WorldMap | null; status: string | null }) {
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
      child.destroy({ children: true, texture: false, textureSource: false });
    }
    if (!map) {
      viewRef.current = { pixelWidth: 0, pixelHeight: 0, fit: 1 };
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const pixi = await import("pixi.js");
        const textures = Object.fromEntries(
          await Promise.all(
            (Object.entries(terrainUrls) as [TerrainType, string][]).map(async ([terrain, url]) => [
              terrain,
              await pixi.Assets.load<import("pixi.js").Texture>(url),
            ]),
          ),
        ) as Record<TerrainType, import("pixi.js").Texture>;
        if (cancelled || worldRef.current !== world) {
          return;
        }

        const skirt = TILE_WIDTH * (textures.grass.height / textures.grass.width) - TILE_HEIGHT;
        const tiles = new Map(map.tiles.map((tile) => [`${tile.x},${tile.y}`, tile.terrainType]));
        const layer = new pixi.Container();
        for (let sum = 0; sum < map.width + map.height - 1; sum += 1) {
          const xStart = Math.max(0, sum - (map.height - 1));
          const xEnd = Math.min(sum, map.width - 1);
          for (let x = xStart; x <= xEnd; x += 1) {
            const y = sum - x;
            const terrain = tiles.get(`${x},${y}`);
            if (!terrain) {
              continue;
            }
            const texture = textures[terrain];
            const sprite = new pixi.Sprite(texture);
            const point = isoPoint(x, y, map.height);
            sprite.anchor.set(0.5, 0);
            sprite.scale.set(TILE_WIDTH / texture.width);
            sprite.position.set(point.x, point.y);
            layer.addChild(sprite);
          }
        }
        world.addChild(layer);

        viewRef.current.pixelWidth = ((map.width + map.height) * TILE_WIDTH) / 2;
        viewRef.current.pixelHeight = ((map.width + map.height) * TILE_HEIGHT) / 2 + skirt;
        fitMap(host, world, viewRef.current);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Map textures failed to load.");
        }
      }
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
