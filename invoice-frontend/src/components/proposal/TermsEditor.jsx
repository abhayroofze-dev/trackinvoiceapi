import { useState } from "react";
import RichTextEditor from "./RichTextEditor";
import { isHtmlEmpty } from "./proposalUtils";

/**
 * TERMS section body: pick a template from terms_master. The template text is
 * COPIED into this proposal (content_snapshot) so later changes to the master
 * never change an old proposal. "Edit Terms" lets you tweak this proposal's copy.
 */
function TermsEditor({ terms, templates, onChange }) {
  const [editing, setEditing] = useState(isHtmlEmpty(terms.content_snapshot));
  const selected = templates.find((t) => String(t.id) === String(terms.terms_master_id));

  const pickTemplate = (e) => {
    const id = e.target.value;
    if (!id) {
      onChange({ ...terms, terms_master_id: null });
      return;
    }
    const tpl = templates.find((t) => String(t.id) === id);
    if (!tpl) return;
    const hasText = !isHtmlEmpty(terms.content_snapshot);
    const sameAsCurrent = selected && selected.content === terms.content_snapshot;
    if (hasText && !sameAsCurrent && !window.confirm("Replace the current Terms text (including your edits) with this template?")) {
      return;
    }
    onChange({ terms_master_id: tpl.id, content_snapshot: tpl.content });
  };

  const edited = selected && selected.content !== terms.content_snapshot;

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={terms.terms_master_id ?? ""}
          onChange={pickTemplate}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
        >
          <option value="">Select a Terms &amp; Conditions template…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
              {t.is_default ? " (Default)" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          {editing ? "Hide editor" : "Edit Terms"}
        </button>
      </div>

      <p className="mt-2 text-[11px] text-slate-400">
        {isHtmlEmpty(terms.content_snapshot)
          ? "No Terms text yet — choose a template or type your own below. Required before finalizing."
          : edited
          ? "This proposal uses its own edited copy of the template. Changes to the master template won't affect it."
          : "A copy of the template is stored with this proposal. Later changes to the master template won't affect it."}
      </p>

      {editing && (
        <div className="mt-3">
          <RichTextEditor
            value={terms.content_snapshot}
            onChange={(html) => onChange({ ...terms, content_snapshot: html })}
            placeholder="Type or paste your Terms & Conditions…"
            minHeight={200}
          />
        </div>
      )}
    </div>
  );
}

export default TermsEditor;
