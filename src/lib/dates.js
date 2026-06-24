export function sprintKeyForDate(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function createSprintPeriods(pastWeeks = 12, futureWeeks = 4) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const currentKey = sprintKeyForDate(today);

  return Array.from({ length: pastWeeks + futureWeeks + 1 }, (_, index) => {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + (index - pastWeeks) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
    const key = sprintKeyForDate(weekStart);
    return {
      key,
      start: weekStart.toISOString(),
      end: weekEnd.toISOString(),
      label: `${fmt.format(weekStart)} - ${fmt.format(weekEnd)}, ${weekEnd.getFullYear()}`,
      isCurrent: key === currentKey,
    };
  });
}

export function createSprintLabels(count = 3) {
  return createSprintPeriods(0, Math.max(0, count - 1)).map((period) => period.label);
}

export function isDateInSprint(value, sprint) {
  if (!value || !sprint) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= new Date(sprint.start).getTime() && time <= new Date(sprint.end).getTime();
}

export function formatDate(value, options = { month: "short", day: "numeric" }) {
  if (!value) return "-";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

export function daysUntil(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const today = new Date();
  const deadline = new Date(`${value}T12:00:00`);
  if (Number.isNaN(deadline.getTime())) return Number.POSITIVE_INFINITY;
  const diff = deadline.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function parseDateValue(value) {
  if (!value) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function compareDateValues(left, right) {
  const leftDate = parseDateValue(left)?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightDate = parseDateValue(right)?.getTime() ?? Number.POSITIVE_INFINITY;
  return leftDate - rightDate;
}

export function formatRelativeDate(value) {
  if (!value) return "No date";
  const days = daysUntil(value);
  if (!Number.isFinite(days)) return "No date";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return `${days}d left`;
  return formatDate(value);
}

export function createCalendarFile(event) {
  const date = parseDateValue(event.date);
  if (!date) return null;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0];
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const escapeText = (value = "") => String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Career Tracker//Application Calendar//EN",
    "BEGIN:VEVENT",
    `UID:${event.id || `${stamp}@career-tracker`}`,
    `DTSTAMP:${stamp}Z`,
    `DTSTART;VALUE=DATE:${yyyymmdd}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description || "")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function dateKey(value) {
  const date = parseDateValue(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

export function addMonths(value, amount) {
  const next = new Date(value);
  next.setMonth(next.getMonth() + amount, 1);
  return next;
}

export function buildCalendarDays(monthDate) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      date,
      key: date.toISOString().slice(0, 10),
      currentMonth: date.getMonth() === monthDate.getMonth(),
    };
  });
}
