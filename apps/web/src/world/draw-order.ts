import type { Container } from "pixi.js";
import { footDepth } from "./feet";

/**
 * Puts a standing picture in the prop list, sorted by its feet.
 * Ground diamonds are not in this list. The whole picture uses one baseline, canopy included.
 */
export function sortByFeet(sprite: Container, x: number, y: number, props: Container | null, fallback: Container | null) {
  sprite.zIndex = footDepth(x, y);
  const parent = props ?? fallback;
  if (parent && sprite.parent !== parent) {
    parent.addChild(sprite);
  }
}
