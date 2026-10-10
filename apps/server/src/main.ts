import { createApp } from "./app.js";
import { loadEnvironment } from "./config/env.js";

loadEnvironment();

let closing = false;
let closeApp: (() => Promise<void>) | undefined;

async function shutdown(signal: string) {
  if (closing) {
    return;
  }
  closing = true;
  if (!closeApp) {
    process.exit(0);
  }
  console.info(`Received ${signal}. Shutting down.`);
  await closeApp();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

try {
  const context = await createApp();
  closeApp = async () => {
    await context.app.close();
  };
  await context.app.listen({ host: context.config.serverHost, port: context.config.serverPort });
} catch (error) {
  const message = error instanceof Error ? error.message : "Server failed to start.";
  console.error(message);
  if (closeApp && !closing) {
    closing = true;
    await closeApp();
  }
  process.exit(1);
}
