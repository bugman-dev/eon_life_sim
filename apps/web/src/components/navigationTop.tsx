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
import { ConnectionStatus } from "../networking/socket";

export default function NavigationTop({
  session,
  connection,
}: {
  session: WorldSessionState | null;
  connection?: ConnectionStatus;
}) {
  const { name, seed } = session ?? { name: "", seed: null };
  return (
    <div className="eon-top">
      <div className="eon-brand">
        <strong>EON</strong>
        <span>Living World Simulator</span>
      </div>

      <button type="button" className="eon-world">
        <span className="eon-world-thumb" aria-hidden="true" />
        <span>
          <strong>{name || "-"}</strong>
          <small>Seed: {seed ?? "-"}</small>
        </span>
        {connection === "connected" ? <CaretIcon /> : <RoundDotIcon />}
      </button>

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
          className="eon-transport-pause"
          aria-label="Pause"
          disabled={connection !== "connected"}
        >
          <PauseIcon />
        </button>
        <button
          type="button"
          aria-label="Play"
          disabled={connection !== "connected"}
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
          <strong>Year 1, Day 28</strong>
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
    </div>
  );
}
