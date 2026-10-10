import {
  BellIcon,
  CaretIcon,
  PauseIcon,
  PlayIcon,
  SearchIcon,
  SettingsIcon,
  StepIcon,
  SunIcon,
} from "../assets/icons";

export default function NavigationTop() {
  return (
    <div className="eon-top">
      <div className="eon-brand">
        <strong>EON</strong>
        <span>Living World Simulator</span>
      </div>

      <button type="button" className="eon-world">
        <span className="eon-world-thumb" aria-hidden="true" />
        <span>
          <strong>Green Valley</strong>
          <small>Seed: 482913</small>
        </span>
        <CaretIcon />
      </button>

      <label className="eon-search">
        <SearchIcon />
        <input readOnly value="" placeholder="Search people, places, resources..." />
        <kbd>/</kbd>
      </label>

      <div className="eon-transport">
        <button type="button" className="eon-transport-pause" aria-label="Pause">
          <PauseIcon />
        </button>
        <button type="button" aria-label="Play">
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
        <button type="button" className="eon-icon-button" aria-label="Notifications">
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
