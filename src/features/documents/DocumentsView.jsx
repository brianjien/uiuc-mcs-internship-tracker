import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiArrowUpRight as ArrowUpRight,
  FiBriefcase as BriefcaseBusiness,
  FiCopy as Copy,
  FiDownload as Download,
  FiEye as Eye,
  FiExternalLink as ExternalLink,
  FiFileText as FileText,
  FiFilter as Filter,
  FiEdit2 as Pencil,
  FiPlus as Plus,
  FiSearch as Search,
  FiTrash2 as Trash2,
  FiUpload as Upload,
  FiX as X,
} from "react-icons/fi";
import { blankDocumentDraft, documentStatusOptions, documentTypeOptions, uploadDocumentLimit } from "../../config/appConfig.jsx";
import { classNames, EmptyState, ViewHeader } from "../../components/ui.jsx";
import { formatDate } from "../../lib/dates.js";
import {
  formatBytes,
  getDocumentDownloadUrl,
  getJobDocumentLabel,
  isOpenableUrl,
  normalizeDocument,
  safeDocumentFileUrl,
  safeExternalUrl,
  uploadDocumentFile,
} from "../../lib/documents.js";
import { DocumentPreviewPanel } from "./DocumentPreviewPanel.jsx";

export function DocumentsView({
  documents,
  jobs,
  authToken,
  onAddDocument,
  onUpdateDocument,
  onDeleteDocument,
  onDuplicateDocument,
  onSelectJob,
  onToast,
}) {
  const fileInputRef = useRef(null);
  const [draft, setDraft] = useState(blankDocumentDraft);
  const [editingId, setEditingId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [fileNotice, setFileNotice] = useState("");
  const [previewDocument, setPreviewDocument] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const targetOptions = useMemo(() => {
    const seen = new Set(["General"]);
    const options = ["General"];
    jobs.forEach((job) => {
      const label = getJobDocumentLabel(job);
      if (!seen.has(label)) {
        seen.add(label);
        options.push(label);
      }
    });
    return options;
  }, [jobs]);
  const jobOptions = useMemo(
    () => [...jobs].sort((left, right) => getJobDocumentLabel(left).localeCompare(getJobDocumentLabel(right))),
    [jobs],
  );
  const jobById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const jobByLabel = useMemo(() => new Map(jobs.map((job) => [getJobDocumentLabel(job), job])), [jobs]);

  function resolveDocumentJob(document) {
    return jobById.get(document.sourceJobId) || jobByLabel.get(document.target) || null;
  }

  const filteredDocuments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents.filter((document) => {
      const linkedJob = resolveDocumentJob(document);
      const matchesStatus = statusFilter === "All" || document.status === statusFilter;
      const matchesType = typeFilter === "All" || document.type === typeFilter;
      const blob = `${document.name} ${document.type} ${document.status} ${document.target} ${document.url} ${document.notes} ${linkedJob ? getJobDocumentLabel(linkedJob) : ""}`.toLowerCase();
      return matchesStatus && matchesType && (!needle || blob.includes(needle));
    });
  }, [documents, query, statusFilter, typeFilter, jobById, jobByLabel]);

  const readyCount = documents.filter((document) => document.status === "Ready" || document.status === "Submitted").length;
  const reviewCount = documents.filter((document) => document.status === "Needs Review").length;
  const linkedCount = documents.filter((document) => resolveDocumentJob(document)).length;
  const sortedDocumentUpdates = documents
    .map((document) => document.updated)
    .filter(Boolean)
    .sort();
  const latestUpdate = sortedDocumentUpdates[sortedDocumentUpdates.length - 1];

  useEffect(() => {
    if (!previewDocument) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setPreviewDocument(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewDocument]);

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateLinkedJob(jobId) {
    const linkedJob = jobById.get(jobId);
    setDraft((current) => ({
      ...current,
      sourceJobId: linkedJob ? linkedJob.id : "",
      target: linkedJob ? getJobDocumentLabel(linkedJob) : current.target || "General",
    }));
  }

  function resetDraft() {
    setDraft(blankDocumentDraft);
    setEditingId("");
    setFileNotice("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function editDocument(document) {
    const linkedJob = resolveDocumentJob(document);
    setDraft({
      ...blankDocumentDraft,
      ...document,
      target: document.target || "General",
      sourceJobId: linkedJob?.id || document.sourceJobId || "",
    });
    setEditingId(document.id);
    setFileNotice(document.fileName ? `${document.fileName}${document.fileSize ? ` · ${formatBytes(document.fileSize)}` : ""}` : "");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function clearAttachedFile() {
    setDraft((current) => ({
      ...current,
      fileName: "",
      fileType: "",
      fileSize: 0,
      fileData: "",
      fileKey: "",
      fileUrl: "",
      storage: "",
    }));
    setFileNotice("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const fileMeta = {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    };
    if (file.size > uploadDocumentLimit) {
      setDraft((current) => ({
        ...current,
        ...fileMeta,
        fileData: "",
        fileKey: "",
        fileUrl: "",
        storage: "",
      }));
      setSelectedFile(null);
      setFileNotice(`${file.name} is over 10 MB`);
      onToast("Use a file under 10 MB");
      return;
    }
    setSelectedFile(file);
    setDraft((current) => ({
      ...current,
      ...fileMeta,
      fileData: "",
      fileKey: "",
      fileUrl: "",
      storage: "",
    }));
    setFileNotice(`${file.name} · ${formatBytes(file.size)} ready to upload`);
  }

  async function submit(event) {
    event.preventDefault();
    if (!draft.name.trim() || uploading) return;
    setUploading(true);
    try {
      const uploadedMeta = selectedFile ? await uploadDocumentFile(selectedFile, authToken) : {};
      const linkedJob = jobById.get(draft.sourceJobId);
      const nextDocument = normalizeDocument({
        ...draft,
        ...uploadedMeta,
        id: editingId || `document-${Date.now()}`,
        name: draft.name.trim(),
        url: safeExternalUrl(draft.url),
        target: linkedJob ? getJobDocumentLabel(linkedJob) : draft.target.trim() || "General",
        sourceJobId: linkedJob?.id || "",
        owner: draft.owner.trim(),
        notes: draft.notes.trim(),
        version: draft.version.trim() || "v1",
        status: draft.status,
        fileData: uploadedMeta.fileUrl ? "" : draft.fileData,
        updated: new Date().toISOString(),
      });
      if (editingId) {
        onUpdateDocument(editingId, nextDocument);
      } else {
        onAddDocument(nextDocument);
      }
      resetDraft();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "File could not upload");
    } finally {
      setUploading(false);
    }
  }

  async function copyLink(document) {
    const link = safeExternalUrl(document.url);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      onToast(`${document.name} link copied`);
    } catch {
      onToast("Link could not be copied");
    }
  }

  function openPreview(document) {
    if (!document.fileData && !safeDocumentFileUrl(document.fileUrl) && !isOpenableUrl(document.url)) {
      onToast("Add a file or link before previewing");
      return;
    }
    setPreviewDocument(document);
  }

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Documents" title="Resume and application assets" />
      <div className="document-stats">
        <article>
          <strong>{documents.length}</strong>
          <span>assets</span>
        </article>
        <article>
          <strong>{readyCount}</strong>
          <span>ready</span>
        </article>
        <article>
          <strong>{reviewCount}</strong>
          <span>needs review</span>
        </article>
        <article>
          <strong>{linkedCount}</strong>
          <span>linked roles</span>
        </article>
        <article>
          <strong>{latestUpdate ? formatDate(latestUpdate, { month: "short", day: "numeric" }) : "None"}</strong>
          <span>last update</span>
        </article>
      </div>

      <div className="document-workspace">
        <form className="document-form" onSubmit={submit}>
          <div className="document-form-head">
            <FileText size={18} aria-hidden="true" />
            <span>
              <strong>{editingId ? "Edit asset" : "New asset"}</strong>
              <small>{editingId ? "Updating saved document" : "Saved to your workspace"}</small>
            </span>
          </div>
          <label>
            Name
            <input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="SWE resume v1" />
          </label>
          <label>
            Type
            <select value={draft.type} onChange={(event) => update("type", event.target.value)}>
              {documentTypeOptions.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            Status
            <select value={draft.status} onChange={(event) => update("status", event.target.value)}>
              {documentStatusOptions.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label>
            Target
            <select value={draft.target} onChange={(event) => update("target", event.target.value)}>
              {targetOptions.map((target) => <option key={target}>{target}</option>)}
            </select>
          </label>
          <label>
            Linked saved job
            <select value={draft.sourceJobId} onChange={(event) => updateLinkedJob(event.target.value)}>
              <option value="">No linked job</option>
              {jobOptions.map((job) => (
                <option key={job.id} value={job.id}>
                  {getJobDocumentLabel(job)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Version
            <input value={draft.version} onChange={(event) => update("version", event.target.value)} placeholder="v1" />
          </label>
          <label>
            Owner
            <input value={draft.owner} onChange={(event) => update("owner", event.target.value)} placeholder="Self, mentor, recruiter" />
          </label>
          <label className="document-wide-field">
            Link
            <input value={draft.url} onChange={(event) => update("url", event.target.value)} placeholder="https://drive.google.com/..." />
          </label>
          <label className="document-file-field">
            File
            <input ref={fileInputRef} type="file" onChange={handleFileChange} />
            <span>
              <Upload size={15} aria-hidden="true" />
              {fileNotice || "Choose file"}
            </span>
          </label>
          {draft.fileName && (
            <button className="text-button document-clear-file" type="button" onClick={clearAttachedFile}>
              Remove file
            </button>
          )}
          <label className="document-wide-field">
            Notes
            <textarea value={draft.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Tailoring notes, reviewer feedback, or usage rules" />
          </label>
          <div className="document-form-actions">
            {editingId && (
              <button className="secondary-button" type="button" onClick={resetDraft} disabled={uploading}>
                Cancel
              </button>
            )}
            <button className="primary-button" type="submit" disabled={uploading}>
              <Plus size={16} aria-hidden="true" />
              {uploading ? "Uploading..." : editingId ? "Save Changes" : "Add Asset"}
            </button>
          </div>
        </form>

        <div className="document-library">
          <div className="document-toolbar">
            <div className="document-search">
              <Search size={16} aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents" />
            </div>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option>All</option>
              {documentTypeOptions.map((type) => <option key={type}>{type}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option>All</option>
              {documentStatusOptions.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>

          {documents.length === 0 && (
            <EmptyState icon={FileText} title="No documents yet" text="Add resumes, templates, or portfolio links when you create them." />
          )}
          {documents.length > 0 && filteredDocuments.length === 0 && (
            <EmptyState icon={Filter} title="No matching documents" text="Adjust the filters or search term." />
          )}
          <div className="document-grid">
            {filteredDocuments.map((doc) => {
              const documentUrl = safeExternalUrl(doc.url);
              const fileUrl = safeDocumentFileUrl(doc.fileUrl);
              const downloadUrl = getDocumentDownloadUrl(doc);
              const linkedJob = resolveDocumentJob(doc);
              const canOpenLink = Boolean(documentUrl);
              const canPreview = Boolean(doc.fileData || fileUrl || canOpenLink);
              return (
                <article key={doc.id} className="document-card">
                  <div className="document-card-head">
                    <span className="document-icon" aria-hidden="true">
                      <FileText size={18} />
                    </span>
                    <span>
                      <strong>{doc.name}</strong>
                      <small>{doc.type} · {linkedJob ? getJobDocumentLabel(linkedJob) : doc.target || "General"}</small>
                    </span>
                    <small className={classNames("document-status", `is-${doc.status.toLowerCase().replace(/\s+/g, "-")}`)}>
                      {doc.status}
                    </small>
                  </div>
                  <div className="document-meta">
                    <span>
                      Version
                      <strong>{doc.version}</strong>
                    </span>
                    <span>
                      Updated
                      <strong>{formatDate(doc.updated, { month: "short", day: "numeric" })}</strong>
                    </span>
                    <span>
                      Owner
                      <strong>{doc.owner || "Self"}</strong>
                    </span>
                  </div>
                  {(doc.fileName || doc.url) && (
                    <div className="document-source">
                      {doc.fileName ? `${doc.fileName}${doc.fileSize ? ` · ${formatBytes(doc.fileSize)}` : ""}` : doc.url}
                    </div>
                  )}
                  {doc.notes && <p className="document-notes">{doc.notes}</p>}
                  <div className="document-card-actions">
                    <button
                      className="secondary-button document-preview-trigger"
                      type="button"
                      onClick={() => openPreview(doc)}
                      disabled={!canPreview}
                      aria-label={`Preview ${doc.name}`}
                    >
                      <Eye size={14} aria-hidden="true" />
                      Preview
                    </button>
                    {canOpenLink ? (
                      <a className="secondary-button" href={documentUrl} target="_blank" rel="noreferrer">
                        Open <ArrowUpRight size={14} aria-hidden="true" />
                      </a>
                    ) : downloadUrl ? (
                      <a className="secondary-button" href={downloadUrl} download={doc.fileName || `${doc.name}.txt`}>
                        Download <Download size={14} aria-hidden="true" />
                      </a>
                    ) : doc.fileData ? (
                      <a className="secondary-button" href={doc.fileData} download={doc.fileName || `${doc.name}.txt`}>
                        Download <Download size={14} aria-hidden="true" />
                      </a>
                    ) : (
                      <button className="secondary-button" type="button" disabled>
                        Open
                      </button>
                    )}
                    <button className="secondary-button" type="button" onClick={() => editDocument(doc)} aria-label={`Edit ${doc.name}`}>
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button className="secondary-button" type="button" onClick={() => copyLink(doc)} disabled={!documentUrl} aria-label={`Copy ${doc.name} link`}>
                      <Copy size={14} aria-hidden="true" />
                    </button>
                    {linkedJob && (
                      <button className="secondary-button" type="button" onClick={() => onSelectJob(linkedJob.id)} aria-label={`Open linked role for ${doc.name}`}>
                        <BriefcaseBusiness size={14} aria-hidden="true" />
                        Role
                      </button>
                    )}
                    <button className="secondary-button" type="button" onClick={() => onDuplicateDocument(doc.id)} aria-label={`Duplicate ${doc.name}`}>
                      <Plus size={14} aria-hidden="true" />
                    </button>
                    <button className="secondary-button danger-button" type="button" onClick={() => onDeleteDocument(doc.id)} aria-label={`Delete ${doc.name}`}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {previewDocument && (
        <div
          className="modal-backdrop document-preview-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`${previewDocument.name} preview`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewDocument(null);
          }}
        >
          <div className="document-preview-modal">
            <div className="document-preview-head">
              <span className="document-icon" aria-hidden="true">
                <FileText size={18} />
              </span>
              <span>
                <strong>{previewDocument.name}</strong>
                <small>
                  {previewDocument.fileName || previewDocument.url || `${previewDocument.type} · ${previewDocument.target || "General"}`}
                </small>
              </span>
              <div className="document-preview-actions">
                {(previewDocument.fileData || getDocumentDownloadUrl(previewDocument)) && (
                  <a
                    className="secondary-button"
                    href={previewDocument.fileData || getDocumentDownloadUrl(previewDocument)}
                    download={previewDocument.fileName || `${previewDocument.name}.txt`}
                  >
                    <Download size={14} aria-hidden="true" />
                    Download
                  </a>
                )}
                {isOpenableUrl(previewDocument.url) && (
                  <a className="secondary-button" href={safeExternalUrl(previewDocument.url)} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} aria-hidden="true" />
                    Open Source
                  </a>
                )}
                <button className="icon-button" type="button" onClick={() => setPreviewDocument(null)} aria-label="Close preview">
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
            <DocumentPreviewPanel document={previewDocument} authToken={authToken} />
          </div>
        </div>
      )}
    </section>
  );
}
