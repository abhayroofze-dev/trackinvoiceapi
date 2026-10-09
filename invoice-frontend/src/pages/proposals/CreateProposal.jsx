import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import AppLayout from "../../components/layout/AppLayout";
import RichTextEditor from "../../components/proposal/RichTextEditor";
import SectionCard from "../../components/proposal/SectionCard";
import TableEditor from "../../components/proposal/TableEditor";
import TermsEditor from "../../components/proposal/TermsEditor";
import AddTableModal from "../../components/proposal/AddTableModal";
import { ProposalPreview, ProposalPrintPortal, downloadProposalPdf } from "../../components/proposal/ProposalDocument";
import { IconDownload, IconShield, IconTable, IconText } from "../../components/proposal/ProposalIcons";
import {
  duplicateSection,
  newContentSection,
  newTableSection,
  newTermsSection,
  toPayload,
  validateForFinalize,
} from "../../components/proposal/proposalUtils";
import { getClients } from "../../api/clients";
import {
  createProposal,
  finalizeProposal,
  getNextProposalNumber,
  getProposal,
  getTermsTemplates,
  updateProposal,
} from "../../api/proposals";
import { COMPANY } from "../../data/company";

const today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const plusDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
};

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-500";

function AddSectionButton({ icon: Icon, title, hint, onClick, disabled, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center gap-3 rounded-2xl border bg-white p-3 text-left shadow-sm transition hover:border-teal-300 hover:shadow ${
        disabled ? "opacity-60" : ""
      } border-slate-200`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-900">{title}</span>
        <span className="block truncate text-[11px] text-slate-400">{hint}</span>
      </span>
    </button>
  );
}

function CreateProposal() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();

  const [proposalId, setProposalId] = useState(routeId || null);
  const [status, setStatus] = useState("DRAFT");
  const [proposalNumber, setProposalNumber] = useState("");
  const [header, setHeader] = useState(() => {
    const d = today();
    return {
      client_id: "",
      proposal_title: "",
      cover_tagline: COMPANY.defaultTagline,
      proposal_date: d,
      valid_till: plusDays(d, 14),
    };
  });
  const [sections, setSections] = useState([]);

  const [clients, setClients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(Boolean(routeId));
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(""); // "", "save", "finalize"
  const [notice, setNotice] = useState(null); // { type: 'error' | 'success', text }
  const [dirty, setDirty] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);

  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  // ---- load clients + Terms templates (+ the proposal when editing) ----
  useEffect(() => {
    let cancelled = false;
    getClients()
      .then((c) => !cancelled && setClients(c.filter((x) => x.status !== "Inactive")))
      .catch(() => {});
    getTermsTemplates()
      .then((t) => !cancelled && setTemplates(t))
      .catch((err) => !cancelled && setNotice({ type: "error", text: err.message }));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!routeId) return undefined;
    let cancelled = false;
    getProposal(routeId)
      .then((p) => {
        if (cancelled) return;
        setProposalId(String(p.id));
        setStatus(p.status);
        setProposalNumber(p.proposal_number);
        setHeader({
          client_id: p.client_id ?? "",
          proposal_title: p.proposal_title || "",
          cover_tagline: p.cover_tagline || COMPANY.defaultTagline,
          proposal_date: p.proposal_date,
          valid_till: p.valid_till || "",
        });
        setSections(p.sections);
      })
      .catch((err) => !cancelled && setLoadError(err.message || "Could not load this proposal."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  // ---- number preview for a brand-new proposal ----
  useEffect(() => {
    if (proposalId || !header.proposal_date) return undefined;
    let cancelled = false;
    getNextProposalNumber(header.proposal_date)
      .then((n) => !cancelled && setProposalNumber(n.proposal_number))
      .catch(() => !cancelled && setProposalNumber(""));
    return () => {
      cancelled = true;
    };
  }, [proposalId, header.proposal_date]);

  // ---- warn before leaving with unsaved changes ----
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ---- helpers that change state ----
  const changeHeader = (patch) => {
    setHeader((h) => ({ ...h, ...patch }));
    setDirty(true);
  };
  const changeSections = useCallback((updater) => {
    setSections(updater);
    setDirty(true);
  }, []);
  const updateSection = (id, patch) =>
    changeSections((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const flash = (type, text) => {
    setNotice({ type, text });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---- add ----
  const addContent = () => changeSections((list) => [...list, newContentSection()]);

  const addTable = (opts) => {
    changeSections((list) => [...list, newTableSection(opts)]);
    setShowTableModal(false);
  };

  const hasTerms = sections.some((s) => s.section_type === "TERMS");
  const addTerms = () => {
    if (hasTerms) {
      flash("error", "Only one Terms & Conditions section is allowed per proposal.");
      return;
    }
    const defaultTemplate = templates.find((t) => t.is_default) || null;
    changeSections((list) => [...list, newTermsSection(defaultTemplate)]);
  };

  // ---- delete / duplicate / reorder ----
  const removeSection = (section) => {
    if (section.section_type === "TERMS") {
      flash("error", "Terms & Conditions are mandatory and cannot be removed.");
      return;
    }
    if (!window.confirm(`Delete "${section.title || "this section"}"?`)) return;
    changeSections((list) => list.filter((s) => s.id !== section.id));
  };

  const copySection = (section) => {
    const copy = duplicateSection(section);
    if (!copy) {
      flash("error", "Only one Terms & Conditions section is allowed per proposal.");
      return;
    }
    changeSections((list) => {
      const i = list.findIndex((s) => s.id === section.id);
      return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)];
    });
  };

  const moveSection = useCallback(
    (from, to) => {
      if (from === to || from === null || to === null) return;
      changeSections((list) => {
        const next = [...list];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return next;
      });
    },
    [changeSections]
  );

  const resetDrag = () => {
    setDragIdx(null);
    setOverIdx(null);
  };

  // ---- save / finalize ----
  const persist = async () => {
    const payload = toPayload(header, sections);
    let saved;
    if (proposalId) saved = await updateProposal(proposalId, payload);
    else saved = await createProposal(payload);
    return { saved, payload };
  };

  const applySaved = (saved) => {
    setProposalId(String(saved.id));
    setStatus(saved.status);
    setProposalNumber(saved.proposal_number);
    setSections(saved.sections); // now carry real database ids
    setDirty(false);
  };

  const handleSave = async () => {
    setNotice(null);
    if (!header.proposal_date) return flash("error", "Please enter the proposal date.");
    setBusy("save");
    try {
      const { saved } = await persist();
      applySaved(saved);
      setNotice({ type: "success", text: `Saved as ${saved.status === "DRAFT" ? "draft" : "finalized"} — ${saved.proposal_number}` });
      if (!routeId) navigate(`/dashboard/proposals/${saved.id}/edit`, { replace: true });
    } catch (err) {
      flash("error", err.message);
    } finally {
      setBusy("");
    }
  };

  const handleFinalize = async () => {
    setNotice(null);
    const problem = validateForFinalize(header, sections);
    if (problem) return flash("error", problem);
    setBusy("finalize");
    try {
      let id = proposalId;
      let currentSections = sections;
      if (!id) {
        // numbered + stored as a draft first; switch the page to the saved copy (real ids)
        const created = await createProposal(toPayload(header, sections));
        applySaved(created);
        id = String(created.id);
        currentSections = created.sections;
      }
      // saves the latest edits + backend validation in one transaction
      await finalizeProposal(id, toPayload(header, currentSections));
      setDirty(false);
      navigate(`/dashboard/proposals/${id}`, { replace: true });
    } catch (err) {
      flash("error", err.message);
      // if the backend rejected it, the proposal stays a draft and you can keep editing
    } finally {
      setBusy("");
    }
  };

  const handleDownload = () => {
  const client = clients.find((c) => String(c.id) === String(header.client_id));
  downloadProposalPdf({
    clientName: client?.name,
    date: header.proposal_date,
    proposalNumber,
  });
};

  // ---- preview model (same data the PDF uses) ----
  const previewProposal = useMemo(
    () => ({ ...header, proposal_number: proposalNumber, sections }),
    [header, proposalNumber, sections]
  );

  if (loading) {
    return (
      <AppLayout title="Edit Proposal">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
          Loading proposal…
        </div>
      </AppLayout>
    );
  }
  if (routeId && loadError) {
    return (
      <AppLayout title="Proposal not found">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-red-500 shadow-sm">{loadError}</div>
      </AppLayout>
    );
  }

  const isEdit = Boolean(routeId);

  return (
    <AppLayout
      title={isEdit ? "Edit Proposal" : "Create Proposal"}
      subtitle="Build a professional proposal with dynamic content, tables and terms & conditions."
      breadcrumbs={["Dashboard", "Proposals", isEdit ? "Edit Proposal" : "Create Proposal"]}
    >
      <ProposalPrintPortal proposal={previewProposal} />

      {notice && (
        <div
          role="alert"
          className={`mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
            notice.type === "error" ? "border-red-100 bg-red-50 text-red-600" : "border-teal-100 bg-teal-50 text-teal-700"
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-bold opacity-60 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {status === "FINALIZED" && (
        <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          This proposal is <b>finalized</b>. You can still edit it; Terms &amp; Conditions must stay filled in.
        </div>
      )}

      {/* ---------- header fields ---------- */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Client <span className="text-red-500">*</span>
            </label>
            <select value={header.client_id} onChange={(e) => changeHeader({ client_id: e.target.value })} className={inputCls}>
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Proposal Date <span className="text-red-500">*</span>
            </label>
            <input type="date" value={header.proposal_date} onChange={(e) => changeHeader({ proposal_date: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Valid Till</label>
            <input type="date" min={header.proposal_date} value={header.valid_till} onChange={(e) => changeHeader({ valid_till: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Proposal No.</label>
            <input value={proposalNumber || "—"} disabled className={inputCls} />
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Proposal Title <span className="text-red-500">*</span>
            </label>
            <input
              value={header.proposal_title}
              onChange={(e) => changeHeader({ proposal_title: e.target.value })}
              placeholder="e.g. E-Commerce Website  →  cover shows “Proposal For E-Commerce Website”"
              maxLength={255}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Cover tagline</label>
            <input
              value={header.cover_tagline}
              onChange={(e) => changeHeader({ cover_tagline: e.target.value })}
              maxLength={255}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,540px)]">
        {/* ---------- builder ---------- */}
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lime-200 text-sm font-extrabold text-slate-900">2</span>
            <h2 className="text-base font-bold text-slate-900">Proposal Content</h2>
          </div>

          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <AddSectionButton icon={IconText} tone="bg-teal-50 text-teal-700" title="Add Content" hint="Text, images, lists…" onClick={addContent} />
            <AddSectionButton icon={IconTable} tone="bg-indigo-50 text-indigo-700" title="Add Table" hint="Add a custom table" onClick={() => setShowTableModal(true)} />
            <AddSectionButton
              icon={IconShield}
              tone="bg-orange-50 text-orange-600"
              title="Terms & Conditions"
              hint={hasTerms ? "Already added" : "Mandatory section"}
              onClick={addTerms}
              disabled={hasTerms}
            />
          </div>

          {sections.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
              No sections yet. Use <b>Add Content</b>, <b>Add Table</b> and <b>Terms &amp; Conditions</b> above to build your proposal.
            </div>
          )}

          <div className="space-y-3">
            {sections.map((section, index) => (
              <SectionCard
                key={section.id}
                index={index}
                total={sections.length}
                section={section}
                onTitleChange={(title) => updateSection(section.id, { title })}
                onDuplicate={() => copySection(section)}
                onDelete={() => removeSection(section)}
                onMove={(dir) => moveSection(index, index + dir)}
                dnd={{
                  isDragging: dragIdx === index,
                  isOver: overIdx === index && dragIdx !== null && dragIdx !== index,
                  onHandleDragStart: (e) => {
                    setDragIdx(index);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(index));
                    const card = e.currentTarget.closest("[data-section-card]");
                    if (card) e.dataTransfer.setDragImage(card, 24, 24);
                  },
                  onDragOver: (e) => {
                    if (dragIdx === null) return;
                    e.preventDefault();
                    if (overIdx !== index) setOverIdx(index);
                  },
                  onDrop: (e) => {
                    e.preventDefault();
                    moveSection(dragIdx, index);
                    resetDrag();
                  },
                  onDragEnd: resetDrag,
                }}
              >
                {section.section_type === "CONTENT" && (
                  <RichTextEditor
                    value={section.content_html}
                    onChange={(html) => updateSection(section.id, { content_html: html })}
                    placeholder="Write the content of this section…"
                  />
                )}
                {section.section_type === "TABLE" && (
                  <TableEditor table={section.table} onChange={(table) => updateSection(section.id, { table })} />
                )}
                {section.section_type === "TERMS" && (
                  <TermsEditor
                    terms={section.terms}
                    templates={templates}
                    onChange={(terms) => updateSection(section.id, { terms })}
                  />
                )}
              </SectionCard>
            ))}
          </div>
        </div>

        {/* ---------- live preview ---------- */}
        <div className="min-w-0 xl:sticky xl:top-20">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <h2 className="text-base font-bold text-slate-900">Live Preview</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <IconDownload /> Download PDF
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={Boolean(busy)}
                  className="rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  {busy === "save" ? "Saving…" : status === "FINALIZED" ? "Save Changes" : "Save Draft"}
                </button>
                {status !== "FINALIZED" && (
                  <button
                    type="button"
                    onClick={handleFinalize}
                    disabled={Boolean(busy)}
                    className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {busy === "finalize" ? "Finalizing…" : "Finalize"}
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-[calc(100vh-11rem)] overflow-y-auto bg-slate-200/70 p-3">
              <ProposalPreview proposal={previewProposal} />
            </div>
          </div>
        </div>
      </div>

      {showTableModal && <AddTableModal onCreate={addTable} onClose={() => setShowTableModal(false)} />}
    </AppLayout>
  );
}

export default CreateProposal;
