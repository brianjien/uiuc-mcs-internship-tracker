const CACHE_TTL_MS = 10 * 60 * 1000;
const LIVE_INDEX_LIMIT = 3000;
const earlyCareerPattern = /\b(intern|internship|co[- ]?op|university|student|new grad|new college grad|graduate|entry[- ]?level|early career)\b/i;
const techRolePattern = /\b(software|engineer|developer|machine learning|ml|ai|data|security|systems|platform|backend|frontend|fullstack)\b/i;

const simplifySources = [
  {
    id: "simplify-off-season",
    name: "Simplify Off-Season",
    url: "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README-Off-Season.md",
    season: "2026 Fall",
    roleType: "Internship",
  },
  {
    id: "simplify-summer",
    name: "Simplify Summer 2026",
    url: "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md",
    season: "2026 Summer",
    roleType: "Internship",
  },
  {
    id: "simplify-new-grad",
    name: "Simplify New Grad",
    url: "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/README.md",
    season: "New Grad",
    roleType: "New Grad",
  },
];

const greenhouseBoards = [
  "andurilindustries",
  "verkada",
  "mongodb",
  "stripe",
  "rubrik",
  "nuro",
  "pinterest",
  "databricks",
  "scaleai",
  "roblox",
  "brex",
  "waymo",
  "affirm",
  "airbnb",
  "anthropic",
  "coinbase",
  "figma",
];

const markdownTableSources = [
  {
    id: "speedy-swe-us-intern",
    name: "SpeedyApply SWE Internships",
    url: "https://raw.githubusercontent.com/speedyapply/2026-SWE-College-Jobs/main/README.md",
    season: "2026 Fall",
    roleType: "Internship",
    format: "speedy",
  },
  {
    id: "speedy-swe-intl-intern",
    name: "SpeedyApply SWE International Internships",
    url: "https://raw.githubusercontent.com/speedyapply/2026-SWE-College-Jobs/main/INTERN_INTL.md",
    season: "2026",
    roleType: "Internship",
    format: "speedy",
  },
  {
    id: "speedy-ai-us-intern",
    name: "SpeedyApply AI Internships",
    url: "https://raw.githubusercontent.com/speedyapply/2026-AI-College-Jobs/main/README.md",
    season: "2026 Fall",
    roleType: "Internship",
    format: "speedy",
  },
  {
    id: "speedy-ai-intl-intern",
    name: "SpeedyApply AI International Internships",
    url: "https://raw.githubusercontent.com/speedyapply/2026-AI-College-Jobs/main/INTERN_INTL.md",
    season: "2026",
    roleType: "Internship",
    format: "speedy",
  },
  {
    id: "speedy-swe-us-new-grad",
    name: "SpeedyApply SWE New Grad",
    url: "https://raw.githubusercontent.com/speedyapply/2026-SWE-College-Jobs/main/NEW_GRAD_USA.md",
    season: "New Grad",
    roleType: "New Grad",
    format: "speedy",
  },
  {
    id: "speedy-ai-us-new-grad",
    name: "SpeedyApply AI New Grad",
    url: "https://raw.githubusercontent.com/speedyapply/2026-AI-College-Jobs/main/NEW_GRAD_USA.md",
    season: "New Grad",
    roleType: "New Grad",
    format: "speedy",
  },
  {
    id: "vansh-summer",
    name: "Vansh Summer Internships",
    url: "https://raw.githubusercontent.com/vanshb03/Summer2027-Internships/dev/README.md",
    season: "2026 Summer",
    roleType: "Internship",
    format: "vansh",
  },
  {
    id: "vansh-offseason",
    name: "Vansh Off-Season Internships",
    url: "https://raw.githubusercontent.com/vanshb03/Summer2027-Internships/dev/OFFSEASON_README.md",
    season: "2026 Fall",
    roleType: "Internship",
    format: "vansh",
  },
  {
    id: "vansh-new-grad",
    name: "Vansh New Grad",
    url: "https://raw.githubusercontent.com/vanshb03/New-Grad-2027/main/README.md",
    season: "New Grad",
    roleType: "New Grad",
    format: "vansh",
  },
  {
    id: "jobright-engineering-intern",
    name: "Jobright Engineering Internships",
    url: "https://raw.githubusercontent.com/jobright-ai/2026-Engineer-Internship/master/README.md",
    season: "2026",
    roleType: "Internship",
    format: "jobright",
  },
  {
    id: "jobright-swe-new-grad",
    name: "Jobright SWE New Grad",
    url: "https://raw.githubusercontent.com/jobright-ai/2026-Software-Engineer-New-Grad/master/README.md",
    season: "New Grad",
    roleType: "New Grad",
    format: "jobright",
  },
];

const leverBoards = ["palantir"];
const remoteOkUrl = "https://remoteok.com/api";
const remotiveUrl = "https://remotive.com/api/remote-jobs?search=software%20engineer";

let cache = {
  createdAt: 0,
  payload: null,
};

function decodeHtml(value = "") {
  return String(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value = "") {
  return decodeHtml(String(value).replace(/<[^>]*>/g, " "));
}

function stripRichText(value = "") {
  return stripTags(
    String(value)
      .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
      .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
      .replace(/[*_`]+/g, ""),
  );
}

function cleanCompany(value = "") {
  return stripRichText(value)
    .replace(/[🔥🔒🎓🛂🇺🇸]/g, "")
    .replace(/^↳\s*/, "")
    .trim();
}

function firstUrl(value = "") {
  const matches = [
    ...[...String(value).matchAll(/href="([^"]+)"/g)].map((match) => match[1]),
    ...[...String(value).matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((match) => match[1]),
  ];
  return matches.find((url) => !url.includes("simplify.jobs/p/") && !url.includes("i.imgur.com")) || matches[0] || "";
}

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function inferMode(location = "") {
  const text = location.toLowerCase();
  if (text.includes("remote")) return "Remote";
  if (text.includes("hybrid")) return "Hybrid";
  return "On-site";
}

function inferSeason(role = "", terms = "", fallback = "2026") {
  const text = `${role} ${terms}`.toLowerCase();
  if (text.includes("new grad") || text.includes("new graduate") || text.includes("entry level") || text.includes("early career")) return "New Grad";
  if (text.includes("fall 2026")) return "2026 Fall";
  if (text.includes("winter 2027") || text.includes("spring 2027") || text.includes("summer 2027") || text.includes("2027")) return "2027";
  if (text.includes("spring 2026")) return "2026 Spring";
  if (text.includes("winter 2026")) return "2026 Winter";
  return fallback;
}

function calculateMatch(job) {
  const text = `${job.role} ${job.company} ${job.location} ${job.tags?.join(" ") || ""}`.toLowerCase();
  let score = 70;
  if (text.includes("software")) score += 9;
  if (text.includes("machine learning") || text.includes("ai") || text.includes("ml")) score += 9;
  if (text.includes("data")) score += 5;
  if (text.includes("backend") || text.includes("platform") || text.includes("systems")) score += 5;
  if (text.includes("remote")) score += 2;
  if (job.season === "2026 Fall" || job.season === "2027" || job.season === "New Grad") score += 6;
  if (job.sponsorship === "No sponsorship") score -= 4;
  return Math.max(58, Math.min(98, score));
}

function normalizeJob(job) {
  const normalized = {
    ...job,
    id: job.id || `${slugify(job.source)}-${slugify(job.company)}-${slugify(job.role)}-${slugify(job.location)}`,
    company: job.company || "Unknown",
    role: job.role || "Internship",
    season: job.season || "2026",
    location: job.location || "Location not listed",
    mode: job.mode || inferMode(job.location),
    sponsorship: job.sponsorship || "Unknown",
    stage: "saved",
    posted: job.posted || new Date().toISOString().slice(0, 10),
    deadline: job.deadline || "",
    priority: false,
    statusDate: "Live source",
    contact: job.contact || "",
    contactRole: job.contactRole || "",
    contactEmail: job.contactEmail || "",
    summary: job.summary || "Fetched from a public jobs source. Review the original posting before applying.",
    notes: job.notes || "Imported from live feed. Tailor resume and verify sponsorship/location details.",
    tags: job.tags || ["Live"],
    nextStep: "Open the posting, verify fit, and decide whether to apply.",
  };
  normalized.match = job.match || calculateMatch(normalized);
  return normalized;
}

function parseSimplifyMarkdown(markdown, source) {
  const rows = [...markdown.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];
  const jobs = [];
  let lastCompany = "";

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
    if (cells.length < 5) continue;

    const hasTerms = cells.length >= 6;
    const companyCell = cells[0];
    const company = cleanCompany(companyCell);
    if (company && company !== "↳") lastCompany = company;

    const role = stripRichText(cells[1]);
    const location = stripRichText(cells[2]);
    const terms = hasTerms ? stripRichText(cells[3]) : "";
    const applicationCell = hasTerms ? cells[4] : cells[3];
    const age = stripRichText(hasTerms ? cells[5] : cells[4]);
    const sourceUrl = firstUrl(applicationCell);
    const closed = /🔒/.test(row[1]);

    if (!role || !lastCompany || closed) continue;

    const inferredSeason = inferSeason(role, terms, source.season);
    const roleType = source.roleType || (inferredSeason === "New Grad" ? "New Grad" : "Internship");

    jobs.push(
      normalizeJob({
        id: `${source.id}-${slugify(lastCompany)}-${slugify(role)}-${slugify(location)}`,
        company: lastCompany,
        role,
        location,
        season: inferredSeason,
        mode: inferMode(location),
        sponsorship: /🛂/.test(companyCell) ? "No sponsorship" : "Unknown",
        posted: age ? `${age} ago` : "Recently",
        deadline: "",
        source: source.name,
        sourceUrl,
        tags: [inferredSeason, roleType, terms || "Tech"].filter(Boolean),
        summary: `${role} at ${lastCompany}. Listed in ${source.name}${terms ? ` for ${terms}` : ""}.`,
      }),
    );
  }

  return jobs;
}

function isMarkdownSeparator(cells = []) {
  return cells.length > 0 && cells.filter(Boolean).every((cell) => /^:?-{2,}:?$/.test(cell.trim()));
}

function parseMarkdownTable(markdown, source) {
  const jobs = [];
  let lastCompany = "";

  for (const line of String(markdown).split("\n")) {
    const stripped = line.trim();
    if (!stripped.startsWith("|")) continue;
    const cells = stripped.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 5 || isMarkdownSeparator(cells)) continue;

    const headerBlob = cells.slice(0, 5).join(" ").toLowerCase();
    if (headerBlob.includes("company") && (headerBlob.includes("position") || headerBlob.includes("role") || headerBlob.includes("job title"))) {
      continue;
    }

    let companyCell = cells[0];
    let roleCell = cells[1];
    let locationCell = cells[2];
    let applicationCell = cells[3];
    let posted = stripRichText(cells[4]);
    let salary = "";

    if (source.format === "speedy" && cells.length >= 6) {
      salary = stripRichText(cells[3]);
      applicationCell = cells[4];
      posted = stripRichText(cells[5]);
    } else if (source.format === "jobright") {
      applicationCell = cells[1];
    }

    const company = cleanCompany(companyCell);
    if (company && !["-", "----", "-------"].includes(company)) lastCompany = company;
    if (!lastCompany || /🔒/.test(line)) continue;

    const role = stripRichText(roleCell);
    const location = stripRichText(locationCell);
    if (!role || !location || ["Role", "Position", "Job Title"].includes(role)) continue;

    const inferredSeason = inferSeason(role, "", source.season || "2026");
    const roleType = source.roleType === "New Grad" || inferredSeason === "New Grad" ? "New Grad" : "Internship";
    const tags = [inferredSeason, roleType, source.name, salary].filter(Boolean);

    jobs.push(
      normalizeJob({
        id: `${source.id}-${slugify(lastCompany)}-${slugify(role)}-${slugify(location)}`,
        company: lastCompany,
        role,
        location,
        season: inferredSeason,
        mode: inferMode(location),
        sponsorship: /🛂/.test(line) ? "No sponsorship" : /🇺🇸/.test(line) ? "US citizenship likely" : "Unknown",
        posted: posted || "Recently",
        deadline: "",
        source: source.name,
        sourceUrl: firstUrl(applicationCell || roleCell),
        tags,
        summary: `${role} at ${lastCompany}. Listed by ${source.name}${salary ? ` with ${salary}` : ""}.`,
        requirements: salary,
      }),
    );
  }

  return jobs;
}

async function fetchText(url) {
  const response = await fetchWithRetry(url, {
    headers: {
      "User-Agent": "Career-Tracker-Dashboard/1.0",
      Accept: "text/plain, text/html, application/json",
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function fetchJson(url) {
  const response = await fetchWithRetry(url, {
    headers: {
      "User-Agent": "Career-Tracker-Dashboard/1.0",
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function fetchWithRetry(url, options = {}, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

async function fetchSimplify() {
  const groups = await Promise.allSettled(
    simplifySources.map(async (source) => parseSimplifyMarkdown(await fetchText(source.url), source)),
  );
  return groups.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

async function fetchMarkdownTables() {
  const groups = await Promise.allSettled(
    markdownTableSources.map(async (source) => parseMarkdownTable(await fetchText(source.url), source)),
  );
  return groups.flatMap((result, index) => {
    if (result.status === "fulfilled") return result.value;
    console.warn(`Markdown source failed: ${markdownTableSources[index]?.name || index}: ${result.reason?.message || result.reason}`);
    return [];
  });
}

async function fetchRemotive() {
  const data = await fetchJson(remotiveUrl);
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  return jobs
    .filter((job) => earlyCareerPattern.test(job.title || "") && techRolePattern.test(job.title || ""))
    .slice(0, 40)
    .map((job) =>
      normalizeJob({
        id: `remotive-${job.id || slugify(`${job.company_name}-${job.title}`)}`,
        company: job.company_name,
        role: job.title,
        location: job.candidate_required_location || "Remote",
        season: inferSeason(job.title || "", "", /2027/.test(job.title || "") ? "2027" : "Remote"),
        mode: "Remote",
        source: "Remotive",
        sourceUrl: job.url,
        posted: job.publication_date?.slice(0, 10) || "",
        tags: ["Remote", job.category].filter(Boolean),
        summary: job.description ? stripTags(job.description).slice(0, 180) : "Remote role from Remotive.",
      }),
    );
}

async function fetchRemoteOk() {
  const data = await fetchJson(remoteOkUrl);
  const rows = Array.isArray(data) ? data.slice(1) : [];
  return rows
    .filter((job) => earlyCareerPattern.test(job.position || "") && techRolePattern.test(job.position || ""))
    .slice(0, 40)
    .map((job) =>
      normalizeJob({
        id: `remoteok-${job.id || slugify(`${job.company}-${job.position}`)}`,
        company: job.company,
        role: job.position,
        location: job.location || "Remote",
        season: inferSeason(job.position || "", "", /2027/.test(job.position || "") ? "2027" : "Remote"),
        mode: "Remote",
        source: "RemoteOK",
        sourceUrl: job.url,
        posted: job.date?.slice(0, 10) || "",
        tags: ["Remote", ...(job.tags || []).slice(0, 3)],
        summary: `Remote role listed by ${job.company || "company"} on RemoteOK.`,
      }),
    );
}

async function fetchGreenhouse() {
  const groups = await Promise.allSettled(
    greenhouseBoards.map(async (board) => {
      const data = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`);
      const rows = Array.isArray(data.jobs) ? data.jobs : [];
      return rows
        .filter((job) => earlyCareerPattern.test(job.title || ""))
        .map((job) => {
          const season = inferSeason(job.title, "", /2027/.test(job.title || "") ? "2027" : "2026");
          const roleType = season === "New Grad" || /new grad|graduate|entry[- ]?level|early career/i.test(job.title || "") ? "New Grad" : "Internship";
          const description = stripTags(job.content || "");
          return normalizeJob({
            id: `greenhouse-${board}-${job.id}`,
            company: data.name || board,
            role: job.title,
            location: job.location?.name || "Location not listed",
            season,
            mode: inferMode(job.location?.name || ""),
            source: `Greenhouse · ${data.name || board}`,
            sourceUrl: job.absolute_url,
            posted: job.updated_at?.slice(0, 10) || "",
            tags: ["Company Board", roleType, board, season].filter(Boolean),
            summary: description.slice(0, 220) || `${job.title} from ${data.name || board}'s public Greenhouse board.`,
            description: description.slice(0, 2200),
          });
        });
    }),
  );
  return groups.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

async function fetchLever() {
  const groups = await Promise.allSettled(
    leverBoards.map(async (board) => {
      const rows = await fetchJson(`https://api.lever.co/v0/postings/${board}?mode=json`);
      if (!Array.isArray(rows)) return [];
      return rows
        .filter((job) => earlyCareerPattern.test(job.text || ""))
        .map((job) => {
          const location = job.categories?.location || "Location not listed";
          const season = inferSeason(job.text || "", "", /2027/.test(job.text || "") ? "2027" : "2026");
          const roleType = season === "New Grad" || /new grad|graduate|entry[- ]?level|early career/i.test(job.text || "") ? "New Grad" : "Internship";
          const description = stripTags(job.descriptionPlain || job.description || "");
          return normalizeJob({
            id: `lever-${board}-${job.id || slugify(job.text)}`,
            company: board.charAt(0).toUpperCase() + board.slice(1),
            role: job.text,
            location,
            season,
            mode: inferMode(location),
            source: `Lever · ${board.charAt(0).toUpperCase() + board.slice(1)}`,
            sourceUrl: job.hostedUrl || job.applyUrl,
            posted: job.createdAt ? new Date(job.createdAt).toISOString().slice(0, 10) : "",
            tags: ["Company Board", roleType, job.categories?.commitment, season].filter(Boolean),
            summary: description.slice(0, 220) || `${job.text} from ${board}'s public Lever board.`,
            description: description.slice(0, 2200),
          });
        });
    }),
  );
  return groups.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

function dedupeJobs(jobs) {
  const seen = new Set();
  const unique = [];
  for (const job of jobs) {
    const key = `${slugify(job.company)}-${slugify(job.role)}-${slugify(job.location)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(job);
  }
  return unique;
}

function filterJobs(jobs, { query = "", season = "all", remote = "all" }) {
  const q = query.trim().toLowerCase();
  return jobs.filter((job) => {
    const blob = `${job.company} ${job.role} ${job.location} ${job.season} ${job.source || ""} ${job.summary || ""} ${job.description || ""} ${job.tags.join(" ")}`.toLowerCase();
    const seasonOk =
      season === "all" ||
      (season === "fall2026" && job.season === "2026 Fall") ||
      (season === "2027" && job.season === "2027") ||
      (season === "internship" && earlyCareerPattern.test(blob) && !blob.includes("new grad")) ||
      (season === "newgrad" && (job.season === "New Grad" || blob.includes("new grad") || blob.includes("entry level") || blob.includes("early career"))) ||
      blob.includes(season.replace(/-/g, " "));
    const remoteOk = remote === "all" || job.mode.toLowerCase() === remote;
    return (!q || blob.includes(q)) && seasonOk && remoteOk;
  });
}

export async function getLiveJobs(params = {}) {
  const now = Date.now();
  if (!cache.payload || now - cache.createdAt > CACHE_TTL_MS || params.refresh === "true") {
    const settled = await Promise.allSettled([fetchSimplify(), fetchMarkdownTables(), fetchGreenhouse(), fetchLever(), fetchRemotive(), fetchRemoteOk()]);
    const jobs = dedupeJobs(settled.flatMap((result) => (result.status === "fulfilled" ? result.value : [])))
      .sort((left, right) => right.match - left.match)
      .slice(0, LIVE_INDEX_LIMIT);

    const sources = [
      { name: "SimplifyJobs Summer2026", url: simplifySources[1].url },
      { name: "SimplifyJobs Off-Season", url: simplifySources[0].url },
      { name: "SimplifyJobs New Grad", url: simplifySources[2].url },
      ...markdownTableSources.map((source) => ({ name: source.name, url: source.url })),
      ...greenhouseBoards.map((board) => ({ name: `Greenhouse · ${board}`, url: `https://boards-api.greenhouse.io/v1/boards/${board}/jobs` })),
      ...leverBoards.map((board) => ({ name: `Lever · ${board.charAt(0).toUpperCase() + board.slice(1)}`, url: `https://api.lever.co/v0/postings/${board}?mode=json` })),
      { name: "Remotive API", url: "https://remotive.com/api/remote-jobs" },
      { name: "RemoteOK API", url: remoteOkUrl },
    ];

    cache = {
      createdAt: now,
      payload: {
        fetchedAt: new Date(now).toISOString(),
        jobs,
        sources,
        sourceStatus: settled.map((result, index) => ({
          index,
          ok: result.status === "fulfilled",
          count: result.status === "fulfilled" ? result.value.length : 0,
          error: result.status === "rejected" ? result.reason?.message || String(result.reason) : "",
        })),
      },
    };
  }

  const filtered = filterJobs(cache.payload.jobs, params);
  const limit = Math.max(1, Math.min(LIVE_INDEX_LIMIT, Number(params.limit || 240)));
  const jobs = filtered.slice(0, limit);
  return {
    ...cache.payload,
    total: cache.payload.jobs.length,
    filteredTotal: filtered.length,
    count: jobs.length,
    jobs,
  };
}
