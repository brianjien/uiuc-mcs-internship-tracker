import { FiArrowUpRight as ArrowUpRight, FiBookOpen as BookOpen } from "react-icons/fi";
import { resourceLinks } from "../../config/appConfig.jsx";
import { ViewHeader } from "../../components/ui.jsx";

export function ResourcesView() {
  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Resources" title="Internship search references" />
      <div className="resource-list">
        {resourceLinks.map((resource) => (
          <a key={resource.title} href={resource.url} target="_blank" rel="noreferrer">
            <BookOpen size={18} aria-hidden="true" />
            <span>
              <strong>{resource.title}</strong>
              <small>{resource.type} · {resource.source}</small>
            </span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
}
