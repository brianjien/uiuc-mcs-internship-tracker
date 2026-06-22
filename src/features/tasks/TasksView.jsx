import { useState } from "react";
import { FiCheckSquare as CheckSquare2, FiCode as FlaskConical, FiEdit2 as Pencil, FiMail as Mail, FiPlus as Plus, FiUsers as Users } from "react-icons/fi";
import { stages } from "../../config/appConfig.jsx";
import { classNames, EmptyState, ViewHeader } from "../../components/ui.jsx";
import { compareDateValues, daysUntil, formatDate, formatRelativeDate } from "../../lib/dates.js";

export function TasksView({ tasks, jobs, onToggleTask, onAddTask }) {
  const [draft, setDraft] = useState({ title: "", due: "", priority: "Medium" });
  const [filter, setFilter] = useState("open");
  const suggestions = jobs
    .filter((job) => job.stage !== "offer")
    .slice(0, 5)
    .map((job) => {
      const stageLabel = stages.find((stage) => stage.id === job.stage)?.label || "Pipeline";
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
    if (!draft.title.trim()) return;
    onAddTask({
      title: draft.title.trim(),
      due: draft.due,
      priority: draft.priority,
      subtitle: draft.due ? `Due ${formatDate(draft.due)} · ${draft.priority} priority` : `${draft.priority} priority`,
      icon: CheckSquare2,
    });
    setDraft({ title: "", due: "", priority: "Medium" });
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
      <form className="task-form" onSubmit={submit}>
        <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Add a follow-up, prep block, or application task" />
        <input type="date" value={draft.due} onChange={(event) => setDraft((current) => ({ ...current, due: event.target.value }))} aria-label="Task due date" />
        <select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))} aria-label="Task priority">
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
        <button className="primary-button" type="submit">
          <Plus size={16} aria-hidden="true" />
          Add
        </button>
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
          return (
            <label key={task.id} className={classNames("task-item large-task", task.done && "is-done")}>
              <span className="task-icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span>
                <strong>{task.title}</strong>
                <small>{task.subtitle || task.priority || "Task"}</small>
              </span>
              <span className={classNames("date-chip", task.due && daysUntil(task.due) < 0 && !task.done && "is-overdue")}>
                {task.due ? formatRelativeDate(task.due) : task.priority || "Task"}
              </span>
              <input checked={task.done} onChange={() => onToggleTask(task.id)} type="checkbox" aria-label={`Complete ${task.title}`} />
            </label>
          );
        })}
      </div>
    </section>
  );
}
