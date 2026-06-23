import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import mysql from "mysql2/promise";

const scrypt = promisify(scryptCallback);

let pool;
let schemaReady = false;

const emptyWorkspace = {
  jobs: [],
  tasks: [],
  contacts: [],
  documents: [],
  goal: null,
};

function loadLocalEnv() {
  const filePath = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const delimiterIndex = trimmed.indexOf("=");
    if (delimiterIndex === -1) continue;

    const key = trimmed.slice(0, delimiterIndex).trim();
    const rawValue = trimmed.slice(delimiterIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

loadLocalEnv();

function env(name, fallback = "") {
  return process.env[name] || fallback;
}

export function hasDatabaseConfig() {
  return Boolean(env("DB_HOST") && env("DB_PORT") && (env("DB_NAME") || env("DB_DATABASE")) && (env("DB_USERNAME") || env("DB_USER")));
}

function getDatabaseConfig() {
  if (!hasDatabaseConfig()) {
    throw new Error("Database environment is not configured.");
  }

  return {
    host: env("DB_HOST"),
    port: Number(env("DB_PORT")),
    database: env("DB_NAME", env("DB_DATABASE")),
    user: env("DB_USERNAME", env("DB_USER")),
    password: env("DB_PASSWORD"),
    waitForConnections: true,
    connectionLimit: Number(env("DB_POOL_LIMIT", "6")),
    queueLimit: 0,
    charset: "utf8mb4",
    dateStrings: true,
  };
}

export function getPool() {
  if (!pool) {
    pool = mysql.createPool(getDatabaseConfig());
  }
  return pool;
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function serializeJson(value) {
  return JSON.stringify(value ?? null);
}

function normalizeWorkspace(value = {}) {
  return {
    jobs: Array.isArray(value.jobs) ? value.jobs : [],
    tasks: Array.isArray(value.tasks) ? value.tasks : [],
    contacts: Array.isArray(value.contacts) ? value.contacts : [],
    documents: Array.isArray(value.documents) ? value.documents : [],
    goal: value.goal && typeof value.goal === "object" ? value.goal : null,
  };
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    profile: parseJson(row.profile_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}

async function verifyPassword(password, stored = "") {
  const [salt, keyHex] = stored.split(":");
  if (!salt || !keyHex) return false;

  const candidate = await scrypt(password, salt, 64);
  const storedKey = Buffer.from(keyHex, "hex");
  return storedKey.length === candidate.length && timingSafeEqual(storedKey, candidate);
}

export async function ensureSchema() {
  if (schemaReady) return;

  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      profile_json LONGTEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX sessions_user_id_idx (user_id),
      INDEX sessions_expires_at_idx (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS workspace_data (
      user_id VARCHAR(36) PRIMARY KEY,
      jobs_json LONGTEXT NOT NULL,
      tasks_json LONGTEXT NOT NULL,
      contacts_json LONGTEXT NOT NULL,
      documents_json LONGTEXT NOT NULL,
      goal_json LONGTEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_workspace_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  schemaReady = true;
}

export async function pingDatabase() {
  if (!hasDatabaseConfig()) return { configured: false, ok: false };
  try {
    await ensureSchema();
    await getPool().query("SELECT 1");
    return { configured: true, ok: true };
  } catch (error) {
    return { configured: true, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  await getPool().execute(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY))",
    [tokenHash(token), userId],
  );
  return token;
}

export async function createUserAccount({ email, password, profile }) {
  await ensureSchema();

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const [existing] = await getPool().execute("SELECT id FROM users WHERE email = ? LIMIT 1", [normalizedEmail]);
  if (existing.length > 0) {
    return { error: "This email is already registered." };
  }

  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  const nextProfile = {
    name: profile?.name || "Candidate",
    program: profile?.program || "Career Profile",
    graduation: profile?.graduation || "2026-2027 cycle",
    visa: profile?.visa || "Internship + New Grad",
    avatar: profile?.avatar || "/assets/profile-presets/avatar-portrait.png",
  };

  await getPool().execute("INSERT INTO users (id, email, password_hash, profile_json) VALUES (?, ?, ?, ?)", [
    id,
    normalizedEmail,
    passwordHash,
    serializeJson(nextProfile),
  ]);
  await saveWorkspace(id, emptyWorkspace);

  const [rows] = await getPool().execute("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  return { user: publicUser(rows[0]), token: await createSession(id), workspace: emptyWorkspace };
}

export async function loginGoogleUser({ email, name, picture }) {
  await ensureSchema();

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const [existingRows] = await getPool().execute("SELECT * FROM users WHERE email = ? LIMIT 1", [normalizedEmail]);
  let user = existingRows[0];

  if (!user) {
    const id = randomUUID();
    const nextProfile = {
      name: name || "Candidate",
      program: "Career Profile",
      graduation: "2026-2027 cycle",
      visa: "Internship + New Grad",
      avatar: picture || "/assets/profile-presets/avatar-portrait.png",
    };
    await getPool().execute("INSERT INTO users (id, email, password_hash, profile_json) VALUES (?, ?, ?, ?)", [
      id,
      normalizedEmail,
      `google:${randomBytes(24).toString("hex")}`,
      serializeJson(nextProfile),
    ]);
    await saveWorkspace(id, emptyWorkspace);
    const [createdRows] = await getPool().execute("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
    user = createdRows[0];
  }

  return { user: publicUser(user), token: await createSession(user.id), workspace: await getWorkspace(user.id) };
}

export async function loginUser({ email, password }) {
  await ensureSchema();

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const [rows] = await getPool().execute("SELECT * FROM users WHERE email = ? LIMIT 1", [normalizedEmail]);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return { error: "Email or password is incorrect." };
  }

  return { user: publicUser(user), token: await createSession(user.id), workspace: await getWorkspace(user.id) };
}

export async function findUserByToken(token) {
  if (!token) return null;
  await ensureSchema();

  const [rows] = await getPool().execute(
    `
      SELECT users.*
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > CURRENT_TIMESTAMP
      LIMIT 1
    `,
    [tokenHash(token)],
  );
  return rows[0] ? publicUser(rows[0]) : null;
}

export async function deleteSession(token) {
  if (!token) return;
  await ensureSchema();
  await getPool().execute("DELETE FROM sessions WHERE token_hash = ?", [tokenHash(token)]);
}

export async function updateUserProfile(userId, profile) {
  await ensureSchema();
  await getPool().execute("UPDATE users SET profile_json = ? WHERE id = ?", [serializeJson(profile || {}), userId]);
  const [rows] = await getPool().execute("SELECT * FROM users WHERE id = ? LIMIT 1", [userId]);
  return publicUser(rows[0]);
}

export async function getWorkspace(userId) {
  await ensureSchema();
  const [rows] = await getPool().execute("SELECT * FROM workspace_data WHERE user_id = ? LIMIT 1", [userId]);
  const row = rows[0];
  if (!row) {
    await saveWorkspace(userId, emptyWorkspace);
    return emptyWorkspace;
  }

  return normalizeWorkspace({
    jobs: parseJson(row.jobs_json, []),
    tasks: parseJson(row.tasks_json, []),
    contacts: parseJson(row.contacts_json, []),
    documents: parseJson(row.documents_json, []),
    goal: parseJson(row.goal_json, null),
  });
}

function getStageCount(jobs, stage) {
  return jobs.filter((job) => job?.stage === stage).length;
}

function getAppliedCount(jobs) {
  return jobs.filter((job) => job?.stage && job.stage !== "saved").length;
}

function getConversionRate(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function publicLeaderboardEntry(entry) {
  const { userId, ...publicEntry } = entry;
  return publicEntry;
}

export async function getLeaderboard(currentUserId, limit = 50) {
  await ensureSchema();
  const safeLimit = Math.min(100, Math.max(5, Number(limit) || 50));
  const [rows] = await getPool().execute(
    `
      SELECT
        users.id,
        users.email,
        users.profile_json,
        users.created_at,
        workspace_data.jobs_json,
        workspace_data.goal_json,
        workspace_data.updated_at AS workspace_updated_at
      FROM users
      LEFT JOIN workspace_data ON workspace_data.user_id = users.id
    `,
  );

  const ranked = rows
    .map((row) => {
      const profile = parseJson(row.profile_json, {});
      const jobs = parseJson(row.jobs_json, []);
      const goal = parseJson(row.goal_json, null);
      const applied = getAppliedCount(jobs);
      const interviews = getStageCount(jobs, "interview");
      const offers = getStageCount(jobs, "offer");
      const oa = getStageCount(jobs, "oa");
      const saved = getStageCount(jobs, "saved");
      const tracked = jobs.length;
      const priority = jobs.filter((job) => job?.priority).length;
      const goalTarget = Number(goal?.target || 0);
      const displayName = String(profile.name || row.email?.split("@")[0] || "Candidate").trim().slice(0, 80);

      return {
        userId: row.id,
        name: displayName || "Candidate",
        avatar: profile.avatar || "/assets/profile-presets/avatar-portrait.png",
        program: profile.program || "Career Profile",
        graduation: profile.graduation || "2026-2027 cycle",
        applied,
        tracked,
        saved,
        oa,
        interviews,
        offers,
        priority,
        conversionRate: getConversionRate(interviews + offers, applied),
        offerRate: getConversionRate(offers, applied),
        goalTarget,
        goalProgress: goalTarget ? Math.min(100, Math.round((applied / goalTarget) * 100)) : 0,
        workspaceUpdatedAt: row.workspace_updated_at || row.created_at,
        isCurrentUser: row.id === currentUserId,
      };
    })
    .sort((left, right) => {
      if (right.applied !== left.applied) return right.applied - left.applied;
      if (right.offers !== left.offers) return right.offers - left.offers;
      if (right.interviews !== left.interviews) return right.interviews - left.interviews;
      return String(right.workspaceUpdatedAt || "").localeCompare(String(left.workspaceUpdatedAt || ""));
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const currentUser = ranked.find((entry) => entry.userId === currentUserId) || null;
  const topApplied = ranked[0]?.applied || 0;
  const totalApplied = ranked.reduce((sum, entry) => sum + entry.applied, 0);
  const activeUsers = ranked.filter((entry) => entry.applied > 0).length;
  const peerAverage = ranked.length ? Math.round(totalApplied / ranked.length) : 0;

  return {
    generatedAt: new Date().toISOString(),
    metric: "applied",
    totalUsers: ranked.length,
    activeUsers,
    topApplied,
    peerAverage,
    currentUser: currentUser ? publicLeaderboardEntry(currentUser) : null,
    entries: ranked.slice(0, safeLimit).map(publicLeaderboardEntry),
  };
}

export async function saveWorkspace(userId, workspace) {
  await ensureSchema();
  const next = normalizeWorkspace(workspace);
  await getPool().execute(
    `
      INSERT INTO workspace_data (user_id, jobs_json, tasks_json, contacts_json, documents_json, goal_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        jobs_json = VALUES(jobs_json),
        tasks_json = VALUES(tasks_json),
        contacts_json = VALUES(contacts_json),
        documents_json = VALUES(documents_json),
        goal_json = VALUES(goal_json)
    `,
    [
      userId,
      serializeJson(next.jobs),
      serializeJson(next.tasks),
      serializeJson(next.contacts),
      serializeJson(next.documents),
      serializeJson(next.goal),
    ],
  );
  return next;
}
