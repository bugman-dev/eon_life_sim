import type { WorldMap } from "@life-simulator/shared";
import type { Graphics } from "pixi.js";
import { footOffset, gridFromScreen, type GridPoint } from "./feet";

export type Obstacle = GridPoint & {
  radius: number;
};

/** Land the body may stand on, plus the solid bases it cannot enter. */
export type Ground = {
  land: Set<string>;
  obstacles: Obstacle[];
};

/** How wide the solid base of each prop is, in screen pixels. Flowers and grass tufts are not solid. */
const BASE_RADIUS = {
  tree: 14,
  shrubs: 10,
  deposit: 16,
} as const;

const NEAR_TILES = 2;
const SEPARATE_PASSES = 2;

/** Land tiles a body is allowed to stand on. */
export function landTiles(map: WorldMap) {
  const land = new Set<string>();
  for (const tile of map.tiles) {
    if (tile.terrainType !== "water") {
      land.add(`${tile.x},${tile.y}`);
    }
  }
  return land;
}

/** Solid bases on the map. Each one sits on the same point the picture uses as its feet. */
export function obstaclesOn(map: WorldMap): Obstacle[] {
  const obstacles: Obstacle[] = [];
  for (const tile of map.tiles) {
    for (let index = 0; index < tile.deposits.length; index += 1) {
      obstacles.push({ x: tile.x, y: tile.y, radius: BASE_RADIUS.deposit });
    }
    for (const plant of tile.vegitation) {
      if (plant.type === "tree" || plant.type === "shrubs") {
        obstacles.push({ x: tile.x, y: tile.y, radius: BASE_RADIUS[plant.type] });
      }
    }
  }
  return obstacles;
}

/** The part of a map a moving body has to respect. */
export function groundOf(map: WorldMap): Ground {
  return {
    land: landTiles(map),
    obstacles: obstaclesOn(map),
  };
}

/**
 * Moves a body in grid units.
 * Water, the map edge, and solid bases block the step. A blocked diagonal still slides along the open axis.
 * Returns the same position when the step is refused.
 */
export function moveThroughWorld(map: WorldMap, ground: Ground, radius: number, position: GridPoint, dx: number, dy: number) {
  const both = tryMove(map, ground, radius, position, dx, dy);
  if (both !== position) {
    return both;
  }
  const alongX = tryMove(map, ground, radius, position, dx, 0);
  if (alongX !== position) {
    return alongX;
  }
  return tryMove(map, ground, radius, position, 0, dy);
}

/** Moves a point out of any base circle it overlaps. Circles are round on screen, at the feet. */
export function separate(position: GridPoint, radius: number, obstacles: Obstacle[]) {
  let x = position.x;
  let y = position.y;
  for (let pass = 0; pass < SEPARATE_PASSES; pass += 1) {
    for (const obstacle of obstacles) {
      if (Math.max(Math.abs(x - obstacle.x), Math.abs(y - obstacle.y)) > NEAR_TILES) {
        continue;
      }
      const cleared = pushCircle({ x, y }, radius, obstacle);
      x = cleared.x;
      y = cleared.y;
    }
  }
  return { x, y };
}

/** Draws each solid base. The graphics object must sit on the foot of grid (0, 0). */
export function drawCollisionCircles(graphics: Graphics, obstacles: Obstacle[]) {
  for (const obstacle of obstacles) {
    const foot = footOffset(obstacle.x, obstacle.y);
    graphics.circle(foot.x, foot.y, obstacle.radius).fill({ color: 0xff3344, alpha: 0.28 }).stroke({ width: 2, color: 0xff3344 });
  }
  graphics.eventMode = "none";
  return graphics;
}

function tryMove(map: WorldMap, ground: Ground, radius: number, position: GridPoint, dx: number, dy: number) {
  if (dx === 0 && dy === 0) {
    return position;
  }
  const next = { x: position.x + dx, y: position.y + dy };
  if (!onLand(map, ground.land, next)) {
    return position;
  }
  const resolved = separate(next, radius, ground.obstacles);
  if (!onLand(map, ground.land, resolved)) {
    return position;
  }
  return resolved;
}

function onLand(map: WorldMap, land: Set<string>, point: GridPoint) {
  const x = Math.round(point.x);
  const y = Math.round(point.y);
  return x >= 0 && y >= 0 && x < map.width && y < map.height && land.has(`${x},${y}`);
}

function pushCircle(position: GridPoint, radius: number, obstacle: Obstacle) {
  const here = footOffset(position.x, position.y);
  const there = footOffset(obstacle.x, obstacle.y);
  const screenX = here.x - there.x;
  const screenY = here.y - there.y;
  const distance = Math.hypot(screenX, screenY);
  const limit = radius + obstacle.radius;
  if (distance >= limit) {
    return position;
  }
  const pushed = distance === 0 ? { x: 0, y: limit } : { x: (screenX / distance) * limit, y: (screenY / distance) * limit };
  const step = gridFromScreen(pushed.x, pushed.y);
  return {
    x: obstacle.x + step.x,
    y: obstacle.y + step.y,
  };
}
