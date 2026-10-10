import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

const envDir = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, "");
  const port = Number(env.WEB_PORT || 5173);

  return {
    plugins: [react()],
    envDir,
    server: {
      host: "0.0.0.0",
      port: Number.isInteger(port) && port > 0 ? port : 5173,
    },
  };
});
