import { serverMessageSchema, type ServerMessage } from "@life-simulator/shared";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";

export function trackMessages(socket: WebSocket) {
  const messages: ServerMessage[] = [];
  socket.on("message", (data) => {
    const text = typeof data === "string" ? data : data.toString();
    const parsed = serverMessageSchema.safeParse(JSON.parse(text));
    if (parsed.success) {
      messages.push(parsed.data);
    }
  });

  return {
    messages,
    async waitFor(predicate: (messages: ServerMessage[]) => boolean) {
      const started = Date.now();
      while (!predicate(messages)) {
        if (Date.now() - started > 3000) {
          throw new Error(`Timed out waiting for a websocket message: ${JSON.stringify(messages)}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    },
  };
}

export async function openSocket(app: FastifyInstance) {
  let tracked: ReturnType<typeof trackMessages> | undefined;
  const socket = await app.injectWS(
    "/ws",
    {},
    {
      onInit(ws) {
        tracked = trackMessages(ws);
      },
    },
  );
  if (!tracked) {
    throw new Error("WebSocket listener was not attached.");
  }
  return { socket, inbox: tracked };
}
