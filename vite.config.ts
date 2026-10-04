import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// One id per build. It is baked into the bundle (__BUILD_ID__) and also written to
// /version.json, so a long-idle tab can ask "is there a newer deploy?" before reloading.
const buildId = Date.now().toString(36);

function emitVersionFile(): Plugin {
  return {
    name: "emit-version-file",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ id: buildId }),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), emitVersionFile()],
  base: "/",
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  build: {
    rollupOptions: {
      output: {
        // Keep big third-party code in its own long-lived chunks so the entry
        // bundle stays small. Firebase is only fetched after first paint.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("firebase")) return "firebase";
          if (id.includes("framer-motion")) return "motion";
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|@remix-run)\//.test(id)) {
            return "react";
          }
        },
      },
    },
  },
});
