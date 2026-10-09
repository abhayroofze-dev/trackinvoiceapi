// src/api/clients.js
//
// Talks to /api/clients (backend `clients` table in rfzbilling_) and
// adapts between the UI's field names (name, contact, address, status...)
// and the database's real column names (business_name, contact_person,
// billing_address, is_active...).
//
// IMPORTANT — schema gap: the `clients` table does not currently have
// columns for "type" (Business/Individual/...), "website" or "notes".
// The form still lets you type them, but they are NOT saved to the
// database yet. If you want them persisted, add the columns in Workbench:
//
//   ALTER TABLE clients
//     ADD COLUMN client_type VARCHAR(20) DEFAULT 'Business',
//     ADD COLUMN website VARCHAR(150) NULL,
//     ADD COLUMN notes TEXT NULL;
//
// and then extend fromApi/toApi below to include them.
//
// "State" is stored as `state_id` (a plain integer/varchar column on
// `clients` — not a foreign key to any other table anywhere in this
// project). We store the official 2-digit GST state code as that id
// (01 = Jammu and Kashmir ... 27 = Maharashtra ... see STATE_GST_CODES in
// data/invoiceFormOptions.js, the single source of truth for these codes)
// and convert back to the human-readable name for display. If `state_id`
// in your Workbench table actually references a separate states/lookup
// table with its own custom numbering, tell Claude and this mapping needs
// to change to match that table instead.

import { http } from "./http";
import { STATE_GST_CODES } from "../data/invoiceFormOptions";

// name -> "27" style code, both defined by STATE_GST_CODES.
function stateIdFromName(name) {
  const code = STATE_GST_CODES[name];
  return code ? Number(code) : undefined;
}

// state_id column value (may come back as a number, e.g. 27, or a string,
// e.g. "27" or "027") -> the matching state name, e.g. "Maharashtra".
function stateNameFromId(id) {
  if (id === null || id === undefined || id === "") return "";
  const padded = String(id).padStart(2, "0");
  const match = Object.entries(STATE_GST_CODES).find(([, code]) => code === padded);
  return match ? match[0] : "";
}

function generateClientCode(name) {
  const initials =
    (name || "CL")
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 3) || "CL";
  return `${initials}${Date.now().toString().slice(-6)}`;
}

function fromApi(row) {
  return {
    id: row.id,
    code: row.client_code || "",
    name: row.business_name || "",
    contact: row.contact_person || "",
    fullContact: row.contact_person || "",
    phone: row.phone || "",
    email: row.email || "",
    address: row.billing_address || "",
    city: row.city || "",
    // state_id is the real column; state/state_name/state_code are kept as
    // fallbacks only in case those also exist in your table.
    state: stateNameFromId(row.state_id) || row.state_name || row.state || "",
    stateCode: row.state_id != null ? String(row.state_id).padStart(2, "0") : row.state_code || "",
    stateId: row.state_id ?? null,
    pincode: row.pincode || "",
    country: row.country || "India",
    pan: row.pan || "",
    gstin: row.gstin || "",
    status: row.is_active === 0 || row.is_active === false ? "Inactive" : "Active",
    // Not present in the DB schema yet — kept so the form doesn't break.
    website: "",
    type: "Business",
    notes: "",
  };
}

function toApi(form) {
  return {
    client_code: form.code,
    business_name: form.name,
    // Optional fields go as "" (not undefined/null) so they also work if the
    // column is NOT NULL, and so clearing a field on Edit really clears it.
    contact_person: form.contact || "",
    phone: form.phone || "",
    email: form.email || null,
    billing_address: form.address || "",
    city: form.city || "",
    // Real column: state_id, storing the 2-digit GST code as a number.
    state_id: stateIdFromName(form.state) ?? null,
    pincode: form.pincode || "",
    country: form.country || "India",
    pan: form.pan || null,
    gstin: form.gstin || null,
    is_active: form.status === "Inactive" ? 0 : 1,
  };
}

export async function getClients() {
  const res = await http.get("/clients?limit=500");
  return res.data.map(fromApi);
}

export async function getClient(id) {
  const res = await http.get(`/clients/${id}`);
  return fromApi(res.data);
}

export async function createClient(form) {
  const payload = toApi({ ...form, code: form.code || generateClientCode(form.name) });
  const res = await http.post("/clients", payload);
  return fromApi(res.data);
}

export async function updateClient(id, form) {
  const res = await http.put(`/clients/${id}`, toApi(form));
  return fromApi(res.data);
}

/**
 * Flip only the is_active flag. The backend PUT updates just the columns it
 * receives, so nothing else on the client is touched.
 */
export async function updateClientStatus(id, isActive) {
  const res = await http.put(`/clients/${id}`, { is_active: isActive ? 1 : 0 });
  return fromApi(res.data);
}

export async function deleteClient(id) {
  await http.delete(`/clients/${id}`);
}
