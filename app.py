import hashlib
import hmac
import json
import os
import re
import secrets
import sys
import uuid
from datetime import datetime, timedelta, timezone
from html import unescape
from pathlib import Path
from urllib.parse import urlparse

import pymysql
import requests
from flask import Flask, jsonify, make_response, redirect, request, send_from_directory
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token


APP_ROOT = Path(__file__).resolve().parent
DIST_DIR = APP_ROOT / "dist"
MAX_BODY_BYTES = 3_000_000
MAX_TEXT_LENGTH = 2_000
MAX_FIELD_LENGTH = 512
MAX_NOTE_LENGTH = 8_000
MAX_DATA_URL_BYTES = 720_000
GOOGLE_CLIENT_ID = os.environ.get(
    "GOOGLE_CLIENT_ID",
    os.environ.get("VITE_GOOGLE_CLIENT_ID", "48292852686-95nqueviim5bflqo4upq3bta29bkamej.apps.googleusercontent.com"),
)

WORKSPACE_LIMITS = {"jobs": 500, "tasks": 500, "contacts": 500, "documents": 200}
ALLOWED_STAGES = {"saved", "applied", "oa", "interview", "offer"}
ALLOWED_MODES = {"Remote", "Hybrid", "On-site"}
ALLOWED_PRIORITIES = {"High", "Medium", "Low"}
ALLOWED_DOCUMENT_TYPES = {"Resume", "Cover Letter", "Portfolio", "Transcript", "Referral Note", "Template", "Other"}
ALLOWED_DOCUMENT_STATUSES = {"Draft", "Needs Review", "Ready", "Submitted", "Archived"}
SAFE_PROFILE_AVATAR_PREFIXES = ("/assets/profile-presets/",)
SAFE_DATA_MIME_TYPES = {
    "data:application/pdf",
    "data:image/gif",
    "data:image/jpeg",
    "data:image/png",
    "data:image/webp",
    "data:text/csv",
    "data:text/markdown",
    "data:text/plain",
    "data:application/json",
}

EMPTY_WORKSPACE = {
    "jobs": [],
    "tasks": [],
    "contacts": [],
    "documents": [],
    "goal": None,
}

app = Flask(__name__, static_folder=None)
schema_ready = False
job_cache = {"created_at": 0, "payload": None}
rate_limit_buckets = {}

simplify_sources = [
    {
        "id": "simplify-off-season",
        "name": "Simplify Off-Season",
        "url": "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README-Off-Season.md",
        "season": "2026 Fall",
        "roleType": "Internship",
    },
    {
        "id": "simplify-summer",
        "name": "Simplify Summer 2026",
        "url": "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md",
        "season": "2026 Summer",
        "roleType": "Internship",
    },
    {
        "id": "simplify-new-grad",
        "name": "Simplify New Grad",
        "url": "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/README.md",
        "season": "New Grad",
        "roleType": "New Grad",
    },
]

greenhouse_boards = ["anthropic", "coinbase", "databricks", "figma", "rubrik", "scaleai", "stripe"]
remoteok_url = "https://remoteok.com/api"
remotive_url = "https://remotive.com/api/remote-jobs?search=software%20engineer"


def env(name, fallback=""):
    return os.environ.get(name) or fallback


def has_database_config():
    return bool(env("DB_HOST") and env("DB_PORT") and (env("DB_NAME") or env("DB_DATABASE")) and (env("DB_USERNAME") or env("DB_USER")))


def db_config():
    if not has_database_config():
        raise RuntimeError("Database environment is not configured.")
    return {
        "host": env("DB_HOST"),
        "port": int(env("DB_PORT")),
        "database": env("DB_NAME", env("DB_DATABASE")),
        "user": env("DB_USERNAME", env("DB_USER")),
        "password": env("DB_PASSWORD"),
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
        "autocommit": True,
    }


def db():
    return pymysql.connect(**db_config())


def ensure_schema():
    global schema_ready
    if schema_ready:
        return
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                  id VARCHAR(36) PRIMARY KEY,
                  email VARCHAR(255) NOT NULL UNIQUE,
                  password_hash VARCHAR(255) NOT NULL,
                  profile_json LONGTEXT NOT NULL,
                  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                  token_hash CHAR(64) PRIMARY KEY,
                  user_id VARCHAR(36) NOT NULL,
                  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  expires_at TIMESTAMP NOT NULL,
                  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                  INDEX sessions_user_id_idx (user_id),
                  INDEX sessions_expires_at_idx (expires_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
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
                """
            )
    schema_ready = True


def parse_json(value, fallback):
    if not value:
        return fallback
    try:
        return json.loads(value)
    except Exception:
        return fallback


CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
HTML_TAG_RE = re.compile(r"<[^>]*>")
EMAIL_RE = re.compile(r"^[^@\s<>]{1,64}@[^@\s<>]{1,180}\.[^@\s<>]{2,20}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ID_RE = re.compile(r"[^a-zA-Z0-9_.:-]+")


def clean_text(value="", limit=MAX_TEXT_LENGTH, fallback=""):
    if value is None or isinstance(value, (dict, list, tuple, set)):
        return fallback
    text = unescape(str(value))
    text = CONTROL_CHAR_RE.sub(" ", text)
    text = HTML_TAG_RE.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return fallback
    return text[:limit]


def clean_identifier(value="", fallback=""):
    text = clean_text(value, 128)
    text = ID_RE.sub("-", text).strip("-")
    return (text[:128] or fallback or f"item-{uuid.uuid4()}")


def clean_email(value=""):
    email = clean_text(value, 254).lower()
    return email if EMAIL_RE.match(email) else ""


def clean_date(value=""):
    text = clean_text(value, 32)
    return text if DATE_RE.match(text) else ""


def clean_bool(value=False):
    return value is True or str(value).lower() in {"true", "1", "yes", "on"}


def clean_int(value=0, minimum=0, maximum=100, fallback=0):
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        number = fallback
    return max(minimum, min(maximum, number))


def is_safe_data_url(value=""):
    raw = str(value or "").strip()
    if not raw or len(raw) > MAX_DATA_URL_BYTES or "," not in raw:
        return False
    header = raw.split(",", 1)[0].lower()
    mime = header.split(";", 1)[0]
    if mime not in SAFE_DATA_MIME_TYPES:
        return False
    if ";base64" in header and not re.match(r"^[a-zA-Z0-9+/=\s]+$", raw.split(",", 1)[1]):
        return False
    return True


def clean_url(value="", allow_data=False, allow_local=False):
    raw = CONTROL_CHAR_RE.sub("", str(value or "").strip())
    if not raw or len(raw) > 2048:
        return ""
    if allow_local and raw.startswith(SAFE_PROFILE_AVATAR_PREFIXES) and re.match(r"^/assets/profile-presets/[a-z0-9_.-]+\.(png|jpg|jpeg|webp|svg)$", raw, re.I):
        return raw
    if allow_data and is_safe_data_url(raw):
        return raw
    try:
        parsed = urlparse(raw)
    except Exception:
        return ""
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.username or parsed.password:
        return ""
    return raw


def clean_tags(value):
    if not isinstance(value, list):
        return []
    tags = []
    for item in value[:12]:
        tag = clean_text(item, 48)
        if tag and tag not in tags:
            tags.append(tag)
    return tags


def clean_profile(profile=None):
    profile = profile if isinstance(profile, dict) else {}
    avatar = clean_url(profile.get("avatar"), allow_local=True)
    return {
        "name": clean_text(profile.get("name"), 80, "Candidate") or "Candidate",
        "program": clean_text(profile.get("program"), 80, "Career Profile") or "Career Profile",
        "graduation": clean_text(profile.get("graduation"), 80, "2026-2027 cycle") or "2026-2027 cycle",
        "visa": clean_text(profile.get("visa"), 80, "Internship + New Grad") or "Internship + New Grad",
        "avatar": avatar or "/assets/profile-presets/avatar-portrait.png",
    }


def sanitize_job(job=None):
    job = job if isinstance(job, dict) else {}
    company = clean_text(job.get("company"), 120, "Unknown")
    role = clean_text(job.get("role"), 160, "Internship")
    location = clean_text(job.get("location"), 160, "Location not listed")
    season = clean_text(job.get("season"), 60, "2026")
    mode = clean_text(job.get("mode"), 40) or infer_mode(location)
    if mode not in ALLOWED_MODES:
        mode = infer_mode(location)
    stage = clean_text(job.get("stage"), 24, "saved")
    if stage not in ALLOWED_STAGES:
        stage = "saved"
    return {
        "id": clean_identifier(job.get("id"), f"job-{uuid.uuid4()}"),
        "company": company,
        "role": role,
        "season": season,
        "deadline": clean_date(job.get("deadline")),
        "location": location,
        "mode": mode,
        "sponsorship": clean_text(job.get("sponsorship"), 80, "Unknown"),
        "stage": stage,
        "match": clean_int(job.get("match"), 0, 100, 70),
        "source": clean_text(job.get("source"), 100, "Manual"),
        "sourceUrl": clean_url(job.get("sourceUrl")),
        "posted": clean_text(job.get("posted"), 80),
        "statusDate": clean_text(job.get("statusDate"), 80),
        "priority": clean_bool(job.get("priority")),
        "contact": clean_text(job.get("contact"), 120),
        "contactRole": clean_text(job.get("contactRole"), 120),
        "contactEmail": clean_email(job.get("contactEmail")),
        "summary": clean_text(job.get("summary"), 700),
        "description": clean_text(job.get("description"), 3_000),
        "requirements": clean_text(job.get("requirements"), 1_200),
        "notes": clean_text(job.get("notes"), MAX_NOTE_LENGTH),
        "tags": clean_tags(job.get("tags")),
        "nextStep": clean_text(job.get("nextStep"), 400),
    }


def sanitize_task(task=None):
    task = task if isinstance(task, dict) else {}
    priority = clean_text(task.get("priority"), 24, "Medium")
    if priority not in ALLOWED_PRIORITIES:
        priority = "Medium"
    return {
        "id": clean_identifier(task.get("id"), f"task-{uuid.uuid4()}"),
        "title": clean_text(task.get("title"), 180, "Untitled task"),
        "subtitle": clean_text(task.get("subtitle"), 220),
        "done": clean_bool(task.get("done")),
        "due": clean_date(task.get("due")),
        "priority": priority,
        "sourceJobId": clean_identifier(task.get("sourceJobId"), "") if task.get("sourceJobId") else "",
    }


def sanitize_contact(contact=None):
    contact = contact if isinstance(contact, dict) else {}
    return {
        "id": clean_identifier(contact.get("id"), f"contact-{uuid.uuid4()}"),
        "name": clean_text(contact.get("name"), 120, "Contact"),
        "company": clean_text(contact.get("company"), 120),
        "role": clean_text(contact.get("role"), 120),
        "email": clean_email(contact.get("email")),
        "next": clean_text(contact.get("next"), 300),
        "source": clean_text(contact.get("source"), 60, "Manual"),
        "sourceJobId": clean_identifier(contact.get("sourceJobId"), "") if contact.get("sourceJobId") else "",
    }


def sanitize_document(document=None):
    document = document if isinstance(document, dict) else {}
    document_type = clean_text(document.get("type"), 40, "Resume")
    status = clean_text(document.get("status"), 40, "Draft")
    if document_type not in ALLOWED_DOCUMENT_TYPES:
        document_type = "Other"
    if status not in ALLOWED_DOCUMENT_STATUSES:
        status = "Draft"
    file_type = clean_text(document.get("fileType"), 100)
    file_data = clean_url(document.get("fileData"), allow_data=True)
    if file_data and file_type.lower() == "image/svg+xml":
        file_data = ""
    return {
        "id": clean_identifier(document.get("id"), f"document-{uuid.uuid4()}"),
        "name": clean_text(document.get("name"), 160, "Untitled document"),
        "type": document_type,
        "status": status,
        "target": clean_text(document.get("target"), 140, "General"),
        "url": clean_url(document.get("url")),
        "version": clean_text(document.get("version"), 40, "v1"),
        "owner": clean_text(document.get("owner"), 120),
        "notes": clean_text(document.get("notes"), 1_500),
        "fileName": clean_text(document.get("fileName"), 180),
        "fileType": file_type,
        "fileSize": clean_int(document.get("fileSize"), 0, MAX_DATA_URL_BYTES, 0),
        "fileData": file_data,
        "updated": clean_text(document.get("updated"), 80),
    }


def sanitize_goal(goal=None):
    if not isinstance(goal, dict):
        return None
    return {
        "target": clean_int(goal.get("target"), 0, 5000, 0),
        "deadline": clean_date(goal.get("deadline")),
        "label": clean_text(goal.get("label"), 80),
    }


def normalize_workspace(value=None):
    value = value if isinstance(value, dict) else {}
    return {
        "jobs": [sanitize_job(item) for item in (value.get("jobs") if isinstance(value.get("jobs"), list) else [])[: WORKSPACE_LIMITS["jobs"]]],
        "tasks": [sanitize_task(item) for item in (value.get("tasks") if isinstance(value.get("tasks"), list) else [])[: WORKSPACE_LIMITS["tasks"]]],
        "contacts": [sanitize_contact(item) for item in (value.get("contacts") if isinstance(value.get("contacts"), list) else [])[: WORKSPACE_LIMITS["contacts"]]],
        "documents": [
            sanitize_document(item)
            for item in (value.get("documents") if isinstance(value.get("documents"), list) else [])[: WORKSPACE_LIMITS["documents"]]
        ],
        "goal": sanitize_goal(value.get("goal")) if isinstance(value.get("goal"), dict) else None,
    }


def public_user(row):
    return {
        "id": row["id"],
        "email": row["email"],
        "profile": clean_profile(parse_json(row.get("profile_json"), {})),
        "createdAt": str(row.get("created_at")),
        "updatedAt": str(row.get("updated_at")),
    }


def token_hash(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_password(password):
    salt = secrets.token_hex(16)
    key = hashlib.scrypt(str(password).encode("utf-8"), salt=salt.encode("utf-8"), n=16384, r=8, p=1, dklen=64)
    return f"{salt}:{key.hex()}"


def verify_password(password, stored=""):
    parts = str(stored).split(":")
    if len(parts) != 2:
        return False
    salt, key_hex = parts
    try:
        candidate = hashlib.scrypt(str(password).encode("utf-8"), salt=salt.encode("utf-8"), n=16384, r=8, p=1, dklen=64)
        return hmac.compare_digest(candidate, bytes.fromhex(key_hex))
    except Exception:
        return False


def create_session(user_id):
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
                (token_hash(token), user_id, expires_at.strftime("%Y-%m-%d %H:%M:%S")),
            )
    return token


def get_workspace(user_id):
    ensure_schema()
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM workspace_data WHERE user_id = %s LIMIT 1", (user_id,))
            row = cur.fetchone()
    if not row:
        save_workspace(user_id, EMPTY_WORKSPACE)
        return EMPTY_WORKSPACE
    return normalize_workspace(
        {
            "jobs": parse_json(row.get("jobs_json"), []),
            "tasks": parse_json(row.get("tasks_json"), []),
            "contacts": parse_json(row.get("contacts_json"), []),
            "documents": parse_json(row.get("documents_json"), []),
            "goal": parse_json(row.get("goal_json"), None),
        }
    )


def save_workspace(user_id, workspace):
    ensure_schema()
    next_workspace = normalize_workspace(workspace)
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO workspace_data (user_id, jobs_json, tasks_json, contacts_json, documents_json, goal_json)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                  jobs_json = VALUES(jobs_json),
                  tasks_json = VALUES(tasks_json),
                  contacts_json = VALUES(contacts_json),
                  documents_json = VALUES(documents_json),
                  goal_json = VALUES(goal_json)
                """,
                (
                    user_id,
                    json.dumps(next_workspace["jobs"]),
                    json.dumps(next_workspace["tasks"]),
                    json.dumps(next_workspace["contacts"]),
                    json.dumps(next_workspace["documents"]),
                    json.dumps(next_workspace["goal"]),
                ),
            )
    return next_workspace


def auth_token():
    header = request.headers.get("authorization", "")
    if header.startswith("Bearer "):
        return header.removeprefix("Bearer ").strip()
    return request.headers.get("x-session-token") or request.cookies.get("ct_session") or ""


def secure_cookie_enabled():
    return bool(
        os.environ.get("WASMER_APP_ID")
        or os.environ.get("NODE_ENV") == "production"
        or request.scheme == "https"
        or request.headers.get("x-forwarded-proto") == "https"
    )


def find_user_by_token(token):
    if not token:
        return None
    ensure_schema()
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT users.*
                FROM sessions
                JOIN users ON users.id = sessions.user_id
                WHERE sessions.token_hash = %s AND sessions.expires_at > CURRENT_TIMESTAMP
                LIMIT 1
                """,
                (token_hash(token),),
            )
            row = cur.fetchone()
    return public_user(row) if row else None


def json_response(payload, status=200, token=None, clear_cookie=False):
    response = make_response(jsonify(payload), status)
    response.headers["cache-control"] = "no-store"
    secure = secure_cookie_enabled()
    if token:
        response.set_cookie("ct_session", token, max_age=30 * 24 * 60 * 60, httponly=True, samesite="Lax", secure=secure, path="/")
    if clear_cookie:
        response.set_cookie("ct_session", "", max_age=0, httponly=True, samesite="Lax", secure=secure, path="/")
    return response


def require_user():
    user = find_user_by_token(auth_token())
    if not user:
        return None, json_response({"error": "Not authenticated."}, 401)
    return user, None


def clean_auth_body(body):
    body = body if isinstance(body, dict) else {}
    profile = body.get("profile") if isinstance(body.get("profile"), dict) else {}
    merged_profile = {
        **profile,
        "name": body.get("name") or profile.get("name"),
        "avatar": body.get("avatar") or profile.get("avatar"),
    }
    return {
        "email": clean_email(body.get("email")),
        "password": str(body.get("password") or "")[:1024],
        "profile": clean_profile(merged_profile),
    }


def create_user_account(draft):
    ensure_schema()
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s LIMIT 1", (draft["email"],))
            if cur.fetchone():
                return {"error": "This email is already registered."}
            user_id = str(uuid.uuid4())
            profile = {
                "name": draft["profile"].get("name") or "Candidate",
                "program": draft["profile"].get("program") or "Career Profile",
                "graduation": draft["profile"].get("graduation") or "2026-2027 cycle",
                "visa": draft["profile"].get("visa") or "Internship + New Grad",
                "avatar": draft["profile"].get("avatar") or "/assets/profile-presets/avatar-portrait.png",
            }
            cur.execute(
                "INSERT INTO users (id, email, password_hash, profile_json) VALUES (%s, %s, %s, %s)",
                (user_id, draft["email"], hash_password(draft["password"]), json.dumps(profile)),
            )
    save_workspace(user_id, EMPTY_WORKSPACE)
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE id = %s LIMIT 1", (user_id,))
            user = public_user(cur.fetchone())
    return {"user": user, "token": create_session(user_id), "workspace": EMPTY_WORKSPACE}


def login_user(draft):
    ensure_schema()
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE email = %s LIMIT 1", (draft["email"],))
            row = cur.fetchone()
    if not row or not verify_password(draft["password"], row.get("password_hash")):
        return {"error": "Email or password is incorrect."}
    return {"user": public_user(row), "token": create_session(row["id"]), "workspace": get_workspace(row["id"])}


def verify_google_credential(credential):
    payload = id_token.verify_oauth2_token(credential, google_requests.Request(), GOOGLE_CLIENT_ID)
    if not payload.get("email") or payload.get("email_verified") is not True:
        raise ValueError("Google account email could not be verified.")
    return {
        "email": payload["email"],
        "name": payload.get("name") or payload["email"].split("@")[0],
        "picture": payload.get("picture") or "",
    }


def login_google_user(profile):
    ensure_schema()
    normalized_email = clean_email(profile.get("email"))
    if not normalized_email:
        raise ValueError("Google profile email is invalid.")
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE email = %s LIMIT 1", (normalized_email,))
            row = cur.fetchone()
            if not row:
                user_id = str(uuid.uuid4())
                next_profile = clean_profile(
                    {
                        "name": profile.get("name") or "Candidate",
                        "program": "Career Profile",
                        "graduation": "2026-2027 cycle",
                        "visa": "Internship + New Grad",
                        "avatar": profile.get("picture") or "/assets/profile-presets/avatar-portrait.png",
                    }
                )
                cur.execute(
                    "INSERT INTO users (id, email, password_hash, profile_json) VALUES (%s, %s, %s, %s)",
                    (user_id, normalized_email, f"google:{secrets.token_hex(24)}", json.dumps(next_profile)),
                )
                save_workspace(user_id, EMPTY_WORKSPACE)
                cur.execute("SELECT * FROM users WHERE id = %s LIMIT 1", (user_id,))
                row = cur.fetchone()
    return {"user": public_user(row), "token": create_session(row["id"]), "workspace": get_workspace(row["id"])}


def log_google_auth_issue(reason, error=None):
    detail = f"google_auth_{reason}"
    if error:
        detail = f"{detail}: {type(error).__name__}: {error}"
    print(detail, file=sys.stderr, flush=True)


def auth_complete_html(nonce=""):
    return """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Completing sign in</title>
    <style nonce="__NONCE__">
      body {
        align-items: center;
        background: #eef8f1;
        color: #17231d;
        display: flex;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        min-height: 100vh;
        justify-content: center;
        margin: 0;
      }
      main { text-align: center; }
      strong { color: #08783f; display: block; font-size: 14px; margin-bottom: 8px; }
      h1 { font-size: 28px; margin: 0; }
    </style>
  </head>
  <body>
    <main>
      <strong>Career Tracker</strong>
      <h1>Completing sign in</h1>
    </main>
    <script nonce="__NONCE__">
      (function () {
        try {
          var params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
          var token = params.get("auth_token");
          if (token) {
            try {
              window.localStorage.setItem("career-tracker-auth-token-v1", token);
            } catch (error) {}
          }
          window.history.replaceState(null, "", "/auth/complete");
          window.location.replace("/");
        } catch (error) {
          window.location.replace("/");
        }
      })();
    </script>
  </body>
</html>""".replace("__NONCE__", nonce)


def decode_html(value=""):
    value = re.sub(r"<br\s*/?>", " ", str(value), flags=re.I)
    return re.sub(r"\s+", " ", unescape(value)).strip()


def strip_tags(value=""):
    return decode_html(re.sub(r"<[^>]*>", " ", str(value)))


def clean_company(value=""):
    return re.sub("[\U0001f525\U0001f512\U0001f393\U0001f6c2\U0001f1fa\U0001f1f8]", "", strip_tags(value)).replace("\u21b3", "").strip()


def first_url(value=""):
    matches = re.findall(r'href="([^"]+)"', str(value))
    safe_matches = [clean_url(url) for url in matches]
    safe_matches = [url for url in safe_matches if url]
    for url in safe_matches:
        if "simplify.jobs/p/" not in url:
            return url
    return safe_matches[0] if safe_matches else ""


def slugify(value=""):
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", str(value).lower().replace("&", " and ")))[:90]


def infer_mode(location=""):
    text = str(location).lower()
    if "remote" in text:
        return "Remote"
    if "hybrid" in text:
        return "Hybrid"
    return "On-site"


def infer_season(role="", terms="", fallback="2026"):
    text = f"{role} {terms}".lower()
    if any(item in text for item in ["new grad", "new graduate", "entry level", "early career"]):
        return "New Grad"
    if "fall 2026" in text:
        return "2026 Fall"
    if "2027" in text or "winter 2027" in text or "spring 2027" in text or "summer 2027" in text:
        return "2027"
    if "spring 2026" in text:
        return "2026 Spring"
    if "winter 2026" in text:
        return "2026 Winter"
    return fallback


def calculate_match(job):
    text = f"{job.get('role')} {job.get('company')} {job.get('location')} {' '.join(job.get('tags') or [])}".lower()
    score = 70
    if "software" in text:
        score += 9
    if "machine learning" in text or "ai" in text or "ml" in text:
        score += 9
    if "data" in text:
        score += 5
    if "backend" in text or "platform" in text or "systems" in text:
        score += 5
    if "remote" in text:
        score += 2
    if job.get("season") in ["2026 Fall", "2027", "New Grad"]:
        score += 6
    if job.get("sponsorship") == "No sponsorship":
        score -= 4
    return max(58, min(98, score))


def normalize_job(job):
    normalized = {
        **job,
        "id": job.get("id") or f"{slugify(job.get('source'))}-{slugify(job.get('company'))}-{slugify(job.get('role'))}-{slugify(job.get('location'))}",
        "company": job.get("company") or "Unknown",
        "role": job.get("role") or "Internship",
        "season": job.get("season") or "2026",
        "location": job.get("location") or "Location not listed",
        "mode": job.get("mode") or infer_mode(job.get("location")),
        "sponsorship": job.get("sponsorship") or "Unknown",
        "stage": "saved",
        "posted": job.get("posted") or datetime.now().date().isoformat(),
        "deadline": job.get("deadline") or "",
        "priority": False,
        "statusDate": "Live source",
        "contact": "",
        "contactRole": "",
        "contactEmail": "",
        "summary": job.get("summary") or "Fetched from a public jobs source. Review the original posting before applying.",
        "description": job.get("description") or job.get("requirements") or "",
        "requirements": job.get("requirements") or "",
        "notes": "Imported from live feed. Tailor resume and verify sponsorship/location details.",
        "tags": job.get("tags") or ["Live"],
        "nextStep": "Open the posting, verify fit, and decide whether to apply.",
    }
    normalized["match"] = clean_int(job.get("match") or calculate_match(normalized), 0, 100, 70)
    return sanitize_job(normalized)


def parse_simplify_markdown(markdown, source):
    rows = re.findall(r"<tr>([\s\S]*?)</tr>", markdown, flags=re.I)
    jobs = []
    last_company = ""
    for row in rows:
        cells = re.findall(r"<td>([\s\S]*?)</td>", row, flags=re.I)
        if len(cells) < 5:
            continue

        has_terms = len(cells) >= 6
        company_cell = cells[0]
        company = clean_company(company_cell)
        if company:
            last_company = company

        role = strip_tags(cells[1])
        location = strip_tags(cells[2])
        terms = strip_tags(cells[3]) if has_terms else ""
        application_cell = cells[4] if has_terms else cells[3]
        age = strip_tags(cells[5] if has_terms else cells[4])
        source_url = first_url(application_cell)

        if not role or not last_company or "\U0001f512" in row:
            continue

        inferred_season = infer_season(role, terms, source["season"])
        role_type = source.get("roleType") or ("New Grad" if inferred_season == "New Grad" else "Internship")
        jobs.append(
            normalize_job(
                {
                    "id": f"{source['id']}-{slugify(last_company)}-{slugify(role)}-{slugify(location)}",
                    "company": last_company,
                    "role": role,
                    "location": location,
                    "season": inferred_season,
                    "mode": infer_mode(location),
                    "sponsorship": "No sponsorship" if "\U0001f6c2" in company_cell else "Unknown",
                    "posted": f"{age} ago" if age else "Recently",
                    "deadline": "",
                    "source": source["name"],
                    "sourceUrl": source_url,
                    "tags": [item for item in [inferred_season, role_type, terms or "Tech"] if item],
                    "summary": f"{role} at {last_company}. Listed in {source['name']}{f' for {terms}' if terms else ''}.",
                    "requirements": terms or "",
                }
            )
        )
    return jobs


def fetch_text(url):
    response = requests.get(
        url,
        headers={"User-Agent": "Career-Tracker-Dashboard/1.0", "Accept": "text/plain, text/html, application/json"},
        timeout=10,
    )
    response.raise_for_status()
    return response.text


def fetch_json(url):
    response = requests.get(url, headers={"User-Agent": "Career-Tracker-Dashboard/1.0", "Accept": "application/json"}, timeout=10)
    response.raise_for_status()
    return response.json()


def fetch_simplify():
    jobs = []
    for source in simplify_sources:
        jobs.extend(parse_simplify_markdown(fetch_text(source["url"]), source))
    return jobs


def fetch_remotive():
    data = fetch_json(remotive_url)
    rows = data.get("jobs", []) if isinstance(data, dict) else []
    jobs = []
    for row in rows[:80]:
        title = row.get("title") or ""
        if not re.search(r"intern|internship|co-op|new grad|graduate|entry level|early career|software|engineer|machine learning|data", title, re.I):
            continue
        jobs.append(
            normalize_job(
                {
                    "id": f"remotive-{row.get('id') or slugify(str(row.get('company_name')) + '-' + title)}",
                    "company": row.get("company_name"),
                    "role": title,
                    "location": row.get("candidate_required_location") or "Remote",
                    "season": infer_season(title, "", "2027" if "2027" in title else "Remote"),
                    "mode": "Remote",
                    "source": "Remotive",
                    "sourceUrl": row.get("url"),
                    "posted": str(row.get("publication_date") or "")[:10],
                    "tags": [item for item in ["Remote", row.get("category")] if item],
                    "summary": strip_tags(row.get("description") or "")[:180] or "Remote role from Remotive.",
                    "description": strip_tags(row.get("description") or "")[:1800],
                }
            )
        )
    return jobs


def fetch_remoteok():
    data = fetch_json(remoteok_url)
    rows = data[1:] if isinstance(data, list) else []
    jobs = []
    for row in rows[:80]:
        title = row.get("position") or ""
        if not re.search(r"intern|internship|co-op|new grad|graduate|entry level|early career|software|engineer|machine learning|data", title, re.I):
            continue
        tags = row.get("tags") if isinstance(row.get("tags"), list) else []
        description = strip_tags(row.get("description") or "")
        jobs.append(
            normalize_job(
                {
                    "id": f"remoteok-{row.get('id') or slugify(str(row.get('company')) + '-' + title)}",
                    "company": row.get("company"),
                    "role": title,
                    "location": row.get("location") or "Remote",
                    "season": infer_season(title, "", "2027" if "2027" in title else "Remote"),
                    "mode": "Remote",
                    "source": "RemoteOK",
                    "sourceUrl": row.get("url"),
                    "posted": str(row.get("date") or "")[:10],
                    "tags": ["Remote", *tags[:3]],
                    "summary": description[:180] or f"Remote role listed by {row.get('company') or 'company'} on RemoteOK.",
                    "description": description[:1800],
                }
            )
        )
    return jobs


def fetch_greenhouse():
    jobs = []
    for board in greenhouse_boards:
        data = fetch_json(f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true")
        rows = data.get("jobs", []) if isinstance(data, dict) else []
        company = data.get("name") if isinstance(data, dict) else ""
        for row in rows:
            title = row.get("title") or ""
            if not re.search(r"intern|internship|university|student|co-op|new grad|graduate|entry level|early career", title, re.I):
                continue
            location = (row.get("location") or {}).get("name") or "Location not listed"
            season = infer_season(title, "", "2027" if "2027" in title else "2026")
            description = strip_tags(row.get("content") or "")
            jobs.append(
                normalize_job(
                    {
                        "id": f"greenhouse-{board}-{row.get('id')}",
                        "company": company or board,
                        "role": title,
                        "location": location,
                        "season": season,
                        "mode": infer_mode(location),
                        "source": "Greenhouse",
                        "sourceUrl": row.get("absolute_url"),
                        "posted": str(row.get("updated_at") or "")[:10],
                        "tags": [item for item in ["Company Board", board, season] if item],
                        "summary": description[:180] or f"{title} from {company or board}'s public Greenhouse board.",
                        "description": description[:1800],
                    }
                )
            )
    return jobs


def dedupe_jobs(jobs):
    seen = set()
    unique = []
    for job in jobs:
        key = f"{slugify(job.get('company'))}-{slugify(job.get('role'))}-{slugify(job.get('location'))}"
        if key in seen:
            continue
        seen.add(key)
        unique.append(job)
    return unique


def filter_jobs(jobs, params):
    query = clean_text(params.get("query"), 120).lower()
    season = clean_text(params.get("season"), 40, "all") or "all"
    remote = clean_text(params.get("remote"), 40, "all") or "all"
    filtered = []
    for job in jobs:
        blob = f"{job['company']} {job['role']} {job['location']} {job['season']} {' '.join(job['tags'])}".lower()
        season_ok = (
            season == "all"
            or (season == "fall2026" and job["season"] == "2026 Fall")
            or (season == "2027" and job["season"] == "2027")
            or (season == "newgrad" and (job["season"] == "New Grad" or "new grad" in blob or "entry level" in blob or "early career" in blob))
            or season.replace("-", " ") in blob
        )
        remote_ok = remote == "all" or job["mode"].lower() == remote
        if (not query or query in blob) and season_ok and remote_ok:
            filtered.append(job)
    return filtered


def get_live_jobs(params):
    now = datetime.now(timezone.utc).timestamp() * 1000
    if not job_cache["payload"] or now - job_cache["created_at"] > 10 * 60 * 1000 or params.get("refresh") == "true":
        jobs = []
        status = []
        fetchers = [
            ("SimplifyJobs", fetch_simplify),
            ("Greenhouse Job Board API", fetch_greenhouse),
            ("Remotive API", fetch_remotive),
            ("RemoteOK API", fetch_remoteok),
        ]
        for index, (name, fetcher) in enumerate(fetchers):
            try:
                fetched = fetcher()
                jobs.extend(fetched)
                status.append({"index": index, "ok": True, "count": len(fetched), "error": ""})
            except Exception as exc:
                status.append({"index": index, "ok": False, "count": 0, "error": str(exc)})
        unique = sorted(dedupe_jobs(jobs), key=lambda item: item.get("match", 0), reverse=True)[:800]
        job_cache["created_at"] = now
        job_cache["payload"] = {
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
            "jobs": unique,
            "sources": [
                {"name": "SimplifyJobs Summer2026", "url": simplify_sources[1]["url"]},
                {"name": "SimplifyJobs Off-Season", "url": simplify_sources[0]["url"]},
                {"name": "SimplifyJobs New Grad", "url": simplify_sources[2]["url"]},
                {"name": "Greenhouse Job Board API", "url": "https://developers.greenhouse.io/job-board.html"},
                {"name": "Remotive API", "url": "https://remotive.com/api/remote-jobs"},
                {"name": "RemoteOK API", "url": remoteok_url},
            ],
            "sourceStatus": status,
        }
    payload = job_cache["payload"]
    filtered = filter_jobs(payload["jobs"], params)
    try:
        requested_limit = int(params.get("limit") or 120)
    except (TypeError, ValueError):
        requested_limit = 120
    limit = max(1, min(800, requested_limit))
    return {**payload, "total": len(payload["jobs"]), "filteredTotal": len(filtered), "count": len(filtered[:limit]), "jobs": filtered[:limit]}



def client_ip():
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    return forwarded or request.remote_addr or "unknown"


def rate_limit_key():
    if request.path.startswith("/api/auth/"):
        return "auth", 30, 60
    if request.path == "/api/jobs":
        return "jobs", 90, 60
    if request.path in {"/api/workspace", "/api/profile"}:
        return "workspace", 180, 60
    return "api", 300, 60


def check_rate_limit():
    bucket_name, limit, window_seconds = rate_limit_key()
    now = datetime.now(timezone.utc).timestamp()
    key = (bucket_name, client_ip())
    bucket = [stamp for stamp in rate_limit_buckets.get(key, []) if now - stamp < window_seconds]
    if len(bucket) >= limit:
        rate_limit_buckets[key] = bucket
        return False
    bucket.append(now)
    rate_limit_buckets[key] = bucket
    if len(rate_limit_buckets) > 5_000:
        stale_before = now - (window_seconds * 2)
        for stale_key, stamps in list(rate_limit_buckets.items()):
            fresh = [stamp for stamp in stamps if stamp >= stale_before]
            if fresh:
                rate_limit_buckets[stale_key] = fresh
            else:
                rate_limit_buckets.pop(stale_key, None)
    return True


def same_origin_request():
    origin = request.headers.get("origin")
    referer = request.headers.get("referer")
    allowed_hosts = {
        request.host,
        request.headers.get("x-forwarded-host", ""),
    }
    allowed_hosts = {host for host in allowed_hosts if host}
    for value in (origin, referer):
        if not value:
            continue
        try:
            parsed = urlparse(value)
        except Exception:
            return False
        if parsed.scheme not in {"http", "https"} or parsed.netloc not in allowed_hosts:
            return False
    return True


JSON_BODY_PATHS = {"/api/auth/register", "/api/auth/login", "/api/auth/google", "/api/profile", "/api/workspace"}


@app.before_request
def guard_request():
    if request.content_length and request.content_length > MAX_BODY_BYTES:
        return json_response({"error": "Request body is too large."}, 413)
    if not request.path.startswith("/api/"):
        return None
    if not check_rate_limit():
        return json_response({"error": "Too many requests. Please wait and try again."}, 429)
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and request.path != "/api/auth/google/redirect":
        if not same_origin_request():
            return json_response({"error": "Cross-site request rejected."}, 403)
    if request.method in {"POST", "PUT", "PATCH"} and request.path in JSON_BODY_PATHS and not request.is_json:
        return json_response({"error": "Expected application/json."}, 415)
    return None


def build_csp(script_nonce=""):
    script_sources = ["'self'", "https://accounts.google.com", "https://accounts.gstatic.com"]
    if script_nonce:
        script_sources.append(f"'nonce-{script_nonce}'")
    directives = {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "connect-src": ["'self'", "https://accounts.google.com", "https://*.google.com"],
        "font-src": ["'self'", "data:"],
        "form-action": ["'self'", "https://accounts.google.com"],
        "frame-ancestors": ["'none'"],
        "frame-src": ["'self'", "https://accounts.google.com", "https://*.google.com", "https://drive.google.com", "https://docs.google.com", "data:"],
        "img-src": ["'self'", "data:", "https:"],
        "media-src": ["'self'", "data:"],
        "object-src": ["'none'"],
        "script-src": script_sources,
        "style-src": ["'self'", "'unsafe-inline'"],
    }
    return "; ".join(f"{name} {' '.join(values)}" for name, values in directives.items())


@app.after_request
def add_security_headers(response):
    response.headers.setdefault("Content-Security-Policy", build_csp())
    response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    if request.path.startswith("/api/") or request.path == "/auth/complete":
        response.headers["cache-control"] = "no-store"
    return response


@app.get("/api/health")
def health():
    if not has_database_config():
        return json_response({"ok": True, "service": "career-tracker-dashboard", "database": {"configured": False, "ok": False}})
    try:
        ensure_schema()
        with db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        database = {"configured": True, "ok": True}
    except Exception as exc:
        database = {"configured": True, "ok": False, "error": str(exc)}
    return json_response({"ok": True, "service": "career-tracker-dashboard", "database": database})


@app.get("/api/jobs")
def jobs():
    return json_response(get_live_jobs(dict(request.args)))


@app.post("/api/auth/register")
def register():
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return json_response({"error": "Invalid JSON body."}, 400)
    draft = clean_auth_body(body)
    if not draft["email"] or not draft["password"]:
        return json_response({"error": "Email and password are required."}, 400)
    if len(draft["password"]) < 8:
        return json_response({"error": "Use at least 8 characters."}, 400)
    result = create_user_account(draft)
    return json_response(result, 409 if result.get("error") else 201, token=result.get("token"))


@app.post("/api/auth/login")
def login():
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return json_response({"error": "Invalid JSON body."}, 400)
    draft = clean_auth_body(body)
    if not draft["email"] or not draft["password"]:
        return json_response({"error": "Email and password are required."}, 400)
    result = login_user(draft)
    return json_response(result, 401 if result.get("error") else 200, token=result.get("token"))


@app.post("/api/auth/google")
def google_login():
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return json_response({"error": "Invalid JSON body."}, 400)
    if not body.get("credential"):
        return json_response({"error": "Missing Google credential."}, 400)
    try:
        result = login_google_user(verify_google_credential(str(body["credential"])))
        return json_response(result, 200, token=result.get("token"))
    except Exception:
        return json_response({"error": "Google credential could not be verified."}, 401)


@app.route("/api/auth/google/redirect", methods=["GET", "POST"])
def google_redirect():
    csrf_body = request.values.get("g_csrf_token", "")
    csrf_cookie = request.cookies.get("g_csrf_token", "")
    if (csrf_body or csrf_cookie) and csrf_body != csrf_cookie:
        log_google_auth_issue("csrf_mismatch")
        return redirect("/?auth_error=google_csrf", code=303)
    credential = str(request.values.get("credential", ""))
    if not credential:
        log_google_auth_issue("missing_credential")
        return redirect("/?auth_error=google_missing_credential", code=303)
    try:
        profile = verify_google_credential(credential)
    except Exception as error:
        log_google_auth_issue("verify_failed", error)
        return redirect("/?auth_error=google_verify", code=303)
    try:
        result = login_google_user(profile)
    except Exception as error:
        log_google_auth_issue("session_failed", error)
        return redirect("/?auth_error=google_session", code=303)
    print("google_auth_success", file=sys.stderr, flush=True)
    response = redirect(f"/auth/complete#auth_token={result['token']}", code=303)
    secure = secure_cookie_enabled()
    response.set_cookie("ct_session", result["token"], max_age=30 * 24 * 60 * 60, httponly=True, samesite="Lax", secure=secure, path="/")
    return response


@app.get("/auth/complete")
def auth_complete():
    nonce = secrets.token_urlsafe(16)
    response = make_response(auth_complete_html(nonce), 200)
    response.headers["cache-control"] = "no-store"
    response.headers["content-type"] = "text/html; charset=utf-8"
    response.headers["Content-Security-Policy"] = build_csp(script_nonce=nonce)
    return response


@app.post("/api/auth/logout")
def logout():
    token = auth_token()
    if token:
        ensure_schema()
        with db() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM sessions WHERE token_hash = %s", (token_hash(token),))
    return json_response({"ok": True}, clear_cookie=True)


@app.get("/api/me")
def me():
    user, error = require_user()
    if error:
        return error
    return json_response({"user": user, "workspace": get_workspace(user["id"])})


@app.patch("/api/profile")
def profile():
    user, error = require_user()
    if error:
        return error
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return json_response({"error": "Invalid JSON body."}, 400)
    submitted_profile = body.get("profile") if isinstance(body.get("profile"), dict) else body
    next_profile = clean_profile({**user.get("profile", {}), **submitted_profile})
    ensure_schema()
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET profile_json = %s WHERE id = %s", (json.dumps(next_profile), user["id"]))
            cur.execute("SELECT * FROM users WHERE id = %s LIMIT 1", (user["id"],))
            updated = public_user(cur.fetchone())
    return json_response({"user": updated})


@app.get("/api/workspace")
def workspace_get():
    user, error = require_user()
    if error:
        return error
    return json_response({"workspace": get_workspace(user["id"])})


@app.put("/api/workspace")
def workspace_put():
    user, error = require_user()
    if error:
        return error
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return json_response({"error": "Invalid JSON body."}, 400)
    submitted_workspace = body.get("workspace") if isinstance(body.get("workspace"), dict) else body
    return json_response({"workspace": save_workspace(user["id"], submitted_workspace)})


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def static_app(path):
    target = DIST_DIR / path
    if path and target.exists() and target.is_file():
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(DIST_DIR, "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
