// Pure helpers for the Proposal Builder (no React).

let counter = 0;
/** Temporary id for anything not saved yet. The backend replaces it with a real id. */
export const tmpId = (prefix = "tmp") => `${prefix}-${Date.now().toString(36)}-${(counter += 1)}`;

export const MAX_COLUMNS = 10;
export const MAX_ROWS = 100;

export function newContentSection(title = "") {
  return { id: tmpId("sec"), section_type: "CONTENT", title, is_mandatory: false, content_html: "" };
}

/** Builds a table with the requested size - header names Column 1.., empty cells. */
export function newTableSection({ title, columns, rows }) {
  const cols = Array.from({ length: columns }, (_, i) => ({ id: tmpId("col"), name: `Column ${i + 1}` }));
  const rws = Array.from({ length: rows }, () => ({
    id: tmpId("row"),
    cells: Object.fromEntries(cols.map((c) => [c.id, ""])),
  }));
  return { id: tmpId("sec"), section_type: "TABLE", title, is_mandatory: false, table: { columns: cols, rows: rws } };
}

export function newTermsSection(template) {
  return {
    id: tmpId("sec"),
    section_type: "TERMS",
    title: "Terms & Conditions",
    is_mandatory: true,
    terms: {
      terms_master_id: template ? template.id : null,
      content_snapshot: template ? template.content : "",
    },
  };
}

/** Deep copy with fresh temporary ids (CONTENT and TABLE only - TERMS can never be duplicated). */
export function duplicateSection(section) {
  if (section.section_type === "TERMS") return null;
  const copy = { ...section, id: tmpId("sec"), title: section.title ? `${section.title} (copy)` : "" };
  if (section.section_type === "TABLE") {
    const colMap = {};
    const columns = section.table.columns.map((c) => {
      const id = tmpId("col");
      colMap[c.id] = id;
      return { id, name: c.name };
    });
    const rows = section.table.rows.map((r) => ({
      id: tmpId("row"),
      cells: Object.fromEntries(section.table.columns.map((c) => [colMap[c.id], r.cells?.[c.id] ?? ""])),
    }));
    copy.table = { columns, rows };
  }
  return copy;
}

export function isHtmlEmpty(html) {
  if (!html) return true;
  if (/<img\b/i.test(html)) return false;
  return (
    String(html)
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/\s+/g, " ")
      .trim().length === 0
  );
}

/** Same rules as the backend (which re-checks everything). Returns an error message or "". */
export function validateForFinalize(header, sections) {
  if (!header.client_id) return "Please select a client before finalizing the proposal.";
  if (!header.proposal_title.trim()) return "Please enter the proposal title before finalizing the proposal.";
  if (!header.proposal_date) return "Please enter the proposal date before finalizing the proposal.";
  if (sections.length === 0) return "Please add at least one section before finalizing the proposal.";
  const terms = sections.find((s) => s.section_type === "TERMS");
  if (!terms) return "Terms & Conditions are mandatory before finalizing the proposal.";
  if (isHtmlEmpty(terms.terms?.content_snapshot)) return "Please add Terms & Conditions before finalizing the proposal.";
  return "";
}

/** "2026-10-03" -> "OCT 2026" (cover page) */
export function coverMonth(dateStr) {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(dateStr || "");
  if (!m) return "";
  const names = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${names[Number(m[2]) - 1] || ""} ${m[1]}`;
}

/** "2026-10-03" -> "03-10-2026" */
export function displayDate(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/** What the backend expects for PUT / POST / finalize. */
export function toPayload(header, sections) {
  return {
    client_id: header.client_id || null,
    proposal_title: header.proposal_title,
    cover_tagline: header.cover_tagline,
    proposal_date: header.proposal_date,
    valid_till: header.valid_till || null,
    sections,
  };
}
