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
    expect(config.nodeEnv).toBe("development");
  });
});
