import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createStream } from "./prng.js";
import { generateWorld } from "./generate.js";

describe("seeded random streams", () => {
  it("repeats a stream and keeps stages apart", () => {
    const first = createStream(42n, "elevation");
    const second = createStream(42n, "elevation");
    const sequence = [first(), first(), first(), first()];
    expect([second(), second(), second(), second()]).toEqual(sequence);

    const other = createStream(42n, "vegetation");
    expect([other(), other(), other(), other()]).not.toEqual(sequence);
  });
});

describe("world generation", () => {
  it("repeats a world for the same seed and changes it for another seed", () => {
    const first = generateWorld({ seed: 7n });
    const second = generateWorld({ seed: 7n });
    const other = generateWorld({ seed: 8n });

    expect(second).toEqual(first);
    expect(other.tiles).not.toEqual(first.tiles);
    expect(first.width).toBe(128);
    expect(first.height).toBe(128);
    expect(first.tiles).toHaveLength(128 * 128);
  });

  it("builds a small grid and rejects dimensions outside the supported range", () => {
    const small = generateWorld({ seed: 3n, width: 8, height: 8 });
    expect(small.tiles).toHaveLength(64);
    expect(new Set(small.tiles.map((tile) => `${tile.x},${tile.y}`)).size).toBe(64);

    expect(() => generateWorld({ seed: 3n, width: 0, height: 8 })).toThrow(/Width/);
    expect(() => generateWorld({ seed: 3n, width: 501, height: 8 })).toThrow(/Width/);
  });

  it("does not read the clock or an unseeded random source", () => {
    const generate = readFileSync(new URL("./generate.ts", import.meta.url), "utf8");
    const prng = readFileSync(new URL("./prng.ts", import.meta.url), "utf8");
    expect(generate).not.toContain("Math.random");
    expect(generate).not.toContain("Date.now");
    expect(prng).not.toContain("Math.random");
    expect(prng).not.toContain("Date.now");
  });
});
