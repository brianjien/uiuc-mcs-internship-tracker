import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiCalendar as CalendarDays,
  FiCheck as Check,
  FiCheckSquare as CheckSquare2,
  FiChevronDown as ChevronDown,
  FiChevronLeft as ChevronLeft,
  FiChevronRight as ChevronRight,
  FiMenu as Menu,
  FiEdit2 as Pencil,
  FiRefreshCcw as RefreshCcw,
  FiSearch as Search,
} from "react-icons/fi";
import {
  blankNotificationState,
  blankGoal,
  defaultProfile,
  navItems,
  profilePresets,
  stages,
} from "./config/appConfig.jsx";
import {
  apiRequest,
  clearAuthToken,
  readInitialAuthToken,
  saveAuthToken,
} from "./lib/auth.js";
import {
  normalizeDocument,
} from "./lib/documents.js";
import {
  createSprintLabels,
  formatDate,
} from "./lib/dates.js";
import { buildNotificationFeed, normalizeNotificationState, safeNotificationId } from "./lib/notifications.jsx";
import {
  cacheWorkspace,
  loadContacts,
  loadDocuments,
  loadGoal,
  loadJobs,
  loadNotificationState,
  loadTasks,
  normalizeWorkspace,
  serializeWorkspace,
} from "./lib/workspace.js";
import { AuthScreen } from "./features/auth/AuthScreen.jsx";
import { AnalyticsView } from "./features/analytics/AnalyticsView.jsx";
import { ResourcesView } from "./features/resources/ResourcesView.jsx";
import { DashboardView } from "./features/dashboard/DashboardView.jsx";
import { LeaderboardView } from "./features/leaderboard/LeaderboardView.jsx";
import { AddJobModal } from "./features/pipeline/PipelineComponents.jsx";
import { LiveSearchView } from "./features/search/LiveSearchView.jsx";
import { CompaniesView } from "./features/companies/CompaniesView.jsx";
import { ContactsView } from "./features/contacts/ContactsView.jsx";
import { CalendarView } from "./features/calendar/CalendarView.jsx";
import { TasksView } from "./features/tasks/TasksView.jsx";
import { DocumentsView } from "./features/documents/DocumentsView.jsx";
import { SettingsView } from "./features/settings/SettingsView.jsx";
import { NotificationCenter } from "./components/NotificationCenter.jsx";
import { classNames, getInitials, IconButton } from "./components/ui.jsx";

export function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(readInitialAuthToken);
  const [authReady, setAuthReady] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [activeView, setActiveView] = useState("Dashboard");
  const [jobs, setJobs] = useState(loadJobs);
  const [tasks, setTasks] = useState(loadTasks);
  const [contacts, setContacts] = useState(loadContacts);
  const [documents, setDocuments] = useState(loadDocuments);
  const [goal, setGoal] = useState(loadGoal);
  const [notificationState, setNotificationState] = useState(loadNotificationState);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [browserPermission, setBrowserPermission] = useState(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return window.Notification.permission;
  });
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [season, setSeason] = useState("All");
  const [sprintIndex, setSprintIndex] = useState(0);
  const [draggingId, setDraggingId] = useState(null);
  const [modalStage, setModalStage] = useState(null);
  const [toast, setToast] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [liveJobs, setLiveJobs] = useState([]);
  const [liveStatus, setLiveStatus] = useState("idle");
  const [liveQuery, setLiveQuery] = useState("");
  const [liveSeason, setLiveSeason] = useState("all");
  const [liveRemote, setLiveRemote] = useState("all");
  const [liveLimit, setLiveLimit] = useState(240);
  const [liveTotal, setLiveTotal] = useState(0);
  const [liveFilteredTotal, setLiveFilteredTotal] = useState(0);
  const [liveFetchedAt, setLiveFetchedAt] = useState("");
  const [liveSources, setLiveSources] = useState([]);
  const nativeNoticeIdsRef = useRef(new Set());
  const sprintLabels = useMemo(() => createSprintLabels(), []);
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date()),
    [],
  );

  function applyWorkspace(workspace) {
    const next = normalizeWorkspace(workspace);
    setJobs(next.jobs);
    setTasks(next.tasks);
    setContacts(next.contacts);
    setDocuments(next.documents);
    setGoal(next.goal || blankGoal);
    setNotificationState(next.notificationState || blankNotificationState);
    cacheWorkspace(serializeWorkspace(next));
  }

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const data = await apiRequest("/api/me", { token: authToken });
        if (cancelled) return;
        setCurrentUser(data.user);
        applyWorkspace(data.workspace);
        setWorkspaceReady(true);
      } catch {
        if (cancelled) return;
        clearAuthToken();
        setAuthToken("");
        setWorkspaceReady(false);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const snapshot = serializeWorkspace({ jobs, tasks, contacts, documents, goal, notificationState });
    cacheWorkspace(snapshot);

    if (!currentUser || !workspaceReady) return undefined;
    const timer = window.setTimeout(async () => {
      try {
        await apiRequest("/api/workspace", {
          method: "PUT",
          token: authToken,
          body: { workspace: snapshot },
        });
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Workspace could not save to database");
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [jobs, tasks, contacts, documents, goal, notificationState, currentUser, authToken, workspaceReady]);

  useEffect(() => {
    if (!selectedId && jobs.length > 0) setSelectedId(jobs[0].id);
  }, [jobs, selectedId]);

  useEffect(() => {
    if (!currentUser) return undefined;
    const timer = window.setTimeout(() => {
      fetchLiveJobs(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [currentUser, liveQuery, liveSeason, liveRemote, liveLimit]);

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesSeason = season === "All" || job.season === season;
      const searchBlob = `${job.company} ${job.role} ${job.location} ${(job.tags || []).join(" ")} ${job.notes}`.toLowerCase();
      return matchesSeason && (!query || searchBlob.includes(query));
    });
  }, [jobs, search, season]);

  const groupedJobs = useMemo(() => {
    return stages.reduce((groups, stage) => {
      groups[stage.id] = filteredJobs
        .filter((job) => job.stage === stage.id)
        .sort((left, right) => right.match - left.match);
      return groups;
    }, {});
  }, [filteredJobs]);

  const selectedJob = jobs.find((job) => job.id === selectedId) || jobs[0];
  const hasPipelineFilters = Boolean(search.trim()) || season !== "All";
  const appliedCount = jobs.filter((job) => job.stage !== "saved").length;
  const oaCount = jobs.filter((job) => job.stage === "oa").length;
  const interviewCount = jobs.filter((job) => job.stage === "interview").length;
  const offerCount = jobs.filter((job) => job.stage === "offer").length;
  const upcoming = [...jobs]
    .filter((job) => job.deadline)
    .sort((left, right) => new Date(left.deadline) - new Date(right.deadline))
    .slice(0, 4);
  const importedIds = useMemo(() => new Set(jobs.map((job) => job.id)), [jobs]);
  const notifications = useMemo(
    () => buildNotificationFeed({ jobs, tasks, documents, goal }),
    [jobs, tasks, documents, goal],
  );
  const browserNotificationsAvailable = browserPermission !== "unsupported";
  const profile = currentUser?.profile || defaultProfile();

  useEffect(() => {
    const validIds = new Set(notifications.map((notification) => notification.id));
    setNotificationState((current) => {
      const readIds = current.readIds.filter((id) => validIds.has(id));
      const dismissedIds = current.dismissedIds.filter((id) => validIds.has(id));
      if (readIds.length === current.readIds.length && dismissedIds.length === current.dismissedIds.length) return current;
      return normalizeNotificationState({ ...current, readIds, dismissedIds });
    });
  }, [notifications]);

  useEffect(() => {
    if (!notificationState.browserAlerts || browserPermission !== "granted") return;
    const readSet = new Set(notificationState.readIds);
    const dismissedSet = new Set(notificationState.dismissedIds);
    notifications
      .filter((notification) => notification.native && !readSet.has(notification.id) && !dismissedSet.has(notification.id))
      .slice(0, 3)
      .forEach((notification) => {
        if (nativeNoticeIdsRef.current.has(notification.id)) return;
        nativeNoticeIdsRef.current.add(notification.id);
        try {
          const nativeNotification = new window.Notification(notification.title, {
            body: notification.body,
            icon: "/assets/career-track-mark.svg",
            tag: notification.id,
          });
          nativeNotification.onclick = () => {
            window.focus();
            handleNotificationOpen(notification);
            nativeNotification.close();
          };
        } catch {
          // Some mobile browsers expose Notification but still block native alerts.
        }
      });
  }, [notifications, notificationState, browserPermission]);

  async function fetchLiveJobs(refresh = false) {
    const params = new URLSearchParams({
      query: liveQuery,
      season: liveSeason,
      remote: liveRemote,
      limit: String(liveLimit),
    });
    if (refresh) params.set("refresh", "true");

    setLiveStatus("loading");
    try {
      const response = await fetch(`/api/jobs?${params.toString()}`);
      if (!response.ok) throw new Error(`Live feed returned ${response.status}`);
      const data = await response.json();
      setLiveJobs(Array.isArray(data.jobs) ? data.jobs : []);
      setLiveTotal(Number(data.total || data.count || 0));
      setLiveFilteredTotal(Number(data.filteredTotal || data.count || 0));
      setLiveFetchedAt(data.fetchedAt || "");
      setLiveSources(Array.isArray(data.sources) ? data.sources : []);
      setLiveStatus("ready");
    } catch (error) {
      setLiveStatus("error");
      setToast(error instanceof Error ? error.message : "Live feed failed");
    }
  }

  function updateJob(id, patch) {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  }

  function changeStage(id, stageId) {
    const stageLabel = stages.find((item) => item.id === stageId)?.label || "pipeline";
    updateJob(id, { stage: stageId, statusDate: `${stageLabel} today` });
    setToast(`Moved to ${stageLabel}`);
  }

  function togglePriority(id) {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, priority: !job.priority } : job)));
  }

  function removeJob(id) {
    const target = jobs.find((job) => job.id === id);
    if (!target) return;
    const confirmed = window.confirm(`Remove ${target.company} from Saved? This deletes it from your tracker.`);
    if (!confirmed) return;
    setJobs((current) => current.filter((job) => job.id !== id));
    setTasks((current) => current.filter((task) => task.sourceJobId !== id));
    if (selectedId === id) setSelectedId(null);
    setToast(`${target.company} removed from Saved`);
  }

  function handleDrop(stageId) {
    if (!draggingId) return;
    changeStage(draggingId, stageId);
    setDraggingId(null);
  }

  function addJob(job) {
    setJobs((current) => [job, ...current]);
    setSelectedId(job.id);
    setModalStage(null);
    setToast(`${job.company} added to ${stages.find((stage) => stage.id === job.stage)?.label}`);
  }

  function importLiveJob(job) {
    if (jobs.some((item) => item.id === job.id)) {
      setSelectedId(job.id);
      setActiveView("Pipeline");
      setToast(`${job.company} is already in your pipeline`);
      return;
    }

    const importedJob = {
      ...job,
      stage: "saved",
      priority: job.match >= 88,
      statusDate: "Imported today",
      deadline: job.deadline || "",
      contact: job.contact || "",
      contactRole: job.contactRole || "",
      contactEmail: job.contactEmail || "",
      notes: job.notes || "Imported from live feed. Verify sponsorship, location, and timing before applying.",
      nextStep: "Open posting, verify eligibility, and tailor resume.",
    };
    setJobs((current) => [importedJob, ...current]);
    setSelectedId(importedJob.id);
    setToast(`${job.company} imported to Saved`);
  }

  function completeNextStep(id) {
    updateJob(id, { nextStep: "Next step completed. Add a fresh follow-up when ready.", statusDate: "Updated today" });
    setToast("Next step marked complete");
  }

  function toggleTask(id) {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));
  }

  function addTask(taskInput) {
    const payload =
      typeof taskInput === "string"
        ? { title: taskInput, subtitle: "Added manually" }
        : taskInput;
    setTasks((current) => [
      {
        id: `task-${Date.now()}`,
        title: payload.title,
        subtitle: payload.subtitle || (payload.due ? `Due ${formatDate(payload.due)}` : "Added manually"),
        icon: payload.icon || CheckSquare2,
        done: false,
        due: payload.due || "",
        priority: payload.priority || "Medium",
        sourceJobId: payload.sourceJobId || "",
        taskType: payload.taskType || "",
      },
      ...current,
    ]);
    setToast("Task added");
  }

  function addContact(contact) {
    setContacts((current) => [contact, ...current]);
    setToast(`${contact.name} added to contacts`);
  }

  function addDocument(document) {
    const nextDocument = normalizeDocument(document);
    setDocuments((current) => [nextDocument, ...current]);
    setToast(`${document.name} added to documents`);
  }

  function updateDocument(id, nextDocument) {
    setDocuments((current) => current.map((document) => (document.id === id ? normalizeDocument({ ...document, ...nextDocument, id }) : document)));
    setToast(`${nextDocument.name || "Document"} updated`);
  }

  function deleteDocument(id) {
    const document = documents.find((item) => item.id === id);
    setDocuments((current) => current.filter((item) => item.id !== id));
    setToast(`${document?.name || "Document"} deleted`);
  }

  function duplicateDocument(id) {
    const document = documents.find((item) => item.id === id);
    if (!document) return;
    const copy = normalizeDocument({
      ...document,
      id: `document-${Date.now()}`,
      name: `${document.name} Copy`,
      status: "Draft",
      updated: new Date().toISOString(),
    });
    setDocuments((current) => [copy, ...current]);
    setToast(`${document.name} duplicated`);
  }

  function updateGoal(nextGoal) {
    setGoal(nextGoal);
    setToast(nextGoal.target ? "Goal saved" : "Goal cleared");
  }

  function setNextNotificationState(updater) {
    setNotificationState((current) => normalizeNotificationState(typeof updater === "function" ? updater(current) : updater));
  }

  function mergeNotificationIds(ids = [], nextId = "") {
    const nextIds = Array.isArray(ids) ? ids : [];
    const cleanId = safeNotificationId(nextId);
    if (!cleanId || nextIds.includes(cleanId)) return nextIds;
    return [cleanId, ...nextIds].slice(0, 600);
  }

  function markNotificationRead(id) {
    setNextNotificationState((current) => ({
      ...current,
      readIds: mergeNotificationIds(current.readIds, id),
    }));
  }

  function markAllNotificationsRead(ids = []) {
    setNextNotificationState((current) => {
      const nextIds = [...current.readIds];
      ids.forEach((id) => {
        const cleanId = safeNotificationId(id);
        if (cleanId && !nextIds.includes(cleanId)) nextIds.push(cleanId);
      });
      return { ...current, readIds: nextIds.slice(0, 600) };
    });
    setToast("Notifications marked read");
  }

  function dismissNotification(id) {
    setNextNotificationState((current) => ({
      ...current,
      readIds: mergeNotificationIds(current.readIds, id),
      dismissedIds: mergeNotificationIds(current.dismissedIds, id),
    }));
  }

  function restoreDismissedNotifications() {
    setNextNotificationState((current) => ({ ...current, dismissedIds: [] }));
    setToast("Dismissed notifications restored");
  }

  async function toggleBrowserAlerts() {
    if (!browserNotificationsAvailable) {
      setToast("Browser alerts are not supported here");
      return;
    }
    if (notificationState.browserAlerts) {
      setNextNotificationState((current) => ({ ...current, browserAlerts: false }));
      setToast("Browser alerts off");
      return;
    }
    if (window.Notification.permission === "granted") {
      setBrowserPermission("granted");
      setNextNotificationState((current) => ({ ...current, browserAlerts: true }));
      setToast("Browser alerts on");
      return;
    }
    const permission = await window.Notification.requestPermission();
    setBrowserPermission(permission);
    setNextNotificationState((current) => ({ ...current, browserAlerts: permission === "granted" }));
    setToast(permission === "granted" ? "Browser alerts on" : "Browser alerts were blocked");
  }

  function handleNotificationOpen(notification) {
    markNotificationRead(notification.id);
    const action = notification.action || {};
    if (action.jobId) {
      setSelectedId(action.jobId);
      setActiveView(action.view || "Pipeline");
    } else if (action.view) {
      setActiveView(action.view);
    }
    setNotificationPanelOpen(false);
  }

  async function handleRegister(draft) {
    try {
      const result = await apiRequest("/api/auth/register", {
        method: "POST",
        body: {
          email: draft.email,
          password: draft.password,
          name: draft.name,
          avatar: draft.avatar,
        },
        token: "",
      });
      saveAuthToken(result.token);
      setAuthToken(result.token);
      setCurrentUser(result.user);
      applyWorkspace(result.workspace);
      setWorkspaceReady(true);
      setToast("Account created");
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Could not create account." };
    }
  }

  async function handleLogin(draft) {
    try {
      const result = await apiRequest("/api/auth/login", {
        method: "POST",
        body: {
          email: draft.email,
          password: draft.password,
        },
        token: "",
      });
      saveAuthToken(result.token);
      setAuthToken(result.token);
      setCurrentUser(result.user);
      applyWorkspace(result.workspace);
      setWorkspaceReady(true);
      setToast("Logged in");
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Could not log in." };
    }
  }

  async function handleGoogleCredential(credential) {
    try {
      const result = await apiRequest("/api/auth/google", {
        method: "POST",
        body: { credential },
        token: "",
      });
      saveAuthToken(result.token);
      setAuthToken(result.token);
      setCurrentUser(result.user);
      applyWorkspace(result.workspace);
      setWorkspaceReady(true);
      setToast("Logged in with Google");
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Google sign-in could not finish." };
    }
  }

  async function updateProfile(nextProfile) {
    const updatedProfile = {
      ...defaultProfile(),
      ...currentUser?.profile,
      ...nextProfile,
    };
    setCurrentUser((current) => (current ? { ...current, profile: updatedProfile } : current));
    setToast("Profile saved");

    try {
      const result = await apiRequest("/api/profile", {
        method: "PATCH",
        token: authToken,
        body: { profile: updatedProfile },
      });
      setCurrentUser(result.user);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Profile could not save to database");
    }
  }

  function logout() {
    apiRequest("/api/auth/logout", { method: "POST", token: authToken }).catch(() => {});
    clearAuthToken();
    setAuthToken("");
    setCurrentUser(null);
    setWorkspaceReady(false);
  }

  function clearLocalData() {
    setJobs([]);
    setTasks([]);
    setContacts([]);
    setDocuments([]);
    setGoal({ target: "", deadline: "", label: "" });
    setNotificationState(blankNotificationState);
    setSelectedId(null);
    setSearch("");
    setSeason("All");
    setToast("Workspace cleared");
  }

  function loadMoreLiveJobs() {
    setLiveLimit((current) => current + 160);
  }

  function clearLiveFilters() {
    setLiveQuery("");
    setLiveSeason("all");
    setLiveRemote("all");
    setLiveLimit(240);
  }

  function clearPipelineFilters() {
    setSearch("");
    setSeason("All");
  }

  function selectCompany(company) {
    if (jobs.some((job) => job.company === company)) {
      setSearch(company);
      setSeason("All");
      setActiveView("Pipeline");
      return;
    }
    setLiveQuery(company);
    setActiveView("Search");
  }

  function renderUtilityView() {
    if (activeView === "Search") {
      return (
        <LiveSearchView
          liveJobs={liveJobs}
          liveStatus={liveStatus}
          liveQuery={liveQuery}
          liveSeason={liveSeason}
          liveRemote={liveRemote}
          liveTotal={liveTotal}
          liveFilteredTotal={liveFilteredTotal}
          liveLimit={liveLimit}
          setLiveQuery={setLiveQuery}
          setLiveSeason={setLiveSeason}
          setLiveRemote={setLiveRemote}
          onLoadMore={loadMoreLiveJobs}
          onClearFilters={clearLiveFilters}
          onRefresh={fetchLiveJobs}
          onImport={importLiveJob}
          importedIds={importedIds}
          fetchedAt={liveFetchedAt}
          sources={liveSources}
        />
      );
    }
    if (activeView === "Companies") return <CompaniesView jobs={jobs} liveJobs={liveJobs} onSelectCompany={selectCompany} />;
    if (activeView === "Leaderboard") return <LeaderboardView authToken={authToken} />;
    if (activeView === "Contacts") {
      return (
        <ContactsView
          contacts={contacts}
          jobs={jobs}
          onAddContact={addContact}
          onCreateTask={addTask}
          onSelectJob={(id) => {
            setSelectedId(id);
            setActiveView("Pipeline");
          }}
        />
      );
    }
    if (activeView === "Calendar") {
      return (
        <CalendarView
          jobs={jobs}
          tasks={tasks}
          onToggleTask={toggleTask}
          onSelectJob={(id) => {
            setSelectedId(id);
            setActiveView("Pipeline");
          }}
        />
      );
    }
    if (activeView === "Tasks") {
      return (
        <TasksView
          tasks={tasks}
          jobs={jobs}
          onToggleTask={toggleTask}
          onAddTask={addTask}
          onSelectJob={(id) => {
            setSelectedId(id);
            setActiveView("Pipeline");
          }}
        />
      );
    }
    if (activeView === "Documents") {
      return (
        <DocumentsView
          documents={documents}
          jobs={jobs}
          authToken={authToken}
          onAddDocument={addDocument}
          onUpdateDocument={updateDocument}
          onDeleteDocument={deleteDocument}
          onDuplicateDocument={duplicateDocument}
          onSelectJob={(id) => {
            setSelectedId(id);
            setActiveView("Pipeline");
          }}
          onToast={setToast}
        />
      );
    }
    if (activeView === "Analytics") return <AnalyticsView jobs={jobs} />;
    if (activeView === "Resources") return <ResourcesView />;
    if (activeView === "Settings") {
      return (
        <SettingsView
          liveStatus={liveStatus}
          fetchedAt={liveFetchedAt}
          goal={goal}
          currentUser={currentUser}
          onGoalChange={updateGoal}
          onProfileUpdate={updateProfile}
          onLogout={logout}
          onRefresh={fetchLiveJobs}
          onReset={clearLocalData}
          sources={liveSources}
        />
      );
    }
    return null;
  }

  if (!authReady) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="auth-visual">
            <img src={profilePresets[0].src} alt="" />
            <div>
              <strong>Career Tracker</strong>
              <span>Internship + New Grad</span>
            </div>
          </div>
          <div className="auth-form">
            <p>Database session</p>
            <h1>Connecting your tracker</h1>
          </div>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} onRegister={handleRegister} onGoogleCredential={handleGoogleCredential} />;
  }

  return (
    <div className="app-shell">
      <aside className={classNames("sidebar", mobileNavOpen && "is-open")}>
        <div className="brand-lockup">
          <img src="/assets/career-track-mark.svg" alt="Career tracker mark" />
          <div>
            <strong>Career Tracker</strong>
            <span>Internship + New Grad</span>
          </div>
        </div>

        <nav aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                className={item.label === activeView ? "is-active" : ""}
                type="button"
                onClick={() => {
                  setActiveView(item.label);
                  setMobileNavOpen(false);
                }}
              >
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="student-card">
          <img src={profile.avatar} alt="" />
          <strong>{profile.name}</strong>
          <span>{profile.program}</span>
          <span>{profile.graduation}</span>
          <small>{profile.visa}</small>
          <button type="button" onClick={() => setActiveView("Settings")}>
            Edit Profile <Pencil size={13} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <IconButton label="Open navigation" className="mobile-menu" onClick={() => setMobileNavOpen((open) => !open)}>
            <Menu size={20} />
          </IconButton>
          <div className="title-block">
            <h1>Career Tracker Dashboard</h1>
            <p>{profile.graduation} · {profile.program}</p>
          </div>

          <div className="sprint-control" aria-label="Sprint selector">
            <IconButton label="Previous sprint" onClick={() => setSprintIndex((index) => Math.max(0, index - 1))}>
              <ChevronLeft size={17} />
            </IconButton>
            <button type="button">
              <CalendarDays size={17} aria-hidden="true" />
              Sprint: {sprintLabels[sprintIndex]}
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            <IconButton label="Next sprint" onClick={() => setSprintIndex((index) => Math.min(sprintLabels.length - 1, index + 1))}>
              <ChevronRight size={17} />
            </IconButton>
          </div>

          <label className="search-box">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Search jobs, companies, and notes</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search jobs, companies, notes..." />
            <kbd>⌘ K</kbd>
          </label>

          <div className="top-actions">
            <IconButton label="Clear workspace data" onClick={clearLocalData}>
              <RefreshCcw size={17} />
            </IconButton>
            <NotificationCenter
              notifications={notifications}
              notificationState={notificationState}
              browserPermission={browserPermission}
              browserNotificationsAvailable={browserNotificationsAvailable}
              isOpen={notificationPanelOpen}
              onToggle={() => setNotificationPanelOpen((open) => !open)}
              onClose={() => setNotificationPanelOpen(false)}
              onOpenNotification={handleNotificationOpen}
              onMarkAllRead={markAllNotificationsRead}
              onDismiss={dismissNotification}
              onRestoreDismissed={restoreDismissedNotifications}
              onToggleBrowserAlerts={toggleBrowserAlerts}
            />
            <button className="avatar-button" type="button" aria-label="Open account menu" onClick={() => setActiveView("Settings")}>
              <img src={profile.avatar} alt="" />
              {getInitials(profile.name)} <ChevronDown size={13} aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="dashboard">
          {activeView === "Dashboard" || activeView === "Pipeline" ? (
            <DashboardView
              jobs={jobs}
              tasks={tasks}
              groupedJobs={groupedJobs}
              selectedJob={selectedJob}
              filteredJobs={filteredJobs}
              appliedCount={appliedCount}
              oaCount={oaCount}
              interviewCount={interviewCount}
              offerCount={offerCount}
              goal={goal}
              season={season}
              upcoming={upcoming}
              todayLabel={todayLabel}
              hasPipelineFilters={hasPipelineFilters}
              onSeasonChange={setSeason}
              onGoalChange={updateGoal}
              onOpenAddJob={setModalStage}
              onSelectJob={setSelectedId}
              onStageChange={changeStage}
              onTogglePriority={togglePriority}
              onRemoveJob={removeJob}
              onDrop={handleDrop}
              onDragStart={setDraggingId}
              onUpdateNotes={(id, notes) => updateJob(id, { notes })}
              onCompleteNextStep={completeNextStep}
              onToggleTask={toggleTask}
              onClearPipelineFilters={clearPipelineFilters}
              onShowSearch={() => setActiveView("Search")}
              onShowTasks={() => setActiveView("Tasks")}
              onShowCalendar={() => setActiveView("Calendar")}
              onShowContacts={() => setActiveView("Contacts")}
            />
          ) : (
            renderUtilityView()
          )}
        </main>
      </div>

      <AddJobModal open={modalStage !== null} defaultStage={modalStage} onClose={() => setModalStage(null)} onAdd={addJob} />

      {toast && (
        <div className="toast" role="status" onAnimationEnd={() => setToast("")}>
          <Check size={15} aria-hidden="true" />
          {toast}
        </div>
      )}
    </div>
  );
}
