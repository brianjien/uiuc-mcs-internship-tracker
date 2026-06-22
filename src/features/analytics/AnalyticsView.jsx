import { useRef, useState } from "react";
import { FiDownload as Download } from "react-icons/fi";
import { stages } from "../../config/appConfig.jsx";
import { classNames, ViewHeader } from "../../components/ui.jsx";
import { downloadSvg, downloadSvgAsPng } from "../../lib/sankeyExport.js";

function buildSankeyStats(jobs = []) {
  const counts = {
    total: jobs.length,
    saved: jobs.filter((job) => job.stage === "saved").length,
    applied: jobs.filter((job) => job.stage === "applied").length,
    oa: jobs.filter((job) => job.stage === "oa").length,
    interview: jobs.filter((job) => job.stage === "interview").length,
    offer: jobs.filter((job) => job.stage === "offer").length,
  };
  counts.sent = Math.max(0, counts.total - counts.saved);
  counts.replies = counts.oa + counts.interview + counts.offer;
  counts.interviewLoop = counts.interview + counts.offer;

  const nodes = [
    { id: "tracked", label: "Roles tracked", value: counts.total, x: 80, y: 260, tone: "green" },
    { id: "saved", label: "Not applied yet", value: counts.saved, x: 270, y: 360, tone: "red" },
    { id: "sent", label: "Applications sent", value: counts.sent, x: 270, y: 175, tone: "green" },
    { id: "noReply", label: "No reply / stalled", value: counts.applied, x: 475, y: 285, tone: "red" },
    { id: "replies", label: "Replies or screens", value: counts.replies, x: 475, y: 130, tone: "green" },
    { id: "oa", label: "OA / assessment", value: counts.oa, x: 690, y: 92, tone: "green" },
    { id: "interview", label: "Interview loop", value: counts.interviewLoop, x: 690, y: 190, tone: "green" },
    { id: "stillInterviewing", label: "Still interviewing", value: counts.interview, x: 900, y: 238, tone: "green" },
    { id: "offer", label: "Offer received", value: counts.offer, x: 900, y: 130, tone: "green" },
  ];
  const nodeMap = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const links = [
    { from: "tracked", to: "sent", value: counts.sent, tone: "green", y1: 242, y2: 180 },
    { from: "tracked", to: "saved", value: counts.saved, tone: "red", y1: 282, y2: 360 },
    { from: "sent", to: "replies", value: counts.replies, tone: "green", y1: 164, y2: 132 },
    { from: "sent", to: "noReply", value: counts.applied, tone: "red", y1: 198, y2: 286 },
    { from: "replies", to: "oa", value: counts.oa, tone: "green", y1: 116, y2: 92 },
    { from: "replies", to: "interview", value: counts.interviewLoop, tone: "green", y1: 148, y2: 190 },
    { from: "interview", to: "offer", value: counts.offer, tone: "green", y1: 178, y2: 130 },
    { from: "interview", to: "stillInterviewing", value: counts.interview, tone: "green", y1: 208, y2: 238 },
  ].filter((link) => link.value > 0);
  return { counts, nodes, nodeMap, links };
}

function sankeyPath(x1, y1, x2, y2) {
  const curve = Math.max(60, (x2 - x1) * 0.58);
  return `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`;
}

function getSankeyLabelPosition(node) {
  if (node.id === "tracked") return { x: 18, anchor: "start" };
  if (node.x > 760) return { x: 18, anchor: "start" };
  return { x: -18, anchor: "end" };
}

function JobSearchSankey({ jobs, svgRef }) {
  const { counts, nodes, nodeMap, links } = buildSankeyStats(jobs);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);
  const maxFlow = Math.max(1, counts.total);
  const flowScale = Math.min(30, 150 / maxFlow);
  const activeCompanies = new Set(jobs.map((job) => job.company).filter(Boolean)).size;

  function startPan(event) {
    if (event.button !== undefined && event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  }

  function movePan(event) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    setPan({
      x: dragRef.current.panX + event.clientX - dragRef.current.startX,
      y: dragRef.current.panY + event.clientY - dragRef.current.startY,
    });
  }

  function stopPan(event) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setDragging(false);
  }

  function panWithKeyboard(event) {
    const step = event.shiftKey ? 40 : 16;
    const moves = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    if (event.key === "Home") {
      event.preventDefault();
      setPan({ x: 0, y: 0 });
      return;
    }
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setPan((current) => ({ x: current.x + move.x, y: current.y + move.y }));
  }

  if (counts.total === 0) {
    return (
      <svg
        ref={svgRef}
        className="sankey-svg sankey-svg-empty"
        viewBox="0 0 720 420"
        role="img"
        aria-label="Empty job search Sankey diagram"
      >
        <rect width="720" height="420" rx="8" fill="#ffffff" />
        <circle cx="360" cy="148" r="48" fill="#e4f7ec" />
        <path d="M328 148h64M360 116v64" stroke="#087b45" strokeWidth="10" strokeLinecap="round" />
        <text x="360" y="238" textAnchor="middle" className="sankey-title">
          Job Search Sankey
        </text>
        <text x="360" y="270" textAnchor="middle" className="sankey-subtitle">
          Import or add roles to generate your diagram.
        </text>
        <text x="360" y="298" textAnchor="middle" className="sankey-empty-copy">
          Saved, applied, OA, interview, and offer stages will turn into flows automatically.
        </text>
      </svg>
    );
  }

  return (
    <svg
      ref={svgRef}
      className={classNames("sankey-svg", dragging && "is-dragging")}
      viewBox="0 0 1120 520"
      role="img"
      aria-label="Job search Sankey diagram"
      tabIndex="0"
      onPointerDown={startPan}
      onPointerMove={movePan}
      onPointerUp={stopPan}
      onPointerCancel={stopPan}
      onDoubleClick={() => setPan({ x: 0, y: 0 })}
      onKeyDown={panWithKeyboard}
    >
      <title>Drag to pan the Sankey diagram. Double-click or press Home to reset.</title>
      <rect width="1120" height="520" rx="8" fill="#ffffff" />
      <text x="560" y="58" textAnchor="middle" className="sankey-title">
        Job Search Sankey
      </text>
      <text x="560" y="85" textAnchor="middle" className="sankey-subtitle">
        {counts.total} tracked roles across {activeCompanies} companies
      </text>

      <g className="sankey-pan-layer" transform={`translate(${pan.x} ${pan.y})`}>
        <g fill="none" strokeLinecap="round">
          {links.map((link) => {
            const from = nodeMap[link.from];
            const to = nodeMap[link.to];
            return (
              <path
                key={`${link.from}-${link.to}`}
                d={sankeyPath(from.x + 12, link.y1, to.x - 12, link.y2)}
                className={classNames("sankey-flow", `is-${link.tone}`)}
                strokeWidth={Math.max(5, link.value * flowScale)}
              />
            );
          })}
        </g>

        {nodes.map((node) => {
          const labelPosition = getSankeyLabelPosition(node);
          return (
            <g
              key={node.id}
              className={classNames("sankey-node", `is-${node.tone}`, node.value === 0 && "is-empty")}
              transform={`translate(${node.x}, ${node.y})`}
            >
              <rect x="-10" y="-38" width="20" height="76" rx="4" />
              <text className="sankey-label-main" x={labelPosition.x} y="-4" textAnchor={labelPosition.anchor}>
                {node.label}
              </text>
              <text className="sankey-label-value" x={labelPosition.x} y="15" textAnchor={labelPosition.anchor}>
                {node.value}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export function AnalyticsView({ jobs }) {
  const sankeyRef = useRef(null);
  const counts = stages.map((stage) => ({
    ...stage,
    count: jobs.filter((job) => job.stage === stage.id).length,
  }));
  const max = Math.max(1, ...counts.map((item) => item.count));
  const offerRate = Math.round((jobs.filter((job) => job.stage === "offer").length / Math.max(1, jobs.length)) * 100);

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Analytics" title="Pipeline health" />
      <div className="analytics-grid">
        <article className="rail-card">
          <h3>Funnel</h3>
          <div className="funnel-bars">
            {counts.map((item) => (
              <div key={item.id}>
                <span>{item.label}</span>
                <i style={{ width: `${(item.count / max) * 100}%` }} />
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </article>
        <article className="rail-card">
          <h3>Offer Rate</h3>
          <strong className="big-number">{offerRate}%</strong>
          <p>{jobs.length} tracked roles across {new Set(jobs.map((job) => job.company)).size} companies</p>
        </article>
        <article className="rail-card sankey-card">
          <div className="sankey-card-head">
            <span>
              <h3>Job Search Sankey</h3>
              <p>Generated from your saved, applied, OA, interview, and offer pipeline stages.</p>
            </span>
            <div className="sankey-actions">
              <button className="secondary-button" type="button" onClick={() => downloadSvgAsPng(sankeyRef.current, "job-search-sankey.png")}>
                <Download size={14} aria-hidden="true" />
                PNG
              </button>
              <button className="secondary-button" type="button" onClick={() => downloadSvg(sankeyRef.current, "job-search-sankey.svg")}>
                <Download size={14} aria-hidden="true" />
                SVG
              </button>
            </div>
          </div>
          <div className={classNames("sankey-scroll", jobs.length === 0 && "is-empty")}>
            <JobSearchSankey jobs={jobs} svgRef={sankeyRef} />
          </div>
        </article>
      </div>
    </section>
  );
}
