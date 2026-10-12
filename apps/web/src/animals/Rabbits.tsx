import { useEffect, useRef } from "react";
import type { Container } from "pixi.js";
import type { WorldMap } from "@life-simulator/shared";
import { useWorldStage } from "../rendering/world-stage";

const SQUARE = 12;

/** Draws each stored rabbit as a white square on its spawn tile. */
export function Rabbits({ map }: { map: WorldMap | null }) {
  const { stageVersion, attachEntity, detachEntity, placeEntity } = useWorldStage();
  const bodiesRef = useRef<Container[]>([]);

  useEffect(() => {
    if (!map || stageVersion === 0) {
      return;
    }

    let cancelled = false;
    const animals = map.animals;

    void import("pixi.js").then((pixi) => {
      if (cancelled) {
        return;
      }
      for (const animal of animals) {
        const body = new pixi.Container();
        const square = new pixi.Graphics();
        square.rect(-SQUARE / 2, -SQUARE / 2, SQUARE, SQUARE).fill({ color: 0xffffff }).stroke({ width: 2, color: 0x222222 });
        body.addChild(square);
        body.eventMode = "none";
        bodiesRef.current.push(body);
        attachEntity(body);
        placeEntity(body, animal.x, animal.y);
      }
    });

    return () => {
      cancelled = true;
      for (const body of bodiesRef.current) {
        detachEntity(body);
      }
      bodiesRef.current = [];
    };
  }, [map, stageVersion, attachEntity, detachEntity, placeEntity]);

  return null;
}
