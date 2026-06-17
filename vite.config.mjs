import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { getLiveJobs } from "./server/jobFeeds.mjs";

function liveJobsApi() {
  return {
    name: "live-jobs-api",
    configureServer(server) {
      server.middlewares.use("/api/jobs", async (request, response) => {
        try {
          const url = new URL(request.url || "", "http://localhost");
          const payload = await getLiveJobs(Object.fromEntries(url.searchParams.entries()));
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify(payload));
        } catch (error) {
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error), jobs: [] }));
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/jobs", async (request, response) => {
        try {
          const url = new URL(request.url || "", "http://localhost");
          const payload = await getLiveJobs(Object.fromEntries(url.searchParams.entries()));
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify(payload));
        } catch (error) {
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error), jobs: [] }));
        }
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
