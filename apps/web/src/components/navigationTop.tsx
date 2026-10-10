import {
  BellIcon,
  CaretIcon,
  PauseIcon,
  PlayIcon,
  RoundDotIcon,
  SearchIcon,
  SettingsIcon,
  StepIcon,
  SunIcon,
} from "../assets/icons";
import type { WorldSessionState } from "@life-simulator/shared";
import { useState } from "react";
import { ConnectionStatus } from "../networking/socket";
import CreateWorld from "../modals/createWorld";

const DAYS_PER_YEAR = 365;

export default function NavigationTop({
  session,
  connection,
  onPlay,
  onPause,
  onCreate,
  onLoad,
}: {
  session: WorldSessionState | null;
  connection?: ConnectionStatus;
  onPlay?: () => void;
  onPause?: () => void;
  onCreate: (name: string, seed?: number) => void;
  onLoad: (worldId: string) => void;
}) {
  const { name, seed } = session ?? { name: "", seed: null };
  const running = session?.status === "running";
  const disconnected = connection !== "connected";
  const [worldMenuOpen, setWorldMenuOpen] = useState(false);
  const [createWorldOpen, setCreateWorldOpen] = useState(false);

  const elapsedDays = Math.max(session?.gameDay ?? 1, 1) - 1;
  const years = Math.floor(elapsedDays / DAYS_PER_YEAR) + 1;
  return (
    <div className="eon-top">
      <div className="eon-brand">
        <strong>EON</strong>
        <span>Living World Simulator</span>
      </div>

      <div className="eon-world-menu">
        <button
          type="button"
          className="eon-world"
          aria-expanded={worldMenuOpen}
          aria-haspopup="menu"
          onClick={() => setWorldMenuOpen((open) => !open)}
        >
          <span className="eon-world-thumb" aria-hidden="true" />
          <span>
            <strong>{name || "-"}</strong>
            <small>Seed: {seed ?? "-"}</small>
          </span>
          {connection === "connected" ? <CaretIcon /> : <RoundDotIcon />}
        </button>
        {worldMenuOpen ? (
          <div className="eon-world-popover" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setWorldMenuOpen(false);
                setCreateWorldOpen(true);
              }}
            >
              Create World
            </button>
            <button type="button" role="menuitem">
              Delete Current World
            </button>
          </div>
        ) : null}
      </div>

      <label className="eon-search">
        <SearchIcon />
        <input
          readOnly
          value=""
          placeholder="Search people, places, resources..."
        />
        <kbd>/</kbd>
      </label>

      <div className="eon-transport">
        <button
          type="button"
          className={
            running ? "eon-transport-pause" : "eon-transport-pause is-active"
          }
          aria-label="Pause"
          disabled={disconnected}
          onClick={onPause}
        >
          <PauseIcon />
        </button>
        <button
          type="button"
          className={
            running ? "eon-transport-play is-active" : "eon-transport-play"
          }
          aria-label="Play"
          disabled={disconnected}
          onClick={onPlay}
        >
          <PlayIcon />
        </button>
        <button type="button" aria-label="Step">
          <StepIcon />
        </button>
        <span>1x</span>
      </div>

      <div className="eon-clock">
        <SunIcon />
        <span>
          <strong>
            Year {years}, Day {elapsedDays}
          </strong>
          <small>Spring Â· 10:24</small>
        </span>
      </div>

      <div className="eon-top-actions">
        <button
          type="button"
          className="eon-icon-button"
          aria-label="Notifications"
        >
          <BellIcon />
          <i />
        </button>
        <button type="button" className="eon-icon-button" aria-label="Settings">
          <SettingsIcon />
        </button>
        <span className="eon-avatar">T</span>
      </div>
      {createWorldOpen ? (
        <CreateWorld
          session={session}
          connected={connection === "connected"}
          onCreate={onCreate}
          onLoad={onLoad}
          onClose={() => setCreateWorldOpen(false)}
        />
      ) : null}
    </div>
  );
}
