import { useEffect, useRef, useState } from "react";
import type { WorldMap, WorldSessionState } from "@life-simulator/shared";
import {
  LAST_WORLD_STORAGE_KEY,
  SessionClient,
} from "../networking/session-client";
import {
  connectSimulationSocket,
  serverSocketUrl,
  type ConnectionStatus,
} from "../networking/socket";
import { PlayerMarker } from "../player/PlayerMarker";
import { PixiViewport } from "../rendering/PixiViewport";
import { WorldStageProvider } from "../rendering/world-stage";
import { AppStateProvider } from "../state/app-state";
import ErrorModal from "../modals/errorModal";
import Layout from "./Layout";

export function App() {
  const [connection, setConnection] = useState<ConnectionStatus>("connecting");
  const [protocolVersion, setProtocolVersion] = useState<number | null>(null);
  const [session, setSession] = useState<WorldSessionState | null>(null);
  const [map, setMap] = useState<WorldMap | null>(null);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<SessionClient | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    let client: SessionClient;
    const socket = connectSimulationSocket(serverSocketUrl(), {
      onStatus: setConnection,
      onConnected: () => {
        client.loadSavedWorld();
      },
      onMessage: (message) => {
        if (message.type === "hello") {
          setProtocolVersion(message.protocolVersion);
          return;
        }
        if (message.type === "world.map") {
          if (sessionIdRef.current && sessionIdRef.current !== message.payload.worldId) {
            return;
          }
          setMap(message.payload);
          setMapUnavailable(false);
          return;
        }
        if (message.type === "world.map.unavailable") {
          if (sessionIdRef.current && sessionIdRef.current !== message.worldId) {
            return;
          }
          setMap(null);
          setMapUnavailable(true);
          return;
        }
        if (message.type === "world.deleted") {
          if (sessionIdRef.current !== message.worldId) {
            return;
          }
          localStorage.removeItem(LAST_WORLD_STORAGE_KEY);
          sessionIdRef.current = null;
          setSession(null);
          setMap(null);
          setMapUnavailable(false);
          setError(null);
          return;
        }
        if (message.type === "request.ok" || message.type === "world.state") {
          const changed = sessionIdRef.current !== message.payload.id;
          sessionIdRef.current = message.payload.id;
          setSession(message.payload);
          localStorage.setItem(LAST_WORLD_STORAGE_KEY, message.payload.id);
          setError(null);
          if (changed) {
            setMap(null);
            setMapUnavailable(false);
          }
          return;
        }
        if (message.type === "simulation.state") {
          setSession((current) => {
            if (!current || current.id !== message.payload.worldId) {
              return current;
            }
            return {
              ...current,
              status: message.payload.status,
              simulationTick: message.payload.simulationTick,
              gameDay: message.payload.gameDay,
              gameHour: message.payload.gameHour,
              gameMinute: message.payload.gameMinute,
              gameSecond: message.payload.gameSecond,
              tickRate: message.payload.tickRate,
            };
          });
          return;
        }
        setError(message.error.message);
        if (message.error.code === "not_found") {
          localStorage.removeItem(LAST_WORLD_STORAGE_KEY);
          sessionIdRef.current = null;
          setSession(null);
          setMap(null);
          setMapUnavailable(false);
        }
      },
    });
    client = new SessionClient(socket);
    clientRef.current = client;

    return () => {
      clientRef.current = null;
      socket.close();
    };
  }, []);

  function requireClient() {
    const client = clientRef.current;
    if (!client) {
      setError("Not connected to the server.");
      return null;
    }
    return client;
  }

  function createWorld(name: string, seed?: number) {
    const client = requireClient();
    if (!client) {
      return;
    }
    if (seed !== undefined && !Number.isSafeInteger(seed)) {
      setError("Seed must be a whole number.");
      return;
    }
    if (!client.createWorld(name, seed)) {
      setError("Not connected to the server.");
    }
  }

  function deleteWorld() {
    const client = requireClient();
    if (!client || !session) {
      setError("Create or load a world first.");
      return;
    }
    if (!client.deleteWorld(session.id)) {
      setError("Not connected to the server.");
    }
  }

  function loadWorld(worldId: string) {
    const client = requireClient();
    if (!client) {
      return;
    }
    if (!client.getWorld(worldId)) {
      setError("Not connected to the server.");
    }
  }

  function command(action: "start" | "pause" | "resume") {
    const client = requireClient();
    if (!client || !session) {
      setError("Create or load a world first.");
      return;
    }
    const sent =
      action === "start"
        ? client.start(session.id)
        : action === "pause"
          ? client.pause(session.id)
          : client.resume(session.id);
    if (!sent) {
      setError("Not connected to the server.");
    }
  }

  return (
    <AppStateProvider>
      <WorldStageProvider>
        <main>
        <Layout
          session={session}
          connection={connection}
          protocolVersion={protocolVersion}
          onToggleSimulation={() =>
            command(
              session?.status === "running"
                ? "pause"
                : session?.simulationTick === "0"
                  ? "start"
                  : "resume",
            )
          }
          onPlay={() => command(session?.simulationTick === "0" ? "start" : "resume")}
          onPause={() => command("pause")}
          onCreate={createWorld}
          onLoad={loadWorld}
          onDelete={deleteWorld}
          mapWidth={map?.width ?? null}
          mapHeight={map?.height ?? null}
        >
          {error ? <ErrorModal type="Error" message={error} onClose={() => setError(null)} /> : null}
          <PixiViewport
            map={map}
            status={
              session && !map
                ? mapUnavailable
                  ? "This world has no generated map."
                  : "Loading map"
                : null
            }
          />
          <PlayerMarker map={map} />
        </Layout>
        </main>
      </WorldStageProvider>
    </AppStateProvider>
  );
}
