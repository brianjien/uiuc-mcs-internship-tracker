import { useMemo, useState } from "react";
import {
  FiArrowUpRight as ArrowUpRight,
  FiBriefcase as BriefcaseBusiness,
  FiCheckSquare as CheckSquare2,
  FiCode as FlaskConical,
  FiEdit2 as Pencil,
  FiMail as Mail,
  FiPlus as Plus,
  FiSearch as Search,
  FiUsers as Users,
} from "react-icons/fi";
import { stages } from "../../config/appConfig.jsx";
import { classNames, EmptyState, ViewHeader } from "../../components/ui.jsx";
import { compareDateValues, daysUntil, formatDate, formatRelativeDate } from "../../lib/dates.js";

const taskTypeOptions = [
  {
    id: "custom",
    label: "Custom task",
    icon: CheckSquare2,
    priority: "Medium",
    title: () => "",
    subtitle: (job) => (job ? `${job.company} · ${job.role}` : "Added manually"),
  },
  {
    id: "tailor",
    label: "Tailor resume",
    icon: Pencil,
    priority: "High",
    title: (job) => (job ? `Tailor resume for ${job.company}` : "Tailor resume"),
    subtitle: (job) => (job ? `${job.role} · customize resume and keywords` : "Customize resume and keywords"),
  },
  {
    id: "apply",
    label: "Apply",
    icon: BriefcaseBusiness,
    priority: "High",
    title: (job) => (job ? `Apply to ${job.company}` : "Submit application"),
    subtitle: (job) => (job ? `${job.role} · submit before deadline` : "Submit before deadline"),
  },
  {
    id: "followup",
    label: "Follow up",
    icon: Mail,
    priority: "Medium",
    title: (job) => (job ? `Follow up with ${job.company}` : "Follow up"),
    subtitle: (job) => (job ? `${job.role} · recruiter or referral touch` : "Recruiter or referral touch"),
  },
  {
    id: "oa",
    label: "OA prep",
    icon: FlaskConical,
    priority: "High",
    title: (job) => (job ? `Prep OA for ${job.company}` : "Prep online assessment"),
    subtitle: (job) => (job ? `${job.role} · timed practice and notes` : "Timed practice and notes"),
  },
  {
    id: "interview",
    label: "Interview prep",
    icon: Users,
    priority: "High",
    title: (job) => (job ? `Prep interview for ${job.company}` : "Prep interview"),
    subtitle: (job) => (job ? `${job.role} · stories, questions, and prep notes` : "Stories, questions, and prep notes"),
  },
  {
    id: "research",
    label: "Research company",
    icon: Search,
    priority: "Medium",
    title: (job) => (job ? `Research ${job.company}` : "Research company"),
    subtitle: (job) => (job ? `${job.role} · product, team, and requirements` : "Product, team, and requirements"),
  },
];

function getStageLabel(stageId) {
  return stages.find((stage) => stage.id === stageId)?.label || "Pipeline";
}

function getTaskType(id) {
  return taskTypeOptions.find((option) => option.id === id) || taskTypeOptions[0];
}

function getJobLabel(job) {
  return `${job.company} · ${job.role}`;
}

export function TasksView({ tasks, jobs, onToggleTask, onAddTask, onSelectJob }) {
  const [draft, setDraft] = useState({ title: "", due: "", priority: "Medium", sourceJobId: "", taskType: "tailor" });
  const [filter, setFilter] = useState("open");
  const jobOptions = useMemo(
    () =>
      [...jobs].sort((left, right) => {
        const leftSaved = left.stage === "saved" ? 0 : 1;
        const rightSaved = right.stage === "saved" ? 0 : 1;
        if (leftSaved !== rightSaved) return leftSaved - rightSaved;
        return getJobLabel(left).localeCompare(getJobLabel(right));
      }),
    [jobs],
  );
  const jobById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const linkedJob = jobById.get(draft.sourceJobId) || null;
  const selectedType = getTaskType(draft.taskType);
  const PreviewIcon = selectedType.icon;
  const generatedTitle = selectedType.title(linkedJob);
  const previewTitle = draft.title.trim() || generatedTitle || "New task";
  const previewSubtitle = selectedType.subtitle(linkedJob);
  const suggestions = jobs
    .filter((job) => job.stage !== "offer")
    .slice(0, 5)
    .map((job) => {
      const stageLabel = getStageLabel(job.stage);
      const templates = {
        saved: { title: `Tailor resume for ${job.company}`, subtitle: `${job.role} · apply after eligibility check`, icon: Pencil, priority: "High" },
        applied: { title: `Follow up with ${job.company}`, subtitle: `${job.role} · check status or recruiter contact`, icon: Mail, priority: "Medium" },
        oa: { title: `Prep OA for ${job.company}`, subtitle: `${job.role} · practice timed problems`, icon: FlaskConical, priority: "High" },
        interview: { title: `Prep interview notes for ${job.company}`, subtitle: `${job.role} · stories, questions, and system design`, icon: Users, priority: "High" },
      };
      return {
        id: `suggestion-${job.id}`,
        sourceJobId: job.id,
        due: job.deadline || "",
        ...(templates[job.stage] || { title: `Move ${job.company} forward`, subtitle: `${job.role} · ${stageLabel}`, icon: CheckSquare2, priority: "Medium" }),
      };
    })
    .filter((suggestion) => !tasks.some((task) => task.title === suggestion.title));
  const sortedTasks = [...tasks].sort((left, right) => {
    if (left.done !== right.done) return left.done ? 1 : -1;
    const dueCompare = compareDateValues(left.due, right.due);
    if (dueCompare !== 0) return dueCompare;
    const priorityRank = { High: 0, Medium: 1, Low: 2 };
    return (priorityRank[left.priority] ?? 1) - (priorityRank[right.priority] ?? 1);
  });
  const visibleTasks = sortedTasks.filter((task) => {
    if (filter === "done") return task.done;
    if (filter === "due") return !task.done && task.due && daysUntil(task.due) <= 7;
    if (filter === "all") return true;
    return !task.done;
  });
  const stats = [
    { label: "open", value: tasks.filter((task) => !task.done).length },
    { label: "due soon", value: tasks.filter((task) => !task.done && task.due && daysUntil(task.due) <= 7).length },
    { label: "done", value: tasks.filter((task) => task.done).length },
  ];

  function submit(event) {
    event.preventDefault();
    const title = draft.title.trim() || generatedTitle;
    if (!title.trim()) return;
    onAddTask({
      title: title.trim(),
      due: draft.due,
      priority: draft.priority,
      subtitle: linkedJob
        ? `${previewSubtitle}${draft.due ? ` · due ${formatDate(draft.due)}` : ""}`
        : draft.due ? `Due ${formatDate(draft.due)} · ${draft.priority} priority` : `${draft.priority} priority`,
      icon: selectedType.icon,
      sourceJobId: linkedJob?.id || "",
      taskType: selectedType.id,
    });
    setDraft({ title: "", due: "", priority: "Medium", sourceJobId: "", taskType: "tailor" });
  }

  function updateDraft(field, value) {
    setDraft((current) => {
      const next = { ...current, [field]: value };
      if (field === "sourceJobId") {
        const nextJob = jobById.get(value);
        if (nextJob?.deadline && !current.due) next.due = nextJob.deadline;
      }
      if (field === "taskType") {
        const nextType = getTaskType(value);
        if (!current.priority || current.priority === getTaskType(current.taskType).priority) next.priority = nextType.priority;
      }
      return next;
    });
  }

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Tasks" title="Weekly action list" />
      <div className="utility-stat-row">
        {stats.map((item) => (
          <article key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </article>
        ))}
      </div>
      <form className="task-form task-composer" onSubmit={submit}>
        <div className="task-composer-grid">
          <label className="task-title-field">
            <span>Task title</span>
            <input
              value={draft.title}
              onChange={(event) => updateDraft("title", event.target.value)}
              placeholder={generatedTitle || "Add a follow-up, prep block, or application task"}
            />
          </label>
          <label>
            <span>Linked saved job</span>
            <select value={draft.sourceJobId} onChange={(event) => updateDraft("sourceJobId", event.target.value)}>
              <option value="">No linked job</option>
              {jobOptions.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.company} · {job.role} · {getStageLabel(job.stage)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Task type</span>
            <select value={draft.taskType} onChange={(event) => updateDraft("taskType", event.target.value)}>
              {taskTypeOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Due date</span>
            <input type="date" value={draft.due} onChange={(event) => updateDraft("due", event.target.value)} />
          </label>
          <label>
            <span>Priority</span>
            <select value={draft.priority} onChange={(event) => updateDraft("priority", event.target.value)}>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </label>
        </div>
        <div className="task-composer-preview">
          <span className="task-preview-icon" aria-hidden="true">
            <PreviewIcon size={18} />
          </span>
          <div>
            <strong>{previewTitle}</strong>
            <small>{linkedJob ? previewSubtitle : "No linked job yet"}</small>
          </div>
          {linkedJob && (
            <button className="secondary-button" type="button" onClick={() => onSelectJob?.(linkedJob.id)}>
              Open role <ArrowUpRight size={13} aria-hidden="true" />
            </button>
          )}
          <button className="primary-button" type="submit">
            <Plus size={16} aria-hidden="true" />
            Add Task
          </button>
        </div>
      </form>
      <div className="task-filter-row" role="tablist" aria-label="Task filters">
        {[
          ["open", "Open"],
          ["due", "Due soon"],
          ["done", "Done"],
          ["all", "All"],
        ].map(([id, label]) => (
          <button key={id} className={classNames(filter === id && "is-active")} type="button" onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      {suggestions.length > 0 && (
        <div className="suggestion-strip">
          {suggestions.map((suggestion) => {
            const Icon = suggestion.icon;
            return (
              <button key={suggestion.id} type="button" onClick={() => onAddTask(suggestion)}>
                <Icon size={15} aria-hidden="true" />
                <span>
                  <strong>{suggestion.title}</strong>
                  <small>{suggestion.subtitle}</small>
                </span>
                <Plus size={14} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
      {tasks.length === 0 && (
        <EmptyState icon={CheckSquare2} title="No tasks yet" text="Tasks appear only after you add them." />
      )}
      <div className="task-board-list">
        {visibleTasks.map((task) => {
          const Icon = task.icon || CheckSquare2;
          const linkedTaskJob = jobById.get(task.sourceJobId);
          return (
            <article key={task.id} className={classNames("task-item large-task", task.done && "is-done")}>
              <span className="task-icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className="task-copy">
                <strong>{task.title}</strong>
                <small>{task.subtitle || task.priority || "Task"}</small>
                {linkedTaskJob && (
                  <button className="task-linked-job" type="button" onClick={() => onSelectJob?.(linkedTaskJob.id)}>
                    <BriefcaseBusiness size={13} aria-hidden="true" />
                    {linkedTaskJob.company}
                    <ArrowUpRight size={12} aria-hidden="true" />
                  </button>
                )}
              </span>
              <span className={classNames("date-chip", task.due && daysUntil(task.due) < 0 && !task.done && "is-overdue")}>
                {task.due ? formatRelativeDate(task.due) : task.priority || "Task"}
              </span>
              <input checked={task.done} onChange={() => onToggleTask(task.id)} type="checkbox" aria-label={`Complete ${task.title}`} />
            </article>
          );
        })}
      </div>
    </section>
  );
}
