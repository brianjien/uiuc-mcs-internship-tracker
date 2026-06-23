import {
  FiBarChart2 as BarChart3,
  FiBookOpen as BookOpen,
  FiBookmark as Bookmark,
  FiBriefcase as Building2,
  FiCalendar as CalendarDays,
  FiCheckSquare as CheckSquare2,
  FiCode as FlaskConical,
  FiFileText as FileText,
  FiAward as Trophy,
  FiHome as Home,
  FiGrid as KanbanSquare,
  FiSearch as Search,
  FiSend as Send,
  FiSettings as Settings,
  FiUsers as Users,
} from "react-icons/fi";
import {
  SiAirbnb,
  SiBytedance,
  SiCisco,
  SiDatabricks,
  SiGoogle,
  SiMeta,
  SiNvidia,
  SiOpenai,
  SiPaloaltonetworks,
  SiSnowflake,
  SiStripe,
} from "react-icons/si";
import { FaAmazon, FaMicrosoft } from "react-icons/fa";

export const STORAGE_KEY = "career-tracker-workspace-v1";

export const stages = [
  {
    id: "saved",
    label: "Saved",
    accent: "green",
    icon: Bookmark,
    empty: "Save roles that fit your target cycle.",
  },
  {
    id: "applied",
    label: "Applied",
    accent: "blue",
    icon: Send,
    empty: "Log every application you submit.",
  },
  {
    id: "oa",
    label: "OA",
    accent: "indigo",
    icon: FlaskConical,
    empty: "Track coding challenge deadlines here.",
  },
  {
    id: "interview",
    label: "Interview",
    accent: "purple",
    icon: Users,
    empty: "Prep notes and recruiter follow-ups land here.",
  },
  {
    id: "offer",
    label: "Offer",
    accent: "amber",
    icon: Trophy,
    empty: "Celebrate, compare, and negotiate offers.",
  },
];

export const navItems = [
  { label: "Dashboard", icon: Home },
  { label: "Pipeline", icon: KanbanSquare },
  { label: "Leaderboard", icon: Trophy },
  { label: "Search", icon: Search },
  { label: "Companies", icon: Building2 },
  { label: "Contacts", icon: Users },
  { label: "Calendar", icon: CalendarDays },
  { label: "Tasks", icon: CheckSquare2 },
  { label: "Documents", icon: FileText },
  { label: "Analytics", icon: BarChart3 },
  { label: "Resources", icon: BookOpen },
  { label: "Settings", icon: Settings },
];

export const companyIcons = {
  NVIDIA: { icon: SiNvidia, className: "brand-nvidia" },
  Meta: { icon: SiMeta, className: "brand-meta" },
  Databricks: { icon: SiDatabricks, className: "brand-databricks" },
  Amazon: { icon: FaAmazon, className: "brand-amazon" },
  Google: { icon: SiGoogle, className: "brand-google" },
  Snowflake: { icon: SiSnowflake, className: "brand-snowflake" },
  Stripe: { icon: SiStripe, className: "brand-stripe" },
  Microsoft: { icon: FaMicrosoft, className: "brand-microsoft" },
  "Palo Alto Networks": { icon: SiPaloaltonetworks, className: "brand-palo" },
  Cisco: { icon: SiCisco, className: "brand-cisco" },
  ByteDance: { icon: SiBytedance, className: "brand-bytedance" },
  OpenAI: { icon: SiOpenai, className: "brand-openai" },
  Airbnb: { icon: SiAirbnb, className: "brand-airbnb" },
};

export const resourceLinks = [
  { title: "Zero to Offer", type: "Guide", source: "Pitt CSC", url: "https://pittcs.wiki/guides/zero-to-offer" },
  { title: "Tech Interview Handbook", type: "Prep", source: "Yangshun Tay", url: "https://www.techinterviewhandbook.org/" },
  { title: "Simplify Summer 2026 List", type: "Jobs", source: "SimplifyJobs", url: "https://github.com/SimplifyJobs/Summer2026-Internships" },
  { title: "New Grad Positions", type: "Jobs", source: "SimplifyJobs", url: "https://github.com/SimplifyJobs/New-Grad-Positions" },
];

export const profilePresets = [
  { id: "portrait", label: "Portrait", src: "/assets/profile-presets/avatar-portrait.png" },
  { id: "workspace", label: "Workspace", src: "/assets/profile-presets/avatar-workspace.png" },
  { id: "abstract", label: "Abstract", src: "/assets/profile-presets/avatar-abstract.svg" },
  { id: "signal", label: "Signal", src: "/assets/profile-presets/avatar-signal.svg" },
];

export const blankNotificationState = {
  readIds: [],
  dismissedIds: [],
  browserAlerts: false,
};

export const emptyStoredData = {
  jobs: [],
  tasks: [],
  contacts: [],
  documents: [],
  goal: null,
  notificationState: blankNotificationState,
};

export const blankGoal = { target: "", deadline: "", label: "" };

export const documentTypeOptions = ["Resume", "Cover Letter", "Portfolio", "Transcript", "Referral Note", "Template", "Other"];
export const documentStatusOptions = ["Draft", "Needs Review", "Ready", "Submitted", "Archived"];
export const uploadDocumentLimit = 10_000_000;

export const sankeyExportStyles = `
  .sankey-title { fill: #124166; font: 850 25px Inter, Arial, sans-serif; }
  .sankey-subtitle { fill: #5f6d65; font: 720 13px Inter, Arial, sans-serif; }
  .sankey-flow { opacity: .76; }
  .sankey-flow.is-green { stroke: #53c861; }
  .sankey-flow.is-red { stroke: #c9484d; }
  .sankey-node.is-green rect { fill: #0aa044; }
  .sankey-node.is-red rect { fill: #bd272d; }
  .sankey-node.is-empty { opacity: .38; }
  .sankey-label-main { fill: #0f1813; font: 850 11px Inter, Arial, sans-serif; }
  .sankey-label-value { fill: #0f1813; font: 950 13px Inter, Arial, sans-serif; }
  .sankey-empty text { fill: #657067; font: 760 14px Inter, Arial, sans-serif; }
`;

export const blankDocumentDraft = {
  name: "",
  type: "Resume",
  status: "Draft",
  target: "General",
  sourceJobId: "",
  url: "",
  version: "v1",
  owner: "",
  notes: "",
  fileName: "",
  fileType: "",
  fileSize: 0,
  fileData: "",
  fileKey: "",
  fileUrl: "",
  storage: "",
};

export function defaultProfile(overrides = {}) {
  return {
    name: "Candidate",
    program: "Career Profile",
    graduation: "2026-2027 cycle",
    visa: "Internship + New Grad",
    avatar: profilePresets[0].src,
    ...overrides,
  };
}
