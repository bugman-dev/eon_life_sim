import type { ClientMessage } from "@life-simulator/shared";
import type { SimulationSocket } from "./socket.js";

export const LAST_WORLD_STORAGE_KEY = "life-simulator:last-world-id";

export class SessionClient {
  constructor(private readonly socket: SimulationSocket) {}

  createWorld(name: string, seed?: number) {
    return this.send({
      type: "world.create",
      requestId: crypto.randomUUID(),
      payload: seed === undefined ? { name } : { name, seed },
    });
  }

  getWorld(worldId: string) {
    return this.send({
      type: "world.get",
      requestId: crypto.randomUUID(),
      payload: { worldId },
    });
  }

  deleteWorld(worldId: string) {
    return this.send({
      type: "world.delete",
      requestId: crypto.randomUUID(),
      payload: { worldId },
    });
  }

  start(worldId: string) {
    return this.send({ type: "simulation.start", requestId: crypto.randomUUID(), payload: { worldId } });
  }

  pause(worldId: string) {
    return this.send({ type: "simulation.pause", requestId: crypto.randomUUID(), payload: { worldId } });
  }

  resume(worldId: string) {
    return this.send({ type: "simulation.resume", requestId: crypto.randomUUID(), payload: { worldId } });
  }

  loadSavedWorld() {
    const worldId = localStorage.getItem(LAST_WORLD_STORAGE_KEY);
    if (!worldId) {
      return false;
    }
    return this.getWorld(worldId);
  }

  private send(message: ClientMessage) {
    return this.socket.send(message);
  }
}
