import type { Graphics } from "pixi.js";
import { trianglePoints, type Obstacle } from "@life-simulator/shared";

/**
 * Triangle sizes live with the shared collision math, so a walking animal
 * and the player stop on the same bases. showCollisionBox only affects drawing.
 */
export {
  BASE_TRIANGLE,
  groundOf,
  landTiles,
  moveThroughWorld,
  obstaclesOn,
  separate,
  type Ground,
  type Obstacle,
} from "@life-simulator/shared";

/** Draws the triangles when true. Collision stays on either way. */
export const showCollisionBox = false;

/** Draws each solid base. The graphics object must sit on the foot of grid (0, 0). */
export function drawCollisionTriangles(graphics: Graphics, obstacles: Obstacle[]) {
  for (const obstacle of obstacles) {
    const [left, right, point] = trianglePoints(obstacle);
    graphics.poly([left.x, left.y, right.x, right.y, point.x, point.y]).fill({ color: 0xff3344, alpha: 0.28 }).stroke({ width: 2, color: 0xff3344 });
  }
  graphics.eventMode = "none";
  return graphics;
}
