import { useState } from "react";
import { FiCalendar as CalendarDays, FiChevronLeft as ChevronLeft, FiChevronRight as ChevronRight, FiDownload as Download } from "react-icons/fi";
import { stages } from "../../config/appConfig.jsx";
import { classNames, EmptyState, ViewHeader } from "../../components/ui.jsx";
import { addMonths, buildCalendarDays, compareDateValues, createCalendarFile, dateKey, daysUntil, formatDate, formatRelativeDate } from "../../lib/dates.js";
import { downloadBlob } from "../../lib/sankeyExport.js";

export function CalendarView({ jobs, tasks, onSelectJob, onToggleTask }) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const events = [
    ...jobs
      .filter((job) => job.deadline)
      .map((job) => ({
        id: `job-${job.id}`,
        type: "Deadline",
        date: job.deadline,
        title: `${job.company} application`,
        description: `${job.role} · ${stages.find((stage) => stage.id === job.stage)?.label || "Pipeline"}`,
        stage: job.stage,
        jobId: job.id,
      })),
    ...tasks
      .filter((task) => task.due)
      .map((task) => ({
        id: `task-${task.id}`,
        type: task.done ? "Done" : "Task",
        date: task.due,
        title: task.title,
        description: task.subtitle || task.priority || "Task",
        taskId: task.id,
        done: task.done,
      })),
  ].sort((left, right) => compareDateValues(left.date, right.date));
  const eventsByDate = events.reduce((map, event) => {
    const key = dateKey(event.date);
    if (!key) return map;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(event);
    return map;
  }, new Map());
  const calendarDays = buildCalendarDays(monthDate);
  const selectedEvents = eventsByDate.get(selectedDate) || [];
  const upcomingEvents = events
    .filter((event) => !event.done && daysUntil(event.date) >= 0)
    .slice(0, 6);
  const stats = [
    { label: "overdue", value: events.filter((event) => !event.done && daysUntil(event.date) < 0).length },
    { label: "today", value: events.filter((event) => !event.done && daysUntil(event.date) === 0).length },
    { label: "next 7 days", value: events.filter((event) => !event.done && daysUntil(event.date) >= 0 && daysUntil(event.date) <= 7).length },
  ];

  function downloadEvent(event) {
    const file = createCalendarFile(event);
    if (!file) return;
    const filename = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "career-event"}.ics`;
    downloadBlob(new Blob([file], { type: "text/calendar;charset=utf-8" }), filename);
  }

  function renderEventActions(event) {
    return (
      <div className="calendar-actions">
        {event.jobId && (
          <button className="secondary-button" type="button" onClick={() => onSelectJob(event.jobId)}>
            Open
          </button>
        )}
        {event.taskId && !event.done && (
          <button className="secondary-button" type="button" onClick={() => onToggleTask(event.taskId)}>
            Done
          </button>
        )}
        <button className="secondary-button" type="button" onClick={() => downloadEvent(event)}>
          <Download size={14} aria-hidden="true" />
          ICS
        </button>
      </div>
    );
  }

  function renderAgendaEvent(event) {
    return (
      <article key={event.id} className={classNames("calendar-event", event.done && "is-done")}>
        <span className={classNames("calendar-dot", event.stage ? `dot-${event.stage}` : "dot-task")} />
        <div>
          <strong>{formatDate(event.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</strong>
          <p>{event.title} · {event.description}</p>
        </div>
        <span className={classNames("date-chip", daysUntil(event.date) < 0 && !event.done && "is-overdue")}>
          {event.type} · {formatRelativeDate(event.date)}
        </span>
        {renderEventActions(event)}
      </article>
    );
  }

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Calendar" title="Deadlines and interviews" />
      <div className="utility-stat-row">
        {stats.map((item) => (
          <article key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </article>
        ))}
      </div>
      {events.length === 0 && (
        <EmptyState icon={CalendarDays} title="No dates yet" text="Role deadlines and task due dates will appear here automatically." />
      )}
      <div className="calendar-workspace">
        <article className="calendar-month-card">
          <div className="calendar-toolbar">
            <button className="icon-button" type="button" onClick={() => setMonthDate((current) => addMonths(current, -1))} aria-label="Previous month">
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <span>
              <strong>{formatDate(monthDate, { month: "long", year: "numeric" })}</strong>
              <small>{events.length} scheduled items</small>
            </span>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                const today = new Date();
                setMonthDate(today);
                setSelectedDate(todayKey);
              }}
            >
              Today
            </button>
            <button className="icon-button" type="button" onClick={() => setMonthDate((current) => addMonths(current, 1))} aria-label="Next month">
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {calendarDays.map((day) => {
              const dayEvents = eventsByDate.get(day.key) || [];
              return (
                <button
                  key={day.key}
                  className={classNames(
                    "calendar-day",
                    !day.currentMonth && "is-muted",
                    day.key === todayKey && "is-today",
                    day.key === selectedDate && "is-selected",
                    dayEvents.length > 0 && "has-events",
                  )}
                  type="button"
                  onClick={() => setSelectedDate(day.key)}
                >
                  <span className="calendar-day-number">{day.date.getDate()}</span>
                  <span className="calendar-day-events">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span key={event.id} className={classNames("calendar-pill", event.stage ? `tone-${event.stage}` : "tone-task", event.done && "is-done")}>
                        {event.type}
                      </span>
                    ))}
                    {dayEvents.length > 3 && <span className="calendar-more">+{dayEvents.length - 3}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </article>

        <aside className="calendar-agenda-panel">
          <div className="calendar-agenda-head">
            <span>
              <small>Selected date</small>
              <strong>{formatDate(selectedDate, { weekday: "long", month: "short", day: "numeric" })}</strong>
            </span>
            <span className="date-chip">{selectedEvents.length} items</span>
          </div>
          <div className="calendar-agenda-list">
            {selectedEvents.length > 0 ? (
              selectedEvents.map(renderAgendaEvent)
            ) : (
              <EmptyState icon={CalendarDays} title="No items on this date" text="Pick another date or add a task with a due date." />
            )}
          </div>
          {upcomingEvents.length > 0 && (
            <>
              <div className="calendar-agenda-subhead">Upcoming</div>
              <div className="calendar-agenda-list is-compact">
                {upcomingEvents.map(renderAgendaEvent)}
              </div>
            </>
          )}
        </aside>
      </div>
      <div className="timeline-list calendar-timeline">
        {events.map((event) => (
          <article key={event.id} className={classNames("calendar-event", event.done && "is-done")}>
            <span className={classNames("calendar-dot", event.stage ? `dot-${event.stage}` : "dot-task")} />
            <div>
              <strong>{formatDate(event.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</strong>
              <p>{event.title} · {event.description}</p>
            </div>
            <span className={classNames("date-chip", daysUntil(event.date) < 0 && !event.done && "is-overdue")}>
              {event.type} · {formatRelativeDate(event.date)}
            </span>
            {renderEventActions(event)}
          </article>
        ))}
      </div>
    </section>
  );
}
