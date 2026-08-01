import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

type NodeLikeGlobal = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

const environment = (globalThis as NodeLikeGlobal).process?.env ?? {};
const isDebug = Boolean(environment.TAURI_ENV_DEBUG);

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: environment.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: isDebug ? false : "esbuild",
    sourcemap: isDebug,
  },
});
