import {
  FiArrowUpRight as ArrowUpRight,
  FiCalendar as CalendarDays,
  FiCheckCircle as CheckCircle2,
  FiCheckSquare as CheckSquare2,
  FiColumns as Columns3,
  FiExternalLink as ExternalLink,
  FiFilter as Filter,
  FiGift as Gift,
  FiMoreHorizontal as MoreHorizontal,
  FiPlus as Plus,
  FiSearch as Search,
  FiSend as Send,
  FiUser as UserRound,
  FiUsers as Users,
  FiZap as Sparkles,
} from "react-icons/fi";
import { stages } from "../../config/appConfig.jsx";
import { classNames, EmptyState, IconButton, MetricCard } from "../../components/ui.jsx";
import { formatDate } from "../../lib/dates.js";
import { DetailPanel, ProgressGoal, StageColumn } from "../pipeline/PipelineComponents.jsx";
import { SprintActivity } from "./SprintActivity.jsx";

export function DashboardView({
  jobs,
  tasks,
  groupedJobs,
  selectedJob,
  filteredJobs,
  appliedCount,
  oaCount,
  interviewCount,
  offerCount,
  goal,
  season,
  upcoming,
  todayLabel,
  selectedSprint,
  hasPipelineFilters,
  onSeasonChange,
  onGoalChange,
  onOpenAddJob,
  onSelectJob,
  onStageChange,
  onTogglePriority,
  onRemoveJob,
  onDrop,
  onDragStart,
  onUpdateJob,
  onUpdateNotes,
  onCompleteNextStep,
  onToggleTask,
  onClearPipelineFilters,
  onShowSearch,
  onShowTasks,
  onShowCalendar,
  onShowContacts,
}) {
  return (
    <>
      <section className="stats-row" aria-label="Pipeline stats">
        <MetricCard label="Applications" value={appliedCount} caption={`${jobs.length} tracked roles`} icon={Send} tone="green" />
        <MetricCard label="OAs" value={oaCount} caption={`${Math.round((oaCount / Math.max(1, appliedCount)) * 100)}% of applied`} icon={CheckCircle2} tone="blue" />
        <MetricCard label="Interviews" value={interviewCount} caption={`${Math.round((interviewCount / Math.max(1, appliedCount)) * 100)}% of applied`} icon={Users} tone="purple" />
        <MetricCard label="Offers" value={offerCount} caption={jobs.length ? "From tracked roles" : "No tracked roles yet"} icon={Gift} tone="amber" />
        <ProgressGoal appliedCount={appliedCount} goal={goal} onGoalChange={onGoalChange} />
      </section>

      <SprintActivity jobs={jobs} sprint={selectedSprint} onSelectJob={onSelectJob} />

      <section className="board-toolbar" aria-label="Pipeline controls">
        <div className="season-tabs" role="tablist" aria-label="Target season">
          {["All", "2026 Fall", "2027", "New Grad"].map((item) => (
            <button
              key={item}
              className={season === item ? "is-active" : ""}
              type="button"
              role="tab"
              aria-selected={season === item}
              onClick={() => onSeasonChange(item)}
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
          <button className="primary-button" type="button" onClick={() => onOpenAddJob("saved")}>
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
                onSelect={onSelectJob}
                onStageChange={onStageChange}
                onTogglePriority={onTogglePriority}
                onRemoveJob={onRemoveJob}
                onDrop={onDrop}
                onDragStart={onDragStart}
                onAdd={onOpenAddJob}
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
                <button className="primary-button" type="button" onClick={onShowSearch}>
                  Import from Live Feed
                </button>
                {hasPipelineFilters && (
                  <button className="secondary-button" type="button" onClick={onClearPipelineFilters}>
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          )}
          <DetailPanel
            job={selectedJob}
            onClose={() => onSelectJob(null)}
            onStageChange={onStageChange}
            onUpdateJob={onUpdateJob}
            onUpdateNotes={onUpdateNotes}
            onCompleteNextStep={onCompleteNextStep}
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
                const Icon = task.icon || CheckSquare2;
                return (
                  <label key={task.id} className={classNames("task-item", task.done && "is-done")}>
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
            <button className="text-button" type="button" onClick={onShowTasks}>
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
                <button key={job.id} type="button" onClick={() => onSelectJob(job.id)}>
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
            <button className="text-button" type="button" onClick={onShowCalendar}>
              Open Calendar <ExternalLink size={13} aria-hidden="true" />
            </button>
          </section>

          <section className="rail-card">
            <div className="rail-head">
              <h2>Quick Actions</h2>
              <Sparkles size={17} aria-hidden="true" />
            </div>
            <div className="quick-actions">
              <button type="button" onClick={() => onOpenAddJob("saved")}>
                <Plus size={16} aria-hidden="true" /> Add New Job
              </button>
              <button type="button" onClick={() => onOpenAddJob("applied")}>
                <Send size={16} aria-hidden="true" /> Log Application
              </button>
              <button type="button" onClick={onShowContacts}>
                <UserRound size={16} aria-hidden="true" /> Add Contact
              </button>
              <button type="button" onClick={onShowSearch}>
                <ArrowUpRight size={16} aria-hidden="true" /> Import from Live Feed
              </button>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
