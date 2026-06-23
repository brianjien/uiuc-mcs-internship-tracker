import {
  createUserAccount,
  deleteSession,
  findUserByToken,
  getLeaderboard,
  getWorkspace,
  hasDatabaseConfig,
  loginGoogleUser,
  loginUser,
  pingDatabase,
  saveWorkspace,
  updateUserProfile,
} from "./db.mjs";
import { getLiveJobs } from "./jobFeeds.mjs";
import { OAuth2Client } from "google-auth-library";

const maxBodyBytes = 1_000_000;
const defaultGoogleClientId = "48292852686-95nqueviim5bflqo4upq3bta29bkamej.apps.googleusercontent.com";
const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || defaultGoogleClientId;
const googleClient = new OAuth2Client(googleClientId);

function sendJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function redirect(response, location, extraHeaders = {}) {
  response.writeHead(303, {
    location,
    "cache-control": "no-store",
    ...extraHeaders,
  });
  response.end();
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
  return request.headers["x-session-token"] || parseCookies(request).ct_session || "";
}

function parseCookies(request) {
  const cookieHeader = request.headers.cookie || "";
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const delimiter = item.indexOf("=");
        if (delimiter === -1) return [decodeURIComponent(item), ""];
        return [decodeURIComponent(item.slice(0, delimiter)), decodeURIComponent(item.slice(delimiter + 1))];
      }),
  );
}

function sessionCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `ct_session=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax${secure}`;
}

function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `ct_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > maxBodyBytes) throw new Error("Request body is too large.");
  }
  return body;
}

async function readJson(request) {
  const body = await readBody(request);
  if (!body.trim()) return {};
  return JSON.parse(body);
}

async function readForm(request) {
  const body = await readBody(request);
  return Object.fromEntries(new URLSearchParams(body));
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
      name: String(body.name || body.profile?.name || "Candidate").trim(),
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

async function verifyGoogleCredential(credential) {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: googleClientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.email || payload.email_verified !== true) {
    throw new Error("Google account email could not be verified.");
  }
  return {
    email: payload.email,
    name: payload.name || payload.email.split("@")[0],
    picture: payload.picture || "",
  };
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
        service: "career-tracker-dashboard",
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
      sendJson(response, result.error ? 409 : 201, result, result.token ? { "set-cookie": sessionCookie(result.token) } : {});
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
      sendJson(response, result.error ? 401 : 200, result, result.token ? { "set-cookie": sessionCookie(result.token) } : {});
      return true;
    }

    if (url.pathname === "/api/auth/google" && request.method === "POST") {
      const body = await readJson(request);
      if (!body.credential) {
        sendJson(response, 400, { error: "Missing Google credential." });
        return true;
      }

      let googleProfile;
      try {
        googleProfile = await verifyGoogleCredential(String(body.credential));
      } catch {
        sendJson(response, 401, { error: "Google credential could not be verified." });
        return true;
      }
      const result = await loginGoogleUser(googleProfile);
      sendJson(response, 200, result, { "set-cookie": sessionCookie(result.token) });
      return true;
    }

    if (url.pathname === "/api/auth/google/redirect" && request.method === "POST") {
      const cookies = parseCookies(request);
      const body = await readForm(request);
      const bodyCsrf = body.g_csrf_token || "";
      const cookieCsrf = cookies.g_csrf_token || "";
      if ((bodyCsrf || cookieCsrf) && bodyCsrf !== cookieCsrf) {
        redirect(response, "/?auth_error=google_csrf");
        return true;
      }

      try {
        const googleProfile = await verifyGoogleCredential(String(body.credential || ""));
        const result = await loginGoogleUser(googleProfile);
        redirect(response, "/", { "set-cookie": sessionCookie(result.token) });
      } catch {
        redirect(response, "/?auth_error=google");
      }
      return true;
    }

    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      await deleteSession(authToken(request));
      sendJson(response, 200, { ok: true }, { "set-cookie": clearSessionCookie() });
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

    if (url.pathname === "/api/leaderboard" && request.method === "GET") {
      const session = await requireUser(request, response);
      if (!session) return true;
      sendJson(response, 200, await getLeaderboard(session.user.id, url.searchParams.get("limit")));
      return true;
    }

    sendJson(response, 404, { error: "API route not found." });
    return true;
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : "API request failed." });
    return true;
  }
}
