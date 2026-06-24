import {
  FiBookmark as Bookmark,
  FiCalendar as CalendarDays,
  FiSend as Send,
} from "react-icons/fi";
import { CompanyLogo } from "../../components/ui.jsx";
import { isDateInSprint } from "../../lib/dates.js";

function formatActivityTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function ActivityGroup({ type, title, icon: Icon, items, onSelectJob }) {
  return (
    <section className={`sprint-activity-group is-${type}`} aria-labelledby={`sprint-${type}-heading`}>
      <div className="sprint-activity-group-head">
        <span>
          <Icon size={16} aria-hidden="true" />
          <strong id={`sprint-${type}-heading`}>{title}</strong>
        </span>
        <b>{items.length}</b>
      </div>

      {items.length === 0 ? (
        <p>No jobs {type === "saved" ? "saved" : "applied to"} in this sprint.</p>
      ) : (
        <div className="sprint-job-list">
          {items.map(({ job, activity }) => (
            <button key={activity.id} type="button" onClick={() => onSelectJob(job.id)}>
              <CompanyLogo company={job.company} />
              <span>
                <strong>{job.company}</strong>
                <small>{job.role}</small>
              </span>
              <time dateTime={activity.at}>{formatActivityTime(activity.at)}</time>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function SprintActivity({ jobs, sprint, onSelectJob }) {
  const activity = jobs
    .flatMap((job) => (job.activity || []).map((item) => ({ job, activity: item })))
    .filter((item) => isDateInSprint(item.activity.at, sprint))
    .sort((left, right) => new Date(right.activity.at) - new Date(left.activity.at));
  const saved = activity.filter((item) => item.activity.type === "saved");
  const applied = activity.filter((item) => item.activity.type === "applied");

  return (
    <section className="sprint-activity" aria-label={`Sprint activity for ${sprint.label}`}>
      <div className="sprint-activity-head">
        <div>
          <span>Sprint activity</span>
          <h2>{sprint.label}</h2>
          <p>Jobs are recorded automatically when you save or apply.</p>
        </div>
        <div className="sprint-activity-total">
          <CalendarDays size={17} aria-hidden="true" />
          <span>
            <strong>{activity.length}</strong>
            actions
          </span>
          {sprint.isCurrent && <b>Current sprint</b>}
        </div>
      </div>

      <div className="sprint-activity-grid">
        <ActivityGroup type="saved" title="Saved" icon={Bookmark} items={saved} onSelectJob={onSelectJob} />
        <ActivityGroup type="applied" title="Applied" icon={Send} items={applied} onSelectJob={onSelectJob} />
      </div>
    </section>
  );
}
