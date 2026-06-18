import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiArrowUpRight as ArrowUpRight,
  FiBarChart2 as BarChart3,
  FiBell as Bell,
  FiBookOpen as BookOpen,
  FiBookmark as Bookmark,
  FiBookmark as BookmarkCheck,
  FiBriefcase as BriefcaseBusiness,
  FiBriefcase as Building2,
  FiCalendar as CalendarDays,
  FiCheck as Check,
  FiCheckCircle as CheckCircle2,
  FiCheckSquare as CheckSquare2,
  FiChevronDown as ChevronDown,
  FiChevronLeft as ChevronLeft,
  FiChevronRight as ChevronRight,
  FiCircle as CircleDot,
  FiClock as Clock3,
  FiColumns as Columns3,
  FiCopy as Copy,
  FiDownload as Download,
  FiEye as Eye,
  FiExternalLink as ExternalLink,
  FiFileText as FileText,
  FiFilter as Filter,
  FiCode as FlaskConical,
  FiGift as Gift,
  FiAward as GraduationCap,
  FiHome as Home,
  FiGrid as KanbanSquare,
  FiCheckSquare as ListChecks,
  FiMail as Mail,
  FiMapPin as MapPin,
  FiMenu as Menu,
  FiMoreHorizontal as MoreHorizontal,
  FiEdit3 as NotebookPen,
  FiEdit2 as Pencil,
  FiPlus as Plus,
  FiRefreshCcw as RefreshCcw,
  FiSearch as Search,
  FiSend as Send,
  FiSettings as Settings,
  FiShield as ShieldCheck,
  FiZap as Sparkles,
  FiTarget as Target,
  FiTrash2 as Trash2,
  FiAward as Trophy,
  FiUpload as Upload,
  FiUser as UserRound,
  FiUsers as Users,
  FiX as X,
} from "react-icons/fi";
import {
  SiAirbnb,
  SiBytedance,
  SiCisco,
  SiDatabricks,
  SiGoogle,
  SiMeta,
  SiNvidia,
  SiOpenai,
  SiPaloaltonetworks,
  SiSnowflake,
  SiStripe,
} from "react-icons/si";
import { FaAmazon, FaMicrosoft } from "react-icons/fa";

const STORAGE_KEY = "career-tracker-workspace-v1";
const AUTH_TOKEN_KEY = "career-tracker-auth-token-v1";
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || "48292852686-95nqueviim5bflqo4upq3bta29bkamej.apps.googleusercontent.com";

const stages = [
  {
    id: "saved",
    label: "Saved",
    accent: "green",
    icon: Bookmark,
    empty: "Save roles that fit your target cycle.",
  },
  {
    id: "applied",
    label: "Applied",
    accent: "blue",
    icon: Send,
    empty: "Log every application you submit.",
  },
  {
    id: "oa",
    label: "OA",
    accent: "indigo",
    icon: FlaskConical,
    empty: "Track coding challenge deadlines here.",
  },
  {
    id: "interview",
    label: "Interview",
    accent: "purple",
    icon: Users,
    empty: "Prep notes and recruiter follow-ups land here.",
  },
  {
    id: "offer",
    label: "Offer",
    accent: "amber",
    icon: Trophy,
    empty: "Celebrate, compare, and negotiate offers.",
  },
];

const navItems = [
  { label: "Dashboard", icon: Home },
  { label: "Pipeline", icon: KanbanSquare },
  { label: "Search", icon: Search },
  { label: "Companies", icon: Building2 },
  { label: "Contacts", icon: Users },
  { label: "Calendar", icon: CalendarDays },
  { label: "Tasks", icon: CheckSquare2 },
  { label: "Documents", icon: FileText },
  { label: "Analytics", icon: BarChart3 },
  { label: "Resources", icon: BookOpen },
  { label: "Settings", icon: Settings },
];

const companyIcons = {
  NVIDIA: { icon: SiNvidia, className: "brand-nvidia" },
  Meta: { icon: SiMeta, className: "brand-meta" },
  Databricks: { icon: SiDatabricks, className: "brand-databricks" },
  Amazon: { icon: FaAmazon, className: "brand-amazon" },
  Google: { icon: SiGoogle, className: "brand-google" },
  Snowflake: { icon: SiSnowflake, className: "brand-snowflake" },
  Stripe: { icon: SiStripe, className: "brand-stripe" },
  Microsoft: { icon: FaMicrosoft, className: "brand-microsoft" },
  "Palo Alto Networks": { icon: SiPaloaltonetworks, className: "brand-palo" },
  Cisco: { icon: SiCisco, className: "brand-cisco" },
  ByteDance: { icon: SiBytedance, className: "brand-bytedance" },
  OpenAI: { icon: SiOpenai, className: "brand-openai" },
  Airbnb: { icon: SiAirbnb, className: "brand-airbnb" },
};

const resourceLinks = [
  { title: "Zero to Offer", type: "Guide", source: "Pitt CSC", url: "https://pittcs.wiki/guides/zero-to-offer" },
  { title: "Tech Interview Handbook", type: "Prep", source: "Yangshun Tay", url: "https://www.techinterviewhandbook.org/" },
  { title: "Simplify Summer 2026 List", type: "Jobs", source: "SimplifyJobs", url: "https://github.com/SimplifyJobs/Summer2026-Internships" },
  { title: "New Grad Positions", type: "Jobs", source: "SimplifyJobs", url: "https://github.com/SimplifyJobs/New-Grad-Positions" },
];

const profilePresets = [
  { id: "portrait", label: "Portrait", src: "/assets/profile-presets/avatar-portrait.png" },
  { id: "workspace", label: "Workspace", src: "/assets/profile-presets/avatar-workspace.png" },
  { id: "abstract", label: "Abstract", src: "/assets/profile-presets/avatar-abstract.svg" },
  { id: "signal", label: "Signal", src: "/assets/profile-presets/avatar-signal.svg" },
];

const emptyStoredData = {
  jobs: [],
  tasks: [],
  contacts: [],
  documents: [],
  goal: null,
};

const blankGoal = { target: "", deadline: "", label: "" };
const documentTypeOptions = ["Resume", "Cover Letter", "Portfolio", "Transcript", "Referral Note", "Template", "Other"];
const documentStatusOptions = ["Draft", "Needs Review", "Ready", "Submitted", "Archived"];
const embeddedDocumentLimit = 520_000;

const blankDocumentDraft = {
  name: "",
  type: "Resume",
  status: "Draft",
  target: "General",
  url: "",
  version: "v1",
  owner: "",
  notes: "",
  fileName: "",
  fileType: "",
  fileSize: 0,
  fileData: "",
};

function defaultProfile(overrides = {}) {
  return {
    name: "Candidate",
    program: "Career Profile",
    graduation: "2026-2027 cycle",
    visa: "Internship + New Grad",
    avatar: profilePresets[0].src,
    ...overrides,
  };
}

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CT";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function normalizeDocument(document = {}) {
  return {
    id: document.id || `document-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: document.name || "Untitled document",
    type: document.type || document.kind || "Resume",
    status: document.status || "Draft",
    target: document.target || document.job || "General",
    url: document.url || "",
    version: document.version || "v1",
    owner: document.owner || "",
    notes: document.notes || "",
    fileName: document.fileName || "",
    fileType: document.fileType || "",
    fileSize: Number(document.fileSize || 0),
    fileData: document.fileData || "",
    updated: document.updated || new Date().toISOString(),
  };
}

function formatBytes(value = 0) {
  const bytes = Number(value || 0);
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isOpenableUrl(value = "") {
  return /^https?:\/\//i.test(String(value).trim());
}

function getEmbeddableDocumentUrl(value = "") {
  const rawUrl = String(value || "").trim();
  if (!isOpenableUrl(rawUrl)) return "";
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "drive.google.com") {
      const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
      const id = fileMatch?.[1] || parsed.searchParams.get("id");
      if (id) return `https://drive.google.com/file/d/${id}/preview`;
    }
    if (host === "docs.google.com") {
      const docMatch = parsed.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([^/]+)/);
      if (docMatch) return `https://docs.google.com/${docMatch[1]}/d/${docMatch[2]}/preview`;
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

function getDocumentPreviewMode(document = {}) {
  const fileType = String(document.fileType || "").toLowerCase();
  const fileName = String(document.fileName || "").toLowerCase();
  if (document.fileData) {
    if (fileType.startsWith("image/")) return "image";
    if (fileType === "application/pdf" || fileName.endsWith(".pdf")) return "frame";
    if (fileType.startsWith("text/") || /\.(csv|json|md|txt)$/i.test(fileName)) return "frame";
    return "unsupported-file";
  }
  if (isOpenableUrl(document.url)) return "link";
  return "empty";
}

function getDocumentPreviewSource(document = {}) {
  if (document.fileData) return document.fileData;
  return getEmbeddableDocumentUrl(document.url);
}

function readAuthToken() {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function saveAuthToken(token) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearAuthToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

function readInitialAuthToken() {
  try {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const redirectToken = hashParams.get("auth_token") || "";
    if (!redirectToken) return readAuthToken();
    saveAuthToken(redirectToken);
    hashParams.delete("auth_token");
    const nextHash = hashParams.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${nextHash ? `#${nextHash}` : ""}`,
    );
    return redirectToken;
  } catch {
    return readAuthToken();
  }
}

function readAuthRedirectMessage() {
  try {
    const errorCode = new URLSearchParams(window.location.search).get("auth_error");
    const messages = {
      google_csrf: "Google sign-in security check failed. Refresh and try again.",
      google_missing_credential: "Google did not return a sign-in credential. Please try again.",
      google_missing_token: "Google signed in, but the browser did not receive the app session. Please try again.",
      google_verify: "Google sign-in could not verify this account. Please try again.",
      google_session: "Google sign-in connected, but the database session could not be created.",
      browser_storage: "Your browser blocked local session storage. Enable site storage and try again.",
      google: "Google sign-in could not finish. Please try again.",
    };
    return messages[errorCode] || "";
  } catch {
    return "";
  }
}

async function apiRequest(path, { method = "GET", body, token = readAuthToken() } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : {};

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }
  return payload;
}

function serializeWorkspace({ jobs, tasks, contacts, documents, goal }) {
  return {
    jobs,
    tasks: tasks.map(({ icon, ...task }) => task),
    contacts,
    documents,
    goal,
  };
}

function normalizeWorkspace(workspace = emptyStoredData) {
  return {
    jobs: Array.isArray(workspace.jobs) ? workspace.jobs : [],
    tasks: Array.isArray(workspace.tasks) ? workspace.tasks.map((task) => ({ ...task, icon: CheckSquare2 })) : [],
    contacts: Array.isArray(workspace.contacts) ? workspace.contacts : [],
    documents: Array.isArray(workspace.documents) ? workspace.documents.map(normalizeDocument) : [],
    goal: workspace.goal && typeof workspace.goal === "object" ? workspace.goal : blankGoal,
  };
}

function cacheWorkspace(workspace) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}

function readStoredData() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return emptyStoredData;
    const parsed = JSON.parse(stored);
    return {
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      goal: parsed.goal && typeof parsed.goal === "object" ? parsed.goal : null,
    };
  } catch {
    return emptyStoredData;
  }
}

function loadJobs() {
  return readStoredData().jobs;
}

function loadTasks() {
  return readStoredData().tasks.map((task) => ({
    ...task,
    icon: CheckSquare2,
  }));
}

function loadContacts() {
  return readStoredData().contacts;
}

function loadDocuments() {
  return readStoredData().documents.map(normalizeDocument);
}

function loadGoal() {
  const goal = readStoredData().goal;
  if (!goal) return blankGoal;
  return {
    target: goal.target ? String(goal.target) : "",
    deadline: goal.deadline || "",
    label: goal.label || "",
  };
}

function createSprintLabels(count = 3) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: count }, (_, index) => {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + index * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
    return `${fmt.format(weekStart)} - ${fmt.format(weekEnd)}, ${weekEnd.getFullYear()}`;
  });
}

function formatDate(value, options = { month: "short", day: "numeric" }) {
  if (!value) return "-";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

function daysUntil(value) {
  const today = new Date();
  const deadline = new Date(`${value}T12:00:00`);
  const diff = deadline.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

function isRenderableIcon(icon) {
  return typeof icon === "function" || (typeof icon === "object" && icon !== null && "$$typeof" in icon);
}

function CompanyLogo({ company }) {
  const brand = companyIcons[company];
  const Icon = isRenderableIcon(brand?.icon) ? brand.icon : Building2;

  return (
    <span className={classNames("company-logo", brand?.className || "brand-generic")} aria-hidden="true">
      <Icon />
    </span>
  );
}

function IconButton({ label, children, className = "", ...props }) {
  return (
    <button className={classNames("icon-button", className)} type="button" aria-label={label} {...props}>
      {children}
    </button>
  );
}

function DocumentPreviewPanel({ document }) {
  const mode = getDocumentPreviewMode(document);
  const source = getDocumentPreviewSource(document);

  if (mode === "image") {
    return (
      <div className="document-preview-canvas">
        <img src={source} alt={`${document.name} preview`} />
      </div>
    );
  }

  if ((mode === "frame" || mode === "link") && source) {
    return (
      <>
        <iframe
          className="document-preview-frame"
          src={source}
          title={`${document.name} preview`}
          referrerPolicy="no-referrer-when-downgrade"
        />
        {mode === "link" && (
          <p className="document-preview-note">
            Some sources block embedded previews. Use Open Source if this pane stays blank.
          </p>
        )}
      </>
    );
  }

  return (
    <div className="document-preview-empty">
      <FileText size={32} aria-hidden="true" />
      <strong>Preview not available</strong>
      <span>
        {document.fileName
          ? "This file type cannot be rendered in the browser. Download it to view the full document."
          : "Attach a PDF, image, text file, or add a document link to preview it here."}
      </span>
    </div>
  );
}

function getOpportunityRoleType(job = {}) {
  const text = `${job.role || ""} ${job.season || ""} ${(job.tags || []).join(" ")}`.toLowerCase();
  if (text.includes("new grad") || text.includes("graduate") || text.includes("entry level") || text.includes("early career")) {
    return "New Grad";
  }
  if (text.includes("intern") || text.includes("co-op")) return "Internship";
  return job.season === "New Grad" ? "New Grad" : "Role";
}

function getOpportunityRequirementItems(job = {}) {
  const items = [
    { label: "Role Type", value: getOpportunityRoleType(job) },
    { label: "Season", value: job.season || "Not listed" },
    { label: "Location", value: job.location || "Not listed" },
    { label: "Work Mode", value: job.mode || "Not listed" },
    { label: "Sponsorship", value: job.sponsorship === "Unknown" ? "Verify on posting" : job.sponsorship },
    { label: "Posted", value: job.posted || "Not listed" },
  ];
  if (job.deadline) items.push({ label: "Deadline", value: formatDate(job.deadline) });
  if (job.requirements) items.push({ label: "Listed Term", value: job.requirements });
  items.push({ label: "Source", value: job.source || "Public feed" });
  return items;
}

function getOpportunitySignals(job = {}) {
  const text = `${job.role || ""} ${job.summary || ""} ${job.description || ""} ${(job.tags || []).join(" ")}`.toLowerCase();
  const signals = [];
  if (text.includes("software")) signals.push("Software engineering keyword match");
  if (text.includes("machine learning") || /\bml\b/.test(text) || text.includes(" ai ")) signals.push("ML / AI signal");
  if (text.includes("data")) signals.push("Data signal");
  if (text.includes("backend") || text.includes("platform") || text.includes("systems")) signals.push("Backend, platform, or systems signal");
  if ((job.season || "").match(/2026 Fall|2027|New Grad/i)) signals.push("Matches selected cycle");
  if ((job.mode || "").toLowerCase() === "remote") signals.push("Remote-friendly listing");
  if (!signals.length) signals.push("General role metadata match");
  return signals.slice(0, 5);
}

function OpportunityPreviewModal({ job, imported, onClose, onImport }) {
  const requirementItems = getOpportunityRequirementItems(job);
  const signals = getOpportunitySignals(job);
  const description = String(job.description || job.summary || "").trim();
  const hasSource = isOpenableUrl(job.sourceUrl);

  return (
    <div
      className="modal-backdrop opportunity-preview-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${job.role} preview`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="opportunity-preview-modal">
        <div className="opportunity-preview-head">
          <CompanyLogo company={job.company} />
          <span>
            <strong>{job.role}</strong>
            <small>{job.company} · {job.location}</small>
          </span>
          <div className="opportunity-preview-actions">
            {hasSource ? (
              <a className="secondary-button" href={job.sourceUrl} target="_blank" rel="noreferrer">
                Apply <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            ) : (
              <button className="secondary-button" type="button" disabled>
                Apply
              </button>
            )}
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                onImport(job);
                onClose();
              }}
              disabled={imported}
            >
              {imported ? "Imported" : "Import"}
            </button>
            <button className="icon-button" type="button" onClick={onClose} aria-label="Close preview">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="opportunity-preview-body">
          <section className="opportunity-preview-summary">
            <div>
              <span>Match</span>
              <strong>{job.match || "-"}%</strong>
            </div>
            <div>
              <span>Source</span>
              <strong>{job.source || "Public feed"}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{imported ? "Imported" : "Not imported"}</strong>
            </div>
          </section>

          <section className="opportunity-preview-section">
            <h3>Requirements and conditions</h3>
            <div className="opportunity-requirement-grid">
              {requirementItems.map((item) => (
                <span key={`${item.label}-${item.value}`}>
                  {item.label}
                  <strong>{item.value}</strong>
                </span>
              ))}
            </div>
          </section>

          <section className="opportunity-preview-section">
            <h3>Match signals</h3>
            <div className="opportunity-signal-list">
              {signals.map((signal) => (
                <span key={signal}>
                  <Check size={13} aria-hidden="true" />
                  {signal}
                </span>
              ))}
            </div>
          </section>

          <section className="opportunity-preview-section">
            <h3>Posting preview</h3>
            {description ? (
              <p>{description}</p>
            ) : (
              <p>
                This source does not publish a full job description in the feed. Open the original posting to verify
                degree, graduation date, sponsorship, location, and technical requirements before applying.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, caption, icon: Icon, tone = "green" }) {
  return (
    <article className="metric-card">
      <span className={classNames("metric-icon", `tone-${tone}`)} aria-hidden="true">
        <Icon size={20} strokeWidth={2} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{caption}</span>
      </div>
    </article>
  );
}

function StageSelect({ value, onChange, label = "Move stage" }) {
  return (
    <label className="stage-select">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {stages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </label>
  );
}

function JobCard({ job, active, onSelect, onStageChange, onToggleSaved, onDragStart }) {
  const urgent = daysUntil(job.deadline) <= 14;

  return (
    <article
      className={classNames("job-card", active && "is-active", job.priority && "is-priority")}
      draggable
      onDragStart={() => onDragStart(job.id)}
      onClick={() => onSelect(job.id)}
      aria-label={`${job.company} ${job.role}`}
    >
      <div className="job-card-top">
        <CompanyLogo company={job.company} />
        <span className="match-pill">{job.match}</span>
      </div>
      <div className="job-card-main">
        <h3>{job.company}</h3>
        <p>{job.role}</p>
        <span>
          {job.season} <CircleDot size={8} aria-hidden="true" /> {formatDate(job.deadline)}
        </span>
      </div>
      <div className="job-card-actions">
        <IconButton label={job.priority ? "Remove priority" : "Mark priority"} onClick={(event) => {
          event.stopPropagation();
          onToggleSaved(job.id);
        }}>
          {job.priority ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
        </IconButton>
        <IconButton label={`Open ${job.company} details`} onClick={(event) => {
          event.stopPropagation();
          onSelect(job.id);
        }}>
          <ExternalLink size={15} />
        </IconButton>
        <StageSelect
          value={job.stage}
          label={`Move ${job.company}`}
          onChange={(stageId) => onStageChange(job.id, stageId)}
        />
      </div>
      {urgent && (
        <div className="deadline-chip">
          <Clock3 size={12} aria-hidden="true" />
          Due soon
        </div>
      )}
    </article>
  );
}

function StageColumn({
  stage,
  jobs,
  selectedId,
  onSelect,
  onStageChange,
  onToggleSaved,
  onDrop,
  onDragStart,
  onAdd,
}) {
  const Icon = stage.icon;

  return (
    <section
      className={classNames("stage-column", `stage-${stage.accent}`)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDrop(stage.id)}
      aria-labelledby={`${stage.id}-heading`}
    >
      <div className="stage-header">
        <div>
          <Icon size={18} aria-hidden="true" />
          <h2 id={`${stage.id}-heading`}>{stage.label}</h2>
          <span>{jobs.length}</span>
        </div>
        <IconButton label={`Add job to ${stage.label}`} onClick={() => onAdd(stage.id)}>
          <Plus size={16} />
        </IconButton>
      </div>
      <div className="stage-list">
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            active={job.id === selectedId}
            onSelect={onSelect}
            onStageChange={onStageChange}
            onToggleSaved={onToggleSaved}
            onDragStart={onDragStart}
          />
        ))}
        {jobs.length === 0 && <p className="empty-stage">{stage.empty}</p>}
      </div>
      <button className="add-inline" type="button" onClick={() => onAdd(stage.id)}>
        <Plus size={15} aria-hidden="true" />
        Add job
      </button>
    </section>
  );
}

function ProgressGoal({ appliedCount, goal = blankGoal, onGoalChange }) {
  const safeGoal = goal || blankGoal;
  const [draft, setDraft] = useState(safeGoal);
  const target = Number(safeGoal.target || 0);
  const hasGoal = target > 0;
  const percent = hasGoal ? Math.min(100, Math.round((appliedCount / target) * 100)) : 0;
  const remaining = hasGoal ? Math.max(0, target - appliedCount) : 0;
  const label = safeGoal.label?.trim() || "applications";
  const deadlineLabel = safeGoal.deadline ? ` by ${formatDate(safeGoal.deadline)}` : "";

  useEffect(() => {
    setDraft(safeGoal);
  }, [safeGoal]);

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function saveGoal(event) {
    event.preventDefault();
    const nextTarget = Math.max(0, Number(draft.target || 0));
    onGoalChange({
      target: nextTarget ? String(nextTarget) : "",
      deadline: draft.deadline || "",
      label: draft.label.trim(),
    });
  }

  return (
    <article className="goal-card">
      <div className="goal-card-title">
        <strong>{hasGoal ? `Goal: ${target} ${label}${deadlineLabel}` : "Set your application goal"}</strong>
        <Target size={16} aria-hidden="true" />
      </div>
      {hasGoal ? (
        <>
          <div className="goal-meter" aria-label={`${appliedCount} applications toward ${target} target`}>
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className="goal-stats">
            <span>
              <strong>{appliedCount}</strong>
              Applied
            </span>
            <span>
              <strong>{remaining}</strong>
              To go
            </span>
            <span>
              <strong>{target}</strong>
              Target
            </span>
          </div>
        </>
      ) : (
        <p className="goal-empty-copy">Choose a target and deadline; progress updates automatically from your pipeline.</p>
      )}
      <form className="goal-form" onSubmit={saveGoal}>
        <label>
          <span>Target</span>
          <input
            type="number"
            min="1"
            value={draft.target}
            onChange={(event) => updateDraft("target", event.target.value)}
            placeholder="40"
            aria-label="Goal target applications"
          />
        </label>
        <label>
          <span>Deadline</span>
          <input
            value={draft.deadline}
            onChange={(event) => updateDraft("deadline", event.target.value)}
            placeholder="YYYY-MM-DD"
            aria-label="Goal deadline"
          />
        </label>
        <label>
          <span>Label</span>
          <input
            value={draft.label}
            onChange={(event) => updateDraft("label", event.target.value)}
            placeholder="quality applications"
            aria-label="Goal label"
          />
        </label>
        <div className="goal-form-actions">
          <button className="primary-button" type="submit">
            Save
          </button>
          <button className="secondary-button" type="button" onClick={() => onGoalChange({ target: "", deadline: "", label: "" })}>
            Clear
          </button>
        </div>
      </form>
    </article>
  );
}

function DetailPanel({ job, onClose, onStageChange, onUpdateNotes, onCompleteNextStep }) {
  const [tab, setTab] = useState("overview");

  if (!job) return null;

  return (
    <section className="detail-panel" aria-label={`${job.company} details`}>
      <div className="detail-top">
        <div className="detail-company">
          <CompanyLogo company={job.company} />
          <div>
            <h2>{job.company}</h2>
            <p>
              {job.role} <span>{job.match} Match</span>
            </p>
            <div className="detail-tags">
              <span>{job.season}</span>
              <span>{job.location}</span>
              <span>{job.mode}</span>
            </div>
          </div>
        </div>
        <div className="detail-actions">
          <StageSelect value={job.stage} onChange={(stageId) => onStageChange(job.id, stageId)} />
          <IconButton label="Close details" onClick={onClose}>
            <X size={17} />
          </IconButton>
        </div>
      </div>

      <div className="detail-links" aria-label="Job source links">
        <a
          href={job.sourceUrl || "#"}
          target={job.sourceUrl ? "_blank" : undefined}
          rel={job.sourceUrl ? "noreferrer" : undefined}
          onClick={(event) => {
            if (!job.sourceUrl) event.preventDefault();
          }}
        >
          {job.source} <ArrowUpRight size={13} aria-hidden="true" />
        </a>
        <a
          href={job.sourceUrl || "#"}
          target={job.sourceUrl ? "_blank" : undefined}
          rel={job.sourceUrl ? "noreferrer" : undefined}
          onClick={(event) => {
            if (!job.sourceUrl) event.preventDefault();
          }}
        >
          Job Posting <ArrowUpRight size={13} aria-hidden="true" />
        </a>
      </div>

      <div className="detail-tabs" role="tablist" aria-label="Detail sections">
        {["overview", "notes", "contacts", "history"].map((item) => (
          <button
            key={item}
            className={tab === item ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="detail-grid">
        <article className="detail-stat">
          <span>Deadline</span>
          <strong>{formatDate(job.deadline, { month: "short", day: "numeric", year: "numeric" })}</strong>
        </article>
        <article className="detail-stat">
          <span>Posted</span>
          <strong>{formatDate(job.posted)}</strong>
        </article>
        <article className="detail-stat">
          <span>Status</span>
          <strong>{job.statusDate}</strong>
        </article>
        <article className="detail-stat">
          <span>Mode</span>
          <strong>{job.mode}</strong>
        </article>
      </div>

      {tab === "overview" && (
        <div className="detail-content-grid">
          <article>
            <h3>Role Summary</h3>
            <p>{job.summary}</p>
            <div className="tag-list">
              {job.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </article>
          <article>
            <h3>My Notes</h3>
            <ul>
              {job.notes.split(". ").map((note) => (
                <li key={note}>{note.replace(/\.$/, "")}</li>
              ))}
            </ul>
            <button className="text-button" type="button" onClick={() => setTab("notes")}>
              Edit Notes
            </button>
          </article>
          <article>
            <h3>Next Step</h3>
            <p>{job.nextStep}</p>
            <button className="text-button" type="button" onClick={() => onCompleteNextStep(job.id)}>
              Mark as Complete
            </button>
          </article>
        <article>
          <h3>Recruiter / Contact</h3>
          {job.contact ? (
            <div className="contact-row">
              <span className="contact-avatar">{job.contact.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{job.contact}</strong>
                <p>{job.contactRole || "Contact"}</p>
                {job.contactEmail ? <a href={`mailto:${job.contactEmail}`}>{job.contactEmail}</a> : <span>No email yet</span>}
              </div>
            </div>
          ) : (
            <p>No contact saved for this role yet.</p>
          )}
        </article>
      </div>
      )}

      {tab === "notes" && (
        <div className="notes-editor">
          <label htmlFor="job-notes">Notes for {job.company}</label>
          <textarea id="job-notes" value={job.notes} onChange={(event) => onUpdateNotes(job.id, event.target.value)} />
          <p>Synced to your database workspace.</p>
        </div>
      )}

      {tab === "contacts" && (
        <div className="contact-panel">
          <Mail size={18} aria-hidden="true" />
          <div>
            <h3>{job.contact || "No contact saved"}</h3>
            <p>{job.contactRole || "Add a recruiter or referral in Contacts."}</p>
            {job.contactEmail ? <a href={`mailto:${job.contactEmail}`}>{job.contactEmail}</a> : <span>No email yet</span>}
          </div>
        </div>
      )}

      {tab === "history" && (
        <ol className="history-list">
          <li>{job.statusDate}</li>
          <li>{job.source} added to tracker</li>
          <li>Matched against your profile</li>
        </ol>
      )}
    </section>
  );
}

function AddJobModal({ open, defaultStage, onClose, onAdd }) {
  const [form, setForm] = useState({
    company: "",
    role: "",
    season: "2026 Fall",
    stage: defaultStage || "saved",
    deadline: "",
    location: "",
    mode: "Hybrid",
    sourceUrl: "",
  });

  useEffect(() => {
    if (open) {
      setForm((current) => ({ ...current, stage: defaultStage || "saved" }));
    }
  }, [defaultStage, open]);

  if (!open) return null;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;

    onAdd({
      id: `${form.company}-${form.role}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      company: form.company.trim(),
      role: form.role.trim(),
      season: form.season,
      deadline: form.deadline,
      location: form.location,
      mode: form.mode,
      sponsorship: "Unknown",
      stage: form.stage,
      match: 76,
      source: "Manual",
      sourceUrl: form.sourceUrl.trim(),
      posted: new Date().toISOString().slice(0, 10),
      statusDate: "Added today",
      priority: false,
      contact: "",
      contactRole: "",
      contactEmail: "",
      summary: "New tracked role. Add details after reviewing the posting.",
      notes: "",
      tags: ["New", form.season],
      nextStep: "Review posting and tailor resume.",
    });

    setForm({
      company: "",
      role: "",
      season: "2026 Fall",
      stage: defaultStage || "saved",
      deadline: "",
      location: "",
      mode: "Hybrid",
      sourceUrl: "",
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="add-job-title">
        <div className="modal-head">
          <div>
            <p>New opportunity</p>
            <h2 id="add-job-title">Add internship</h2>
          </div>
          <IconButton label="Close add job modal" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <label>
            Company
            <input value={form.company} onChange={(event) => updateField("company", event.target.value)} placeholder="Airbnb" />
          </label>
          <label>
            Role
            <input value={form.role} onChange={(event) => updateField("role", event.target.value)} placeholder="Software Engineer Intern" />
          </label>
          <label>
            Season
            <select value={form.season} onChange={(event) => updateField("season", event.target.value)}>
              <option>2026 Fall</option>
              <option>2027</option>
              <option>New Grad</option>
            </select>
          </label>
          <label>
            Stage
            <select value={form.stage} onChange={(event) => updateField("stage", event.target.value)}>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Deadline
            <input type="date" value={form.deadline} onChange={(event) => updateField("deadline", event.target.value)} />
          </label>
          <label>
            Location
            <input value={form.location} onChange={(event) => updateField("location", event.target.value)} placeholder="Seattle, WA" />
          </label>
          <label>
            Posting URL
            <input value={form.sourceUrl} onChange={(event) => updateField("sourceUrl", event.target.value)} placeholder="https://..." />
          </label>
          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" type="submit">
              <Plus size={16} aria-hidden="true" />
              Add Job
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ViewHeader({ eyebrow, title, children }) {
  return (
    <section className="view-header">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ icon: Icon = Search, title, text, children }) {
  return (
    <div className="empty-state">
      <Icon size={22} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{text}</span>
      {children}
    </div>
  );
}

function ProfileImagePicker({ value, onChange, compact = false }) {
  return (
    <div className={classNames("profile-image-picker", compact && "is-compact")} aria-label="Profile image presets">
      {profilePresets.map((preset) => (
        <button
          key={preset.id}
          className={preset.src === value ? "is-selected" : ""}
          type="button"
          onClick={() => onChange(preset.src)}
          aria-label={`Use ${preset.label} profile image`}
        >
          <img src={preset.src} alt="" />
          <span>{preset.label}</span>
        </button>
      ))}
    </div>
  );
}

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function GoogleSignInButton({ disabled = false }) {
  const buttonRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function renderGoogleButton() {
      try {
        await loadGoogleIdentityScript();
        if (cancelled || !buttonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: "redirect",
          login_uri: `${window.location.origin}/api/auth/google/redirect`,
        });
        buttonRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          type: "standard",
          shape: "rectangular",
          text: "continue_with",
          width: Math.min(buttonRef.current.clientWidth || 360, 420),
        });
        setReady(true);
      } catch {
        setReady(false);
      }
    }

    renderGoogleButton();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={classNames("google-auth-slot", disabled && "is-disabled", !ready && "is-loading")}>
      <div ref={buttonRef} />
      {!ready && <span>Loading Google sign-in</span>}
    </div>
  );
}

function AuthScreen({ onLogin, onRegister }) {
  const [mode, setMode] = useState("register");
  const [draft, setDraft] = useState({
    name: "",
    email: "",
    password: "",
    avatar: profilePresets[0].src,
  });
  const [error, setError] = useState(readAuthRedirectMessage);
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    if (!draft.email.trim() || !draft.password) {
      setError("Email and password are required.");
      return;
    }
    if (isRegister && draft.password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }

    setLoading(true);
    const result = isRegister ? await onRegister(draft) : await onLogin(draft);
    if (result?.error) setError(result.error);
    setLoading(false);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-visual">
          <img src={draft.avatar} alt="" />
          <div>
            <strong>Career Tracker</strong>
            <span>Internship + New Grad</span>
          </div>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <div>
            <p>{isRegister ? "Create account" : "Welcome back"}</p>
            <h1>{isRegister ? "Register your tracker" : "Log in to your tracker"}</h1>
          </div>
          {isRegister && (
            <label>
              Name
              <input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Your name" />
            </label>
          )}
          <label>
            Email
            <input value={draft.email} onChange={(event) => update("email", event.target.value)} placeholder="you@example.com" />
          </label>
          <label>
            Password
            <input
              type="password"
              value={draft.password}
              onChange={(event) => update("password", event.target.value)}
              placeholder="Database account password"
            />
          </label>
          {isRegister && <ProfileImagePicker value={draft.avatar} onChange={(avatar) => update("avatar", avatar)} compact />}
          {error && <span className="auth-error">{error}</span>}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Connecting" : isRegister ? "Create Account" : "Log In"}
          </button>
          <div className="auth-divider">
            <span>or</span>
          </div>
          <GoogleSignInButton disabled={loading} />
          <button
            className="text-button auth-switch"
            type="button"
            onClick={() => {
              setMode(isRegister ? "login" : "register");
              setError("");
            }}
          >
            {isRegister ? "Already have an account? Log in" : "Need an account? Register"}
          </button>
        </form>
      </section>
    </main>
  );
}

function LiveSearchView({
  liveJobs,
  liveStatus,
  liveQuery,
  liveSeason,
  liveRemote,
  liveTotal,
  liveFilteredTotal,
  liveLimit,
  setLiveQuery,
  setLiveSeason,
  setLiveRemote,
  onLoadMore,
  onClearFilters,
  onRefresh,
  onImport,
  importedIds,
  fetchedAt,
  sources,
}) {
  const hasActiveFilters = Boolean(liveQuery.trim()) || liveSeason !== "all" || liveRemote !== "all";
  const [previewJob, setPreviewJob] = useState(null);

  useEffect(() => {
    if (!previewJob) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setPreviewJob(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewJob]);

  return (
    <section className="view-shell live-search-view">
      <ViewHeader eyebrow="Live Search" title="Real internship feed">
        <button className="primary-button" type="button" onClick={() => onRefresh(true)} disabled={liveStatus === "loading"}>
          <RefreshCcw size={16} aria-hidden="true" />
          {liveStatus === "loading" ? "Fetching" : "Refresh Feed"}
        </button>
      </ViewHeader>

      <div className="live-toolbar">
        <label className="search-box live-search-box">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search live opportunities</span>
          <input value={liveQuery} onChange={(event) => setLiveQuery(event.target.value)} placeholder="Software, ML, data, company..." />
        </label>
        <label>
          Season
          <select value={liveSeason} onChange={(event) => setLiveSeason(event.target.value)}>
            <option value="all">All</option>
            <option value="fall2026">2026 Fall</option>
            <option value="2027">2027</option>
            <option value="newgrad">New Grad</option>
          </select>
        </label>
        <label>
          Mode
          <select value={liveRemote} onChange={(event) => setLiveRemote(event.target.value)}>
            <option value="all">All</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="on-site">On-site</option>
          </select>
        </label>
        {hasActiveFilters && (
          <button className="secondary-button clear-filter-button" type="button" onClick={onClearFilters}>
            <X size={15} aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      <div className="source-row">
        <article>
          <strong>{liveJobs.length}</strong>
          <span>shown now</span>
        </article>
        <article>
          <strong>{liveFilteredTotal}</strong>
          <span>matching filters</span>
        </article>
        <article>
          <strong>{liveTotal}</strong>
          <span>indexed roles</span>
        </article>
        <article>
          <strong>{sources?.length || 0}</strong>
          <span>public sources</span>
        </article>
      </div>

      <div className="filter-summary">
        <span>
          {hasActiveFilters
            ? `Showing ${liveFilteredTotal} matches from ${liveTotal} indexed roles. Last fetch ${fetchedAt ? formatDate(fetchedAt.slice(0, 10), { month: "short", day: "numeric" }) : "-"}`
            : `Showing the top ${liveJobs.length} live roles from ${liveTotal} indexed roles.`}
        </span>
      </div>

      {liveStatus === "error" && (
        <div className="no-results">
          <ShieldCheck size={22} aria-hidden="true" />
          <strong>Live feed could not refresh</strong>
          <span>The pipeline still works with saved jobs. Try refresh again.</span>
        </div>
      )}

      {liveStatus !== "loading" && liveJobs.length === 0 && (
        <EmptyState
          icon={Search}
          title="No live roles yet"
          text="Refresh the feed or broaden the filters. The pipeline stays empty until you import or add roles."
        />
      )}

      <div className="opportunity-list">
        {liveJobs.map((job) => {
          const imported = importedIds.has(job.id);
          const hasSource = isOpenableUrl(job.sourceUrl);
          return (
            <article key={job.id} className="opportunity-row">
              <CompanyLogo company={job.company} />
              <div className="opportunity-main">
                <div>
                  <h3>{job.role}</h3>
                  <p>
                    {job.company} · {job.location}
                  </p>
                </div>
                <div className="tag-list">
                  <span>{job.season}</span>
                  <span>{job.mode}</span>
                  <span>{job.source}</span>
                  {job.tags.slice(0, 2).map((tag) => (
                    <span key={`${job.id}-${tag}`}>{tag}</span>
                  ))}
                </div>
              </div>
              <div className="opportunity-score">
                <strong>{job.match}</strong>
                <span>match</span>
              </div>
              <div className="opportunity-actions">
                <button className="secondary-button opportunity-preview-button" type="button" onClick={() => setPreviewJob(job)}>
                  <Eye size={14} aria-hidden="true" />
                  Preview
                </button>
                {hasSource ? (
                  <a className="secondary-button" href={job.sourceUrl} target="_blank" rel="noreferrer">
                    Apply <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                ) : (
                  <button className="secondary-button" type="button" disabled>
                    Apply
                  </button>
                )}
                <button className="primary-button" type="button" onClick={() => onImport(job)} disabled={imported}>
                  {imported ? "Imported" : "Import"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {liveFilteredTotal > liveJobs.length && (
        <button className="secondary-button load-more-button" type="button" onClick={onLoadMore} disabled={liveStatus === "loading"}>
          <Plus size={16} aria-hidden="true" />
          Load more live roles
        </button>
      )}

      {previewJob && (
        <OpportunityPreviewModal
          job={previewJob}
          imported={importedIds.has(previewJob.id)}
          onClose={() => setPreviewJob(null)}
          onImport={onImport}
        />
      )}
    </section>
  );
}

function CompaniesView({ jobs, liveJobs, onSelectCompany }) {
  const companies = useMemo(() => {
    const map = new Map();
    const trackedIds = new Set(jobs.map((job) => job.id));
    for (const job of [...jobs, ...liveJobs.slice(0, 80)]) {
      const current = map.get(job.company) || {
        company: job.company,
        tracked: 0,
        live: 0,
        bestMatch: 0,
        locations: new Set(),
        roles: new Set(),
      };
      if (trackedIds.has(job.id)) current.tracked += 1;
      else current.live += 1;
      current.bestMatch = Math.max(current.bestMatch, job.match || 0);
      current.locations.add(job.location);
      current.roles.add(job.role);
      map.set(job.company, current);
    }
    return [...map.values()].sort((left, right) => right.bestMatch - left.bestMatch).slice(0, 18);
  }, [jobs, liveJobs]);

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Companies" title="Target company map" />
      {companies.length === 0 && (
        <EmptyState icon={Building2} title="No companies loaded" text="The company map builds from the live feed and imported roles." />
      )}
      <div className="company-grid">
        {companies.map((company) => (
          <button key={company.company} className="company-card" type="button" onClick={() => onSelectCompany(company.company)}>
            <CompanyLogo company={company.company} />
            <strong>{company.company}</strong>
            <span>{company.roles.size} roles · {company.locations.size} locations</span>
            <div>
              <small>{company.tracked} tracked</small>
              <small>{company.live} live</small>
              <small>{company.bestMatch} match</small>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function ContactsView({ contacts, jobs, onAddContact }) {
  const [draft, setDraft] = useState({ name: "", company: "", role: "", email: "" });
  const jobContacts = jobs
    .filter((job) => job.contact)
    .map((job) => ({
      id: `job-${job.id}`,
      name: job.contact,
      role: job.contactRole,
      company: job.company,
      email: job.contactEmail,
      next: job.nextStep,
    }));
  const rows = [...contacts, ...jobContacts];

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    if (!draft.name.trim() || !draft.company.trim()) return;
    onAddContact({
      id: `contact-${Date.now()}`,
      name: draft.name.trim(),
      company: draft.company.trim(),
      role: draft.role.trim(),
      email: draft.email.trim(),
      next: "Follow up when ready.",
    });
    setDraft({ name: "", company: "", role: "", email: "" });
  }

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Contacts" title="Recruiter and alumni CRM" />
      <form className="inline-data-form" onSubmit={submit}>
        <input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Name" />
        <input value={draft.company} onChange={(event) => update("company", event.target.value)} placeholder="Company" />
        <input value={draft.role} onChange={(event) => update("role", event.target.value)} placeholder="Role or note" />
        <input value={draft.email} onChange={(event) => update("email", event.target.value)} placeholder="Email" />
        <button className="secondary-button" type="submit">
          <Plus size={16} aria-hidden="true" />
          Add Contact
        </button>
      </form>
      {rows.length === 0 && (
        <EmptyState icon={Users} title="No contacts yet" text="Add recruiters, alumni, or referrals here as you find them." />
      )}
      <div className="data-table">
        {rows.map((contact) => (
          <article key={contact.id || `${contact.company}-${contact.name}`}>
            <span className="contact-avatar">{contact.name.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{contact.name}</strong>
              <p>{contact.role} · {contact.company}</p>
            </div>
            <a href={contact.email ? `mailto:${contact.email}` : "#"}>{contact.email || "No email yet"}</a>
            <small>{contact.next}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function CalendarView({ jobs, onSelectJob }) {
  const events = [...jobs]
    .filter((job) => job.deadline)
    .sort((left, right) => new Date(left.deadline) - new Date(right.deadline))
    .slice(0, 14);

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Calendar" title="Deadlines and interviews" />
      {events.length === 0 && (
        <EmptyState icon={CalendarDays} title="No deadlines yet" text="Import or add roles with deadlines and they will appear here." />
      )}
      <div className="timeline-list">
        {events.map((job) => (
          <button key={job.id} type="button" onClick={() => onSelectJob(job.id)}>
            <span className={classNames("calendar-dot", `dot-${job.stage}`)} />
            <div>
              <strong>{formatDate(job.deadline, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</strong>
              <p>{job.company} · {job.role}</p>
            </div>
            <span>{stages.find((stage) => stage.id === job.stage)?.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function TasksView({ tasks, onToggleTask, onAddTask }) {
  const [draft, setDraft] = useState("");

  function submit(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    onAddTask(draft.trim());
    setDraft("");
  }

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Tasks" title="Weekly action list" />
      <form className="task-form" onSubmit={submit}>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add a new follow-up or application task" />
        <button className="primary-button" type="submit">
          <Plus size={16} aria-hidden="true" />
          Add
        </button>
      </form>
      {tasks.length === 0 && (
        <EmptyState icon={CheckSquare2} title="No tasks yet" text="Tasks appear only after you add them." />
      )}
      <div className="task-board-list">
        {tasks.map((task) => {
          const Icon = task.icon || CheckSquare2;
          return (
            <label key={task.id} className={classNames("task-item large-task", task.done && "is-done")}>
              <span className="task-icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span>
                <strong>{task.title}</strong>
                <small>{task.subtitle}</small>
              </span>
              <input checked={task.done} onChange={() => onToggleTask(task.id)} type="checkbox" aria-label={`Complete ${task.title}`} />
            </label>
          );
        })}
      </div>
    </section>
  );
}

function DocumentsView({
  documents,
  jobs,
  onAddDocument,
  onUpdateDocument,
  onDeleteDocument,
  onDuplicateDocument,
  onToast,
}) {
  const fileInputRef = useRef(null);
  const [draft, setDraft] = useState(blankDocumentDraft);
  const [editingId, setEditingId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [fileNotice, setFileNotice] = useState("");
  const [previewDocument, setPreviewDocument] = useState(null);

  const targetOptions = useMemo(() => {
    const seen = new Set(["General"]);
    const options = ["General"];
    jobs.forEach((job) => {
      const label = `${job.company} · ${job.role}`;
      if (!seen.has(label)) {
        seen.add(label);
        options.push(label);
      }
    });
    return options;
  }, [jobs]);

  const filteredDocuments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents.filter((document) => {
      const matchesStatus = statusFilter === "All" || document.status === statusFilter;
      const matchesType = typeFilter === "All" || document.type === typeFilter;
      const blob = `${document.name} ${document.type} ${document.status} ${document.target} ${document.url} ${document.notes}`.toLowerCase();
      return matchesStatus && matchesType && (!needle || blob.includes(needle));
    });
  }, [documents, query, statusFilter, typeFilter]);

  const readyCount = documents.filter((document) => document.status === "Ready" || document.status === "Submitted").length;
  const reviewCount = documents.filter((document) => document.status === "Needs Review").length;
  const linkedCount = documents.filter((document) => document.url || document.fileData).length;
  const sortedDocumentUpdates = documents
    .map((document) => document.updated)
    .filter(Boolean)
    .sort();
  const latestUpdate = sortedDocumentUpdates[sortedDocumentUpdates.length - 1];

  useEffect(() => {
    if (!previewDocument) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setPreviewDocument(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewDocument]);

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function resetDraft() {
    setDraft(blankDocumentDraft);
    setEditingId("");
    setFileNotice("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function editDocument(document) {
    setDraft({
      ...blankDocumentDraft,
      ...document,
      target: document.target || "General",
    });
    setEditingId(document.id);
    setFileNotice(document.fileName ? `${document.fileName}${document.fileSize ? ` · ${formatBytes(document.fileSize)}` : ""}` : "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function clearAttachedFile() {
    setDraft((current) => ({ ...current, fileName: "", fileType: "", fileSize: 0, fileData: "" }));
    setFileNotice("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const fileMeta = {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    };
    if (file.size > embeddedDocumentLimit) {
      setDraft((current) => ({ ...current, ...fileMeta, fileData: "" }));
      setFileNotice(`${file.name} · ${formatBytes(file.size)} · link required`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((current) => ({ ...current, ...fileMeta, fileData: String(reader.result || "") }));
      setFileNotice(`${file.name} · ${formatBytes(file.size)} attached`);
    };
    reader.onerror = () => {
      setDraft((current) => ({ ...current, ...fileMeta, fileData: "" }));
      setFileNotice(`${file.name} could not attach`);
    };
    reader.readAsDataURL(file);
  }

  function submit(event) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const nextDocument = normalizeDocument({
      ...draft,
      id: editingId || `document-${Date.now()}`,
      name: draft.name.trim(),
      url: draft.url.trim(),
      target: draft.target.trim() || "General",
      owner: draft.owner.trim(),
      notes: draft.notes.trim(),
      version: draft.version.trim() || "v1",
      status: draft.status,
      updated: new Date().toISOString(),
    });
    if (editingId) {
      onUpdateDocument(editingId, nextDocument);
    } else {
      onAddDocument(nextDocument);
    }
    resetDraft();
  }

  async function copyLink(document) {
    if (!document.url) return;
    try {
      await navigator.clipboard.writeText(document.url);
      onToast(`${document.name} link copied`);
    } catch {
      onToast("Link could not be copied");
    }
  }

  function openPreview(document) {
    if (!document.fileData && !isOpenableUrl(document.url)) {
      onToast("Add a file or link before previewing");
      return;
    }
    setPreviewDocument(document);
  }

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Documents" title="Resume and application assets" />
      <div className="document-stats">
        <article>
          <strong>{documents.length}</strong>
          <span>assets</span>
        </article>
        <article>
          <strong>{readyCount}</strong>
          <span>ready</span>
        </article>
        <article>
          <strong>{reviewCount}</strong>
          <span>needs review</span>
        </article>
        <article>
          <strong>{linkedCount}</strong>
          <span>linked</span>
        </article>
        <article>
          <strong>{latestUpdate ? formatDate(latestUpdate, { month: "short", day: "numeric" }) : "None"}</strong>
          <span>last update</span>
        </article>
      </div>

      <div className="document-workspace">
        <form className="document-form" onSubmit={submit}>
          <div className="document-form-head">
            <FileText size={18} aria-hidden="true" />
            <span>
              <strong>{editingId ? "Edit asset" : "New asset"}</strong>
              <small>{editingId ? "Updating saved document" : "Saved to your workspace"}</small>
            </span>
          </div>
          <label>
            Name
            <input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="SWE resume v1" />
          </label>
          <label>
            Type
            <select value={draft.type} onChange={(event) => update("type", event.target.value)}>
              {documentTypeOptions.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            Status
            <select value={draft.status} onChange={(event) => update("status", event.target.value)}>
              {documentStatusOptions.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label>
            Target
            <select value={draft.target} onChange={(event) => update("target", event.target.value)}>
              {targetOptions.map((target) => <option key={target}>{target}</option>)}
            </select>
          </label>
          <label>
            Version
            <input value={draft.version} onChange={(event) => update("version", event.target.value)} placeholder="v1" />
          </label>
          <label>
            Owner
            <input value={draft.owner} onChange={(event) => update("owner", event.target.value)} placeholder="Self, mentor, recruiter" />
          </label>
          <label className="document-wide-field">
            Link
            <input value={draft.url} onChange={(event) => update("url", event.target.value)} placeholder="https://drive.google.com/..." />
          </label>
          <label className="document-file-field">
            File
            <input ref={fileInputRef} type="file" onChange={handleFileChange} />
            <span>
              <Upload size={15} aria-hidden="true" />
              {fileNotice || "Choose file"}
            </span>
          </label>
          {draft.fileName && (
            <button className="text-button document-clear-file" type="button" onClick={clearAttachedFile}>
              Remove file
            </button>
          )}
          <label className="document-wide-field">
            Notes
            <textarea value={draft.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Tailoring notes, reviewer feedback, or usage rules" />
          </label>
          <div className="document-form-actions">
            {editingId && (
              <button className="secondary-button" type="button" onClick={resetDraft}>
                Cancel
              </button>
            )}
            <button className="primary-button" type="submit">
              <Plus size={16} aria-hidden="true" />
              {editingId ? "Save Changes" : "Add Asset"}
            </button>
          </div>
        </form>

        <div className="document-library">
          <div className="document-toolbar">
            <div className="document-search">
              <Search size={16} aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents" />
            </div>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option>All</option>
              {documentTypeOptions.map((type) => <option key={type}>{type}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option>All</option>
              {documentStatusOptions.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>

          {documents.length === 0 && (
            <EmptyState icon={FileText} title="No documents yet" text="Add resumes, templates, or portfolio links when you create them." />
          )}
          {documents.length > 0 && filteredDocuments.length === 0 && (
            <EmptyState icon={Filter} title="No matching documents" text="Adjust the filters or search term." />
          )}
          <div className="document-grid">
            {filteredDocuments.map((doc) => {
              const canOpenLink = isOpenableUrl(doc.url);
              const canPreview = Boolean(doc.fileData || canOpenLink);
              return (
                <article key={doc.id} className="document-card">
                  <div className="document-card-head">
                    <span className="document-icon" aria-hidden="true">
                      <FileText size={18} />
                    </span>
                    <span>
                      <strong>{doc.name}</strong>
                      <small>{doc.type} · {doc.target || "General"}</small>
                    </span>
                    <small className={classNames("document-status", `is-${doc.status.toLowerCase().replace(/\s+/g, "-")}`)}>
                      {doc.status}
                    </small>
                  </div>
                  <div className="document-meta">
                    <span>
                      Version
                      <strong>{doc.version}</strong>
                    </span>
                    <span>
                      Updated
                      <strong>{formatDate(doc.updated, { month: "short", day: "numeric" })}</strong>
                    </span>
                    <span>
                      Owner
                      <strong>{doc.owner || "Self"}</strong>
                    </span>
                  </div>
                  {(doc.fileName || doc.url) && (
                    <div className="document-source">
                      {doc.fileName ? `${doc.fileName}${doc.fileSize ? ` · ${formatBytes(doc.fileSize)}` : ""}` : doc.url}
                    </div>
                  )}
                  {doc.notes && <p className="document-notes">{doc.notes}</p>}
                  <div className="document-card-actions">
                    <button
                      className="secondary-button document-preview-trigger"
                      type="button"
                      onClick={() => openPreview(doc)}
                      disabled={!canPreview}
                      aria-label={`Preview ${doc.name}`}
                    >
                      <Eye size={14} aria-hidden="true" />
                      Preview
                    </button>
                    {canOpenLink ? (
                      <a className="secondary-button" href={doc.url} target="_blank" rel="noreferrer">
                        Open <ArrowUpRight size={14} aria-hidden="true" />
                      </a>
                    ) : doc.fileData ? (
                      <a className="secondary-button" href={doc.fileData} download={doc.fileName || `${doc.name}.txt`}>
                        Download <Download size={14} aria-hidden="true" />
                      </a>
                    ) : (
                      <button className="secondary-button" type="button" disabled>
                        Open
                      </button>
                    )}
                    <button className="secondary-button" type="button" onClick={() => editDocument(doc)} aria-label={`Edit ${doc.name}`}>
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button className="secondary-button" type="button" onClick={() => copyLink(doc)} disabled={!doc.url} aria-label={`Copy ${doc.name} link`}>
                      <Copy size={14} aria-hidden="true" />
                    </button>
                    <button className="secondary-button" type="button" onClick={() => onDuplicateDocument(doc.id)} aria-label={`Duplicate ${doc.name}`}>
                      <Plus size={14} aria-hidden="true" />
                    </button>
                    <button className="secondary-button danger-button" type="button" onClick={() => onDeleteDocument(doc.id)} aria-label={`Delete ${doc.name}`}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {previewDocument && (
        <div
          className="modal-backdrop document-preview-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`${previewDocument.name} preview`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewDocument(null);
          }}
        >
          <div className="document-preview-modal">
            <div className="document-preview-head">
              <span className="document-icon" aria-hidden="true">
                <FileText size={18} />
              </span>
              <span>
                <strong>{previewDocument.name}</strong>
                <small>
                  {previewDocument.fileName || previewDocument.url || `${previewDocument.type} · ${previewDocument.target || "General"}`}
                </small>
              </span>
              <div className="document-preview-actions">
                {previewDocument.fileData && (
                  <a className="secondary-button" href={previewDocument.fileData} download={previewDocument.fileName || `${previewDocument.name}.txt`}>
                    <Download size={14} aria-hidden="true" />
                    Download
                  </a>
                )}
                {isOpenableUrl(previewDocument.url) && (
                  <a className="secondary-button" href={previewDocument.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} aria-hidden="true" />
                    Open Source
                  </a>
                )}
                <button className="icon-button" type="button" onClick={() => setPreviewDocument(null)} aria-label="Close preview">
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
            <DocumentPreviewPanel document={previewDocument} />
          </div>
        </div>
      )}
    </section>
  );
}

function AnalyticsView({ jobs }) {
  const counts = stages.map((stage) => ({
    ...stage,
    count: jobs.filter((job) => job.stage === stage.id).length,
  }));
  const max = Math.max(1, ...counts.map((item) => item.count));
  const offerRate = Math.round((jobs.filter((job) => job.stage === "offer").length / Math.max(1, jobs.length)) * 100);

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Analytics" title="Pipeline health" />
      <div className="analytics-grid">
        <article className="rail-card">
          <h3>Funnel</h3>
          <div className="funnel-bars">
            {counts.map((item) => (
              <div key={item.id}>
                <span>{item.label}</span>
                <i style={{ width: `${(item.count / max) * 100}%` }} />
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </article>
        <article className="rail-card">
          <h3>Offer Rate</h3>
          <strong className="big-number">{offerRate}%</strong>
          <p>{jobs.length} tracked roles across {new Set(jobs.map((job) => job.company)).size} companies</p>
        </article>
      </div>
    </section>
  );
}

function ResourcesView() {
  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Resources" title="Internship search references" />
      <div className="resource-list">
        {resourceLinks.map((resource) => (
          <a key={resource.title} href={resource.url} target="_blank" rel="noreferrer">
            <BookOpen size={18} aria-hidden="true" />
            <span>
              <strong>{resource.title}</strong>
              <small>{resource.type} · {resource.source}</small>
            </span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
}

function SettingsView({
  liveStatus,
  fetchedAt,
  goal = blankGoal,
  currentUser,
  onGoalChange,
  onProfileUpdate,
  onLogout,
  onRefresh,
  onReset,
  sources,
}) {
  const safeGoal = goal || blankGoal;
  const safeProfile = currentUser?.profile || defaultProfile();
  const [draftGoal, setDraftGoal] = useState(safeGoal);
  const [draftProfile, setDraftProfile] = useState(safeProfile);
  const hasGoal = Number(safeGoal.target || 0) > 0;

  useEffect(() => {
    setDraftGoal(safeGoal);
  }, [safeGoal]);

  useEffect(() => {
    setDraftProfile(safeProfile);
  }, [safeProfile]);

  function updateDraftGoal(field, value) {
    setDraftGoal((current) => ({ ...current, [field]: value }));
  }

  function updateDraftProfile(field, value) {
    setDraftProfile((current) => ({ ...current, [field]: value }));
  }

  function saveSettingsGoal(event) {
    event.preventDefault();
    const nextTarget = Math.max(0, Number(draftGoal.target || 0));
    onGoalChange({
      target: nextTarget ? String(nextTarget) : "",
      deadline: draftGoal.deadline || "",
      label: draftGoal.label.trim(),
    });
  }

  function saveProfile(event) {
    event.preventDefault();
    onProfileUpdate(draftProfile);
  }

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Settings" title="Profile and data sources" />
      <div className="settings-grid">
        <article className="rail-card">
          <h3>Student Profile</h3>
          <form className="profile-settings-form" onSubmit={saveProfile}>
            <div className="profile-preview">
              <img src={draftProfile.avatar} alt="" />
              <span>
                <strong>{draftProfile.name || "Student"}</strong>
                <small>{currentUser?.email}</small>
              </span>
            </div>
            <input value={draftProfile.name} onChange={(event) => updateDraftProfile("name", event.target.value)} placeholder="Name" />
            <input value={draftProfile.program} onChange={(event) => updateDraftProfile("program", event.target.value)} placeholder="Program" />
            <input value={draftProfile.graduation} onChange={(event) => updateDraftProfile("graduation", event.target.value)} placeholder="Graduation" />
            <input value={draftProfile.visa} onChange={(event) => updateDraftProfile("visa", event.target.value)} placeholder="Visa status" />
            <ProfileImagePicker value={draftProfile.avatar} onChange={(avatar) => updateDraftProfile("avatar", avatar)} compact />
            <div className="profile-settings-actions">
              <button className="primary-button" type="submit">Save Profile</button>
              <button className="secondary-button" type="button" onClick={onLogout}>Log Out</button>
            </div>
          </form>
        </article>
        <article className="rail-card">
          <h3>Live Feed</h3>
          <p>Status: {liveStatus}. Last fetch: {fetchedAt ? new Date(fetchedAt).toLocaleString() : "not fetched yet"}.</p>
          <button className="primary-button" type="button" onClick={() => onRefresh(true)}>
            <RefreshCcw size={16} aria-hidden="true" />
            Refresh Sources
          </button>
        </article>
        <article className="rail-card settings-goal-card">
          <h3>Application Goal</h3>
          <p>
            {hasGoal
              ? `${safeGoal.target} ${safeGoal.label || "applications"}${safeGoal.deadline ? ` by ${formatDate(safeGoal.deadline)}` : ""}`
              : "No goal set yet."}
          </p>
          <form className="settings-goal-form" onSubmit={saveSettingsGoal}>
            <input
              type="number"
              min="1"
              value={draftGoal.target}
              onChange={(event) => updateDraftGoal("target", event.target.value)}
              placeholder="Target"
              aria-label="Settings goal target"
            />
            <input
              value={draftGoal.deadline}
              onChange={(event) => updateDraftGoal("deadline", event.target.value)}
              placeholder="YYYY-MM-DD"
              aria-label="Settings goal deadline"
            />
            <input
              value={draftGoal.label}
              onChange={(event) => updateDraftGoal("label", event.target.value)}
              placeholder="Label"
              aria-label="Settings goal label"
            />
            <div className="settings-goal-actions">
              <button className="secondary-button" type="submit">Save Goal</button>
              <button className="secondary-button" type="button" onClick={() => onGoalChange({ target: "", deadline: "", label: "" })}>
                Clear
              </button>
            </div>
          </form>
        </article>
        <article className="rail-card">
          <h3>Sources</h3>
          <div className="settings-sources">
            {sources.map((source) => (
              <a key={source.name} href={source.url} target="_blank" rel="noreferrer">
                {source.name}
              </a>
            ))}
          </div>
        </article>
        <article className="rail-card">
          <h3>Database Workspace</h3>
          <p>Imported live roles and data you add are saved to your account database.</p>
          <button className="secondary-button" type="button" onClick={onReset}>Clear Workspace</button>
        </article>
      </div>
    </section>
  );
}

export function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(readInitialAuthToken);
  const [authReady, setAuthReady] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [activeView, setActiveView] = useState("Dashboard");
  const [jobs, setJobs] = useState(loadJobs);
  const [tasks, setTasks] = useState(loadTasks);
  const [contacts, setContacts] = useState(loadContacts);
  const [documents, setDocuments] = useState(loadDocuments);
  const [goal, setGoal] = useState(loadGoal);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [season, setSeason] = useState("All");
  const [sprintIndex, setSprintIndex] = useState(0);
  const [draggingId, setDraggingId] = useState(null);
  const [modalStage, setModalStage] = useState(null);
  const [toast, setToast] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [liveJobs, setLiveJobs] = useState([]);
  const [liveStatus, setLiveStatus] = useState("idle");
  const [liveQuery, setLiveQuery] = useState("");
  const [liveSeason, setLiveSeason] = useState("all");
  const [liveRemote, setLiveRemote] = useState("all");
  const [liveLimit, setLiveLimit] = useState(120);
  const [liveTotal, setLiveTotal] = useState(0);
  const [liveFilteredTotal, setLiveFilteredTotal] = useState(0);
  const [liveFetchedAt, setLiveFetchedAt] = useState("");
  const [liveSources, setLiveSources] = useState([]);
  const sprintLabels = useMemo(() => createSprintLabels(), []);
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date()),
    [],
  );

  function applyWorkspace(workspace) {
    const next = normalizeWorkspace(workspace);
    setJobs(next.jobs);
    setTasks(next.tasks);
    setContacts(next.contacts);
    setDocuments(next.documents);
    setGoal(next.goal || blankGoal);
    cacheWorkspace(serializeWorkspace(next));
  }

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const data = await apiRequest("/api/me", { token: authToken });
        if (cancelled) return;
        setCurrentUser(data.user);
        applyWorkspace(data.workspace);
        setWorkspaceReady(true);
      } catch {
        if (cancelled) return;
        clearAuthToken();
        setAuthToken("");
        setWorkspaceReady(false);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const snapshot = serializeWorkspace({ jobs, tasks, contacts, documents, goal });
    cacheWorkspace(snapshot);

    if (!currentUser || !workspaceReady) return undefined;
    const timer = window.setTimeout(async () => {
      try {
        await apiRequest("/api/workspace", {
          method: "PUT",
          token: authToken,
          body: { workspace: snapshot },
        });
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Workspace could not save to database");
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [jobs, tasks, contacts, documents, goal, currentUser, authToken, workspaceReady]);

  useEffect(() => {
    if (!selectedId && jobs.length > 0) setSelectedId(jobs[0].id);
  }, [jobs, selectedId]);

  useEffect(() => {
    if (!currentUser) return undefined;
    const timer = window.setTimeout(() => {
      fetchLiveJobs(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [currentUser, liveQuery, liveSeason, liveRemote, liveLimit]);

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesSeason = season === "All" || job.season === season;
      const searchBlob = `${job.company} ${job.role} ${job.location} ${job.tags.join(" ")} ${job.notes}`.toLowerCase();
      return matchesSeason && (!query || searchBlob.includes(query));
    });
  }, [jobs, search, season]);

  const groupedJobs = useMemo(() => {
    return stages.reduce((groups, stage) => {
      groups[stage.id] = filteredJobs
        .filter((job) => job.stage === stage.id)
        .sort((left, right) => right.match - left.match);
      return groups;
    }, {});
  }, [filteredJobs]);

  const selectedJob = jobs.find((job) => job.id === selectedId) || jobs[0];
  const hasPipelineFilters = Boolean(search.trim()) || season !== "All";
  const appliedCount = jobs.filter((job) => job.stage !== "saved").length;
  const oaCount = jobs.filter((job) => job.stage === "oa").length;
  const interviewCount = jobs.filter((job) => job.stage === "interview").length;
  const offerCount = jobs.filter((job) => job.stage === "offer").length;
  const upcoming = [...jobs]
    .filter((job) => job.deadline)
    .sort((left, right) => new Date(left.deadline) - new Date(right.deadline))
    .slice(0, 4);
  const importedIds = useMemo(() => new Set(jobs.map((job) => job.id)), [jobs]);
  const notificationCount = tasks.filter((task) => !task.done).length + upcoming.length;
  const profile = currentUser?.profile || defaultProfile();

  async function fetchLiveJobs(refresh = false) {
    const params = new URLSearchParams({
      query: liveQuery,
      season: liveSeason,
      remote: liveRemote,
      limit: String(liveLimit),
    });
    if (refresh) params.set("refresh", "true");

    setLiveStatus("loading");
    try {
      const response = await fetch(`/api/jobs?${params.toString()}`);
      if (!response.ok) throw new Error(`Live feed returned ${response.status}`);
      const data = await response.json();
      setLiveJobs(Array.isArray(data.jobs) ? data.jobs : []);
      setLiveTotal(Number(data.total || data.count || 0));
      setLiveFilteredTotal(Number(data.filteredTotal || data.count || 0));
      setLiveFetchedAt(data.fetchedAt || "");
      setLiveSources(Array.isArray(data.sources) ? data.sources : []);
      setLiveStatus("ready");
    } catch (error) {
      setLiveStatus("error");
      setToast(error instanceof Error ? error.message : "Live feed failed");
    }
  }

  function updateJob(id, patch) {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  }

  function changeStage(id, stageId) {
    const stageLabel = stages.find((item) => item.id === stageId)?.label || "pipeline";
    updateJob(id, { stage: stageId, statusDate: `${stageLabel} today` });
    setToast(`Moved to ${stageLabel}`);
  }

  function togglePriority(id) {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, priority: !job.priority } : job)));
  }

  function handleDrop(stageId) {
    if (!draggingId) return;
    changeStage(draggingId, stageId);
    setDraggingId(null);
  }

  function addJob(job) {
    setJobs((current) => [job, ...current]);
    setSelectedId(job.id);
    setModalStage(null);
    setToast(`${job.company} added to ${stages.find((stage) => stage.id === job.stage)?.label}`);
  }

  function importLiveJob(job) {
    if (jobs.some((item) => item.id === job.id)) {
      setSelectedId(job.id);
      setActiveView("Pipeline");
      setToast(`${job.company} is already in your pipeline`);
      return;
    }

    const importedJob = {
      ...job,
      stage: "saved",
      priority: job.match >= 88,
      statusDate: "Imported today",
      deadline: job.deadline || "",
      contact: job.contact || "",
      contactRole: job.contactRole || "",
      contactEmail: job.contactEmail || "",
      notes: job.notes || "Imported from live feed. Verify sponsorship, location, and timing before applying.",
      nextStep: "Open posting, verify eligibility, and tailor resume.",
    };
    setJobs((current) => [importedJob, ...current]);
    setSelectedId(importedJob.id);
    setToast(`${job.company} imported to Saved`);
  }

  function completeNextStep(id) {
    updateJob(id, { nextStep: "Next step completed. Add a fresh follow-up when ready.", statusDate: "Updated today" });
    setToast("Next step marked complete");
  }

  function toggleTask(id) {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));
  }

  function addTask(title) {
    setTasks((current) => [
      ...current,
      {
        id: `task-${Date.now()}`,
        title,
        subtitle: "Added manually",
        icon: CheckSquare2,
        done: false,
      },
    ]);
  }

  function addContact(contact) {
    setContacts((current) => [contact, ...current]);
    setToast(`${contact.name} added to contacts`);
  }

  function addDocument(document) {
    const nextDocument = normalizeDocument(document);
    setDocuments((current) => [nextDocument, ...current]);
    setToast(`${document.name} added to documents`);
  }

  function updateDocument(id, nextDocument) {
    setDocuments((current) => current.map((document) => (document.id === id ? normalizeDocument({ ...document, ...nextDocument, id }) : document)));
    setToast(`${nextDocument.name || "Document"} updated`);
  }

  function deleteDocument(id) {
    const document = documents.find((item) => item.id === id);
    setDocuments((current) => current.filter((item) => item.id !== id));
    setToast(`${document?.name || "Document"} deleted`);
  }

  function duplicateDocument(id) {
    const document = documents.find((item) => item.id === id);
    if (!document) return;
    const copy = normalizeDocument({
      ...document,
      id: `document-${Date.now()}`,
      name: `${document.name} Copy`,
      status: "Draft",
      updated: new Date().toISOString(),
    });
    setDocuments((current) => [copy, ...current]);
    setToast(`${document.name} duplicated`);
  }

  function updateGoal(nextGoal) {
    setGoal(nextGoal);
    setToast(nextGoal.target ? "Goal saved" : "Goal cleared");
  }

  async function handleRegister(draft) {
    try {
      const result = await apiRequest("/api/auth/register", {
        method: "POST",
        body: {
          email: draft.email,
          password: draft.password,
          name: draft.name,
          avatar: draft.avatar,
        },
        token: "",
      });
      saveAuthToken(result.token);
      setAuthToken(result.token);
      setCurrentUser(result.user);
      applyWorkspace(result.workspace);
      setWorkspaceReady(true);
      setToast("Account created");
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Could not create account." };
    }
  }

  async function handleLogin(draft) {
    try {
      const result = await apiRequest("/api/auth/login", {
        method: "POST",
        body: {
          email: draft.email,
          password: draft.password,
        },
        token: "",
      });
      saveAuthToken(result.token);
      setAuthToken(result.token);
      setCurrentUser(result.user);
      applyWorkspace(result.workspace);
      setWorkspaceReady(true);
      setToast("Logged in");
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Could not log in." };
    }
  }

  async function updateProfile(nextProfile) {
    const updatedProfile = {
      ...defaultProfile(),
      ...currentUser?.profile,
      ...nextProfile,
    };
    setCurrentUser((current) => (current ? { ...current, profile: updatedProfile } : current));
    setToast("Profile saved");

    try {
      const result = await apiRequest("/api/profile", {
        method: "PATCH",
        token: authToken,
        body: { profile: updatedProfile },
      });
      setCurrentUser(result.user);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Profile could not save to database");
    }
  }

  function logout() {
    apiRequest("/api/auth/logout", { method: "POST", token: authToken }).catch(() => {});
    clearAuthToken();
    setAuthToken("");
    setCurrentUser(null);
    setWorkspaceReady(false);
  }

  function clearLocalData() {
    setJobs([]);
    setTasks([]);
    setContacts([]);
    setDocuments([]);
    setGoal({ target: "", deadline: "", label: "" });
    setSelectedId(null);
    setSearch("");
    setSeason("All");
    setToast("Workspace cleared");
  }

  function loadMoreLiveJobs() {
    setLiveLimit((current) => current + 80);
  }

  function clearLiveFilters() {
    setLiveQuery("");
    setLiveSeason("all");
    setLiveRemote("all");
    setLiveLimit(120);
  }

  function clearPipelineFilters() {
    setSearch("");
    setSeason("All");
  }

  function selectCompany(company) {
    if (jobs.some((job) => job.company === company)) {
      setSearch(company);
      setSeason("All");
      setActiveView("Pipeline");
      return;
    }
    setLiveQuery(company);
    setActiveView("Search");
  }

  function renderUtilityView() {
    if (activeView === "Search") {
      return (
        <LiveSearchView
          liveJobs={liveJobs}
          liveStatus={liveStatus}
          liveQuery={liveQuery}
          liveSeason={liveSeason}
          liveRemote={liveRemote}
          liveTotal={liveTotal}
          liveFilteredTotal={liveFilteredTotal}
          liveLimit={liveLimit}
          setLiveQuery={setLiveQuery}
          setLiveSeason={setLiveSeason}
          setLiveRemote={setLiveRemote}
          onLoadMore={loadMoreLiveJobs}
          onClearFilters={clearLiveFilters}
          onRefresh={fetchLiveJobs}
          onImport={importLiveJob}
          importedIds={importedIds}
          fetchedAt={liveFetchedAt}
          sources={liveSources}
        />
      );
    }
    if (activeView === "Companies") return <CompaniesView jobs={jobs} liveJobs={liveJobs} onSelectCompany={selectCompany} />;
    if (activeView === "Contacts") return <ContactsView contacts={contacts} jobs={jobs} onAddContact={addContact} />;
    if (activeView === "Calendar") return <CalendarView jobs={jobs} onSelectJob={(id) => { setSelectedId(id); setActiveView("Pipeline"); }} />;
    if (activeView === "Tasks") return <TasksView tasks={tasks} onToggleTask={toggleTask} onAddTask={addTask} />;
    if (activeView === "Documents") {
      return (
        <DocumentsView
          documents={documents}
          jobs={jobs}
          onAddDocument={addDocument}
          onUpdateDocument={updateDocument}
          onDeleteDocument={deleteDocument}
          onDuplicateDocument={duplicateDocument}
          onToast={setToast}
        />
      );
    }
    if (activeView === "Analytics") return <AnalyticsView jobs={jobs} />;
    if (activeView === "Resources") return <ResourcesView />;
    if (activeView === "Settings") {
      return (
        <SettingsView
          liveStatus={liveStatus}
          fetchedAt={liveFetchedAt}
          goal={goal}
          currentUser={currentUser}
          onGoalChange={updateGoal}
          onProfileUpdate={updateProfile}
          onLogout={logout}
          onRefresh={fetchLiveJobs}
          onReset={clearLocalData}
          sources={liveSources}
        />
      );
    }
    return null;
  }

  if (!authReady) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="auth-visual">
            <img src={profilePresets[0].src} alt="" />
            <div>
              <strong>Career Tracker</strong>
              <span>Internship + New Grad</span>
            </div>
          </div>
          <div className="auth-form">
            <p>Database session</p>
            <h1>Connecting your tracker</h1>
          </div>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} onRegister={handleRegister} />;
  }

  return (
    <div className="app-shell">
      <aside className={classNames("sidebar", mobileNavOpen && "is-open")}>
        <div className="brand-lockup">
          <img src="/assets/career-track-mark.svg" alt="Career tracker mark" />
          <div>
            <strong>Career Tracker</strong>
            <span>Internship + New Grad</span>
          </div>
        </div>

        <nav aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className={item.label === activeView ? "is-active" : ""}
                type="button"
                onClick={() => {
                  setActiveView(item.label);
                  setMobileNavOpen(false);
                }}
              >
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="student-card">
          <img src={profile.avatar} alt="" />
          <strong>{profile.name}</strong>
          <span>{profile.program}</span>
          <span>{profile.graduation}</span>
          <small>{profile.visa}</small>
          <button type="button" onClick={() => setActiveView("Settings")}>
            Edit Profile <Pencil size={13} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <IconButton label="Open navigation" className="mobile-menu" onClick={() => setMobileNavOpen((open) => !open)}>
            <Menu size={20} />
          </IconButton>
          <div className="title-block">
            <h1>Career Tracker Dashboard</h1>
            <p>{profile.graduation} · {profile.program}</p>
          </div>

          <div className="sprint-control" aria-label="Sprint selector">
            <IconButton label="Previous sprint" onClick={() => setSprintIndex((index) => Math.max(0, index - 1))}>
              <ChevronLeft size={17} />
            </IconButton>
            <button type="button">
              <CalendarDays size={17} aria-hidden="true" />
              Sprint: {sprintLabels[sprintIndex]}
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            <IconButton label="Next sprint" onClick={() => setSprintIndex((index) => Math.min(sprintLabels.length - 1, index + 1))}>
              <ChevronRight size={17} />
            </IconButton>
          </div>

          <label className="search-box">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Search jobs, companies, and notes</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search jobs, companies, notes..." />
            <kbd>⌘ K</kbd>
          </label>

          <div className="top-actions">
            <IconButton label="Clear workspace data" onClick={clearLocalData}>
              <RefreshCcw size={17} />
            </IconButton>
            <IconButton label="Notifications">
              <Bell size={18} />
              {notificationCount > 0 && <span className="notification-dot">{notificationCount}</span>}
            </IconButton>
            <button className="avatar-button" type="button" aria-label="Open account menu" onClick={() => setActiveView("Settings")}>
              <img src={profile.avatar} alt="" />
              {getInitials(profile.name)} <ChevronDown size={13} aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="dashboard">
          {activeView === "Dashboard" || activeView === "Pipeline" ? (
            <>
              <section className="stats-row" aria-label="Pipeline stats">
                <MetricCard label="Applications" value={appliedCount} caption={`${jobs.length} tracked roles`} icon={Send} tone="green" />
                <MetricCard label="OAs" value={oaCount} caption={`${Math.round((oaCount / Math.max(1, appliedCount)) * 100)}% of applied`} icon={CheckCircle2} tone="blue" />
                <MetricCard label="Interviews" value={interviewCount} caption={`${Math.round((interviewCount / Math.max(1, appliedCount)) * 100)}% of applied`} icon={Users} tone="purple" />
                <MetricCard label="Offers" value={offerCount} caption={jobs.length ? "From tracked roles" : "No tracked roles yet"} icon={Gift} tone="amber" />
                <ProgressGoal appliedCount={appliedCount} goal={goal} onGoalChange={updateGoal} />
              </section>

              <section className="board-toolbar" aria-label="Pipeline controls">
                <div className="season-tabs" role="tablist" aria-label="Target season">
                  {["All", "2026 Fall", "2027", "New Grad"].map((item) => (
                    <button
                      key={item}
                      className={season === item ? "is-active" : ""}
                      type="button"
                      role="tab"
                      aria-selected={season === item}
                      onClick={() => setSeason(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className="toolbar-actions">
                  <button className="secondary-button" type="button">
                    <Filter size={16} aria-hidden="true" />
                    Filters
                  </button>
                  <button className="secondary-button" type="button">
                    <Columns3 size={16} aria-hidden="true" />
                    Columns
                  </button>
                  <button className="primary-button" type="button" onClick={() => setModalStage("saved")}>
                    <Plus size={17} aria-hidden="true" />
                    Add Job
                  </button>
                </div>
              </section>

              <div className="content-grid">
                <section className="board-section" aria-label="Application pipeline">
                  <div className="kanban-board">
                    {stages.map((stage) => (
                      <StageColumn
                        key={stage.id}
                        stage={stage}
                        jobs={groupedJobs[stage.id] || []}
                        selectedId={selectedJob?.id}
                        onSelect={setSelectedId}
                        onStageChange={changeStage}
                        onToggleSaved={togglePriority}
                        onDrop={handleDrop}
                        onDragStart={setDraggingId}
                        onAdd={setModalStage}
                      />
                    ))}
                  </div>
                  {filteredJobs.length === 0 && (
                    <div className="no-results">
                      <Search size={22} aria-hidden="true" />
                      <strong>{jobs.length === 0 ? "Pipeline is empty" : "No roles match this view"}</strong>
                      <span>
                        {jobs.length === 0
                          ? "Import a live role or add a job manually to start building the pipeline."
                          : "Try clearing the pipeline filters or search term."}
                      </span>
                      <div className="empty-actions">
                        <button className="primary-button" type="button" onClick={() => setActiveView("Search")}>
                          Import from Live Feed
                        </button>
                        {hasPipelineFilters && (
                          <button className="secondary-button" type="button" onClick={clearPipelineFilters}>
                            Clear Filters
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <DetailPanel
                    job={selectedJob}
                    onClose={() => setSelectedId(null)}
                    onStageChange={changeStage}
                    onUpdateNotes={(id, notes) => updateJob(id, { notes })}
                    onCompleteNextStep={completeNextStep}
                  />
                </section>

                <aside className="right-rail" aria-label="Focus rail">
                  <section className="rail-card today-card">
                    <div className="rail-head">
                      <div>
                        <h2>Today's Plan</h2>
                        <p>{todayLabel}</p>
                      </div>
                      <IconButton label="Today menu">
                        <MoreHorizontal size={17} />
                      </IconButton>
                    </div>
                    <div className="task-list">
                      {tasks.length === 0 && (
                        <EmptyState icon={CheckSquare2} title="No tasks yet" text="Add tasks from the Tasks page." />
                      )}
                      {tasks.map((task) => {
                        const Icon = task.icon;
                        return (
                          <label key={task.id} className={classNames("task-item", task.done && "is-done")}>
                            <span className="task-icon" aria-hidden="true">
                              <Icon size={18} />
                            </span>
                            <span>
                              <strong>{task.title}</strong>
                              <small>{task.subtitle}</small>
                            </span>
                            <input checked={task.done} onChange={() => toggleTask(task.id)} type="checkbox" aria-label={`Complete ${task.title}`} />
                          </label>
                        );
                      })}
                    </div>
                    <button className="text-button" type="button" onClick={() => setActiveView("Tasks")}>
                      View full task list
                    </button>
                  </section>

                  <section className="rail-card">
                    <div className="rail-head">
                      <h2>Upcoming Calendar</h2>
                      <CalendarDays size={17} aria-hidden="true" />
                    </div>
                    <div className="calendar-list">
                      {upcoming.length === 0 && (
                        <EmptyState icon={CalendarDays} title="No dates yet" text="Deadlines appear after you import or add roles." />
                      )}
                      {upcoming.map((job) => (
                        <button key={job.id} type="button" onClick={() => setSelectedId(job.id)}>
                          <span className={classNames("calendar-dot", `dot-${job.stage}`)} />
                          <span>
                            <strong>
                              {job.stage === "oa" ? "OA Deadline" : job.stage === "interview" ? "Interview" : "Deadline"}: {job.company}
                            </strong>
                            <small>{formatDate(job.deadline, { weekday: "short", month: "short", day: "numeric" })}</small>
                          </span>
                          <ExternalLink size={14} aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                    <button className="text-button" type="button" onClick={() => setActiveView("Calendar")}>
                      Open Calendar <ExternalLink size={13} aria-hidden="true" />
                    </button>
                  </section>

                  <section className="rail-card">
                    <div className="rail-head">
                      <h2>Quick Actions</h2>
                      <Sparkles size={17} aria-hidden="true" />
                    </div>
                    <div className="quick-actions">
                      <button type="button" onClick={() => setModalStage("saved")}>
                        <Plus size={16} aria-hidden="true" /> Add New Job
                      </button>
                      <button type="button" onClick={() => setModalStage("applied")}>
                        <Send size={16} aria-hidden="true" /> Log Application
                      </button>
                      <button type="button" onClick={() => setActiveView("Contacts")}>
                        <UserRound size={16} aria-hidden="true" /> Add Contact
                      </button>
                      <button type="button" onClick={() => setActiveView("Search")}>
                        <ArrowUpRight size={16} aria-hidden="true" /> Import from Live Feed
                      </button>
                    </div>
                  </section>
                </aside>
              </div>
            </>
          ) : (
            renderUtilityView()
          )}
        </main>
      </div>

      <AddJobModal open={modalStage !== null} defaultStage={modalStage} onClose={() => setModalStage(null)} onAdd={addJob} />

      {toast && (
        <div className="toast" role="status" onAnimationEnd={() => setToast("")}>
          <Check size={15} aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  );
}
