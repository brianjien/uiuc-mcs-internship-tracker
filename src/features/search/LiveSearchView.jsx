import { useEffect, useState } from "react";
import {
  FiArrowUpRight as ArrowUpRight,
  FiCheck as Check,
  FiEye as Eye,
  FiPlus as Plus,
  FiRefreshCcw as RefreshCcw,
  FiSearch as Search,
  FiShield as ShieldCheck,
  FiX as X,
} from "react-icons/fi";
import { CompanyLogo, EmptyState, ViewHeader } from "../../components/ui.jsx";
import { formatDate } from "../../lib/dates.js";
import { safeExternalUrl } from "../../lib/documents.js";

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

function isBlockingLinkStatus(status = {}) {
  return status.status === "unavailable" || status.status === "invalid";
}

function getLinkStatusText(status = {}, hasSource = false) {
  if (!hasSource) return "Source link missing";
  if (status.status === "available") return "Apply link verified";
  if (status.status === "unavailable") return "Posting closed";
  if (status.status === "invalid") return "Unsafe apply link";
  if (status.status === "unknown") return "Could not verify";
  if (status.status === "unchecked") return "Verify on source";
  return "Apply link ready";
}

function getApplyButtonText({ hasSource, imported, isChecking, status }) {
  if (!hasSource) return "Apply";
  if (isChecking) return "Checking";
  if (isBlockingLinkStatus(status)) return "Closed";
  return imported ? "Open" : "Apply";
}

function OpportunityPreviewModal({ job, imported, linkStatus, isCheckingLink, onApply, onClose, onImport }) {
  const requirementItems = getOpportunityRequirementItems(job);
  const signals = getOpportunitySignals(job);
  const description = String(job.description || job.summary || "").trim();
  const sourceUrl = safeExternalUrl(job.sourceUrl);
  const hasSource = Boolean(sourceUrl);
  const linkStatusText = getLinkStatusText(linkStatus, hasSource);

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
            <button
              className="secondary-button"
              type="button"
              onClick={() => onApply(job)}
              disabled={!hasSource || isCheckingLink || isBlockingLinkStatus(linkStatus)}
            >
              {getApplyButtonText({ hasSource, imported, isChecking: isCheckingLink, status: linkStatus })}
              {hasSource && !isBlockingLinkStatus(linkStatus) && <ArrowUpRight size={14} aria-hidden="true" />}
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                onImport(job);
                onClose();
              }}
              disabled={imported || isBlockingLinkStatus(linkStatus)}
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
              <strong>{isBlockingLinkStatus(linkStatus) ? "Closed" : imported ? "Imported" : "Not imported"}</strong>
            </div>
            <div>
              <span>Link</span>
              <strong>{isCheckingLink ? "Checking" : linkStatusText}</strong>
            </div>
          </section>
          {isBlockingLinkStatus(linkStatus) && (
            <section className="opportunity-preview-section opportunity-link-warning">
              <h3>Posting unavailable</h3>
              <p>{linkStatus.message || "This posting appears to be closed or removed from the source ATS."}</p>
            </section>
          )}

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

export function LiveSearchView({
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
  const [linkStatuses, setLinkStatuses] = useState({});
  const [checkingLinkIds, setCheckingLinkIds] = useState({});

  useEffect(() => {
    if (!previewJob) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setPreviewJob(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewJob]);

  async function handleApply(job) {
    const sourceUrl = safeExternalUrl(job.sourceUrl);
    if (!sourceUrl) return;
    const cachedStatus = linkStatuses[job.id];
    if (isBlockingLinkStatus(cachedStatus)) return;

    const openedWindow = window.open("", "_blank", "noopener,noreferrer");
    setCheckingLinkIds((current) => ({ ...current, [job.id]: true }));
    try {
      const response = await fetch(`/api/jobs/link-status?url=${encodeURIComponent(sourceUrl)}`);
      const data = response.ok ? await response.json() : { ok: true, status: "unknown", url: sourceUrl };
      setLinkStatuses((current) => ({ ...current, [job.id]: data }));
      if (isBlockingLinkStatus(data)) {
        if (openedWindow && !openedWindow.closed) openedWindow.close();
        return;
      }
      const verifiedUrl = safeExternalUrl(data.url) || sourceUrl;
      if (openedWindow) {
        openedWindow.location.href = verifiedUrl;
      } else {
        window.open(verifiedUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      if (openedWindow) {
        openedWindow.location.href = sourceUrl;
      } else {
        window.open(sourceUrl, "_blank", "noopener,noreferrer");
      }
    } finally {
      setCheckingLinkIds((current) => ({ ...current, [job.id]: false }));
    }
  }

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
          Track
          <select value={liveSeason} onChange={(event) => setLiveSeason(event.target.value)}>
            <option value="all">All</option>
            <option value="internship">Internship</option>
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
          const sourceUrl = safeExternalUrl(job.sourceUrl);
          const hasSource = Boolean(sourceUrl);
          const linkStatus = linkStatuses[job.id] || {};
          const isCheckingLink = Boolean(checkingLinkIds[job.id]);
          const linkStatusText = getLinkStatusText(linkStatus, hasSource);
          return (
            <article key={job.id} className={`opportunity-row${isBlockingLinkStatus(linkStatus) ? " opportunity-row-closed" : ""}`}>
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
                  {(job.tags || []).slice(0, 2).map((tag) => (
                    <span key={`${job.id}-${tag}`}>{tag}</span>
                  ))}
                </div>
                <div className="opportunity-detail-strip">
                  <span>Posted {job.posted || "Recently"}</span>
                  <span>{job.sponsorship === "Unknown" ? "Sponsorship: verify" : job.sponsorship}</span>
                  <span className={isBlockingLinkStatus(linkStatus) ? "link-status-closed" : ""}>
                    {isCheckingLink ? "Checking apply link" : linkStatusText}
                  </span>
                </div>
                {isBlockingLinkStatus(linkStatus) && (
                  <p className="opportunity-link-warning-text">
                    {linkStatus.message || "This posting appears closed or removed from the source ATS."}
                  </p>
                )}
                {job.summary && <p className="opportunity-summary">{job.summary}</p>}
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
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => handleApply(job)}
                  disabled={!hasSource || isCheckingLink || isBlockingLinkStatus(linkStatus)}
                >
                  {getApplyButtonText({ hasSource, imported, isChecking: isCheckingLink, status: linkStatus })}
                  {hasSource && !isBlockingLinkStatus(linkStatus) && <ArrowUpRight size={14} aria-hidden="true" />}
                </button>
                <button className="primary-button" type="button" onClick={() => onImport(job)} disabled={imported || isBlockingLinkStatus(linkStatus)}>
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
          linkStatus={linkStatuses[previewJob.id] || {}}
          isCheckingLink={Boolean(checkingLinkIds[previewJob.id])}
          onApply={handleApply}
          onClose={() => setPreviewJob(null)}
          onImport={onImport}
        />
      )}
    </section>
  );
}
