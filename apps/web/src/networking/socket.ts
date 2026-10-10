import { serverMessageSchema, type ClientMessage, type ServerMessage } from "@life-simulator/shared";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export type SocketHandlers = {
  onStatus: (status: ConnectionStatus) => void;
  onMessage: (message: ServerMessage) => void;
  onConnected: () => void;
};

export type SimulationSocket = {
  send(message: ClientMessage): boolean;
  close(): void;
};

export function serverSocketUrl() {
  return import.meta.env.VITE_WS_URL || "ws://localhost:3000/ws";
}

export function connectSimulationSocket(url: string, handlers: SocketHandlers): SimulationSocket {
  let socket: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let retryTimer: number | undefined;

  const connect = () => {
    handlers.onStatus("connecting");
    const next = new WebSocket(url);
    socket = next;

    next.addEventListener("open", () => {
      if (socket !== next) {
        return;
      }
      attempt = 0;
      handlers.onStatus("connected");
      handlers.onConnected();
    });

    next.addEventListener("message", (event) => {
      if (typeof event.data !== "string") {
        return;
      }
      try {
        const parsed = serverMessageSchema.safeParse(JSON.parse(event.data));
        if (parsed.success) {
          handlers.onMessage(parsed.data);
        }
      } catch {
        // Ignore a frame that is not JSON. The server remains authoritative.
      }
    });

    next.addEventListener("close", () => {
      if (socket !== next || closed) {
        return;
      }
      handlers.onStatus("disconnected");
      const delay = Math.min(5000, 500 * 2 ** attempt);
      attempt += 1;
      retryTimer = window.setTimeout(connect, delay);
    });
  };

  connect();

  return {
    send(message) {
      if (socket?.readyState !== WebSocket.OPEN) {
        return false;
      }
      socket.send(JSON.stringify(message));
      return true;
    },
    close() {
      closed = true;
      if (retryTimer !== undefined) {
        window.clearTimeout(retryTimer);
      }
      socket?.close();
    },
  };
}
