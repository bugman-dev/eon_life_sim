const worldStatus = [
  { label: "Climate", value: "Temperature" },
  { label: "Weather", value: "22Â°C  Clear" },
  { label: "Season", value: "Spring" },
  { label: "Day Length", value: "14h 12m" },
] as const;

export default function WorldStatus() {
  return (
    <section className="eon-card">
      <header>
        <h2>World Status</h2>
        <button type="button">Edit</button>
      </header>
      <ul className="eon-status">
        {worldStatus.map((row) => (
          <li key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
