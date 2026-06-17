import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { handleApiRequest } from "./server/api.mjs";

function liveJobsApi() {
  return {
    name: "internship-tracker-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (await handleApiRequest(request, response)) return;
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (await handleApiRequest(request, response)) return;
        next();
      });
    },
  };
}

export default defineConfig({
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [liveJobsApi(), react()],
});
