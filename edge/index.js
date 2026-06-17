import { getLiveJobs } from "../server/jobFeeds.mjs";
import { assets } from "./static-assets.generated.mjs";

const binaryCache = new Map();

function baseHeaders(extra = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    ...extra,
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: baseHeaders({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    }),
  });
}

function decodeAsset(assetPath, asset) {
  if (binaryCache.has(assetPath)) return binaryCache.get(assetPath);

  const binary = atob(asset.body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  binaryCache.set(assetPath, bytes);
  return bytes;
}

function resolveAsset(pathname) {
  let cleanPath = "/";
  try {
    cleanPath = decodeURIComponent(pathname);
  } catch {
    cleanPath = pathname;
  }

  cleanPath = cleanPath.replace(/\/+/g, "/");
  if (cleanPath === "/") return { path: "/index.html", asset: assets["/index.html"] };
  if (assets[cleanPath]) return { path: cleanPath, asset: assets[cleanPath] };
  if (assets[`${cleanPath}/index.html`]) {
    return { path: `${cleanPath}/index.html`, asset: assets[`${cleanPath}/index.html`] };
  }

  return { path: "/index.html", asset: assets["/index.html"] };
}

async function handleApi(request, url) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: baseHeaders() });
  }

  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const params = Object.fromEntries(url.searchParams.entries());
    const payload = await getLiveJobs(params);
    return jsonResponse(payload);
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : String(error),
        jobs: [],
      },
      500,
    );
  }
}

async function handler(request) {
  const url = new URL(request.url);

  if (url.pathname === "/api/health") {
    return jsonResponse({ ok: true, service: "uiuc-mcs-internship-tracker" });
  }

  if (url.pathname === "/api/jobs") {
    return handleApi(request, url);
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: baseHeaders() });
  }

  const { path, asset } = resolveAsset(url.pathname);
  if (!asset) {
    return new Response("Build assets missing. Run npm run build before deploying.", {
      status: 503,
      headers: baseHeaders({ "content-type": "text/plain; charset=utf-8" }),
    });
  }

  const isHtml = path === "/index.html";
  return new Response(request.method === "HEAD" ? null : decodeAsset(path, asset), {
    headers: baseHeaders({
      "content-type": asset.type,
      "cache-control": isHtml ? "no-cache" : "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    }),
  });
}

addEventListener("fetch", (fetchEvent) => {
  fetchEvent.respondWith(handler(fetchEvent.request));
});

export { handler };
