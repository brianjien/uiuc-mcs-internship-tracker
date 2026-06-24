import { useState } from "react";
import {
  FiActivity as Activity,
  FiCheckCircle as CheckCircle2,
  FiClock as Clock3,
  FiCode as Code2,
  FiEdit3 as Edit3,
  FiFileText as FileText,
  FiPlus as Plus,
  FiTrash2 as Trash2,
} from "react-icons/fi";
import { classNames, IconButton } from "../../components/ui.jsx";

const OA_QUESTION_TYPES = ["Coding", "Multiple choice", "SQL", "Debugging", "System design", "Behavioral", "Math / logic"];
const OA_RESULTS = ["Scheduled", "Completed", "Passed", "Rejected"];

function localDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function emptyOaAttempt() {
  return {
    completedAt: localDateTimeValue(),
    durationMinutes: "",
    questionTypes: [],
    result: "Completed",
    reflection: "",
  };
}

function formatOaDate(value) {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function OaTracker({ job, onUpdateJob }) {
  const [draft, setDraft] = useState(emptyOaAttempt);
  const attempts = Array.isArray(job.oaAttempts) ? job.oaAttempts : [];
  const totalMinutes = attempts.reduce((sum, attempt) => sum + Number(attempt.durationMinutes || 0), 0);
  const completedAttempts = attempts.filter((attempt) => attempt.result !== "Scheduled").length;
  const passed = attempts.some((attempt) => attempt.result === "Passed");
  const stageReached = ["oa", "interview", "offer"].includes(job.stage);
  const nextRoundReached = ["interview", "offer"].includes(job.stage) || passed;
  const flowSteps = [
    { label: "Applied", detail: "Application sent", reached: job.stage !== "saved" },
    { label: "OA invited", detail: stageReached || attempts.length ? "Assessment received" : "Waiting", reached: stageReached || attempts.length > 0 },
    { label: "Attempts", detail: `${attempts.length} logged`, reached: attempts.length > 0 },
    { label: "Completed", detail: `${completedAttempts} finished`, reached: completedAttempts > 0 },
    { label: "Next round", detail: nextRoundReached ? "Interview unlocked" : "Awaiting result", reached: nextRoundReached },
  ];

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function toggleQuestionType(type) {
    setDraft((current) => ({
      ...current,
      questionTypes: current.questionTypes.includes(type)
        ? current.questionTypes.filter((item) => item !== type)
        : [...current.questionTypes, type],
    }));
  }

  function addAttempt(event) {
    event.preventDefault();
    const nextAttempt = {
      id: `oa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      completedAt: draft.completedAt,
      durationMinutes: Math.max(0, Number(draft.durationMinutes || 0)),
      questionTypes: draft.questionTypes,
      result: draft.result,
      reflection: draft.reflection.trim(),
    };

    onUpdateJob(job.id, {
      oaAttempts: [nextAttempt, ...attempts],
      stage: ["saved", "applied"].includes(job.stage) ? "oa" : job.stage,
      statusDate: "OA attempt logged today",
    });
    setDraft(emptyOaAttempt());
  }

  function removeAttempt(attemptId) {
    if (!window.confirm("Delete this OA attempt and its reflection?")) return;
    onUpdateJob(job.id, { oaAttempts: attempts.filter((attempt) => attempt.id !== attemptId) });
  }

  return (
    <div className="oa-tracker">
      <div className="oa-tracker-head">
        <div>
          <span className="oa-eyebrow">Assessment workspace</span>
          <h3>OA progress</h3>
          <p>Keep every attempt, question pattern, and takeaway attached to this role.</p>
        </div>
        <span className="oa-stage-badge">
          <Activity size={14} aria-hidden="true" />
          {stageReached ? "In OA" : "OA prep"}
        </span>
      </div>

      <div className="oa-summary" aria-label="OA summary">
        <span>
          <strong>{attempts.length}</strong>
          attempts
        </span>
        <span>
          <strong>{totalMinutes}</strong>
          minutes
        </span>
        <span>
          <strong>{passed ? "Passed" : completedAttempts ? "Waiting" : "Not started"}</strong>
          current result
        </span>
      </div>

      <div className="oa-flow" aria-label="OA application flow">
        {flowSteps.map((step, index) => (
          <div key={step.label} className={classNames("oa-flow-step", step.reached && "is-reached")}>
            <span className="oa-flow-marker">{step.reached ? <CheckCircle2 size={16} /> : index + 1}</span>
            <strong>{step.label}</strong>
            <small>{step.detail}</small>
          </div>
        ))}
      </div>

      <form className="oa-attempt-form" onSubmit={addAttempt}>
        <div className="oa-section-heading">
          <div>
            <h3>Log an OA attempt</h3>
            <p>Record the real session while the details are still fresh.</p>
          </div>
          <Code2 size={18} aria-hidden="true" />
        </div>

        <div className="oa-form-grid">
          <label>
            <span>Date and time</span>
            <input
              type="datetime-local"
              value={draft.completedAt}
              onChange={(event) => updateDraft("completedAt", event.target.value)}
              required
            />
          </label>
          <label>
            <span>Duration (minutes)</span>
            <input
              type="number"
              min="0"
              max="1440"
              value={draft.durationMinutes}
              onChange={(event) => updateDraft("durationMinutes", event.target.value)}
              placeholder="75"
            />
          </label>
          <label>
            <span>Result</span>
            <select value={draft.result} onChange={(event) => updateDraft("result", event.target.value)}>
              {OA_RESULTS.map((result) => (
                <option key={result}>{result}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="oa-question-types">
          <legend>Question types</legend>
          <div>
            {OA_QUESTION_TYPES.map((type) => (
              <label key={type} className={draft.questionTypes.includes(type) ? "is-selected" : ""}>
                <input
                  type="checkbox"
                  checked={draft.questionTypes.includes(type)}
                  onChange={() => toggleQuestionType(type)}
                />
                {type}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="oa-reflection-field">
          <span>
            <Edit3 size={14} aria-hidden="true" />
            Reflection
          </span>
          <textarea
            value={draft.reflection}
            onChange={(event) => updateDraft("reflection", event.target.value)}
            placeholder="What appeared, what was difficult, and what should you practice before the next round?"
            maxLength={3000}
          />
        </label>

        <div className="oa-form-actions">
          <span>{draft.reflection.length}/3000</span>
          <button className="primary-button" type="submit">
            <Plus size={16} aria-hidden="true" />
            Save attempt
          </button>
        </div>
      </form>

      <section className="oa-attempt-history" aria-labelledby="oa-history-heading">
        <div className="oa-section-heading">
          <div>
            <h3 id="oa-history-heading">Attempt history</h3>
            <p>{attempts.length ? "Newest attempt first." : "Your OA sessions will appear here."}</p>
          </div>
          <FileText size={18} aria-hidden="true" />
        </div>

        {attempts.length === 0 ? (
          <div className="oa-empty-state">
            <Clock3 size={20} aria-hidden="true" />
            <strong>No OA attempts logged yet</strong>
            <span>Use the form above after a practice or real assessment.</span>
          </div>
        ) : (
          <div className="oa-attempt-list">
            {attempts.map((attempt, index) => (
              <article key={attempt.id} className="oa-attempt-row">
                <div className="oa-attempt-index">#{attempts.length - index}</div>
                <div className="oa-attempt-main">
                  <div className="oa-attempt-title">
                    <strong>{formatOaDate(attempt.completedAt)}</strong>
                    <span className={classNames("oa-result-pill", `is-${attempt.result.toLowerCase()}`)}>{attempt.result}</span>
                  </div>
                  <div className="oa-attempt-meta">
                    <span>
                      <Clock3 size={13} aria-hidden="true" />
                      {attempt.durationMinutes ? `${attempt.durationMinutes} min` : "Duration not set"}
                    </span>
                    {(attempt.questionTypes || []).map((type) => (
                      <span key={type}>{type}</span>
                    ))}
                  </div>
                  {attempt.reflection && <p className="oa-attempt-reflection">{attempt.reflection}</p>}
                </div>
                <IconButton label={`Delete OA attempt ${attempts.length - index}`} onClick={() => removeAttempt(attempt.id)}>
                  <Trash2 size={15} />
                </IconButton>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
