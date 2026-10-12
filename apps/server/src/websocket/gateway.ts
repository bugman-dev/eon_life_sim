import websocket from "@fastify/websocket";
import { MAX_CLIENT_MESSAGE_BYTES, PROTOCOL_VERSION, worldMapSchema, type ServerMessage } from "@life-simulator/shared";
import type { FastifyInstance } from "fastify";
import type { RawData, WebSocket } from "ws";
import type { AppLogger } from "../observability/logger.js";
import type { WorldMapRepository } from "../persistence/world-map-repository.js";
import type { WorldSessionRepository } from "../persistence/world-session-repository.js";
import type { SimulationRuntime } from "../simulation/runtime.js";
import type { AnimalSettings } from "../world/animals.js";
import type { DepositSettings } from "../world/deposits.js";
import type { VegetationSettings } from "../world/vegetation.js";
import { WorldSessionService } from "../world-session/world-session-service.js";
import { dispatch } from "./dispatcher.js";
import { parseClientMessage } from "./parse-message.js";

export class ClientHub {
  private readonly rooms = new Map<string, Set<WebSocket>>();

  subscribe(worldId: string, socket: WebSocket) {
    const existing = this.rooms.get(worldId);
    if (existing) {
      existing.add(socket);
      return;
    }
    this.rooms.set(worldId, new Set([socket]));
  }

  remove(socket: WebSocket) {
    for (const room of this.rooms.values()) {
      room.delete(socket);
    }
  }

  publish(worldId: string, message: ServerMessage) {
    const payload = JSON.stringify(message);
    for (const socket of this.rooms.get(worldId) ?? []) {
      if (socket.readyState === socket.OPEN) {
        socket.send(payload);
      }
    }
  }

  drop(worldId: string) {
    this.rooms.delete(worldId);
  }
}

export type GatewayDependencies = {
  hub: ClientHub;
  repository: WorldSessionRepository;
  maps: WorldMapRepository;
  runtime: SimulationRuntime;
  tickRate: number;
  gameSecondsPerTick: number;
  worldWidth: number;
  worldHeight: number;
  deposits: DepositSettings;
  vegitation: VegetationSettings;
  animals: AnimalSettings;
  logger: AppLogger;
};

export async function registerGateway(app: FastifyInstance, deps: GatewayDependencies) {
  await app.register(websocket, {
    options: { maxPayload: MAX_CLIENT_MESSAGE_BYTES * 4 },
  });

  const service = new WorldSessionService(
    deps.repository,
    deps.maps,
    deps.runtime,
    deps.tickRate,
    deps.gameSecondsPerTick,
    deps.worldWidth,
    deps.worldHeight,
    deps.deposits,
    deps.vegitation,
    deps.animals,
  );

  app.get("/ws", { websocket: true }, (socket) => {
    const hello = JSON.stringify({ type: "hello", protocolVersion: PROTOCOL_VERSION } satisfies ServerMessage);
    if (socket.readyState === socket.OPEN) {
      socket.send(hello);
    } else {
      socket.once("open", () => {
        socket.send(hello);
      });
    }

    socket.on("message", (raw) => {
      void handleMessage(socket, raw);
    });
    socket.on("close", () => {
      deps.hub.remove(socket);
    });
    socket.on("error", (error: Error) => {
      deps.logger.warn({ message: error.message }, "websocket error");
    });
  });

  async function sendMap(socket: WebSocket, worldId: string) {
    const map = await deps.maps.findMap(worldId);
    if (!map || !worldMapSchema.safeParse(map).success) {
      send(socket, { type: "world.map.unavailable", worldId });
      return;
    }
    send(socket, { type: "world.map", payload: map });
  }

  async function handleMessage(socket: WebSocket, raw: RawData) {
    const parsed = parseClientMessage(rawToText(raw));
    if (!parsed.ok) {
      deps.logger.warn({ code: parsed.code }, "rejected websocket message");
      send(socket, {
        type: "request.error",
        requestId: parsed.requestId,
        error: { code: parsed.code, message: parsed.message },
      });
      return;
    }

    try {
      const response = await dispatch(parsed.message, service);
      if (response.type === "world.deleted") {
        deps.hub.publish(response.worldId, response);
        deps.hub.drop(response.worldId);
      }
      if (response.type === "request.ok") {
        deps.hub.subscribe(response.payload.id, socket);
        deps.hub.publish(response.payload.id, { type: "world.state", payload: response.payload });
      }
      send(socket, response);
      if (
        response.type === "request.ok" &&
        (parsed.message.type === "world.create" || parsed.message.type === "world.get")
      ) {
        await sendMap(socket, response.payload.id);
      }
    } catch (error) {
      deps.logger.error(
        { message: error instanceof Error ? error.message : "Unknown command failure" },
        "websocket command failed",
      );
      send(socket, {
        type: "request.error",
        requestId: parsed.message.requestId,
        error: { code: "internal_error", message: "The request could not be completed." },
      });
    }
  }
}

function rawToText(raw: RawData): string {
  if (typeof raw === "string") {
    return raw;
  }
  if (Buffer.isBuffer(raw)) {
    return raw.toString("utf8");
  }
  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw).toString("utf8");
  }
  return Buffer.concat(raw).toString("utf8");
}

function send(socket: WebSocket, message: ServerMessage) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}
