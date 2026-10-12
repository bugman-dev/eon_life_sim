import type { Container } from "pixi.js";
import type { AnimalMove } from "@life-simulator/shared";

/** How long a step takes to slide. This matches the server tick of one second. */
export const GLIDE_MS = 1000;

export type GlideBody = {
  container: Container;
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  started: number;
};

/** Aims each body at the server's new point, starting from where it is on screen. */
export function aimBodies(bodies: Map<string, GlideBody>, moves: readonly AnimalMove[], now: number) {
  let moving = false;
  for (const move of moves) {
    const body = bodies.get(move.id);
    if (!body || (body.x === move.x && body.y === move.y)) {
      continue;
    }
    body.fromX = body.x;
    body.fromY = body.y;
    body.toX = move.x;
    body.toY = move.y;
    body.started = now;
    moving = true;
  }
  return moving;
}

/** Slides each body toward its target and reports whether any are still on the way. */
export function glideBodies(
  bodies: Map<string, GlideBody>,
  now: number,
  place: (container: Container, x: number, y: number) => void,
) {
  let moving = false;
  for (const body of bodies.values()) {
    const t = Math.min(1, Math.max(0, now - body.started) / GLIDE_MS);
    body.x = body.fromX + (body.toX - body.fromX) * t;
    body.y = body.fromY + (body.toY - body.fromY) * t;
    place(body.container, body.x, body.y);
    if (t < 1) {
      moving = true;
    }
  }
  return moving;
}
