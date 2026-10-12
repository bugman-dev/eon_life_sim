/** Shared ground size of a diamond in the atlas, in source pixels. */
const DIAMOND_WIDTH = 217;
const DIAMOND_HALF = 71;

export const TILE_WIDTH = 64;
export const TILE_SCALE = TILE_WIDTH / DIAMOND_WIDTH;
export const TILE_HEIGHT = DIAMOND_HALF * 2 * TILE_SCALE;

/**
 * The bottom of each plant sits on the middle of the diamond.
 * Piles stay a little further forward, toward the front corner.
 */
export const PLANT_GROUND_AT = 0.65;
export const RESOURCE_GROUND_AT = 0.75;
