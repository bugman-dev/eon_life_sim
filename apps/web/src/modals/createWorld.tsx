import { useState, type FormEvent } from "react";
import type { WorldSessionState } from "@life-simulator/shared";

export default function CreateWorld({
  session,
  connected,
  onCreate,
  onLoad,
  onClose,
}: {
  session: WorldSessionState | null;
  connected: boolean;
  onCreate: (name: string, seed?: number) => void;
  onLoad: (worldId: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("First world");
  const [seed, setSeed] = useState("");
  const [worldId, setWorldId] = useState("");

  function createWorld(event: FormEvent) {
    event.preventDefault();
    const trimmedSeed = seed.trim();
    if (trimmedSeed === "") {
      onCreate(name.trim());
    } else {
      onCreate(name.trim(), Number(trimmedSeed));
    }
    onClose();
  }

  function loadWorld(event: FormEvent) {
    event.preventDefault();
    onLoad(worldId.trim());
    onClose();
  }

  return (
    <div className="eon-modal" role="presentation" onClick={onClose}>
      <div
        className="eon-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-world-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="create-world-title">Create World</h2>
          <button type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <section>
          <h2>World session</h2>
          {session ? (
            <>
              <p>{session.name}</p>
              <p>
                <code>{session.id}</code>
              </p>
              <p>
                {session.seed === null ? "No seed" : `Seed ${session.seed}`}
              </p>
            </>
          ) : (
            <p>No session</p>
          )}
          {session === null ? (
            <form onSubmit={createWorld}>
              <label>
                Name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={80}
                />
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
              <button
                type="submit"
                disabled={!connected || name.trim() === ""}
              >
                Create world
              </button>
            </form>
          ) : null}
          {session === null ? (
            <form onSubmit={loadWorld}>
              <label>
                World id
                <input
                  value={worldId}
                  onChange={(event) => setWorldId(event.target.value)}
                  placeholder="Paste an existing id"
                />
              </label>
              <button
                type="submit"
                disabled={!connected || worldId.trim() === ""}
              >
                Load world
              </button>
            </form>
          ) : null}
        </section>
      </div>
    </div>
  );
}
