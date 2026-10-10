import { useState, type FormEvent } from "react";
import type { WorldSessionState } from "@life-simulator/shared";

export function WorldSessionPanel({
  session,
  connected,
  onCreate,
  onLoad,
}: {
  session: WorldSessionState | null;
  connected: boolean;
  onCreate: (name: string, seed?: number) => void;
  onLoad: (worldId: string) => void;
}) {
  const [name, setName] = useState("First world");
  const [seed, setSeed] = useState("");
  const [worldId, setWorldId] = useState("");

  function createWorld(event: FormEvent) {
    event.preventDefault();
    const trimmedSeed = seed.trim();
    if (trimmedSeed === "") {
      onCreate(name.trim());
      return;
    }
    onCreate(name.trim(), Number(trimmedSeed));
  }

  function loadWorld(event: FormEvent) {
    event.preventDefault();
    onLoad(worldId.trim());
  }

  return (
    <section>
      <h2>World session</h2>
      {session ? (
        <>
          <p>{session.name}</p>
          <p>
            <code>{session.id}</code>
          </p>
          <p>{session.seed === null ? "No seed" : `Seed ${session.seed}`}</p>
        </>
      ) : (
        <p>No session</p>
      )}
      <form onSubmit={createWorld}>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} />
        </label>
        <label>
          Seed
          <input
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
            inputMode="numeric"
            placeholder="Optional"
          />
        </label>
        <button type="submit" disabled={!connected}>
          Create world
        </button>
      </form>
      <form onSubmit={loadWorld}>
        <label>
          World id
          <input value={worldId} onChange={(event) => setWorldId(event.target.value)} placeholder="Paste an existing id" />
        </label>
        <button type="submit" disabled={!connected || worldId.trim() === ""}>
          Load world
        </button>
      </form>
    </section>
  );
}
