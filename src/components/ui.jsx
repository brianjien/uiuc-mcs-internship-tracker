import { FiBriefcase as Building2, FiSearch as Search } from "react-icons/fi";
import { companyIcons, profilePresets } from "../config/appConfig.jsx";

export function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CT";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

function isRenderableIcon(icon) {
  return typeof icon === "function" || (typeof icon === "object" && icon !== null && "$$typeof" in icon);
}

export function CompanyLogo({ company }) {
  const brand = companyIcons[company];
  const Icon = isRenderableIcon(brand?.icon) ? brand.icon : Building2;

  return (
    <span className={classNames("company-logo", brand?.className || "brand-generic")} aria-hidden="true">
      <Icon />
    </span>
  );
}

export function IconButton({ label, children, className = "", ...props }) {
  return (
    <button className={classNames("icon-button", className)} type="button" aria-label={label} {...props}>
      {children}
    </button>
  );
}

export function MetricCard({ label, value, caption, icon: Icon, tone = "green" }) {
  return (
    <article className="metric-card">
      <span className={classNames("metric-icon", `tone-${tone}`)} aria-hidden="true">
        <Icon size={20} strokeWidth={2} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{caption}</span>
      </div>
    </article>
  );
}

export function ViewHeader({ eyebrow, title, children }) {
  return (
    <section className="view-header">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ icon: Icon = Search, title, text, children }) {
  return (
    <div className="empty-state">
      <Icon size={22} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{text}</span>
      {children}
    </div>
  );
}

export function ProfileImagePicker({ value, onChange, compact = false }) {
  return (
    <div className={classNames("profile-image-picker", compact && "is-compact")} aria-label="Profile image presets">
      {profilePresets.map((preset) => (
        <button
          key={preset.id}
          className={preset.src === value ? "is-selected" : ""}
          type="button"
          onClick={() => onChange(preset.src)}
          aria-label={`Use ${preset.label} profile image`}
        >
          <img src={preset.src} alt="" />
          <span>{preset.label}</span>
        </button>
      ))}
    </div>
  );
}
