import { describe, expect, it } from "vitest";
import { loadConfig } from "./env.js";

describe("configuration", () => {
  it("rejects a missing database url", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it("applies local defaults when only the database url is set", () => {
    const config = loadConfig({
      DATABASE_URL: "postgresql://life_sim:replace_me@localhost:5432/life_sim",
    });

    expect(config.serverHost).toBe("0.0.0.0");
    expect(config.serverPort).toBe(3000);
    expect(config.tickIntervalMs).toBe(1000);
    expect(config.tickRate).toBe(1);
    expect(config.tickGameSeconds).toBe(3600);
    expect(config.worldWidth).toBe(128);
    expect(config.worldHeight).toBe(128);
    expect(config.nodeEnv).toBe("development");
  });

  it("accepts a map size inside 8 to 500 and rejects one outside it", () => {
    const database = { DATABASE_URL: "postgresql://life_sim:replace_me@localhost:5432/life_sim" };
    const config = loadConfig({ ...database, WORLD_WIDTH: "8", WORLD_HEIGHT: "200" });
    expect(config.worldWidth).toBe(8);
    expect(config.worldHeight).toBe(200);
    expect(() => loadConfig({ ...database, WORLD_WIDTH: "7" })).toThrow(/WORLD_WIDTH/);
    expect(() => loadConfig({ ...database, WORLD_HEIGHT: "501" })).toThrow(/WORLD_HEIGHT/);
  });
});
