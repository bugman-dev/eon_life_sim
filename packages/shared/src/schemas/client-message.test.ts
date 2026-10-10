import { describe, expect, it } from "vitest";
import { clientMessageSchema } from "./client-message.js";
import { serverMessageSchema } from "./world-session.js";

const requestId = "4f5b7c2e-1a2b-4c3d-8e9f-123456789abc";
const worldId = "8b2e4c1a-9d8e-4f7a-b6c5-abcdef123456";

describe("client messages", () => {
  it("accepts a world create command", () => {
    const parsed = clientMessageSchema.safeParse({
      type: "world.create",
      requestId,
      payload: { name: "Valley", seed: 12345 },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown command", () => {
    const parsed = clientMessageSchema.safeParse({
      type: "simulation.setTick",
      requestId,
      payload: { worldId, simulationTick: "10" },
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts a world delete command", () => {
    expect(
      clientMessageSchema.safeParse({
        type: "world.delete",
        requestId,
        payload: { worldId },
      }).success,
    ).toBe(true);
    expect(
      serverMessageSchema.safeParse({
        type: "world.deleted",
        requestId,
        worldId,
      }).success,
    ).toBe(true);
  });

  it("rejects a missing name and a fractional seed", () => {
    expect(
      clientMessageSchema.safeParse({
        type: "world.create",
        requestId,
        payload: { name: "   " },
      }).success,
    ).toBe(false);

    expect(
      clientMessageSchema.safeParse({
        type: "world.create",
        requestId,
        payload: { name: "Valley", seed: 1.5 },
      }).success,
    ).toBe(false);
  });
});

describe("server messages", () => {
  it("accepts the protocol hello", () => {
    expect(serverMessageSchema.safeParse({ type: "hello", protocolVersion: 1 }).success).toBe(true);
    expect(serverMessageSchema.safeParse({ type: "hello", protocolVersion: 2 }).success).toBe(false);
  });
});
