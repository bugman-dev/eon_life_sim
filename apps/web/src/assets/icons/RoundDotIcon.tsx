export default function RoundDotIcon({
  color = "red",
  size = 16,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <svg
      className="eon-round-dot"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <circle cx="8" cy="8" r="7" style={{ fill: color, stroke: "none" }} />
    </svg>
  );
}
