import {
  createUserAccount,
  deleteSession,
  findUserByToken,
  getWorkspace,
  hasDatabaseConfig,
  loginUser,
  pingDatabase,
  saveWorkspace,
  updateUserProfile,
} from "./db.mjs";
import { getLiveJobs } from "./jobFeeds.mjs";

const maxBodyBytes = 1_000_000;

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sendNoContent(response) {
  response.writeHead(204, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  });
  response.end();
}

function authToken(request) {
  const header = request.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice("Bearer ".length).trim();
  return request.headers["x-session-token"] || "";
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > maxBodyBytes) throw new Error("Request body is too large.");
  }
  if (!body.trim()) return {};
  return JSON.parse(body);
}

async function requireUser(request, response) {
  const token = authToken(request);
  const user = await findUserByToken(token);
  if (!user) {
    sendJson(response, 401, { error: "Not authenticated." });
    return null;
  }
  return { user, token };
}

function normalizeAuthDraft(body) {
  return {
    email: String(body.email || "").trim().toLowerCase(),
    password: String(body.password || ""),
    profile: {
      name: String(body.name || body.profile?.name || "Brian Jien").trim(),
      avatar: body.avatar || body.profile?.avatar,
      program: body.profile?.program,
      graduation: body.profile?.graduation,
      visa: body.profile?.visa,
    },
  };
}

function validateAuthDraft(draft, isRegister) {
  if (!draft.email || !draft.password) return "Email and password are required.";
  if (isRegister && draft.password.length < 8) return "Use at least 8 characters.";
  return "";
}

export async function handleApiRequest(request, response) {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (!url.pathname.startsWith("/api/")) return false;

  if (request.method === "OPTIONS") {
    sendNoContent(response);
    return true;
  }

  try {
    if (url.pathname === "/api/health") {
      sendJson(response, 200, {
        ok: true,
        service: "uiuc-mcs-internship-tracker",
        database: await pingDatabase(),
      });
      return true;
    }

    if (url.pathname === "/api/jobs" && request.method === "GET") {
      const payload = await getLiveJobs(Object.fromEntries(url.searchParams.entries()));
      sendJson(response, 200, payload);
      return true;
    }

    if (!hasDatabaseConfig()) {
      sendJson(response, 503, { error: "Database environment is not configured." });
      return true;
    }

    if (url.pathname === "/api/auth/register" && request.method === "POST") {
      const draft = normalizeAuthDraft(await readJson(request));
      const validationError = validateAuthDraft(draft, true);
      if (validationError) {
        sendJson(response, 400, { error: validationError });
        return true;
      }

      const result = await createUserAccount(draft);
      sendJson(response, result.error ? 409 : 201, result);
      return true;
    }

    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      const draft = normalizeAuthDraft(await readJson(request));
      const validationError = validateAuthDraft(draft, false);
      if (validationError) {
        sendJson(response, 400, { error: validationError });
        return true;
      }

      const result = await loginUser(draft);
      sendJson(response, result.error ? 401 : 200, result);
      return true;
    }

    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      await deleteSession(authToken(request));
      sendJson(response, 200, { ok: true });
      return true;
    }

    if (url.pathname === "/api/me" && request.method === "GET") {
      const session = await requireUser(request, response);
      if (!session) return true;
      sendJson(response, 200, { user: session.user, workspace: await getWorkspace(session.user.id) });
      return true;
    }

    if (url.pathname === "/api/profile" && request.method === "PATCH") {
      const session = await requireUser(request, response);
      if (!session) return true;
      const body = await readJson(request);
      const nextProfile = {
        ...session.user.profile,
        ...(body.profile && typeof body.profile === "object" ? body.profile : body),
      };
      sendJson(response, 200, { user: await updateUserProfile(session.user.id, nextProfile) });
      return true;
    }

    if (url.pathname === "/api/workspace" && request.method === "GET") {
      const session = await requireUser(request, response);
      if (!session) return true;
      sendJson(response, 200, { workspace: await getWorkspace(session.user.id) });
      return true;
    }

    if (url.pathname === "/api/workspace" && request.method === "PUT") {
      const session = await requireUser(request, response);
      if (!session) return true;
      const body = await readJson(request);
      sendJson(response, 200, { workspace: await saveWorkspace(session.user.id, body.workspace || body) });
      return true;
    }

    sendJson(response, 404, { error: "API route not found." });
    return true;
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : "API request failed." });
    return true;
  }
}
