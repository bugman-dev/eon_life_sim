import type { WorldSessionState } from "@life-simulator/shared";

export function ClockPanel({
  session,
  connected,
  onStart,
  onPause,
  onResume,
}: {
  session: WorldSessionState | null;
  connected: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const running = session?.status === "running";
  const unavailable = !connected || !session;
  const hour = String(session?.gameHour ?? 0).padStart(2, "0");
  const minute = String(session?.gameMinute ?? 0).padStart(2, "0");
  const second = String(session?.gameSecond ?? 0).padStart(2, "0");

  return (
    <section>
      <h2>Simulation clock</h2>
      <p>
        Tick {session?.simulationTick ?? "0"} · Day {session?.gameDay ?? 1}, {hour}:{minute}:{second} ·{" "}
        {session?.status ?? "paused"}
      </p>
      <button type="button" onClick={onStart} disabled={unavailable || running}>
        Start
      </button>
      <button type="button" onClick={onPause} disabled={unavailable || !running}>
        Pause
      </button>
      <button type="button" onClick={onResume} disabled={unavailable || running}>
        Resume
      </button>
    </section>
  );
}
