import { useEffect, useRef, useState } from "react";
import type { Container } from "pixi.js";
import type { WorldMap } from "@life-simulator/shared";
import { useWorldStage } from "../rendering/world-stage";
import { drawCollisionCircles, groundOf } from "../world/collision";
import { createHeldDirections, directionFromKey, isTypingTarget } from "./controls";
import { PLAYER_RADIUS, roamPlayer, spawnClear, type GridPoint } from "./player";

/** Draws the test player and lets it walk through the same ground any entity will use. */
export function PlayerMarker({ map }: { map: WorldMap | null }) {
  const { stageVersion, viewVersion, attachEntity, detachEntity, placeEntity, attachOverlay, detachOverlay, centerView } = useWorldStage();
  const visualRef = useRef<GridPoint | null>(null);
  const bodyRef = useRef<Container | null>(null);
  const [placed, setPlaced] = useState(0);

  useEffect(() => {
    if (!map || stageVersion === 0) {
      visualRef.current = null;
      return;
    }

    let cancelled = false;
    let frame = 0;
    let last = 0;
    const held = createHeldDirections();
    const ground = groundOf(map);
    const spawn = spawnClear(map, ground);
    visualRef.current = spawn;

    const tick = (now: number) => {
      const seconds = last === 0 ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      const position = visualRef.current;
      const body = bodyRef.current;
      if (position) {
        const screen = held.screen();
        if (screen.x !== 0 || screen.y !== 0) {
          const next = roamPlayer(map, ground, position, screen.x, screen.y, seconds);
          if (next !== position) {
            visualRef.current = next;
            if (body) {
              placeEntity(body, next.x, next.y);
            }
            centerView(next.x, next.y);
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };

    void import("pixi.js").then((pixi) => {
      if (cancelled) {
        return;
      }
      const body = new pixi.Container();
      const dot = new pixi.Graphics();
      dot.circle(0, 0, PLAYER_RADIUS).fill({ color: 0x2f6fed }).stroke({ width: 2, color: 0xffffff });
      body.addChild(dot);
      body.eventMode = "none";
      const rings = drawCollisionCircles(new pixi.Graphics(), ground.obstacles);
      const position = visualRef.current;
      if (!position) {
        body.destroy({ children: true });
        rings.destroy();
        return;
      }
      bodyRef.current = body;
      attachEntity(body);
      attachOverlay(rings);
      placeEntity(body, position.x, position.y);
      setPlaced((value) => value + 1);
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || !directionFromKey(event.key)) {
        return;
      }
      event.preventDefault();
      if (!event.repeat) {
        held.press(event.key);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      held.release(event.key);
    };
    const onBlur = () => {
      held.clear();
    };

    frame = requestAnimationFrame(tick);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      visualRef.current = null;
      const body = bodyRef.current;
      bodyRef.current = null;
      if (body) {
        detachEntity(body);
      }
      detachOverlay();
    };
  }, [map, stageVersion, attachEntity, detachEntity, placeEntity, attachOverlay, detachOverlay, centerView]);

  useEffect(() => {
    const position = visualRef.current;
    if (!position) {
      return;
    }
    centerView(position.x, position.y);
  }, [viewVersion, placed, centerView]);

  return null;
}
