import { useEffect, useMemo, useState } from "react";
import {
  FiAward as Award,
  FiBarChart2 as BarChart3,
  FiRefreshCcw as RefreshCcw,
  FiTarget as Target,
  FiTrendingUp as TrendingUp,
  FiUsers as Users,
} from "react-icons/fi";
import { classNames, EmptyState, getInitials, ViewHeader } from "../../components/ui.jsx";
import { apiRequest } from "../../lib/auth.js";
import { formatDate } from "../../lib/dates.js";

const sortOptions = [
  { id: "applied", label: "Applied", suffix: "" },
  { id: "interviews", label: "Interviews", suffix: "" },
  { id: "offers", label: "Offers", suffix: "" },
  { id: "conversionRate", label: "Conversion", suffix: "%" },
];

function formatNumber(value = 0) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function getSortLabel(sortBy) {
  return sortOptions.find((option) => option.id === sortBy)?.label || "Applied";
}

function getMetricValue(entry, sortBy) {
  return Number(entry?.[sortBy] || 0);
}

function LeaderAvatar({ entry, size = "regular" }) {
  const avatar = String(entry?.avatar || "");
  const hasImage = avatar.startsWith("/") || avatar.startsWith("https://") || avatar.startsWith("http://");

  return (
    <span className={classNames("leader-avatar", `is-${size}`)} aria-hidden="true">
      {hasImage ? <img src={avatar} alt="" /> : getInitials(entry?.name || "Candidate")}
    </span>
  );
}

function PodiumCard({ entry, rank, sortBy }) {
  const metric = getMetricValue(entry, sortBy);
  const suffix = sortOptions.find((option) => option.id === sortBy)?.suffix || "";

  return (
    <article className={classNames("podium-card", rank === 1 && "is-first")}>
      <span className="podium-rank">#{rank}</span>
      <LeaderAvatar entry={entry} size="large" />
      <strong>{entry.name}</strong>
      <small>{entry.program}</small>
      <div>
        <span>{getSortLabel(sortBy)}</span>
        <b>{formatNumber(metric)}{suffix}</b>
      </div>
      <p>
        {formatNumber(entry.applied)} applied · {formatNumber(entry.interviews)} interviews · {formatNumber(entry.offers)} offers
      </p>
    </article>
  );
}

function LeaderboardRow({ entry, displayRank, sortBy, maxMetric }) {
  const metric = getMetricValue(entry, sortBy);
  const suffix = sortOptions.find((option) => option.id === sortBy)?.suffix || "";
  const width = maxMetric ? Math.max(4, Math.round((metric / maxMetric) * 100)) : 0;

  return (
    <article className={classNames("leaderboard-row", entry.isCurrentUser && "is-current")}>
      <span className="leaderboard-rank">#{displayRank}</span>
      <LeaderAvatar entry={entry} />
      <div className="leaderboard-person">
        <strong>{entry.name}</strong>
        <small>{entry.graduation} · {entry.program}</small>
      </div>
      <div className="leaderboard-score">
        <span>{getSortLabel(sortBy)}</span>
        <strong>{formatNumber(metric)}{suffix}</strong>
      </div>
      <div className="leaderboard-progress" aria-label={`${entry.name} ${getSortLabel(sortBy)} score`}>
        <span style={{ width: `${width}%` }} />
      </div>
      <div className="leaderboard-chips">
        <span>{formatNumber(entry.applied)} Applied</span>
        <span>{formatNumber(entry.interviews)} Interviews</span>
        <span>{formatNumber(entry.offers)} Offers</span>
      </div>
    </article>
  );
}

export function LeaderboardView({ authToken }) {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [sortBy, setSortBy] = useState("applied");

  async function loadLeaderboard() {
    setStatus("loading");
    setError("");
    try {
      const payload = await apiRequest("/api/leaderboard?limit=50", { token: authToken });
      setData(payload);
      setStatus("ready");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Leaderboard could not load");
      setStatus("error");
    }
  }

  useEffect(() => {
    loadLeaderboard();
  }, [authToken]);

  const entries = data?.entries || [];
  const sortedEntries = useMemo(() => {
    return [...entries].sort((left, right) => {
      const metricDiff = getMetricValue(right, sortBy) - getMetricValue(left, sortBy);
      if (metricDiff !== 0) return metricDiff;
      if (right.applied !== left.applied) return right.applied - left.applied;
      return left.rank - right.rank;
    });
  }, [entries, sortBy]);
  const podium = sortedEntries.slice(0, 3);
  const maxMetric = Math.max(0, ...sortedEntries.map((entry) => getMetricValue(entry, sortBy)));
  const currentUser = data?.currentUser;
  const currentGap = currentUser ? Math.max(0, Number(data?.topApplied || 0) - Number(currentUser.applied || 0)) : 0;

  return (
    <section className="view-shell leaderboard-view">
      <ViewHeader eyebrow="Leaderboard" title="Applied ranking">
        <button className="primary-button" type="button" onClick={loadLeaderboard} disabled={status === "loading"}>
          <RefreshCcw size={16} aria-hidden="true" />
          {status === "loading" ? "Refreshing" : "Refresh"}
        </button>
      </ViewHeader>

      <div className="leaderboard-hero">
        <article className="leaderboard-my-rank">
          <span className="leaderboard-crown">
            <Award size={22} aria-hidden="true" />
          </span>
          <div>
            <small>Your Applied Rank</small>
            <strong>{currentUser ? `#${currentUser.rank}` : "-"}</strong>
            <p>{currentUser ? `${formatNumber(currentUser.applied)} applied roles` : "No rank yet"}</p>
          </div>
        </article>
        <article>
          <Target size={19} aria-hidden="true" />
          <span>
            <strong>{formatNumber(data?.topApplied || 0)}</strong>
            <small>top applied</small>
          </span>
        </article>
        <article>
          <Users size={19} aria-hidden="true" />
          <span>
            <strong>{formatNumber(data?.activeUsers || 0)}</strong>
            <small>active applicants</small>
          </span>
        </article>
        <article>
          <TrendingUp size={19} aria-hidden="true" />
          <span>
            <strong>{formatNumber(data?.peerAverage || 0)}</strong>
            <small>peer average</small>
          </span>
        </article>
        <article>
          <BarChart3 size={19} aria-hidden="true" />
          <span>
            <strong>{formatNumber(currentGap)}</strong>
            <small>to first place</small>
          </span>
        </article>
      </div>

      <div className="leaderboard-toolbar">
        <div className="leaderboard-tabs" role="tablist" aria-label="Leaderboard metric">
          {sortOptions.map((option) => (
            <button
              key={option.id}
              className={classNames(sortBy === option.id && "is-active")}
              type="button"
              role="tab"
              aria-selected={sortBy === option.id}
              onClick={() => setSortBy(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span>{data?.generatedAt ? `Updated ${formatDate(data.generatedAt, { month: "short", day: "numeric" })}` : "Live database"}</span>
      </div>

      {status === "error" && (
        <EmptyState icon={Award} title="Leaderboard unavailable" text={error || "Refresh again after the database is ready."} />
      )}

      {status !== "error" && entries.length === 0 && status !== "loading" && (
        <EmptyState icon={Award} title="No rankings yet" text="Applied rankings appear after accounts start tracking roles." />
      )}

      {podium.length > 0 && (
        <div className="podium-grid">
          {podium.map((entry, index) => (
            <PodiumCard key={`${entry.rank}-${entry.name}`} entry={entry} rank={index + 1} sortBy={sortBy} />
          ))}
        </div>
      )}

      <div className="leaderboard-list">
        {status === "loading" && entries.length === 0 ? (
          <article className="leaderboard-row is-loading">
            <span className="leaderboard-rank">...</span>
            <div className="leaderboard-person">
              <strong>Loading rankings</strong>
              <small>Reading application counts from the database</small>
            </div>
          </article>
        ) : (
          sortedEntries.map((entry, index) => (
            <LeaderboardRow
              key={`${entry.rank}-${entry.name}-${entry.applied}`}
              entry={entry}
              displayRank={sortBy === "applied" ? entry.rank : index + 1}
              sortBy={sortBy}
              maxMetric={maxMetric}
            />
          ))
        )}
      </div>
    </section>
  );
}
