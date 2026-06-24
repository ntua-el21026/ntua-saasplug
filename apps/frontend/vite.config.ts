import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1200,
  },
  envDir: "../..",
  envPrefix: "VITE_",
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  test: {
    environment: "jsdom",
    fileParallelism: false,
    setupFiles: "./src/test/setup.ts",
  },
});
