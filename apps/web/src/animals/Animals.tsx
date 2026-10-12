import { useEffect, useRef } from "react";
import type { AnimalMove, WorldMap } from "@life-simulator/shared";
import { useWorldStage } from "../rendering/world-stage";
import { animalAppearance } from "./appearances";
import { aimBodies, glideBodies, type GlideBody } from "./glide";

/** Draws every animal and slides it to each point the server sends. */
export function Animals({ map, moves }: { map: WorldMap | null; moves: readonly AnimalMove[] | null }) {
  const { stageVersion, attachEntity, detachEntity, placeEntity } = useWorldStage();
  const bodiesRef = useRef<Map<string, GlideBody>>(new Map());
  const frameRef = useRef(0);
  const placeRef = useRef(placeEntity);
  const movesRef = useRef(moves);
  placeRef.current = placeEntity;
  movesRef.current = moves;

  useEffect(() => {
    if (!map || stageVersion === 0) {
      return;
    }

    let cancelled = false;
    const animals = map.animals;
    const bodies = bodiesRef.current;

    const loop = () => {
      const moving = glideBodies(bodies, performance.now(), placeRef.current);
      frameRef.current = moving ? requestAnimationFrame(loop) : 0;
    };
    const startFrame = () => {
      if (frameRef.current === 0) {
        frameRef.current = requestAnimationFrame(loop);
      }
    };

    void import("pixi.js").then((pixi) => {
      if (cancelled) {
        return;
      }
      for (const animal of animals) {
        const body = new pixi.Container();
        const picture = new pixi.Graphics();
        animalAppearance[animal.species](picture);
        body.addChild(picture);
        body.eventMode = "none";
        bodies.set(animal.id, {
          container: body,
          x: animal.x,
          y: animal.y,
          fromX: animal.x,
          fromY: animal.y,
          toX: animal.x,
          toY: animal.y,
          started: 0,
        });
        attachEntity(body);
        placeEntity(body, animal.x, animal.y);
      }
      if (aimBodies(bodies, movesRef.current ?? [], performance.now())) {
        startFrame();
      }
    });

    return () => {
      cancelled = true;
      if (frameRef.current !== 0) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
      for (const body of bodies.values()) {
        detachEntity(body.container);
      }
      bodies.clear();
    };
  }, [map, stageVersion, attachEntity, detachEntity, placeEntity]);

  useEffect(() => {
    if (!moves || bodiesRef.current.size === 0) {
      return;
    }
    if (!aimBodies(bodiesRef.current, moves, performance.now())) {
      return;
    }
    if (frameRef.current !== 0) {
      return;
    }
    const loop = () => {
      const moving = glideBodies(bodiesRef.current, performance.now(), placeRef.current);
      frameRef.current = moving ? requestAnimationFrame(loop) : 0;
    };
    frameRef.current = requestAnimationFrame(loop);
  }, [moves]);

  return null;
}
