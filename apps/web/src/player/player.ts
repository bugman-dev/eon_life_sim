import type { WorldMap } from "@life-simulator/shared";
import { gridStep, type GridPoint } from "../world/feet";
import { groundOf, moveThroughWorld, separate, type Ground } from "../world/collision";

export type { GridPoint };

export type StepDirection = "up" | "down" | "left" | "right";

/** Screen pace. Walking straight up or down crosses one diamond in about 0.8 seconds. */
export const ROAM_SPEED = 2.6;

/** The blue dot is 8 pixels across its middle. */
export const PLAYER_RADIUS = 8;

/** The land tile nearest the middle of the map. */
export function spawnPlayer(map: WorldMap): GridPoint {
  const originX = Math.floor(map.width / 2);
  const originY = Math.floor(map.height / 2);
  let nearest: GridPoint | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const tile of map.tiles) {
    if (tile.terrainType === "water") {
      continue;
    }
    const distance = Math.max(Math.abs(tile.x - originX), Math.abs(tile.y - originY));
    const nearer =
      distance < nearestDistance ||
      (distance === nearestDistance && nearest !== null && (tile.y < nearest.y || (tile.y === nearest.y && tile.x < nearest.x)));
    if (nearest === null || nearer) {
      nearest = { x: tile.x, y: tile.y };
      nearestDistance = distance;
    }
  }
  return nearest ?? { x: originX, y: originY };
}

/** A spawn that is not inside a solid base. */
export function spawnClear(map: WorldMap, ground: Ground = groundOf(map)) {
  return separate(spawnPlayer(map), PLAYER_RADIUS, ground.obstacles);
}

/**
 * Moves freely in screen directions.
 * screenX is right, screenY is down. The body uses the same ground rules as any other entity.
 */
export function roamPlayer(map: WorldMap, ground: Ground, position: GridPoint, screenX: number, screenY: number, seconds: number) {
  const step = gridStep(screenX, screenY, ROAM_SPEED * seconds);
  return moveThroughWorld(map, ground, PLAYER_RADIUS, position, step.x, step.y);
}
