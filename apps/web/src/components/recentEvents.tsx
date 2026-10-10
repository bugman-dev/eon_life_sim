import { Landscape } from "../assets/icons";

const events = [
  {
    title: "A baby was born",
    time: "2 hours ago",
    tag: "People",
    tone: "blue",
  },
  {
    title: "New building constructed",
    time: "5 hours ago",
    tag: "Building",
    tone: "amber",
  },
  {
    title: "Deer spotted near the river",
    time: "7 hours ago",
    tag: "Animal",
    tone: "green",
  },
  { title: "Rainfall event", time: "1 day ago", tag: "Weather", tone: "sky" },
] as const;

export default function RecentEvents() {
  return (
    <section className="eon-card">
      <header>
        <h2>Recent Events</h2>
        <button type="button">View All</button>
      </header>
      <ul className="eon-events">
        {events.map((event) => (
          <li key={event.title}>
            <span className={`is-${event.tone}`} />
            <div>
              <strong>{event.title}</strong>
              <small>{event.time}</small>
            </div>
            <em className={`is-${event.tone}`}>{event.tag}</em>
          </li>
        ))}
      </ul>
      <div className="eon-landscape" aria-hidden="true">
        <Landscape />
      </div>
    </section>
  );
}
