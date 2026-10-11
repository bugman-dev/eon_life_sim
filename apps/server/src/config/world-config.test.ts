import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadWorldConfig } from "./world-config.js";

const band = { percent: 1, minAmount: 100, maxAmount: 500 };

function fileDeposits(patch: {
  stone?: Partial<typeof band>;
  ore?: Partial<typeof band>;
  clay?: Partial<typeof band>;
}) {
  return {
    stone: { ...band, ...patch.stone },
    ore: { ...band, ...patch.ore },
    clay: { ...band, ...patch.clay },
  };
}

describe("world config", () => {
  it("reads deposit percents and amount ranges from worldConfig.json", () => {
    expect(loadWorldConfig()).toEqual({
      stone: { percent: 0.5, minAmount: 1000, maxAmount: 50000 },
      ore: { percent: 0.1, minAmount: 1000, maxAmount: 50000 },
      clay: { percent: 0.2, minAmount: 1, maxAmount: 10 },
    });
  });

  it("rejects a missing file, invalid JSON, a percent outside 0 to 100, and a reversed amount range", () => {
    const empty = mkdtempSync(join(tmpdir(), "world-config-"));
    expect(() => loadWorldConfig(empty)).toThrow(/worldConfig.json was not found/);

    const invalid = mkdtempSync(join(tmpdir(), "world-config-"));
    writeFileSync(join(invalid, "worldConfig.json"), "{", "utf8");
    expect(() => loadWorldConfig(invalid)).toThrow(/not valid JSON/);

    const high = mkdtempSync(join(tmpdir(), "world-config-"));
    writeFileSync(join(high, "worldConfig.json"), JSON.stringify({ deposits: fileDeposits({ stone: { percent: 101 } }) }), "utf8");
    expect(() => loadWorldConfig(high)).toThrow(/stone/);

    const reversed = mkdtempSync(join(tmpdir(), "world-config-"));
    writeFileSync(
      join(reversed, "worldConfig.json"),
      JSON.stringify({ deposits: fileDeposits({ ore: { minAmount: 400, maxAmount: 200 } }) }),
      "utf8",
    );
    expect(() => loadWorldConfig(reversed)).toThrow(/minAmount/);
  });
});
