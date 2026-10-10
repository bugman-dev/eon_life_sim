import { z } from "zod";

export const worldSessionStatusSchema = z.enum(["paused", "running"]);

export const worldSessionStateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: worldSessionStatusSchema,
  simulationTick: z.string().regex(/^\d+$/),
  gameDay: z.number().int().positive(),
  gameHour: z.number().int().min(0).max(23),
  gameMinute: z.number().int().min(0).max(59),
  gameSecond: z.number().int().min(0).max(59),
  tickRate: z.number().int().positive(),
  seed: z.string().regex(/^-?\d+$/).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const simulationStateSchema = z.object({
  worldId: z.string().uuid(),
  status: worldSessionStatusSchema,
  simulationTick: z.string().regex(/^\d+$/),
  gameDay: z.number().int().positive(),
  gameHour: z.number().int().min(0).max(23),
  gameMinute: z.number().int().min(0).max(59),
  gameSecond: z.number().int().min(0).max(59),
  tickRate: z.number().int().positive(),
});

export const serverMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    protocolVersion: z.literal(1),
  }),
  z.object({
    type: z.literal("request.ok"),
    requestId: z.string(),
    payload: worldSessionStateSchema,
  }),
  z.object({
    type: z.literal("request.error"),
    requestId: z.string(),
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  }),
  z.object({
    type: z.literal("world.state"),
    payload: worldSessionStateSchema,
  }),
  z.object({
    type: z.literal("simulation.state"),
    payload: simulationStateSchema,
  }),
]);

export type WorldSessionStatus = z.infer<typeof worldSessionStatusSchema>;
export type WorldSessionState = z.infer<typeof worldSessionStateSchema>;
export type SimulationState = z.infer<typeof simulationStateSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;
