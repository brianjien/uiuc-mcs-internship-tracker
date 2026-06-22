import { useEffect, useState } from "react";
import { FiRefreshCcw as RefreshCcw } from "react-icons/fi";
import { blankGoal, defaultProfile } from "../../config/appConfig.jsx";
import { ProfileImagePicker, ViewHeader } from "../../components/ui.jsx";
import { formatDate } from "../../lib/dates.js";

export function SettingsView({
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
