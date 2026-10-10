import type { ConnectionStatus } from "../../networking/socket";

const labels: Record<ConnectionStatus, string> = {
  connecting: "Connecting",
  connected: "Connected",
  disconnected: "Disconnected",
};

export function ConnectionPanel({
  status,
  protocolVersion,
}: {
  status: ConnectionStatus;
  protocolVersion: number | null;
}) {
  return (
    <section>
      <h2>Connection</h2>
      <p>
        {labels[status]}
        {protocolVersion ? ` · Protocol ${protocolVersion}` : ""}
      </p>
    </section>
  );
}
