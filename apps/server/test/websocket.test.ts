import { beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createApp } from "../src/app.js";
import { applyMigrations } from "../src/persistence/migrate.js";
import { ensureTestDatabase, testDatabaseUrl, testProcessEnv } from "./database.js";
import { ManualScheduler } from "./manual-scheduler.js";
import { openSocket } from "./messages.js";

const databaseUrl = testDatabaseUrl(process.env.DATABASE_URL ?? "");

beforeAll(async () => {
  await ensureTestDatabase(databaseUrl);
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await applyMigrations(pool);
  } finally {
    await pool.end();
  }
});

describe("websocket session control", () => {
  it("keeps two clients on one server clock and rejects a bad message", async () => {
    const scheduler = new ManualScheduler();
    const context = await createApp({ env: testProcessEnv(databaseUrl), scheduler });
    await context.app.ready();

    const first = await openSocket(context.app);
    const second = await openSocket(context.app);
    await first.inbox.waitFor((messages) => messages.some((message) => message.type === "hello"));
    await second.inbox.waitFor((messages) => messages.some((message) => message.type === "hello"));

    const createId = crypto.randomUUID();
    first.socket.send(
      JSON.stringify({
        type: "world.create",
        requestId: createId,
        payload: { name: "Shared valley" },
      }),
    );
    await first.inbox.waitFor((messages) => messages.some((message) => message.type === "request.ok" && message.requestId === createId));
    const created = first.inbox.messages.find((message) => message.type === "request.ok" && message.requestId === createId);
    if (!created || created.type !== "request.ok") {
      throw new Error("Create did not return a session.");
    }

    const worldId = created.payload.id;
    const getId = crypto.randomUUID();
    second.socket.send(JSON.stringify({ type: "world.get", requestId: getId, payload: { worldId } }));
    await second.inbox.waitFor((messages) => messages.some((message) => message.type === "request.ok" && message.requestId === getId));

    first.socket.send("not-json");
    await first.inbox.waitFor((messages) => messages.some((message) => message.type === "request.error"));
    const afterError = first.inbox.messages.length;

    const startId = crypto.randomUUID();
    first.socket.send(JSON.stringify({ type: "simulation.start", requestId: startId, payload: { worldId } }));
    await second.inbox.waitFor((messages) =>
      messages.some((message) => message.type === "simulation.state" && message.payload.status === "running"),
    );
    expect(scheduler.pending()).toBe(1);

    await scheduler.flushNext();
    await second.inbox.waitFor((messages) =>
      messages.some((message) => message.type === "simulation.state" && message.payload.simulationTick === "1"),
    );
    await first.inbox.waitFor((messages) =>
      messages.some((message) => message.type === "simulation.state" && message.payload.simulationTick === "1"),
    );

    const pauseId = crypto.randomUUID();
    first.socket.send(JSON.stringify({ type: "simulation.pause", requestId: pauseId, payload: { worldId } }));
    await first.inbox.waitFor((messages) => messages.some((message) => message.type === "request.ok" && message.requestId === pauseId));
    expect(scheduler.pending()).toBe(0);
    await scheduler.flushNext();

    const resumeId = crypto.randomUUID();
    second.socket.send(JSON.stringify({ type: "simulation.resume", requestId: resumeId, payload: { worldId } }));
    await second.inbox.waitFor((messages) => messages.some((message) => message.type === "request.ok" && message.requestId === resumeId));
    await scheduler.flushNext();
    await first.inbox.waitFor((messages) =>
      messages.some((message) => message.type === "simulation.state" && message.payload.simulationTick === "2"),
    );

    const followUpId = crypto.randomUUID();
    first.socket.send(JSON.stringify({ type: "world.get", requestId: followUpId, payload: { worldId } }));
    await first.inbox.waitFor((messages) => messages.some((message) => message.type === "request.ok" && message.requestId === followUpId));
    expect(first.inbox.messages.length).toBeGreaterThan(afterError);
    expect(context.runtime.getLive(worldId)?.simulationTick).toBe(2n);

    first.socket.close();
    second.socket.close();
    await context.app.close();
  });
});
