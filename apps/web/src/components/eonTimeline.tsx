import { CalendarIcon, PauseIcon } from "../assets/icons";

export default function EonTimeline() {
  return (
    <section className="eon-card eon-timeline">
      <header>
        <h2>Simulation Timeline</h2>
      </header>
      <div className="eon-timeline-row">
        <button type="button" className="eon-round-pause" aria-label="Pause simulation">
          <PauseIcon />
        </button>
        <div className="eon-track" aria-hidden="true">
          <i />
          <b />
          <b />
          <b className="is-idle" />
          <b className="is-idle" />
        </div>
        <div className="eon-year-chip">
          <CalendarIcon />
          <span>
            <strong>Year 1</strong>
            <small>Day 28</small>
          </span>
        </div>
      </div>
      <dl>
        <div>
          <dt>Running</dt>
          <dd>Year 1, Day 28 10:24</dd>
        </div>
        <div>
          <dt>Next Tick</dt>
          <dd>+ 6 seconds</dd>
        </div>
        <div>
          <dt>Season</dt>
          <dd>Spring</dd>
        </div>
        <div>
          <dt>Year Progress</dt>
          <dd>
            1%
            <span>
              <i />
            </span>
          </dd>
        </div>
        <div>
          <dt>Day</dt>
          <dd>Day 28 / 90</dd>
        </div>
      </dl>
    </section>
  );
}
