import type { StepDirection } from "./player";

/** Arrow keys and WASD. Holding a key keeps that direction. */
export function directionFromKey(key: string): StepDirection | null {
  switch (key) {
    case "ArrowUp":
    case "w":
    case "W":
      return "up";
    case "ArrowDown":
    case "s":
    case "S":
      return "down";
    case "ArrowLeft":
    case "a":
    case "A":
      return "left";
    case "ArrowRight":
    case "d":
    case "D":
      return "right";
    default:
      return null;
  }
}

/** Text fields keep their own keys. */
export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

/** Every direction still held, combined so two keys move on a diagonal. */
export function createHeldDirections() {
  const held = new Set<StepDirection>();
  return {
    press(key: string) {
      const direction = directionFromKey(key);
      if (direction) {
        held.add(direction);
      }
      return direction;
    },
    release(key: string) {
      const direction = directionFromKey(key);
      if (direction) {
        held.delete(direction);
      }
    },
    /** Screen axes. X is right and Y is down. */
    screen() {
      let x = 0;
      let y = 0;
      if (held.has("right")) {
        x += 1;
      }
      if (held.has("left")) {
        x -= 1;
      }
      if (held.has("down")) {
        y += 1;
      }
      if (held.has("up")) {
        y -= 1;
      }
      return { x, y };
    },
    clear() {
      held.clear();
    },
  };
}
