import type { ClientMessage, ServerMessage } from "@life-simulator/shared";
import { ServiceError, type WorldSessionService } from "../world-session/world-session-service.js";
import { toWorldSessionState } from "../world-session/state.js";

export async function dispatch(message: ClientMessage, service: WorldSessionService): Promise<ServerMessage> {
  if (message.type === "world.delete") {
    try {
      await service.delete(message.payload.worldId);
      return { type: "world.deleted", requestId: message.requestId, worldId: message.payload.worldId };
    } catch (error) {
      if (error instanceof ServiceError) {
        return {
          type: "request.error",
          requestId: message.requestId,
          error: { code: error.code, message: error.message },
        };
      }
      throw error;
    }
  }

  try {
    const session = await runCommand(message, service);
    return {
      type: "request.ok",
      requestId: message.requestId,
      payload: toWorldSessionState(session),
    };
  } catch (error) {
    if (error instanceof ServiceError) {
      return {
        type: "request.error",
        requestId: message.requestId,
        error: { code: error.code, message: error.message },
      };
    }
    throw error;
  }
}

async function runCommand(message: Exclude<ClientMessage, { type: "world.delete" }>, service: WorldSessionService) {
  switch (message.type) {
    case "world.create":
      return service.create(message.payload);
    case "world.get":
      return service.get(message.payload.worldId);
    case "simulation.start":
      return service.start(message.payload.worldId);
    case "simulation.pause":
      return service.pause(message.payload.worldId);
    case "simulation.resume":
      return service.resume(message.payload.worldId);
  }
}
