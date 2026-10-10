import { useEffect } from "react";
import { CalendarIcon, PauseIcon, PlayIcon } from "../assets/icons";
import { padTwoDigits } from "../utils/helperFunctions";

const DAYS_PER_MONTH = 30;
const MONTHS_PER_YEAR = 12;
const DAYS_PER_YEAR = 365;

export default function EonTimeline({
  tick = "0",
  seconds = 0,
  minutes = 0,
  hours = 0,
  days = 1,
  running = false,
  onToggle,
}: {
  tick?: string;
  seconds?: number;
  minutes?: number;
  hours?: number;
  days?: number;
  running?: boolean;
  onToggle?: () => void;
}) {
  const elapsedDays = Math.max(days, 1) - 1;
  const months = (Math.floor(elapsedDays / DAYS_PER_MONTH) % MONTHS_PER_YEAR) + 1;
  const years = Math.floor(elapsedDays / DAYS_PER_YEAR) + 1;
  const dayIntoYear = elapsedDays % DAYS_PER_YEAR;
  const hourFraction = (hours + minutes / 60 + seconds / 3600) / 24;
  const yearProgress = Math.round(((dayIntoYear + hourFraction) / DAYS_PER_YEAR) * 100);

  useEffect(() => {
    console.log("Ticks: ", tick);
    console.log("Seconds: ", seconds);
    console.log("Minutes: ", minutes);
    console.log("Hours: ", hours);
    console.log("Days: ", days);
    console.log("Months: ", months);
    console.log("Years: ", years);
  }, [tick, seconds, minutes, hours, days, months, years]);

  return (
    <section className="eon-card eon-timeline">
      <header>
        <h2>Simulation Timeline</h2>
      </header>
      <div className="eon-timeline-row">
        <button
          type="button"
          className="eon-round-pause"
          aria-label={running ? "Pause simulation" : "Play simulation"}
          onClick={onToggle}
        >
          {running ? <PauseIcon /> : <PlayIcon />}
        </button>
        <div
          className="eon-track"
          role="progressbar"
          aria-label="Day progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(hourFraction * 100)}
        >
          <i style={{ width: `${hourFraction * 100}%` }} />
        </div>
        <div className="eon-year-chip">
          <CalendarIcon />
          <span>
            <strong>Year {years}</strong>
            <small>Day {days}</small>
          </span>
        </div>
      </div>
      <dl>
        <div>
          <dt>{running ? "Running" : "Paused"}</dt>
          <dd>Year {years} </dd>
          <dd>
            Day {padTwoDigits(days)}, {padTwoDigits(hours)}:{padTwoDigits(minutes)}
          </dd>
        </div>
        <div>
          <dt>Next Tick</dt>
          <dd>+ {seconds} seconds</dd>
        </div>
        <div>
          <dt>Season</dt>
          <dd>Spring</dd>
        </div>
        <div>
          <dt>Year Progress</dt>
          <dd>
            {yearProgress}%
            <span>
              <i />
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
