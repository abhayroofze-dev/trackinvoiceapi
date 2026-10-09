import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { COMPANY } from "../../data/company";
import { coverMonth,displayDate, isHtmlEmpty } from "./proposalUtils";
import "./proposalDocument.css";

// Renders a proposal exactly like the sample PDF:
//   cover page  ->  every section in sort order (flowing over as many pages as needed)  ->  contact page
// Nothing here is hard-coded per proposal; it just walks `proposal.sections`.

function SectionTitle({ title }) {
  if (!title || !title.trim()) return null;
  return <h2 className="pdoc-sec-title">{title}</h2>;
}

function Section({ section }) {
  if (section.section_type === "CONTENT") {
    if (isHtmlEmpty(section.content_html) && !section.title?.trim()) return null;
    return (
      <div className="pdoc-sec">
        <SectionTitle title={section.title} />
        <div className="pdoc-body proposal-rich" dangerouslySetInnerHTML={{ __html: section.content_html || "" }} />
      </div>
    );
  }

  if (section.section_type === "TABLE") {
    const { columns = [], rows = [] } = section.table || {};
    return (
      <div className="pdoc-sec">
        <SectionTitle title={section.title} />
        <table className="pdoc-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.id}>{c.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {columns.map((c) => (
                  <td key={c.id}>{r.cells?.[c.id] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // TERMS
  const html = section.terms?.content_snapshot || "";
  return (
    <div className="pdoc-sec pdoc-sec-terms">
      <SectionTitle title={section.title || "Terms & Conditions"} />
      <div className="pdoc-body proposal-rich" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

export function ProposalDocument({ proposal }) {
  const sections = proposal.sections || [];
  const title = proposal.proposal_title?.trim() || "Proposal Title";

  return (
    <div className="pdoc">
      <img className="pdoc-fixed-wm" src="/proposal-watermark-faint.png" alt="" />

      {/* ---------- cover ---------- */}
      <div className="pdoc-cover">
        <div className="pdoc-cover-date">{coverMonth(proposal.proposal_date)}</div>
        <div className="pdoc-logo">
          <img src="/proposal-watermark.png" alt="Roofze" />
        </div>
        <div className="pdoc-cover-title-wrap">
          <h1 className="pdoc-cover-title">Proposal For {title}</h1>
          <p className="pdoc-cover-tagline">{proposal.cover_tagline?.trim() || COMPANY.defaultTagline}</p>
        </div>
        <div className="pdoc-cover-by">
          <div className="lbl">PRESENTED BY:</div>
          <div className="name">{COMPANY.name}</div>
          <div className="loc">( {COMPANY.location} )</div>
          <div className="gst">GSTIN - {COMPANY.gstin}</div>
        </div>
      </div>

      {/* ---------- sections, in sort order ---------- */}
      {/* The table's header/footer rows are empty spacers: they repeat on every printed page, giving real top/bottom margins. */}
      <div className="pdoc-flow-wrap">
        <table className="pdoc-flow">
          <thead>
            <tr><td><div className="pdoc-space-top" /></td></tr>
          </thead>
          <tfoot>
            <tr><td><div className="pdoc-space-bottom" /></td></tr>
          </tfoot>
          <tbody>
            <tr>
              <td className="pdoc-flow-cell">
                {sections.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#94a3b8", padding: "30mm 0" }}>
                    Your sections will appear here as you add them.
                  </p>
                ) : (
                  sections.map((s) => <Section key={s.id} section={s} />)
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ---------- contact page ---------- */}
      <div className="pdoc-contact">
        <div className="pdoc-contact-brand">
          {COMPANY.nameWords.map((w, i) => (
            <span key={w} className={`w${i}`}>
              {w}{" "}
            </span>
          ))}
        </div>
        <div className="pdoc-contact-left">
          <h2>FOR ENQUIRIES, CONTACT US.</h2>
          <img src="/proposal-contact.jpg" alt="" />
          <div className="pdoc-contact-lines">
            <div><span className="ico">&#9679;</span>{COMPANY.website}</div>
            <div><span className="ico">&#9679;</span>{COMPANY.email}</div>
            {COMPANY.contacts.map((c) => (
              <div key={c.name}><span className="ico">&#9679;</span>{c.name} &nbsp; {c.phone}</div>
            ))}
          </div>
        </div>
        <div className="pdoc-contact-right">
          <h3>ADDITIONAL SERVICES</h3>
          <ul>
            {COMPANY.services.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** On-screen preview: the A4 document scaled down to fit its container. */
export function ProposalPreview({ proposal }) {
  const wrapRef = useRef(null);
  const [zoom, setZoom] = useState(0.6);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const A4_PX = 794; // 210mm at 96dpi
    const update = () => setZoom(Math.min(1, Math.max(0.3, el.clientWidth / A4_PX)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="pdoc-screen">
      <div style={{ zoom }}>
        <ProposalDocument proposal={proposal} />
      </div>
    </div>
  );
}

/**
 * Hidden copy of the document placed directly in <body>. It is only visible when
 * printing / "Save as PDF" (the app itself is hidden by the `proposal-mode` class).
 */
export function ProposalPrintPortal({ proposal }) {
  useEffect(() => {
    document.body.classList.add("proposal-mode");
    return () => document.body.classList.remove("proposal-mode");
  }, []);

  return createPortal(
    <div className="pdoc-print-root">
      <ProposalDocument proposal={proposal} />
    </div>,
    document.body
  );
}

/** Opens the browser print dialog -> choose "Save as PDF". */
export function downloadProposalPdf({ clientName, date, proposalNumber } = {}) {
  const previous = document.title;
  const clean = (t) => String(t || "").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
  const name = clean(clientName) || clean(proposalNumber);
  document.title = [name, displayDate(date)].filter(Boolean).join(" - ") || "Proposal";
  const restore = () => {
    document.title = previous;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}

export default ProposalDocument;
