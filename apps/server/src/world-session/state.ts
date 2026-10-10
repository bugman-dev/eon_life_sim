import type { SimulationState, WorldSessionState } from "@life-simulator/shared";
import type { WorldSessionRecord } from "../persistence/world-session-repository.js";

export function toWorldSessionState(session: WorldSessionRecord): WorldSessionState {
  return {
    id: session.id,
    name: session.name,
    status: session.status,
    simulationTick: session.simulationTick.toString(),
    gameDay: session.gameDay,
    gameHour: session.gameHour,
    gameMinute: session.gameMinute,
    gameSecond: session.gameSecond,
    tickRate: session.tickRate,
    seed: session.seed === null ? null : session.seed.toString(),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export function toSimulationState(session: WorldSessionRecord): SimulationState {
  return {
    worldId: session.id,
    status: session.status,
    simulationTick: session.simulationTick.toString(),
    gameDay: session.gameDay,
    gameHour: session.gameHour,
    gameMinute: session.gameMinute,
    gameSecond: session.gameSecond,
    tickRate: session.tickRate,
  };
}
