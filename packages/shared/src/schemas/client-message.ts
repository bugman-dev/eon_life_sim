import { z } from "zod";

const requestId = z.string().uuid();
const worldId = z.string().uuid();

export const clientMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("world.create"),
      requestId,
      payload: z
        .object({
          name: z.string().trim().min(1).max(80),
          seed: z.number().int().safe().optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("world.get"),
      requestId,
      payload: z.object({ worldId }).strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("world.delete"),
      requestId,
      payload: z.object({ worldId }).strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("simulation.start"),
      requestId,
      payload: z.object({ worldId }).strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("simulation.pause"),
      requestId,
      payload: z.object({ worldId }).strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("simulation.resume"),
      requestId,
      payload: z.object({ worldId }).strict(),
    })
    .strict(),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;
