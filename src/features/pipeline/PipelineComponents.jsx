import { useEffect, useState } from "react";
import {
  FiArrowUpRight as ArrowUpRight,
  FiBookmark as Bookmark,
  FiBookmark as BookmarkCheck,
  FiChevronDown as ChevronDown,
  FiCircle as CircleDot,
  FiClock as Clock3,
  FiExternalLink as ExternalLink,
  FiMail as Mail,
  FiPlus as Plus,
  FiTarget as Target,
  FiTrash2 as Trash2,
  FiX as X,
} from "react-icons/fi";
import { blankGoal, stages } from "../../config/appConfig.jsx";
import { classNames, CompanyLogo, IconButton } from "../../components/ui.jsx";
import { daysUntil, formatDate } from "../../lib/dates.js";
import { safeExternalUrl } from "../../lib/documents.js";
import { OaTracker } from "./OaTracker.jsx";

export function StageSelect({ value, onChange, label = "Move stage" }) {
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

export function JobCard({ job, active, onSelect, onStageChange, onTogglePriority, onRemoveJob, onDragStart }) {
  const urgent = daysUntil(job.deadline) <= 14;
  const isSaved = job.stage === "saved";

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
        <IconButton
          className={isSaved ? "danger-icon-button" : ""}
          label={isSaved ? `Remove ${job.company} from Saved` : job.priority ? "Remove priority" : "Mark priority"}
          onClick={(event) => {
            event.stopPropagation();
            if (isSaved) {
              onRemoveJob(job.id);
              return;
            }
            onTogglePriority(job.id);
          }}
        >
          {isSaved ? <Trash2 size={15} /> : job.priority ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
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

export function StageColumn({
  stage,
  jobs,
  selectedId,
  onSelect,
  onStageChange,
  onTogglePriority,
  onRemoveJob,
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
            onTogglePriority={onTogglePriority}
            onRemoveJob={onRemoveJob}
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

export function ProgressGoal({ appliedCount, goal = blankGoal, onGoalChange }) {
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

export function DetailPanel({ job, onClose, onStageChange, onUpdateJob, onUpdateNotes, onCompleteNextStep }) {
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    setTab(job?.stage === "oa" ? "oa" : "overview");
  }, [job?.id]);

  useEffect(() => {
    if (job?.stage === "oa") setTab("oa");
  }, [job?.stage]);

  if (!job) return null;

  const sourceUrl = safeExternalUrl(job.sourceUrl);

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
          href={sourceUrl || "#"}
          target={sourceUrl ? "_blank" : undefined}
          rel={sourceUrl ? "noreferrer" : undefined}
          onClick={(event) => {
            if (!sourceUrl) event.preventDefault();
          }}
        >
          {job.source} <ArrowUpRight size={13} aria-hidden="true" />
        </a>
        <a
          href={sourceUrl || "#"}
          target={sourceUrl ? "_blank" : undefined}
          rel={sourceUrl ? "noreferrer" : undefined}
          onClick={(event) => {
            if (!sourceUrl) event.preventDefault();
          }}
        >
          Job Posting <ArrowUpRight size={13} aria-hidden="true" />
        </a>
      </div>

      <div className="detail-tabs" role="tablist" aria-label="Detail sections">
        {["overview", "oa", "notes", "contacts", "history"].map((item) => (
          <button
            key={item}
            className={tab === item ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
          >
            {item === "oa" ? "OA tracker" : item}
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
              {(job.tags || []).map((tag) => (
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

      {tab === "oa" && <OaTracker job={job} onUpdateJob={onUpdateJob} />}

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

export function AddJobModal({ open, defaultStage, onClose, onAdd }) {
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
      sourceUrl: safeExternalUrl(form.sourceUrl),
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
