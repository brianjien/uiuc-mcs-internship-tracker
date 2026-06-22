import { useState } from "react";
import { FiBriefcase as BriefcaseBusiness, FiClock as Clock3, FiMail as Mail, FiPlus as Plus, FiUsers as Users } from "react-icons/fi";
import { EmptyState, ViewHeader } from "../../components/ui.jsx";

export function ContactsView({ contacts, jobs, onAddContact, onCreateTask, onSelectJob }) {
  const [draft, setDraft] = useState({ name: "", company: "", role: "", email: "", next: "" });
  const jobContacts = jobs
    .filter((job) => job.contact)
    .map((job) => ({
      id: `job-${job.id}`,
      name: job.contact,
      role: job.contactRole,
      company: job.company,
      email: job.contactEmail,
      next: job.nextStep,
      source: "Pipeline",
      sourceJobId: job.id,
    }));
  const rows = [...contacts.map((contact) => ({ ...contact, source: contact.source || "Manual" })), ...jobContacts]
    .filter((contact, index, list) => {
      const key = `${String(contact.email || "").toLowerCase()}-${String(contact.name || "").toLowerCase()}-${String(contact.company || "").toLowerCase()}`;
      return list.findIndex((item) => `${String(item.email || "").toLowerCase()}-${String(item.name || "").toLowerCase()}-${String(item.company || "").toLowerCase()}` === key) === index;
    })
    .sort((left, right) => String(left.company || "").localeCompare(String(right.company || "")));
  const stats = [
    { label: "contacts", value: rows.length },
    { label: "with email", value: rows.filter((contact) => contact.email).length },
    { label: "linked roles", value: rows.filter((contact) => contact.sourceJobId).length },
  ];

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    if (!draft.name.trim() || !draft.company.trim()) return;
    onAddContact({
      id: `contact-${Date.now()}`,
      name: draft.name.trim(),
      company: draft.company.trim(),
      role: draft.role.trim(),
      email: draft.email.trim(),
      next: draft.next.trim() || "Follow up when ready.",
      source: "Manual",
    });
    setDraft({ name: "", company: "", role: "", email: "", next: "" });
  }

  function createFollowUp(contact) {
    const due = new Date();
    due.setDate(due.getDate() + 2);
    onCreateTask({
      title: `Follow up with ${contact.name}`,
      subtitle: `${contact.company || "Contact"} · ${contact.role || "Networking"}`,
      due: due.toISOString().slice(0, 10),
      priority: "High",
      sourceJobId: contact.sourceJobId || "",
      icon: Mail,
    });
  }

  return (
    <section className="view-shell">
      <ViewHeader eyebrow="Contacts" title="Recruiter and alumni CRM" />
      <div className="utility-stat-row">
        {stats.map((item) => (
          <article key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </article>
        ))}
      </div>
      <form className="inline-data-form" onSubmit={submit}>
        <input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Name" />
        <input value={draft.company} onChange={(event) => update("company", event.target.value)} placeholder="Company" />
        <input value={draft.role} onChange={(event) => update("role", event.target.value)} placeholder="Role or note" />
        <input value={draft.email} onChange={(event) => update("email", event.target.value)} placeholder="Email" />
        <input value={draft.next} onChange={(event) => update("next", event.target.value)} placeholder="Next touch" />
        <button className="secondary-button" type="submit">
          <Plus size={16} aria-hidden="true" />
          Add Contact
        </button>
      </form>
      {rows.length === 0 && (
        <EmptyState icon={Users} title="No contacts yet" text="Add recruiters, alumni, or referrals here as you find them." />
      )}
      <div className="contact-grid">
        {rows.map((contact) => (
          <article key={contact.id || `${contact.company}-${contact.name}`} className="contact-card">
            <div className="contact-card-head">
              <span className="contact-avatar">{contact.name.slice(0, 2).toUpperCase()}</span>
              <span>
                <strong>{contact.name}</strong>
                <p>{contact.role || "Contact"} · {contact.company || "Company"}</p>
              </span>
              <small>{contact.source}</small>
            </div>
            <div className="contact-next">
              <Clock3 size={14} aria-hidden="true" />
              <span>{contact.next || "Add a next touch after your conversation."}</span>
            </div>
            <div className="contact-actions">
              {contact.email ? (
                <a
                  className="secondary-button"
                  href={`mailto:${contact.email}?subject=${encodeURIComponent(`Following up about ${contact.company || "opportunities"}`)}`}
                >
                  <Mail size={14} aria-hidden="true" />
                  Email
                </a>
              ) : (
                <button className="secondary-button" type="button" disabled>
                  <Mail size={14} aria-hidden="true" />
                  Email
                </button>
              )}
              <button className="secondary-button" type="button" onClick={() => createFollowUp(contact)}>
                <Plus size={14} aria-hidden="true" />
                Task
              </button>
              {contact.sourceJobId && (
                <button className="secondary-button" type="button" onClick={() => onSelectJob(contact.sourceJobId)}>
                  <BriefcaseBusiness size={14} aria-hidden="true" />
                  Role
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
