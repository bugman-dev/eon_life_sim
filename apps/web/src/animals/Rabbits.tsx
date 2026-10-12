import type { Graphics } from "pixi.js";

const SQUARE = 12;

/** The rabbit picture. Other species supply their own picture the same way. */
export function paintRabbit(graphics: Graphics) {
  graphics.rect(-SQUARE / 2, -SQUARE / 2, SQUARE, SQUARE).fill({ color: 0xffffff }).stroke({ width: 2, color: 0x222222 });
}
