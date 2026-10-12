export type GridPoint = {
  x: number;
  y: number;
};

/**
 * Screen size of one grid step. These match the map diamond in the viewport.
 * Feet and collision are measured in screen pixels so a round base stays round on screen.
 */
export const HALF_TILE_WIDTH = 32;
export const HALF_TILE_HEIGHT = (71 * 64) / 217;

/** Screen depth of a pair of feet. A larger value is lower on the screen and draws in front. */
export function footDepth(x: number, y: number) {
  return x + y;
}

/** Screen offset of a foot from the foot at grid (0, 0). The extra lift of the map cancels out. */
export function footOffset(x: number, y: number) {
  return {
    x: (x - y) * HALF_TILE_WIDTH,
    y: (x + y) * HALF_TILE_HEIGHT,
  };
}

/** Grid step that matches a screen move. Screen X is right and screen Y is down. */
export function gridFromScreen(screenX: number, screenY: number) {
  const horizontal = screenX / HALF_TILE_WIDTH;
  const vertical = screenY / HALF_TILE_HEIGHT;
  return {
    x: (horizontal + vertical) / 2,
    y: (vertical - horizontal) / 2,
  };
}

/**
 * How far to step on the grid while moving `distance` grid units in a screen direction.
 * screenX is right and screenY is down. Straight up or down changes x and y by the same amount.
 */
export function gridStep(screenX: number, screenY: number, distance: number) {
  const length = Math.hypot(screenX, screenY);
  if (length === 0 || distance <= 0) {
    return { x: 0, y: 0 };
  }
  const horizontal = (screenX / length) * distance;
  const vertical = (screenY / length) * distance;
  return {
    x: (horizontal + vertical) / 2,
    y: (vertical - horizontal) / 2,
  };
}
