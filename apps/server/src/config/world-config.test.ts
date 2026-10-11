import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadWorldConfig } from "./world-config.js";

describe("world config", () => {
  it("reads deposit percents from worldConfig.json", () => {
    expect(loadWorldConfig()).toEqual({ stone: 2, ore: 0.5, clay: 0.2 });
  });

  it("rejects a missing file, invalid JSON, and a percent outside 0 to 100", () => {
    const empty = mkdtempSync(join(tmpdir(), "world-config-"));
    expect(() => loadWorldConfig(empty)).toThrow(/worldConfig.json was not found/);

    const invalid = mkdtempSync(join(tmpdir(), "world-config-"));
    writeFileSync(join(invalid, "worldConfig.json"), "{", "utf8");
    expect(() => loadWorldConfig(invalid)).toThrow(/not valid JSON/);

    const high = mkdtempSync(join(tmpdir(), "world-config-"));
    writeFileSync(join(high, "worldConfig.json"), JSON.stringify({ deposits: { stone: 101, ore: 0, clay: 0 } }), "utf8");
    expect(() => loadWorldConfig(high)).toThrow(/stone/);
  });
});
