import { useMemo } from "react";
import { FiBriefcase as Building2 } from "react-icons/fi";
import { CompanyLogo, EmptyState, ViewHeader } from "../../components/ui.jsx";

export function CompaniesView({ jobs, liveJobs, onSelectCompany }) {
  const companies = useMemo(() => {
    const map = new Map();
    const trackedIds = new Set(jobs.map((job) => job.id));
    for (const job of [...jobs, ...liveJobs.slice(0, 80)]) {
      const current = map.get(job.company) || {
        company: job.company,
        tracked: 0,
        live: 0,
        bestMatch: 0,
        locations: new Set(),
        roles: new Set(),
      };
      if (trackedIds.has(job.id)) current.tracked += 1;
      else current.live += 1;
      current.bestMatch = Math.max(current.bestMatch, job.match || 0);
      current.locations.add(job.location);
      current.roles.add(job.role);
      map.set(job.company, current);
    }
    return [...map.values()].sort((left, right) => right.bestMatch - left.bestMatch).slice(0, 18);
  }, [jobs, liveJobs]);

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Companies" title="Target company map" />
      {companies.length === 0 && (
        <EmptyState icon={Building2} title="No companies loaded" text="The company map builds from the live feed and imported roles." />
      )}
      <div className="company-grid">
        {companies.map((company) => (
          <button key={company.company} className="company-card" type="button" onClick={() => onSelectCompany(company.company)}>
            <CompanyLogo company={company.company} />
            <strong>{company.company}</strong>
            <span>{company.roles.size} roles · {company.locations.size} locations</span>
            <div>
              <small>{company.tracked} tracked</small>
              <small>{company.live} live</small>
              <small>{company.bestMatch} match</small>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
