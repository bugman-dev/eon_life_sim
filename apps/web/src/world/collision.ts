import type { WorldMap } from "@life-simulator/shared";
import type { Graphics } from "pixi.js";
import { footOffset, gridFromScreen, type GridPoint } from "./feet";

type ScreenPoint = {
  x: number;
  y: number;
};

export type Obstacle = GridPoint & {
  width: number;
  height: number;
  right: number;
  down: number;
};

/** Land the body may stand on, plus the solid bases it cannot enter. */
export type Ground = {
  land: Set<string>;
  obstacles: Obstacle[];
};

/**
 * Screen size and shift of each solid base, in pixels.
 * width is the flat edge. height is the distance from that edge to the point.
 * right moves the triangle to the right. down moves it down the screen.
 * The point faces up the screen. Flowers and grass tufts are not solid.
 */
const BASE_TRIANGLE = {
  tree: { width: 20, height: 22, right: 0, down: -5 },
  shrubs: { width: 30, height: 20, right: 0, down: -6 },
  deposit: { width: 32, height: 24, right: 0, down: 0 },
} as const;

/** Draws the triangles when true. Collision stays on either way. */
export const showCollisionBox = false;

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
      obstacles.push({ x: tile.x, y: tile.y, ...BASE_TRIANGLE.deposit });
    }
    for (const plant of tile.vegitation) {
      if (plant.type === "tree" || plant.type === "shrubs") {
        obstacles.push({ x: tile.x, y: tile.y, ...BASE_TRIANGLE[plant.type] });
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

/** Moves a round body out of any triangle it overlaps. Triangles keep their shape on screen, at the feet. */
export function separate(position: GridPoint, radius: number, obstacles: Obstacle[]) {
  let x = position.x;
  let y = position.y;
  for (let pass = 0; pass < SEPARATE_PASSES; pass += 1) {
    for (const obstacle of obstacles) {
      if (Math.max(Math.abs(x - obstacle.x), Math.abs(y - obstacle.y)) > NEAR_TILES) {
        continue;
      }
      const cleared = pushTriangle({ x, y }, radius, obstacle);
      x = cleared.x;
      y = cleared.y;
    }
  }
  return { x, y };
}

/** Draws each solid base. The graphics object must sit on the foot of grid (0, 0). */
export function drawCollisionTriangles(graphics: Graphics, obstacles: Obstacle[]) {
  for (const obstacle of obstacles) {
    const [left, right, point] = triangleAt(obstacle);
    graphics.poly([left.x, left.y, right.x, right.y, point.x, point.y]).fill({ color: 0xff3344, alpha: 0.28 }).stroke({ width: 2, color: 0xff3344 });
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

/** Isosceles triangle on a foot, shifted by right and down. The third corner is the point, up the screen. */
function triangleAt(obstacle: Obstacle): [ScreenPoint, ScreenPoint, ScreenPoint] {
  const foot = footOffset(obstacle.x, obstacle.y);
  const x = foot.x + obstacle.right;
  const y = foot.y + obstacle.down;
  const below = obstacle.height / 3;
  return [
    { x: x - obstacle.width / 2, y: y + below },
    { x: x + obstacle.width / 2, y: y + below },
    { x, y: y - below * 2 },
  ];
}

function pushTriangle(position: GridPoint, radius: number, obstacle: Obstacle) {
  const here = footOffset(position.x, position.y);
  const corners = triangleAt(obstacle);
  const closest = closestOnTriangle(here, corners);
  const offsetX = here.x - closest.x;
  const offsetY = here.y - closest.y;
  const distance = Math.hypot(offsetX, offsetY);
  const inside = pointInTriangle(here, corners);
  if (!inside && distance >= radius) {
    return position;
  }
  const away = distance === 0 ? leavePoint(here, corners) : inside ? { x: -offsetX / distance, y: -offsetY / distance } : { x: offsetX / distance, y: offsetY / distance };
  return gridFromScreen(closest.x + away.x * radius, closest.y + away.y * radius);
}

function closestOnTriangle(point: ScreenPoint, corners: [ScreenPoint, ScreenPoint, ScreenPoint]) {
  let best = closestOnSegment(point, corners[0], corners[1]);
  let bestDistance = Math.hypot(point.x - best.x, point.y - best.y);
  for (let index = 1; index < 3; index += 1) {
    const next = closestOnSegment(point, corners[index], corners[(index + 1) % 3]);
    const distance = Math.hypot(point.x - next.x, point.y - next.y);
    if (distance < bestDistance) {
      best = next;
      bestDistance = distance;
    }
  }
  return best;
}

function closestOnSegment(point: ScreenPoint, start: ScreenPoint, end: ScreenPoint) {
  const edgeX = end.x - start.x;
  const edgeY = end.y - start.y;
  const length = edgeX * edgeX + edgeY * edgeY;
  if (length === 0) {
    return start;
  }
  const along = Math.min(1, Math.max(0, ((point.x - start.x) * edgeX + (point.y - start.y) * edgeY) / length));
  return { x: start.x + edgeX * along, y: start.y + edgeY * along };
}

function pointInTriangle(point: ScreenPoint, [a, b, c]: [ScreenPoint, ScreenPoint, ScreenPoint]) {
  const edgeCX = c.x - a.x;
  const edgeCY = c.y - a.y;
  const edgeBX = b.x - a.x;
  const edgeBY = b.y - a.y;
  const fromA = { x: point.x - a.x, y: point.y - a.y };
  const dotCC = edgeCX * edgeCX + edgeCY * edgeCY;
  const dotCB = edgeCX * edgeBX + edgeCY * edgeBY;
  const dotCP = edgeCX * fromA.x + edgeCY * fromA.y;
  const dotBB = edgeBX * edgeBX + edgeBY * edgeBY;
  const dotBP = edgeBX * fromA.x + edgeBY * fromA.y;
  const area = dotCC * dotBB - dotCB * dotCB;
  if (area === 0) {
    return false;
  }
  const alongC = (dotBB * dotCP - dotCB * dotBP) / area;
  const alongB = (dotCC * dotBP - dotCB * dotCP) / area;
  return alongC >= 0 && alongB >= 0 && alongC + alongB <= 1;
}

/** Outward direction when the body sits on a corner and has no offset yet. */
function leavePoint(point: ScreenPoint, corners: [ScreenPoint, ScreenPoint, ScreenPoint]) {
  let x = 0;
  let y = 0;
  for (let index = 0; index < 3; index += 1) {
    const start = corners[index];
    const end = corners[(index + 1) % 3];
    const other = corners[(index + 2) % 3];
    const closest = closestOnSegment(point, start, end);
    if (Math.hypot(point.x - closest.x, point.y - closest.y) > 0.001) {
      continue;
    }
    const normal = outwardNormal(start, end, other);
    x += normal.x;
    y += normal.y;
  }
  const length = Math.hypot(x, y);
  if (length === 0) {
    return { x: 0, y: 1 };
  }
  return { x: x / length, y: y / length };
}

function outwardNormal(start: ScreenPoint, end: ScreenPoint, interior: ScreenPoint) {
  const edgeX = end.x - start.x;
  const edgeY = end.y - start.y;
  const length = Math.hypot(edgeX, edgeY) || 1;
  let x = -edgeY / length;
  let y = edgeX / length;
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  if ((interior.x - midX) * x + (interior.y - midY) * y > 0) {
    x = -x;
    y = -y;
  }
  return { x, y };
}
