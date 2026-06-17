import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLiveJobs } from "./jobFeeds.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(projectRoot, "dist");
const port = Number(process.env.PORT || 8787);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function safeFilePath(urlPath) {
  let decoded = "/";
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    decoded = urlPath;
  }

  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(distDir, normalized === "/" ? "index.html" : normalized);
  return filePath.startsWith(distDir) ? filePath : null;
}

async function serveApi(request, response, url) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const payload = await getLiveJobs(Object.fromEntries(url.searchParams.entries()));
    sendJson(response, 200, payload);
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : String(error),
      jobs: [],
    });
  }
}

async function serveStatic(request, response, url) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
    response.end("Method not allowed");
    return;
  }

  const requestedPath = safeFilePath(url.pathname);
  const candidates = [
    requestedPath,
    requestedPath && !path.extname(requestedPath) ? path.join(requestedPath, "index.html") : null,
    path.join(distDir, "index.html"),
  ].filter(Boolean);

  for (const filePath of candidates) {
    try {
      const file = await fs.readFile(filePath);
      const isIndex = path.basename(filePath) === "index.html";
      response.writeHead(200, {
        "content-type": mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream",
        "cache-control": isIndex ? "no-cache" : "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      });
      response.end(request.method === "HEAD" ? null : file);
      return;
    } catch {
      // Try the next candidate, then fall through to 404.
    }
  }

  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, service: "uiuc-mcs-internship-tracker" });
    return;
  }

  if (url.pathname === "/api/jobs") {
    await serveApi(request, response, url);
    return;
  }

  await serveStatic(request, response, url);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Full-stack server listening on http://127.0.0.1:${port}`);
});
