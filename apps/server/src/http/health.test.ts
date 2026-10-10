import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerHealthRoutes } from "./health.js";

describe("health routes", () => {
  it("reports the process as alive", async () => {
    const app = Fastify({ logger: false });
    registerHealthRoutes(app, { query: async () => ({ rows: [] }) });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
  });

  it("reports not ready when the database is unavailable", async () => {
    const app = Fastify({ logger: false });
    registerHealthRoutes(app, {
      query: async () => {
        throw new Error("connect ECONNREFUSED");
      },
    });

    const response = await app.inject({ method: "GET", url: "/ready" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: "unavailable" });
    await app.close();
  });
});
