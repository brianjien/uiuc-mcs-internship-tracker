import hashlib
import hmac
import ipaddress
import json
import mimetypes
import os
import re
import secrets
import socket
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from html import unescape
from pathlib import Path
from threading import Lock
from urllib.parse import parse_qs, quote, urljoin, urlparse

import pymysql
import requests
from flask import Flask, jsonify, make_response, redirect, request, send_from_directory
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from openapi_spec import build_openapi_spec
from werkzeug.utils import secure_filename

try:
    import boto3
    from botocore.config import Config as BotoConfig
except Exception:
    boto3 = None
    BotoConfig = None


APP_ROOT = Path(__file__).resolve().parent
DIST_DIR = APP_ROOT / "dist"
MAX_BODY_BYTES = 12_000_000
MAX_TEXT_LENGTH = 2_000
MAX_FIELD_LENGTH = 512
MAX_NOTE_LENGTH = 8_000
MAX_DATA_URL_BYTES = 720_000
MAX_UPLOAD_BYTES = 10_000_000
DATABASE_SCHEMA_VERSION = 2
DATABASE_NORMAL_FORM = "BCNF"
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
ALLOWED_OA_RESULTS = {"Scheduled", "Completed", "Passed", "Rejected"}
ALLOWED_JOB_ACTIVITY_TYPES = {"saved", "applied"}
ALLOWED_OA_QUESTION_TYPES = {
    "Coding",
    "Multiple choice",
    "SQL",
    "Debugging",
    "System design",
    "Behavioral",
    "Math / logic",
}
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
SAFE_UPLOAD_MIME_TYPES = {
    "application/json",
    "application/msword",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/csv",
    "text/markdown",
    "text/plain",
}

EMPTY_WORKSPACE = {
    "jobs": [],
    "tasks": [],
    "contacts": [],
    "documents": [],
    "goal": None,
    "notificationState": {"readIds": [], "dismissedIds": [], "browserAlerts": False},
}

app = Flask(__name__, static_folder=None)
schema_ready = False
schema_lock = Lock()
job_cache = {"created_at": 0, "payload": None}
rate_limit_buckets = {}
link_status_cache = {}

EARLY_CAREER_PATTERN = re.compile(
    r"\b(intern|internship|co[- ]?op|university|student|new grad|new college grad|graduate|entry[- ]?level|early career)\b",
    re.I,
)
TECH_ROLE_PATTERN = re.compile(r"\b(software|engineer|developer|machine learning|ml|ai|data|security|systems|platform|backend|frontend|fullstack)\b", re.I)
LIVE_INDEX_LIMIT = 3_000
LINK_STATUS_CACHE_MS = 15 * 60 * 1000
LINK_STATUS_MAX_BYTES = 96_000
CHECKABLE_JOB_HOST_SUFFIXES = (
    "ashbyhq.com",
    "greenhouse.io",
    "lever.co",
    "lever.com",
    "workdayjobs.com",
    "myworkdayjobs.com",
)
JOB_CLOSED_PATTERNS = [
    re.compile(pattern, re.I)
    for pattern in [
        r"\bjob not found\b",
        r"\bthe job you requested was not found\b",
        r"\bposition not found\b",
        r"\bposting not found\b",
        r"\bthis job is closed\b",
        r"\bthis position is closed\b",
        r"\bno longer accepting applications\b",
        r"\bno longer available\b",
        r"\bapplication window has closed\b",
    ]
]

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

markdown_table_sources = [
    {
        "id": "speedy-swe-us-intern",
        "name": "SpeedyApply SWE Internships",
        "url": "https://raw.githubusercontent.com/speedyapply/2026-SWE-College-Jobs/main/README.md",
        "season": "2026 Fall",
        "roleType": "Internship",
        "format": "speedy",
    },
    {
        "id": "speedy-swe-intl-intern",
        "name": "SpeedyApply SWE International Internships",
        "url": "https://raw.githubusercontent.com/speedyapply/2026-SWE-College-Jobs/main/INTERN_INTL.md",
        "season": "2026",
        "roleType": "Internship",
        "format": "speedy",
    },
    {
        "id": "speedy-ai-us-intern",
        "name": "SpeedyApply AI Internships",
        "url": "https://raw.githubusercontent.com/speedyapply/2026-AI-College-Jobs/main/README.md",
        "season": "2026 Fall",
        "roleType": "Internship",
        "format": "speedy",
    },
    {
        "id": "speedy-ai-intl-intern",
        "name": "SpeedyApply AI International Internships",
        "url": "https://raw.githubusercontent.com/speedyapply/2026-AI-College-Jobs/main/INTERN_INTL.md",
        "season": "2026",
        "roleType": "Internship",
        "format": "speedy",
    },
    {
        "id": "speedy-swe-us-new-grad",
        "name": "SpeedyApply SWE New Grad",
        "url": "https://raw.githubusercontent.com/speedyapply/2026-SWE-College-Jobs/main/NEW_GRAD_USA.md",
        "season": "New Grad",
        "roleType": "New Grad",
        "format": "speedy",
    },
    {
        "id": "speedy-ai-us-new-grad",
        "name": "SpeedyApply AI New Grad",
        "url": "https://raw.githubusercontent.com/speedyapply/2026-AI-College-Jobs/main/NEW_GRAD_USA.md",
        "season": "New Grad",
        "roleType": "New Grad",
        "format": "speedy",
    },
    {
        "id": "vansh-summer",
        "name": "Vansh Summer Internships",
        "url": "https://raw.githubusercontent.com/vanshb03/Summer2027-Internships/dev/README.md",
        "season": "2026 Summer",
        "roleType": "Internship",
        "format": "vansh",
    },
    {
        "id": "vansh-offseason",
        "name": "Vansh Off-Season Internships",
        "url": "https://raw.githubusercontent.com/vanshb03/Summer2027-Internships/dev/OFFSEASON_README.md",
        "season": "2026 Fall",
        "roleType": "Internship",
        "format": "vansh",
    },
    {
        "id": "vansh-new-grad",
        "name": "Vansh New Grad",
        "url": "https://raw.githubusercontent.com/vanshb03/New-Grad-2027/main/README.md",
        "season": "New Grad",
        "roleType": "New Grad",
        "format": "vansh",
    },
    {
        "id": "jobright-engineering-intern",
        "name": "Jobright Engineering Internships",
        "url": "https://raw.githubusercontent.com/jobright-ai/2026-Engineer-Internship/master/README.md",
        "season": "2026",
        "roleType": "Internship",
        "format": "jobright",
    },
    {
        "id": "jobright-swe-new-grad",
        "name": "Jobright SWE New Grad",
        "url": "https://raw.githubusercontent.com/jobright-ai/2026-Software-Engineer-New-Grad/master/README.md",
        "season": "New Grad",
        "roleType": "New Grad",
        "format": "jobright",
    },
]

greenhouse_boards = [
    "andurilindustries",
    "verkada",
    "mongodb",
    "stripe",
    "rubrik",
    "nuro",
    "pinterest",
    "databricks",
    "scaleai",
    "roblox",
    "brex",
    "waymo",
    "affirm",
    "airbnb",
    "anthropic",
    "coinbase",
    "figma",
]
lever_boards = ["palantir"]
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
    with schema_lock:
        if schema_ready:
            return
        _ensure_schema()
        schema_ready = True


def _ensure_schema():
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                  version INT UNSIGNED PRIMARY KEY,
                  name VARCHAR(120) NOT NULL,
                  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                  id VARCHAR(36) PRIMARY KEY,
                  email VARCHAR(255) NOT NULL UNIQUE,
                  password_hash VARCHAR(255) NOT NULL,
                  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS candidate_profiles (
                  user_id VARCHAR(36) PRIMARY KEY,
                  name VARCHAR(80) NOT NULL,
                  program VARCHAR(80) NOT NULL,
                  graduation VARCHAR(80) NOT NULL,
                  visa VARCHAR(80) NOT NULL,
                  avatar VARCHAR(2048) NOT NULL,
                  CONSTRAINT fk_candidate_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                  token_hash CHAR(64) PRIMARY KEY,
                  user_id VARCHAR(36) NOT NULL,
                  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  expires_at DATETIME NOT NULL,
                  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                  INDEX sessions_user_id_idx (user_id),
                  INDEX sessions_expires_at_idx (expires_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS workspace_meta (
                  user_id VARCHAR(36) PRIMARY KEY,
                  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  CONSTRAINT fk_workspace_meta_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                  user_id VARCHAR(36) NOT NULL,
                  id VARCHAR(128) NOT NULL,
                  company VARCHAR(120) NOT NULL,
                  role VARCHAR(160) NOT NULL,
                  season VARCHAR(60) NOT NULL,
                  deadline DATE NULL,
                  location VARCHAR(160) NOT NULL,
                  mode VARCHAR(40) NOT NULL,
                  sponsorship VARCHAR(80) NOT NULL,
                  stage VARCHAR(24) NOT NULL,
                  match_score SMALLINT UNSIGNED NOT NULL,
                  source VARCHAR(100) NOT NULL,
                  source_url VARCHAR(2048) NOT NULL,
                  posted VARCHAR(80) NOT NULL,
                  status_date VARCHAR(80) NOT NULL,
                  priority BOOLEAN NOT NULL DEFAULT FALSE,
                  contact_name VARCHAR(120) NOT NULL,
                  contact_role VARCHAR(120) NOT NULL,
                  contact_email VARCHAR(254) NOT NULL,
                  summary VARCHAR(700) NOT NULL,
                  description TEXT NOT NULL,
                  requirements_text VARCHAR(1200) NOT NULL,
                  notes TEXT NOT NULL,
                  next_step VARCHAR(400) NOT NULL,
                  position INT UNSIGNED NOT NULL,
                  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  PRIMARY KEY (user_id, id),
                  CONSTRAINT fk_jobs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                  INDEX jobs_stage_idx (user_id, stage),
                  INDEX jobs_company_idx (user_id, company)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS job_tags (
                  user_id VARCHAR(36) NOT NULL,
                  job_id VARCHAR(128) NOT NULL,
                  tag VARCHAR(48) NOT NULL,
                  position SMALLINT UNSIGNED NOT NULL,
                  PRIMARY KEY (user_id, job_id, tag),
                  CONSTRAINT fk_job_tags_job FOREIGN KEY (user_id, job_id) REFERENCES jobs(user_id, id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS job_oa_attempts (
                  user_id VARCHAR(36) NOT NULL,
                  job_id VARCHAR(128) NOT NULL,
                  id VARCHAR(128) NOT NULL,
                  completed_at VARCHAR(32) NOT NULL,
                  duration_minutes SMALLINT UNSIGNED NOT NULL,
                  result VARCHAR(24) NOT NULL,
                  reflection TEXT NOT NULL,
                  PRIMARY KEY (user_id, job_id, id),
                  CONSTRAINT fk_oa_attempts_job FOREIGN KEY (user_id, job_id) REFERENCES jobs(user_id, id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS job_oa_question_types (
                  user_id VARCHAR(36) NOT NULL,
                  job_id VARCHAR(128) NOT NULL,
                  attempt_id VARCHAR(128) NOT NULL,
                  question_type VARCHAR(40) NOT NULL,
                  PRIMARY KEY (user_id, job_id, attempt_id, question_type),
                  CONSTRAINT fk_oa_question_attempt FOREIGN KEY (user_id, job_id, attempt_id)
                    REFERENCES job_oa_attempts(user_id, job_id, id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS job_activities (
                  user_id VARCHAR(36) NOT NULL,
                  job_id VARCHAR(128) NOT NULL,
                  id VARCHAR(128) NOT NULL,
                  activity_type VARCHAR(20) NOT NULL,
                  occurred_at VARCHAR(32) NOT NULL,
                  PRIMARY KEY (user_id, job_id, id),
                  CONSTRAINT fk_job_activities_job FOREIGN KEY (user_id, job_id) REFERENCES jobs(user_id, id) ON DELETE CASCADE,
                  INDEX job_activities_time_idx (user_id, occurred_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tasks (
                  user_id VARCHAR(36) NOT NULL,
                  id VARCHAR(128) NOT NULL,
                  title VARCHAR(180) NOT NULL,
                  subtitle VARCHAR(220) NOT NULL,
                  done BOOLEAN NOT NULL DEFAULT FALSE,
                  due_date DATE NULL,
                  priority VARCHAR(24) NOT NULL,
                  source_job_id VARCHAR(128) NULL,
                  task_type VARCHAR(40) NOT NULL,
                  position INT UNSIGNED NOT NULL,
                  PRIMARY KEY (user_id, id),
                  CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS contacts (
                  user_id VARCHAR(36) NOT NULL,
                  id VARCHAR(128) NOT NULL,
                  name VARCHAR(120) NOT NULL,
                  company VARCHAR(120) NOT NULL,
                  role VARCHAR(120) NOT NULL,
                  email VARCHAR(254) NOT NULL,
                  next_action VARCHAR(300) NOT NULL,
                  source VARCHAR(60) NOT NULL,
                  source_job_id VARCHAR(128) NULL,
                  position INT UNSIGNED NOT NULL,
                  PRIMARY KEY (user_id, id),
                  CONSTRAINT fk_contacts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS documents (
                  user_id VARCHAR(36) NOT NULL,
                  id VARCHAR(128) NOT NULL,
                  name VARCHAR(160) NOT NULL,
                  document_type VARCHAR(40) NOT NULL,
                  status VARCHAR(40) NOT NULL,
                  target VARCHAR(140) NOT NULL,
                  source_job_id VARCHAR(128) NULL,
                  external_url VARCHAR(2048) NOT NULL,
                  version VARCHAR(40) NOT NULL,
                  owner VARCHAR(120) NOT NULL,
                  notes VARCHAR(1500) NOT NULL,
                  file_name VARCHAR(180) NOT NULL,
                  file_type VARCHAR(100) NOT NULL,
                  file_size INT UNSIGNED NOT NULL,
                  file_data LONGTEXT NOT NULL,
                  file_key VARCHAR(512) NOT NULL,
                  file_url VARCHAR(2048) NOT NULL,
                  storage VARCHAR(20) NOT NULL,
                  updated_label VARCHAR(80) NOT NULL,
                  position INT UNSIGNED NOT NULL,
                  PRIMARY KEY (user_id, id),
                  CONSTRAINT fk_documents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS goals (
                  user_id VARCHAR(36) PRIMARY KEY,
                  target INT UNSIGNED NOT NULL,
                  deadline DATE NULL,
                  label VARCHAR(80) NOT NULL,
                  CONSTRAINT fk_goals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS notification_settings (
                  user_id VARCHAR(36) PRIMARY KEY,
                  browser_alerts BOOLEAN NOT NULL DEFAULT FALSE,
                  CONSTRAINT fk_notification_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            for table, constraint in (
                ("notification_reads", "fk_notification_reads_user"),
                ("notification_dismissals", "fk_notification_dismissals_user"),
            ):
                cur.execute(
                    f"""
                    CREATE TABLE IF NOT EXISTS {table} (
                      user_id VARCHAR(36) NOT NULL,
                      notification_id VARCHAR(180) NOT NULL,
                      PRIMARY KEY (user_id, notification_id),
                      CONSTRAINT {constraint} FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    """
                )
            migrate_legacy_profiles(cur)
            migrate_legacy_workspaces(cur)
            cur.execute(
                """
                INSERT INTO schema_migrations (version, name)
                VALUES (%s, %s)
                ON DUPLICATE KEY UPDATE name = VALUES(name)
                """,
                (DATABASE_SCHEMA_VERSION, "workspace-bcnf"),
            )


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
NOTIFICATION_ID_RE = re.compile(r"^[a-zA-Z0-9_.:@|/-]{1,180}$")


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


def clean_reference_id(value=""):
    raw = CONTROL_CHAR_RE.sub("", str(value or "").strip())
    if ".." in raw or raw.startswith("/"):
        return ""
    return clean_identifier(raw, "")


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


def hostname_is_public(hostname=""):
    host = str(hostname or "").strip().strip(".").lower()
    if not host or host in {"localhost", "0.0.0.0"} or host.endswith(".local"):
        return False
    try:
        for family, _, _, _, sockaddr in socket.getaddrinfo(host, None):
            address = sockaddr[0]
            ip = ipaddress.ip_address(address)
            if (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_multicast
                or ip.is_reserved
                or ip.is_unspecified
            ):
                return False
    except Exception:
        return False
    return True


def checkable_job_host(hostname=""):
    host = str(hostname or "").strip(".").lower()
    return any(host == suffix or host.endswith(f".{suffix}") for suffix in CHECKABLE_JOB_HOST_SUFFIXES)


def safe_job_check_url(value=""):
    url = clean_url(value)
    if not url:
        return ""
    try:
        parsed = urlparse(url)
    except Exception:
        return ""
    if not parsed.hostname or not hostname_is_public(parsed.hostname):
        return ""
    return url


def read_response_sample(response):
    chunks = []
    total = 0
    for chunk in response.iter_content(chunk_size=8192, decode_unicode=False):
        if not chunk:
            continue
        chunks.append(chunk)
        total += len(chunk)
        if total >= LINK_STATUS_MAX_BYTES:
            break
    raw = b"".join(chunks)
    encoding = response.encoding or "utf-8"
    try:
        return raw.decode(encoding, errors="ignore")
    except Exception:
        return raw.decode("utf-8", errors="ignore")


def closed_posting_reason(status_code, body=""):
    if status_code in {404, 410}:
        return "The source returned a not-found response."
    text = strip_tags(body or "")
    for pattern in JOB_CLOSED_PATTERNS:
        if pattern.search(text):
            return "The source says this posting is no longer available."
    return ""


def fetch_job_link_status(url):
    current_url = safe_job_check_url(url)
    if not current_url:
        return {
            "ok": False,
            "status": "invalid",
            "checked": False,
            "message": "This apply link is invalid or unsafe.",
            "url": "",
        }
    parsed = urlparse(current_url)
    if not checkable_job_host(parsed.hostname):
        return {
            "ok": True,
            "status": "unchecked",
            "checked": False,
            "message": "This source is not checked automatically. Open it and verify before applying.",
            "url": current_url,
        }

    headers = {
        "User-Agent": "Career-Tracker-Dashboard/1.0 (+https://internship-tracker.wasmer.app)",
        "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    }
    try:
        for _ in range(4):
            response = requests.get(current_url, headers=headers, timeout=8, allow_redirects=False, stream=True)
            if response.is_redirect:
                location = response.headers.get("location") or ""
                next_url = safe_job_check_url(urljoin(current_url, location))
                if not next_url:
                    return {
                        "ok": False,
                        "status": "invalid",
                        "checked": True,
                        "message": "This apply link redirects to an unsafe or unsupported destination.",
                        "url": current_url,
                    }
                current_url = next_url
                continue

            body = ""
            content_type = response.headers.get("content-type", "")
            if "text/" in content_type or "html" in content_type or "json" in content_type or not content_type:
                body = read_response_sample(response)
            reason = closed_posting_reason(response.status_code, body)
            if reason:
                return {
                    "ok": False,
                    "status": "unavailable",
                    "checked": True,
                    "message": reason,
                    "url": current_url,
                    "httpStatus": response.status_code,
                }
            if 200 <= response.status_code < 400:
                return {
                    "ok": True,
                    "status": "available",
                    "checked": True,
                    "message": "The apply link is reachable.",
                    "url": current_url,
                    "httpStatus": response.status_code,
                }
            return {
                "ok": True,
                "status": "unknown",
                "checked": True,
                "message": "The source could not be verified, but it did not return a clear closed-posting signal.",
                "url": current_url,
                "httpStatus": response.status_code,
            }
    except requests.RequestException:
        return {
            "ok": True,
            "status": "unknown",
            "checked": True,
            "message": "The source could not be reached for verification. Open it and verify before applying.",
            "url": current_url,
        }

    return {
        "ok": True,
        "status": "unknown",
        "checked": True,
        "message": "The source redirects too many times to verify automatically.",
        "url": current_url,
    }


def get_job_link_status(url):
    safe_url = clean_url(url)
    if not safe_url:
        return fetch_job_link_status(url)
    now = datetime.now(timezone.utc).timestamp() * 1000
    cached = link_status_cache.get(safe_url)
    if cached and now - cached["created_at"] < LINK_STATUS_CACHE_MS:
        return cached["payload"]
    payload = fetch_job_link_status(safe_url)
    link_status_cache[safe_url] = {"created_at": now, "payload": payload}
    if len(link_status_cache) > 1_000:
        stale_before = now - (LINK_STATUS_CACHE_MS * 2)
        for key, value in list(link_status_cache.items()):
            if value.get("created_at", 0) < stale_before:
                link_status_cache.pop(key, None)
    return payload


def clean_file_proxy_url(value=""):
    raw = CONTROL_CHAR_RE.sub("", str(value or "").strip())
    if not raw:
        return ""
    if raw.startswith("/api/documents/file?") and len(raw) <= 2048:
        try:
            parsed = urlparse(raw)
            query = parse_qs(parsed.query)
            key = clean_storage_key((query.get("key") or [""])[0])
        except Exception:
            return ""
        if parsed.path == "/api/documents/file" and key:
            return document_file_url(key)
    return ""


def clean_storage_key(value=""):
    key = CONTROL_CHAR_RE.sub("", str(value or "").strip())
    if not key or len(key) > 512 or ".." in key or key.startswith("/"):
        return ""
    if not re.match(r"^users/[a-zA-Z0-9_-]+/documents/[a-zA-Z0-9_.@+=,/-]+$", key):
        return ""
    return key


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


def clean_datetime(value):
    text = clean_text(value, 32)
    if not text:
        return ""
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return ""
    return parsed.isoformat(timespec="minutes")


def sanitize_oa_attempt(attempt=None):
    attempt = attempt if isinstance(attempt, dict) else {}
    result = clean_text(attempt.get("result"), 24, "Completed")
    if result not in ALLOWED_OA_RESULTS:
        result = "Completed"

    question_types = []
    raw_types = attempt.get("questionTypes") if isinstance(attempt.get("questionTypes"), list) else []
    for raw_type in raw_types[:8]:
        question_type = clean_text(raw_type, 40)
        if question_type in ALLOWED_OA_QUESTION_TYPES and question_type not in question_types:
            question_types.append(question_type)

    return {
        "id": clean_identifier(attempt.get("id"), f"oa-{uuid.uuid4()}"),
        "completedAt": clean_datetime(attempt.get("completedAt")),
        "durationMinutes": clean_int(attempt.get("durationMinutes"), 0, 1440, 0),
        "questionTypes": question_types,
        "result": result,
        "reflection": clean_text(attempt.get("reflection"), 3_000),
    }


def sanitize_job_activity(activity=None):
    activity = activity if isinstance(activity, dict) else {}
    activity_type = clean_text(activity.get("type"), 20)
    if activity_type not in ALLOWED_JOB_ACTIVITY_TYPES:
        activity_type = "saved"
    return {
        "id": clean_identifier(activity.get("id"), f"activity-{uuid.uuid4()}"),
        "type": activity_type,
        "at": clean_datetime(activity.get("at")),
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
        "oaAttempts": [
            sanitize_oa_attempt(item)
            for item in (job.get("oaAttempts") if isinstance(job.get("oaAttempts"), list) else [])[:50]
        ],
        "activity": [
            sanitize_job_activity(item)
            for item in (job.get("activity") if isinstance(job.get("activity"), list) else [])[:200]
            if isinstance(item, dict) and clean_datetime(item.get("at"))
        ],
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
        "taskType": clean_text(task.get("taskType"), 40),
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
    file_key = clean_storage_key(document.get("fileKey"))
    file_url = clean_file_proxy_url(document.get("fileUrl"))
    return {
        "id": clean_identifier(document.get("id"), f"document-{uuid.uuid4()}"),
        "name": clean_text(document.get("name"), 160, "Untitled document"),
        "type": document_type,
        "status": status,
        "target": clean_text(document.get("target"), 140, "General"),
        "sourceJobId": clean_reference_id(document.get("sourceJobId")) if document.get("sourceJobId") else "",
        "url": clean_url(document.get("url")),
        "version": clean_text(document.get("version"), 40, "v1"),
        "owner": clean_text(document.get("owner"), 120),
        "notes": clean_text(document.get("notes"), 1_500),
        "fileName": clean_text(document.get("fileName"), 180),
        "fileType": file_type,
        "fileSize": clean_int(document.get("fileSize"), 0, MAX_UPLOAD_BYTES, 0),
        "fileData": "" if file_key else file_data,
        "fileKey": file_key,
        "fileUrl": file_url,
        "storage": "s3" if file_key else clean_text(document.get("storage"), 20),
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


def clean_notification_id_list(value=None):
    if not isinstance(value, list):
        return []
    clean_items = []
    for item in value[:600]:
        text = CONTROL_CHAR_RE.sub("", str(item or "").strip())[:180]
        if ".." in text or text.startswith("/"):
            continue
        if text and NOTIFICATION_ID_RE.match(text) and text not in clean_items:
            clean_items.append(text)
    return clean_items


def sanitize_notification_state(state=None):
    state = state if isinstance(state, dict) else {}
    return {
        "readIds": clean_notification_id_list(state.get("readIds")),
        "dismissedIds": clean_notification_id_list(state.get("dismissedIds")),
        "browserAlerts": clean_bool(state.get("browserAlerts")),
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
        "notificationState": sanitize_notification_state(value.get("notificationState")),
    }


def profile_from_row(row=None):
    row = row if isinstance(row, dict) else {}
    if row.get("profile_name") or row.get("profile_avatar"):
        return clean_profile(
            {
                "name": row.get("profile_name"),
                "program": row.get("profile_program"),
                "graduation": row.get("profile_graduation"),
                "visa": row.get("profile_visa"),
                "avatar": row.get("profile_avatar"),
            }
        )
    return clean_profile(parse_json(row.get("profile_json"), {}))


def user_select_sql(where_clause=""):
    return f"""
        SELECT
          users.*,
          candidate_profiles.name AS profile_name,
          candidate_profiles.program AS profile_program,
          candidate_profiles.graduation AS profile_graduation,
          candidate_profiles.visa AS profile_visa,
          candidate_profiles.avatar AS profile_avatar
        FROM users
        LEFT JOIN candidate_profiles ON candidate_profiles.user_id = users.id
        {where_clause}
    """


def public_user(row):
    return {
        "id": row["id"],
        "email": row["email"],
        "profile": profile_from_row(row),
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


def migrate_legacy_profiles(cur):
    cur.execute("SHOW COLUMNS FROM users LIKE 'profile_json'")
    if not cur.fetchone():
        return
    cur.execute(
        """
        SELECT users.id, users.profile_json
        FROM users
        LEFT JOIN candidate_profiles ON candidate_profiles.user_id = users.id
        WHERE candidate_profiles.user_id IS NULL
        """
    )
    for row in cur.fetchall():
        profile = clean_profile(parse_json(row.get("profile_json"), {}))
        cur.execute(
            """
            INSERT INTO candidate_profiles (user_id, name, program, graduation, visa, avatar)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
              name = VALUES(name),
              program = VALUES(program),
              graduation = VALUES(graduation),
              visa = VALUES(visa),
              avatar = VALUES(avatar)
            """,
            (
                row["id"],
                profile["name"],
                profile["program"],
                profile["graduation"],
                profile["visa"],
                profile["avatar"],
            ),
        )
    cur.execute("ALTER TABLE users DROP COLUMN profile_json")


def sql_date(value):
    return value or None


def _replace_workspace_rows(cur, user_id, workspace):
    next_workspace = normalize_workspace(workspace)
    for table in (
        "notification_reads",
        "notification_dismissals",
        "notification_settings",
        "goals",
        "tasks",
        "contacts",
        "documents",
        "jobs",
    ):
        cur.execute(f"DELETE FROM {table} WHERE user_id = %s", (user_id,))

    for position, job in enumerate(next_workspace["jobs"]):
        cur.execute(
            """
            INSERT INTO jobs (
              user_id, id, company, role, season, deadline, location, mode, sponsorship, stage,
              match_score, source, source_url, posted, status_date, priority, contact_name,
              contact_role, contact_email, summary, description, requirements_text, notes,
              next_step, position
            ) VALUES (
              %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
              %s, %s, %s, %s, %s, %s, %s,
              %s, %s, %s, %s, %s, %s,
              %s, %s
            )
            """,
            (
                user_id,
                job["id"],
                job["company"],
                job["role"],
                job["season"],
                sql_date(job["deadline"]),
                job["location"],
                job["mode"],
                job["sponsorship"],
                job["stage"],
                job["match"],
                job["source"],
                job["sourceUrl"],
                job["posted"],
                job["statusDate"],
                job["priority"],
                job["contact"],
                job["contactRole"],
                job["contactEmail"],
                job["summary"],
                job["description"],
                job["requirements"],
                job["notes"],
                job["nextStep"],
                position,
            ),
        )
        for tag_position, tag in enumerate(job["tags"]):
            cur.execute(
                "INSERT INTO job_tags (user_id, job_id, tag, position) VALUES (%s, %s, %s, %s)",
                (user_id, job["id"], tag, tag_position),
            )
        for attempt in job["oaAttempts"]:
            cur.execute(
                """
                INSERT INTO job_oa_attempts (
                  user_id, job_id, id, completed_at, duration_minutes, result, reflection
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    user_id,
                    job["id"],
                    attempt["id"],
                    attempt["completedAt"],
                    attempt["durationMinutes"],
                    attempt["result"],
                    attempt["reflection"],
                ),
            )
            for question_type in attempt["questionTypes"]:
                cur.execute(
                    """
                    INSERT INTO job_oa_question_types (user_id, job_id, attempt_id, question_type)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (user_id, job["id"], attempt["id"], question_type),
                )
        for activity in job["activity"]:
            cur.execute(
                """
                INSERT INTO job_activities (user_id, job_id, id, activity_type, occurred_at)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (user_id, job["id"], activity["id"], activity["type"], activity["at"]),
            )

    valid_job_ids = {job["id"] for job in next_workspace["jobs"]}
    for position, task in enumerate(next_workspace["tasks"]):
        source_job_id = task["sourceJobId"] if task["sourceJobId"] in valid_job_ids else None
        cur.execute(
            """
            INSERT INTO tasks (
              user_id, id, title, subtitle, done, due_date, priority, source_job_id, task_type, position
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                task["id"],
                task["title"],
                task["subtitle"],
                task["done"],
                sql_date(task["due"]),
                task["priority"],
                source_job_id,
                task["taskType"],
                position,
            ),
        )
    for position, contact in enumerate(next_workspace["contacts"]):
        source_job_id = contact["sourceJobId"] if contact["sourceJobId"] in valid_job_ids else None
        cur.execute(
            """
            INSERT INTO contacts (
              user_id, id, name, company, role, email, next_action, source, source_job_id, position
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                contact["id"],
                contact["name"],
                contact["company"],
                contact["role"],
                contact["email"],
                contact["next"],
                contact["source"],
                source_job_id,
                position,
            ),
        )
    for position, document in enumerate(next_workspace["documents"]):
        source_job_id = document["sourceJobId"] if document["sourceJobId"] in valid_job_ids else None
        cur.execute(
            """
            INSERT INTO documents (
              user_id, id, name, document_type, status, target, source_job_id, external_url,
              version, owner, notes, file_name, file_type, file_size, file_data, file_key,
              file_url, storage, updated_label, position
            ) VALUES (
              %s, %s, %s, %s, %s, %s, %s, %s,
              %s, %s, %s, %s, %s, %s, %s, %s,
              %s, %s, %s, %s
            )
            """,
            (
                user_id,
                document["id"],
                document["name"],
                document["type"],
                document["status"],
                document["target"],
                source_job_id,
                document["url"],
                document["version"],
                document["owner"],
                document["notes"],
                document["fileName"],
                document["fileType"],
                document["fileSize"],
                document["fileData"],
                document["fileKey"],
                document["fileUrl"],
                document["storage"],
                document["updated"],
                position,
            ),
        )
    if next_workspace["goal"]:
        goal = next_workspace["goal"]
        cur.execute(
            "INSERT INTO goals (user_id, target, deadline, label) VALUES (%s, %s, %s, %s)",
            (user_id, goal["target"], sql_date(goal["deadline"]), goal["label"]),
        )
    notification_state = next_workspace["notificationState"]
    cur.execute(
        "INSERT INTO notification_settings (user_id, browser_alerts) VALUES (%s, %s)",
        (user_id, notification_state["browserAlerts"]),
    )
    for notification_id in notification_state["readIds"]:
        cur.execute(
            "INSERT INTO notification_reads (user_id, notification_id) VALUES (%s, %s)",
            (user_id, notification_id),
        )
    for notification_id in notification_state["dismissedIds"]:
        cur.execute(
            "INSERT INTO notification_dismissals (user_id, notification_id) VALUES (%s, %s)",
            (user_id, notification_id),
        )
    cur.execute(
        """
        INSERT INTO workspace_meta (user_id)
        VALUES (%s)
        ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
        """,
        (user_id,),
    )
    return next_workspace


def migrate_legacy_workspaces(cur):
    cur.execute("SHOW TABLES LIKE 'workspace_data'")
    if not cur.fetchone():
        return
    cur.execute(
        """
        SELECT workspace_data.*
        FROM workspace_data
        LEFT JOIN workspace_meta ON workspace_meta.user_id = workspace_data.user_id
        WHERE workspace_meta.user_id IS NULL
        """
    )
    for row in cur.fetchall():
        _replace_workspace_rows(
            cur,
            row["user_id"],
            {
                "jobs": parse_json(row.get("jobs_json"), []),
                "tasks": parse_json(row.get("tasks_json"), []),
                "contacts": parse_json(row.get("contacts_json"), []),
                "documents": parse_json(row.get("documents_json"), []),
                "goal": parse_json(row.get("goal_json"), None),
                "notificationState": parse_json(row.get("notifications_json"), {}),
            },
        )


def date_text(value):
    if value is None:
        return ""
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _read_workspace_rows(cur, user_id):
    cur.execute("SELECT * FROM jobs WHERE user_id = %s ORDER BY position", (user_id,))
    jobs = {}
    for row in cur.fetchall():
        jobs[row["id"]] = {
            "id": row["id"],
            "company": row["company"],
            "role": row["role"],
            "season": row["season"],
            "deadline": date_text(row.get("deadline")),
            "location": row["location"],
            "mode": row["mode"],
            "sponsorship": row["sponsorship"],
            "stage": row["stage"],
            "match": row["match_score"],
            "source": row["source"],
            "sourceUrl": row["source_url"],
            "posted": row["posted"],
            "statusDate": row["status_date"],
            "priority": bool(row["priority"]),
            "contact": row["contact_name"],
            "contactRole": row["contact_role"],
            "contactEmail": row["contact_email"],
            "summary": row["summary"],
            "description": row["description"],
            "requirements": row["requirements_text"],
            "notes": row["notes"],
            "tags": [],
            "nextStep": row["next_step"],
            "oaAttempts": [],
            "activity": [],
        }

    if jobs:
        cur.execute("SELECT * FROM job_tags WHERE user_id = %s ORDER BY job_id, position", (user_id,))
        for row in cur.fetchall():
            if row["job_id"] in jobs:
                jobs[row["job_id"]]["tags"].append(row["tag"])
        cur.execute("SELECT * FROM job_oa_attempts WHERE user_id = %s", (user_id,))
        attempts = {}
        for row in cur.fetchall():
            attempt = {
                "id": row["id"],
                "completedAt": row["completed_at"],
                "durationMinutes": row["duration_minutes"],
                "questionTypes": [],
                "result": row["result"],
                "reflection": row["reflection"],
            }
            attempts[(row["job_id"], row["id"])] = attempt
            if row["job_id"] in jobs:
                jobs[row["job_id"]]["oaAttempts"].append(attempt)
        cur.execute("SELECT * FROM job_oa_question_types WHERE user_id = %s", (user_id,))
        for row in cur.fetchall():
            attempt = attempts.get((row["job_id"], row["attempt_id"]))
            if attempt:
                attempt["questionTypes"].append(row["question_type"])
        cur.execute("SELECT * FROM job_activities WHERE user_id = %s ORDER BY occurred_at", (user_id,))
        for row in cur.fetchall():
            if row["job_id"] in jobs:
                jobs[row["job_id"]]["activity"].append(
                    {"id": row["id"], "type": row["activity_type"], "at": row["occurred_at"]}
                )

    cur.execute("SELECT * FROM tasks WHERE user_id = %s ORDER BY position", (user_id,))
    tasks = [
        {
            "id": row["id"],
            "title": row["title"],
            "subtitle": row["subtitle"],
            "done": bool(row["done"]),
            "due": date_text(row.get("due_date")),
            "priority": row["priority"],
            "sourceJobId": row.get("source_job_id") or "",
            "taskType": row["task_type"],
        }
        for row in cur.fetchall()
    ]
    cur.execute("SELECT * FROM contacts WHERE user_id = %s ORDER BY position", (user_id,))
    contacts = [
        {
            "id": row["id"],
            "name": row["name"],
            "company": row["company"],
            "role": row["role"],
            "email": row["email"],
            "next": row["next_action"],
            "source": row["source"],
            "sourceJobId": row.get("source_job_id") or "",
        }
        for row in cur.fetchall()
    ]
    cur.execute("SELECT * FROM documents WHERE user_id = %s ORDER BY position", (user_id,))
    documents = [
        {
            "id": row["id"],
            "name": row["name"],
            "type": row["document_type"],
            "status": row["status"],
            "target": row["target"],
            "sourceJobId": row.get("source_job_id") or "",
            "url": row["external_url"],
            "version": row["version"],
            "owner": row["owner"],
            "notes": row["notes"],
            "fileName": row["file_name"],
            "fileType": row["file_type"],
            "fileSize": row["file_size"],
            "fileData": row["file_data"],
            "fileKey": row["file_key"],
            "fileUrl": row["file_url"],
            "storage": row["storage"],
            "updated": row["updated_label"],
        }
        for row in cur.fetchall()
    ]
    cur.execute("SELECT * FROM goals WHERE user_id = %s LIMIT 1", (user_id,))
    goal_row = cur.fetchone()
    goal = (
        {
            "target": goal_row["target"],
            "deadline": date_text(goal_row.get("deadline")),
            "label": goal_row["label"],
        }
        if goal_row
        else None
    )
    cur.execute("SELECT browser_alerts FROM notification_settings WHERE user_id = %s LIMIT 1", (user_id,))
    notification_row = cur.fetchone()
    cur.execute("SELECT notification_id FROM notification_reads WHERE user_id = %s", (user_id,))
    read_ids = [row["notification_id"] for row in cur.fetchall()]
    cur.execute("SELECT notification_id FROM notification_dismissals WHERE user_id = %s", (user_id,))
    dismissed_ids = [row["notification_id"] for row in cur.fetchall()]
    return normalize_workspace(
        {
            "jobs": list(jobs.values()),
            "tasks": tasks,
            "contacts": contacts,
            "documents": documents,
            "goal": goal,
            "notificationState": {
                "readIds": read_ids,
                "dismissedIds": dismissed_ids,
                "browserAlerts": bool(notification_row and notification_row["browser_alerts"]),
            },
        }
    )


def get_workspace(user_id):
    ensure_schema()
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT user_id FROM workspace_meta WHERE user_id = %s LIMIT 1", (user_id,))
            exists = cur.fetchone()
            if exists:
                return _read_workspace_rows(cur, user_id)
    if not exists:
        save_workspace(user_id, EMPTY_WORKSPACE)
        return EMPTY_WORKSPACE
    return EMPTY_WORKSPACE


def save_workspace(user_id, workspace):
    ensure_schema()
    with db() as conn:
        conn.begin()
        try:
            with conn.cursor() as cur:
                next_workspace = _replace_workspace_rows(cur, user_id, workspace)
            conn.commit()
            return next_workspace
        except Exception:
            conn.rollback()
            raise


def stage_count(jobs, stage):
    return len([job for job in jobs if isinstance(job, dict) and job.get("stage") == stage])


def applied_count(jobs):
    return len([job for job in jobs if isinstance(job, dict) and job.get("stage") and job.get("stage") != "saved"])


def conversion_rate(numerator, denominator):
    if not denominator:
        return 0
    return round((numerator / denominator) * 100)


def public_leaderboard_entry(entry):
    public_entry = dict(entry)
    public_entry.pop("userId", None)
    return public_entry


def get_leaderboard(current_user_id, limit=50):
    ensure_schema()
    safe_limit = clean_int(limit, 5, 100, 50)
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  users.id,
                  users.email,
                  users.created_at,
                  candidate_profiles.name AS profile_name,
                  candidate_profiles.program AS profile_program,
                  candidate_profiles.graduation AS profile_graduation,
                  candidate_profiles.avatar AS profile_avatar,
                  goals.target AS goal_target,
                  workspace_meta.updated_at AS workspace_updated_at,
                  COUNT(jobs.id) AS tracked,
                  SUM(CASE WHEN jobs.stage = 'saved' THEN 1 ELSE 0 END) AS saved,
                  SUM(CASE WHEN jobs.stage <> 'saved' THEN 1 ELSE 0 END) AS applied,
                  SUM(CASE WHEN jobs.stage = 'oa' THEN 1 ELSE 0 END) AS oa,
                  SUM(CASE WHEN jobs.stage = 'interview' THEN 1 ELSE 0 END) AS interviews,
                  SUM(CASE WHEN jobs.stage = 'offer' THEN 1 ELSE 0 END) AS offers,
                  SUM(CASE WHEN jobs.priority = TRUE THEN 1 ELSE 0 END) AS priority_count
                FROM users
                LEFT JOIN candidate_profiles ON candidate_profiles.user_id = users.id
                LEFT JOIN workspace_meta ON workspace_meta.user_id = users.id
                LEFT JOIN goals ON goals.user_id = users.id
                LEFT JOIN jobs ON jobs.user_id = users.id
                GROUP BY
                  users.id,
                  users.email,
                  users.created_at,
                  candidate_profiles.name,
                  candidate_profiles.program,
                  candidate_profiles.graduation,
                  candidate_profiles.avatar,
                  goals.target,
                  workspace_meta.updated_at
                """
            )
            rows = cur.fetchall()

    ranked = []
    for row in rows:
        profile = profile_from_row(row)
        applied = int(row.get("applied") or 0)
        interviews = int(row.get("interviews") or 0)
        offers = int(row.get("offers") or 0)
        oa = int(row.get("oa") or 0)
        saved = int(row.get("saved") or 0)
        tracked = int(row.get("tracked") or 0)
        goal_target = clean_int(row.get("goal_target"), 0, 5000, 0)
        display_name = clean_text(profile.get("name"), 80) or clean_text(str(row.get("email") or "").split("@", 1)[0], 80, "Candidate")

        ranked.append(
            {
                "userId": row["id"],
                "name": display_name or "Candidate",
                "avatar": profile.get("avatar") or "/assets/profile-presets/avatar-portrait.png",
                "program": profile.get("program") or "Career Profile",
                "graduation": profile.get("graduation") or "2026-2027 cycle",
                "applied": applied,
                "tracked": tracked,
                "saved": saved,
                "oa": oa,
                "interviews": interviews,
                "offers": offers,
                "priority": int(row.get("priority_count") or 0),
                "conversionRate": conversion_rate(interviews + offers, applied),
                "offerRate": conversion_rate(offers, applied),
                "goalTarget": goal_target,
                "goalProgress": min(100, round((applied / goal_target) * 100)) if goal_target else 0,
                "workspaceUpdatedAt": str(row.get("workspace_updated_at") or row.get("created_at") or ""),
                "isCurrentUser": row["id"] == current_user_id,
            }
        )

    ranked.sort(
        key=lambda entry: (
            entry["applied"],
            entry["offers"],
            entry["interviews"],
            entry["workspaceUpdatedAt"],
        ),
        reverse=True,
    )
    for index, entry in enumerate(ranked, start=1):
        entry["rank"] = index

    current_user = next((entry for entry in ranked if entry["userId"] == current_user_id), None)
    total_applied = sum(entry["applied"] for entry in ranked)
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "metric": "applied",
        "totalUsers": len(ranked),
        "activeUsers": len([entry for entry in ranked if entry["applied"] > 0]),
        "topApplied": ranked[0]["applied"] if ranked else 0,
        "peerAverage": round(total_applied / len(ranked)) if ranked else 0,
        "currentUser": public_leaderboard_entry(current_user) if current_user else None,
        "entries": [public_leaderboard_entry(entry) for entry in ranked[:safe_limit]],
    }


def storage_bucket():
    return env("S3_BUCKET", env("S3_BUCKET_NAME"))


def storage_region():
    return env("S3_REGION", env("AWS_REGION", "us-east-1"))


def storage_endpoint():
    return env("S3_ENDPOINT_URL", env("AWS_S3_ENDPOINT_URL"))


def storage_access_key():
    return env("S3_ACCESS_KEY_ID", env("AWS_ACCESS_KEY_ID"))


def storage_secret_key():
    return env("S3_SECRET_ACCESS_KEY", env("AWS_SECRET_ACCESS_KEY"))


def storage_configured():
    return bool(storage_bucket() and storage_access_key() and storage_secret_key())


def storage_client():
    if boto3 is None or BotoConfig is None:
        raise RuntimeError("S3 client dependency is not installed.")
    endpoint = storage_endpoint() or None
    config_kwargs = {"signature_version": "s3v4"}
    if endpoint:
        config_kwargs["s3"] = {"addressing_style": env("S3_ADDRESSING_STYLE", "path")}
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=storage_region(),
        aws_access_key_id=storage_access_key(),
        aws_secret_access_key=storage_secret_key(),
        config=BotoConfig(**config_kwargs),
    )


def safe_upload_filename(filename="document"):
    cleaned = secure_filename(clean_text(filename, 180, "document"))
    return cleaned or f"document-{uuid.uuid4()}"


def detect_file_type(file_storage, filename):
    guessed = mimetypes.guess_type(filename)[0]
    detected = clean_text(file_storage.mimetype, 100)
    if detected in {"application/octet-stream", "binary/octet-stream"}:
        return guessed or detected
    return detected or guessed or "application/octet-stream"


def document_file_key(user_id, filename):
    return f"users/{clean_identifier(user_id)}/documents/{uuid.uuid4().hex}-{safe_upload_filename(filename)}"


def document_file_url(key):
    return f"/api/documents/file?key={quote(key, safe='')}"


def require_document_key_for_user(user, key):
    clean_key = clean_storage_key(key)
    prefix = f"users/{clean_identifier(user['id'])}/documents/"
    return clean_key if clean_key.startswith(prefix) else ""


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
                SELECT
                  users.*,
                  candidate_profiles.name AS profile_name,
                  candidate_profiles.program AS profile_program,
                  candidate_profiles.graduation AS profile_graduation,
                  candidate_profiles.visa AS profile_visa,
                  candidate_profiles.avatar AS profile_avatar
                FROM sessions
                JOIN users ON users.id = sessions.user_id
                LEFT JOIN candidate_profiles ON candidate_profiles.user_id = users.id
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
                "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                (user_id, draft["email"], hash_password(draft["password"])),
            )
            cur.execute(
                """
                INSERT INTO candidate_profiles (user_id, name, program, graduation, visa, avatar)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (user_id, profile["name"], profile["program"], profile["graduation"], profile["visa"], profile["avatar"]),
            )
    save_workspace(user_id, EMPTY_WORKSPACE)
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(user_select_sql("WHERE users.id = %s LIMIT 1"), (user_id,))
            user = public_user(cur.fetchone())
    return {"user": user, "token": create_session(user_id), "workspace": EMPTY_WORKSPACE}


def login_user(draft):
    ensure_schema()
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(user_select_sql("WHERE users.email = %s LIMIT 1"), (draft["email"],))
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
            cur.execute(user_select_sql("WHERE users.email = %s LIMIT 1"), (normalized_email,))
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
                    "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
                    (user_id, normalized_email, f"google:{secrets.token_hex(24)}"),
                )
                cur.execute(
                    """
                    INSERT INTO candidate_profiles (user_id, name, program, graduation, visa, avatar)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        user_id,
                        next_profile["name"],
                        next_profile["program"],
                        next_profile["graduation"],
                        next_profile["visa"],
                        next_profile["avatar"],
                    ),
                )
                save_workspace(user_id, EMPTY_WORKSPACE)
                cur.execute(user_select_sql("WHERE users.id = %s LIMIT 1"), (user_id,))
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


def strip_rich_text(value=""):
    text = re.sub(r"!\[[^\]]*]\([^)]+\)", " ", str(value))
    text = re.sub(r"\[([^\]]+)]\([^)]+\)", r"\1", text)
    text = re.sub(r"[*_`]+", "", text)
    return strip_tags(text)


def clean_company(value=""):
    return re.sub("[\U0001f525\U0001f512\U0001f393\U0001f6c2\U0001f1fa\U0001f1f8]", "", strip_rich_text(value)).replace("\u21b3", "").strip()


def first_url(value=""):
    matches = re.findall(r'href="([^"]+)"', str(value))
    matches.extend(re.findall(r"\]\((https?://[^)\s]+)\)", str(value)))
    safe_matches = [clean_url(url) for url in matches]
    safe_matches = [url for url in safe_matches if url]
    for url in safe_matches:
        if "simplify.jobs/p/" not in url and "i.imgur.com" not in url:
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

        role = strip_rich_text(cells[1])
        location = strip_rich_text(cells[2])
        terms = strip_rich_text(cells[3]) if has_terms else ""
        application_cell = cells[4] if has_terms else cells[3]
        age = strip_rich_text(cells[5] if has_terms else cells[4])
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


def is_markdown_separator(cells):
    return bool(cells) and all(re.fullmatch(r":?-{2,}:?", cell.strip()) for cell in cells if cell.strip())


def parse_markdown_table(markdown, source):
    jobs = []
    last_company = ""
    source_format = source.get("format", "generic")
    role_type = source.get("roleType") or "Internship"

    for line in str(markdown).splitlines():
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        cells = [cell.strip() for cell in stripped.strip("|").split("|")]
        if len(cells) < 5 or is_markdown_separator(cells):
            continue
        header_blob = " ".join(cells[:5]).lower()
        if "company" in header_blob and ("position" in header_blob or "role" in header_blob or "job title" in header_blob):
            continue

        if source_format == "speedy":
            company_cell, role_cell, location_cell = cells[0], cells[1], cells[2]
            if len(cells) >= 6:
                salary, application_cell, posted = strip_rich_text(cells[3]), cells[4], strip_rich_text(cells[5])
            else:
                salary, application_cell, posted = "", cells[3], strip_rich_text(cells[4])
        elif source_format == "jobright":
            company_cell, role_cell, location_cell = cells[0], cells[1], cells[2]
            salary, application_cell, posted = "", cells[1], strip_rich_text(cells[4])
        else:
            company_cell, role_cell, location_cell = cells[0], cells[1], cells[2]
            salary, application_cell, posted = "", cells[3], strip_rich_text(cells[4])

        company = clean_company(company_cell)
        if company and company not in {"-", "----", "-------"}:
            last_company = company
        if not last_company:
            continue

        role = strip_rich_text(role_cell)
        location = strip_rich_text(location_cell)
        if not role or not location or role in {"Role", "Position", "Job Title"}:
            continue
        if "\U0001f512" in line:
            continue

        inferred_season = infer_season(role, "", source.get("season", "2026"))
        inferred_role_type = "New Grad" if role_type == "New Grad" or inferred_season == "New Grad" else "Internship"
        source_url = first_url(application_cell or role_cell)
        tags = [inferred_season, inferred_role_type, source.get("name")]
        if salary:
            tags.append(salary)

        jobs.append(
            normalize_job(
                {
                    "id": f"{source['id']}-{slugify(last_company)}-{slugify(role)}-{slugify(location)}",
                    "company": last_company,
                    "role": role,
                    "location": location,
                    "season": inferred_season,
                    "mode": infer_mode(location),
                    "sponsorship": "No sponsorship" if "\U0001f6c2" in line else "US citizenship likely" if "\U0001f1fa\U0001f1f8" in line else "Unknown",
                    "posted": posted or "Recently",
                    "deadline": "",
                    "source": source["name"],
                    "sourceUrl": source_url,
                    "tags": [item for item in tags if item],
                    "summary": f"{role} at {last_company}. Listed by {source['name']}{f' with {salary}' if salary else ''}.",
                    "requirements": salary,
                }
            )
        )
    return jobs


def fetch_text(url):
    last_error = None
    for attempt in range(2):
        try:
            response = requests.get(
                url,
                headers={"User-Agent": "Career-Tracker-Dashboard/1.0", "Accept": "text/plain, text/html, application/json"},
                timeout=10,
            )
            response.raise_for_status()
            return response.text
        except Exception as exc:
            last_error = exc
            if attempt == 0:
                time.sleep(0.25)
    raise last_error


def fetch_json(url):
    last_error = None
    for attempt in range(2):
        try:
            response = requests.get(url, headers={"User-Agent": "Career-Tracker-Dashboard/1.0", "Accept": "application/json"}, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            last_error = exc
            if attempt == 0:
                time.sleep(0.25)
    raise last_error


def fetch_simplify():
    jobs = []
    with ThreadPoolExecutor(max_workers=min(6, len(simplify_sources))) as executor:
        futures = [executor.submit(lambda item: parse_simplify_markdown(fetch_text(item["url"]), item), source) for source in simplify_sources]
        for future in as_completed(futures):
            jobs.extend(future.result())
    return jobs


def fetch_markdown_tables():
    jobs = []
    with ThreadPoolExecutor(max_workers=min(10, len(markdown_table_sources))) as executor:
        futures = [executor.submit(lambda item: parse_markdown_table(fetch_text(item["url"]), item), source) for source in markdown_table_sources]
        for future in as_completed(futures):
            jobs.extend(future.result())
    return jobs


def fetch_remotive():
    data = fetch_json(remotive_url)
    rows = data.get("jobs", []) if isinstance(data, dict) else []
    jobs = []
    for row in rows[:80]:
        title = row.get("title") or ""
        if not (EARLY_CAREER_PATTERN.search(title) and TECH_ROLE_PATTERN.search(title)):
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
        if not (EARLY_CAREER_PATTERN.search(title) and TECH_ROLE_PATTERN.search(title)):
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


def fetch_greenhouse_board(board):
    data = fetch_json(f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true")
    rows = data.get("jobs", []) if isinstance(data, dict) else []
    company = data.get("name") if isinstance(data, dict) else ""
    jobs = []
    for row in rows:
        title = row.get("title") or ""
        if not EARLY_CAREER_PATTERN.search(title):
            continue
        location = (row.get("location") or {}).get("name") or "Location not listed"
        season = infer_season(title, "", "2027" if "2027" in title else "2026")
        role_type = "New Grad" if season == "New Grad" or re.search(r"new grad|graduate|entry[- ]?level|early career", title, re.I) else "Internship"
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
                    "source": f"Greenhouse · {company or board}",
                    "sourceUrl": row.get("absolute_url"),
                    "posted": str(row.get("updated_at") or "")[:10],
                    "tags": [item for item in ["Company Board", role_type, board, season] if item],
                    "summary": description[:220] or f"{title} from {company or board}'s public Greenhouse board.",
                    "description": description[:2200],
                }
            )
        )
    return jobs


def fetch_greenhouse():
    jobs = []
    with ThreadPoolExecutor(max_workers=min(10, len(greenhouse_boards))) as executor:
        futures = [executor.submit(fetch_greenhouse_board, board) for board in greenhouse_boards]
        for future in as_completed(futures):
            jobs.extend(future.result())
    return jobs


def fetch_lever_board(board):
    rows = fetch_json(f"https://api.lever.co/v0/postings/{board}?mode=json")
    jobs = []
    for row in rows if isinstance(rows, list) else []:
        title = row.get("text") or ""
        if not EARLY_CAREER_PATTERN.search(title):
            continue
        categories = row.get("categories") or {}
        location = categories.get("location") or "Location not listed"
        commitment = categories.get("commitment") or ""
        description = strip_tags(row.get("descriptionPlain") or row.get("description") or "")
        season = infer_season(title, "", "2027" if "2027" in title else "2026")
        role_type = "New Grad" if season == "New Grad" or re.search(r"new grad|graduate|entry[- ]?level|early career", title, re.I) else "Internship"
        jobs.append(
            normalize_job(
                {
                    "id": f"lever-{board}-{row.get('id') or slugify(title)}",
                    "company": board.title(),
                    "role": title,
                    "location": location,
                    "season": season,
                    "mode": infer_mode(location),
                    "source": f"Lever · {board.title()}",
                    "sourceUrl": row.get("hostedUrl") or row.get("applyUrl"),
                    "posted": datetime.fromtimestamp((row.get("createdAt") or 0) / 1000, timezone.utc).date().isoformat()
                    if row.get("createdAt")
                    else "",
                    "tags": [item for item in ["Company Board", role_type, commitment, season] if item],
                    "summary": description[:220] or f"{title} from {board.title()}'s public Lever board.",
                    "description": description[:2200],
                }
            )
        )
    return jobs


def fetch_lever():
    jobs = []
    with ThreadPoolExecutor(max_workers=min(6, len(lever_boards))) as executor:
        futures = [executor.submit(fetch_lever_board, board) for board in lever_boards]
        for future in as_completed(futures):
            jobs.extend(future.result())
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
        blob = (
            f"{job['company']} {job['role']} {job['location']} {job['season']} {job.get('source', '')} "
            f"{job.get('summary', '')} {job.get('description', '')} {' '.join(job['tags'])}"
        ).lower()
        season_ok = (
            season == "all"
            or (season == "fall2026" and job["season"] == "2026 Fall")
            or (season == "2027" and job["season"] == "2027")
            or (season == "internship" and (EARLY_CAREER_PATTERN.search(blob) and "new grad" not in blob))
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
            ("GitHub Curated Tables", fetch_markdown_tables),
            ("Greenhouse Job Board API", fetch_greenhouse),
            ("Lever Job Board API", fetch_lever),
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
        unique = sorted(dedupe_jobs(jobs), key=lambda item: item.get("match", 0), reverse=True)[:LIVE_INDEX_LIMIT]
        sources = [
            {"name": "SimplifyJobs Summer2026", "url": simplify_sources[1]["url"]},
            {"name": "SimplifyJobs Off-Season", "url": simplify_sources[0]["url"]},
            {"name": "SimplifyJobs New Grad", "url": simplify_sources[2]["url"]},
            *[{"name": source["name"], "url": source["url"]} for source in markdown_table_sources],
            *[
                {"name": f"Greenhouse · {board}", "url": f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs"}
                for board in greenhouse_boards
            ],
            *[
                {"name": f"Lever · {board.title()}", "url": f"https://api.lever.co/v0/postings/{board}?mode=json"}
                for board in lever_boards
            ],
            {"name": "Remotive API", "url": "https://remotive.com/api/remote-jobs"},
            {"name": "RemoteOK API", "url": remoteok_url},
        ]
        job_cache["created_at"] = now
        job_cache["payload"] = {
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
            "jobs": unique,
            "sources": sources,
            "sourceStatus": status,
        }
    payload = job_cache["payload"]
    filtered = filter_jobs(payload["jobs"], params)
    try:
        requested_limit = int(params.get("limit") or 240)
    except (TypeError, ValueError):
        requested_limit = 240
    limit = max(1, min(LIVE_INDEX_LIMIT, requested_limit))
    return {**payload, "total": len(payload["jobs"]), "filteredTotal": len(filtered), "count": len(filtered[:limit]), "jobs": filtered[:limit]}



def client_ip():
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    return forwarded or request.remote_addr or "unknown"


def rate_limit_key():
    if request.path.startswith("/api/auth/"):
        return "auth", 30, 60
    if request.path == "/api/jobs":
        return "jobs", 90, 60
    if request.path == "/api/jobs/link-status":
        return "job-link-status", 180, 60
    if request.path == "/api/leaderboard":
        return "leaderboard", 120, 60
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
        "frame-src": ["'self'", "https://accounts.google.com", "https://*.google.com", "https://drive.google.com", "https://docs.google.com", "data:", "blob:"],
        "img-src": ["'self'", "data:", "blob:", "https:"],
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


def swagger_docs_html(nonce):
    return """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#08783f" />
    <title>Career Tracker API</title>
    <link rel="icon" href="/swagger-ui/favicon-32x32.png" />
    <link rel="stylesheet" href="/swagger-ui/swagger-ui.css" />
    <style nonce="__NONCE__">
      :root { color-scheme: light; }
      body { background: #f3f8f4; margin: 0; }
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 36px 0 28px; }
      .swagger-ui .info .title { color: #17231d; }
      .swagger-ui .info a { color: #08783f; }
      .swagger-ui .btn.authorize { border-color: #08783f; color: #08783f; }
      .swagger-ui .btn.authorize svg { fill: #08783f; }
      .swagger-ui .opblock.opblock-get { background: rgba(8, 120, 63, .06); border-color: #08783f; }
      .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #08783f; }
      .swagger-ui .scheme-container { box-shadow: 0 1px 2px rgba(23, 35, 29, .12); }
      @media (max-width: 640px) {
        .swagger-ui .wrapper { padding: 0 12px; }
        .swagger-ui .info { margin: 24px 0 18px; }
        .swagger-ui .opblock .opblock-summary { align-items: flex-start; }
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/swagger-ui/swagger-ui-bundle.js"></script>
    <script src="/swagger-ui/swagger-ui-standalone-preset.js"></script>
    <script nonce="__NONCE__">
      window.ui = SwaggerUIBundle({
        url: "/api/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        displayRequestDuration: true,
        filter: true,
        persistAuthorization: true,
        tryItOutEnabled: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: "StandaloneLayout"
      });
    </script>
  </body>
</html>""".replace("__NONCE__", nonce)


@app.get("/api/openapi.json")
def openapi_json():
    return json_response(build_openapi_spec())


@app.get("/api/docs")
def swagger_docs():
    nonce = secrets.token_urlsafe(16)
    response = make_response(swagger_docs_html(nonce), 200)
    response.headers["content-type"] = "text/html; charset=utf-8"
    response.headers["Content-Security-Policy"] = build_csp(script_nonce=nonce)
    return response


@app.get("/api/health")
def health():
    if not has_database_config():
        return json_response(
            {
                "ok": True,
                "service": "career-tracker-dashboard",
                "database": {
                    "configured": False,
                    "ok": False,
                    "schemaVersion": DATABASE_SCHEMA_VERSION,
                    "normalForm": DATABASE_NORMAL_FORM,
                },
            }
        )
    try:
        ensure_schema()
        with db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.execute("SELECT MAX(version) AS version FROM schema_migrations")
                schema_row = cur.fetchone() or {}
        database = {
            "configured": True,
            "ok": True,
            "schemaVersion": int(schema_row.get("version") or DATABASE_SCHEMA_VERSION),
            "normalForm": DATABASE_NORMAL_FORM,
        }
    except Exception as exc:
        database = {
            "configured": True,
            "ok": False,
            "schemaVersion": DATABASE_SCHEMA_VERSION,
            "normalForm": DATABASE_NORMAL_FORM,
            "error": str(exc),
        }
    return json_response({"ok": True, "service": "career-tracker-dashboard", "database": database})


@app.get("/api/jobs")
def jobs():
    return json_response(get_live_jobs(dict(request.args)))


@app.get("/api/jobs/link-status")
def job_link_status():
    return json_response(get_job_link_status(request.args.get("url", "")))


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
            cur.execute(
                """
                INSERT INTO candidate_profiles (user_id, name, program, graduation, visa, avatar)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                  name = VALUES(name),
                  program = VALUES(program),
                  graduation = VALUES(graduation),
                  visa = VALUES(visa),
                  avatar = VALUES(avatar)
                """,
                (
                    user["id"],
                    next_profile["name"],
                    next_profile["program"],
                    next_profile["graduation"],
                    next_profile["visa"],
                    next_profile["avatar"],
                ),
            )
            cur.execute(user_select_sql("WHERE users.id = %s LIMIT 1"), (user["id"],))
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


@app.get("/api/leaderboard")
def leaderboard_get():
    user, error = require_user()
    if error:
        return error
    return json_response(get_leaderboard(user["id"], request.args.get("limit")))


@app.post("/api/documents/upload")
def document_upload():
    user, error = require_user()
    if error:
        return error
    if not storage_configured():
        return json_response({"error": "S3 storage is not configured."}, 503)
    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename:
        return json_response({"error": "Attach a file before uploading."}, 400)

    filename = safe_upload_filename(uploaded.filename)
    content_type = detect_file_type(uploaded, filename)
    if content_type not in SAFE_UPLOAD_MIME_TYPES:
        return json_response({"error": "This file type is not supported for secure storage."}, 415)

    data = uploaded.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        return json_response({"error": "File is too large. Use a file under 10 MB."}, 413)
    if not data:
        return json_response({"error": "File is empty."}, 400)

    key = document_file_key(user["id"], filename)
    try:
        storage_client().put_object(
            Bucket=storage_bucket(),
            Key=key,
            Body=data,
            ContentType=content_type,
            ContentDisposition=f"inline; filename*=UTF-8''{quote(filename)}",
        )
    except Exception as exc:
        print(f"s3_upload_failed: {type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
        return json_response({"error": "File could not upload to storage."}, 502)

    return json_response(
        {
            "fileName": filename,
            "fileType": content_type,
            "fileSize": len(data),
            "fileKey": key,
            "fileUrl": document_file_url(key),
            "storage": "s3",
        },
        201,
    )


@app.get("/api/documents/file")
def document_file():
    user, error = require_user()
    if error:
        return error
    key = require_document_key_for_user(user, request.args.get("key", ""))
    if not key:
        return json_response({"error": "File key is invalid."}, 404)
    if not storage_configured():
        return json_response({"error": "S3 storage is not configured."}, 503)
    try:
        obj = storage_client().get_object(Bucket=storage_bucket(), Key=key)
        body = obj["Body"].read()
    except Exception as exc:
        print(f"s3_download_failed: {type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
        return json_response({"error": "File could not be loaded from storage."}, 404)

    stored_name = key.rsplit("/", 1)[-1]
    filename = safe_upload_filename(stored_name.split("-", 1)[-1] or "document")
    content_type = obj.get("ContentType") or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    disposition = "attachment" if request.args.get("download") == "1" else "inline"
    response = make_response(body, 200)
    response.headers["content-type"] = content_type
    response.headers["content-disposition"] = f"{disposition}; filename*=UTF-8''{quote(filename)}"
    response.headers["cache-control"] = "private, max-age=300"
    return response


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def static_app(path):
    target = DIST_DIR / path
    if path and target.exists() and target.is_file():
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(DIST_DIR, "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
