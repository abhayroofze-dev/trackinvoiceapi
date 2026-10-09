// src/api/proposals.js
//
// Talks to /api/proposals and /api/terms-master (see invoice-backend
// controllers/proposalController.js). A proposal is a header plus an ordered
// list of sections; each section is CONTENT, TABLE or TERMS.
//
// Shape used everywhere in the UI:
//   section = { id, section_type, title, is_mandatory,
//               content_html            (CONTENT)
//               table: { columns:[{id,name}], rows:[{id, cells:{[columnId]:text}}] }   (TABLE)
//               terms: { terms_master_id, content_snapshot }                           (TERMS) }
// Array position = sort_order. Unsaved sections/rows/columns carry ids like "tmp-3";
// the backend swaps them for real ids when saving.

import { http } from "./http";

export async function getProposals() {
  const res = await http.get("/proposals?limit=500");
  return res.data;
}

export async function getProposal(id) {
  const res = await http.get(`/proposals/${encodeURIComponent(id)}`);
  return res.data;
}

export async function getNextProposalNumber(date) {
  const res = await http.get(`/proposals/next-number?date=${encodeURIComponent(date)}`);
  return res.data; // { proposal_number, financial_year, sequence_number }
}

export async function createProposal(payload) {
  const res = await http.post("/proposals", payload);
  return res.data;
}

export async function updateProposal(id, payload) {
  const res = await http.put(`/proposals/${encodeURIComponent(id)}`, payload);
  return res.data;
}

/** Saves the latest edits and validates (client, title, date, Terms ...) in one transaction. */
export async function finalizeProposal(id, payload) {
  const res = await http.post(`/proposals/${encodeURIComponent(id)}/finalize`, payload || {});
  return res.data;
}

export async function reopenProposal(id) {
  const res = await http.patch(`/proposals/${encodeURIComponent(id)}/status`, { status: "DRAFT" });
  return res.data;
}

export async function deleteProposal(id) {
  await http.delete(`/proposals/${encodeURIComponent(id)}`);
}

/** Active Terms & Conditions templates (default first). */
export async function getTermsTemplates() {
  const res = await http.get("/terms-master?limit=500");
  return res.data
    .filter((t) => t.is_active === 1 || t.is_active === true || t.is_active === undefined)
    .sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.title.localeCompare(b.title));
}
