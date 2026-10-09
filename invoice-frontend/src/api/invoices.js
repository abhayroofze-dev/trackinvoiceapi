// src/api/invoices.js
//
// Talks to /api/invoices (backend invoiceController). Invoices live in the
// MySQL tables `invoices`, `invoice_items` and `invoice_item_milestones` —
// nothing is stored in the browser any more.
//
// The backend returns database-style fields; fromApi() reshapes them into
// the object the invoice screens (list, detail, preview, dashboard) already
// use, so those components did not have to change.

import { http } from "./http";

function itemFromApi(item) {
  return {
    id: item.id,
    service_description: item.service_description,
    qty: item.qty,
    total_price: item.total_price,
    price_percentage: item.price_percentage,
    tax_rate: item.tax_rate,
    taxable_amount: item.taxable_amount,
    tax_amount: item.tax_amount,
    line_total: item.line_total,
    subtotal: item.taxable_amount, // the preview reads the taxable amount as "subtotal"
    milestones: item.milestones?.length ? item.milestones : null,
  };
}

function fromApi(row) {
  return {
    ...row,
    created_at: row.created_at_ms || 0, // ms timestamp, used for sorting
    items: row.items ? row.items.map(itemFromApi) : undefined,
  };
}

/** Newest first. Header rows only (no items) — enough for the list + dashboard. */
export async function getInvoices() {
  const res = await http.get("/invoices?limit=500");
  return res.data.map(fromApi);
}

/** One invoice with all its items and milestones. */
export async function getInvoice(id) {
  const res = await http.get(`/invoices/${encodeURIComponent(id)}`);
  return fromApi(res.data);
}

/**
 * What number will the next invoice get? Preview only — the number is
 * really reserved by the backend at the moment the invoice is saved.
 */
export async function getNextInvoiceNumber({ locationId, date, locationType }) {
  const params = new URLSearchParams({ location_id: locationId, date, location_type: locationType || "" });
  const res = await http.get(`/invoices/next-number?${params.toString()}`);
  return res.data; // { invoice_number, financial_year, sequence_number }
}

/** Save a new invoice (all tables in one database transaction). */
export async function createInvoice(payload) {
  const res = await http.post("/invoices", payload);
  return fromApi(res.data);
}

/**
 * Change an invoice's status.
 *  - "PENDING": no details needed.
 *  - "PAID": pass { payment_mode, payment_reference, payment_date, amount_paid }.
 */
export async function updateInvoiceStatus(id, paymentStatus, paymentDetails = {}) {
  const res = await http.patch(`/invoices/${encodeURIComponent(id)}/status`, {
    payment_status: paymentStatus,
    ...(paymentStatus === "PAID" ? paymentDetails : {}),
  });
  return fromApi(res.data);
}
