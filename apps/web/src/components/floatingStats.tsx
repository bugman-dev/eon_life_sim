import type { ReactNode } from "react";

type FloatingStatsProps = {
  label: string;
  value: string;
  delta: string;
  note: string;
  tone: string;
  icon: ReactNode;
};

export default function FloatingStats({ label, value, delta, note, tone, icon }: FloatingStatsProps) {
  return (
    <article className="eon-stat">
      <span className={`eon-stat-icon is-${tone}`}>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>
          {value}
          <em>â†‘ {delta}</em>
        </strong>
        <small>{note}</small>
      </div>
    </article>
  );
}
