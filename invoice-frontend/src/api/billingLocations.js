// src/api/billingLocations.js
//
// Talks to /api/billing-locations (backend `billing_location` table).
//
// IMPORTANT — schema gap: your `billing_location` table does not have
// columns for bank_name, account_name, account_number, ifsc_code,
// qr_code_url or a default GST percentage. The old static
// data/billingLocations.js file had these, and CreateInvoice's bank
// details / QR section still expects them. They come back as null below
// so nothing crashes, but bank details won't show on the invoice until
// you add the columns, e.g.:
//
//   ALTER TABLE billing_location
//     ADD COLUMN default_gst_percentage DECIMAL(5,2) NULL,
//     ADD COLUMN bank_name VARCHAR(100) NULL,
//     ADD COLUMN account_name VARCHAR(150) NULL,
//     ADD COLUMN account_number VARCHAR(30) NULL,
//     ADD COLUMN ifsc_code VARCHAR(15) NULL,
//     ADD COLUMN qr_code_url VARCHAR(255) NULL;
//
// then fill fromApi/toApi below to read/write those columns too — the
// backend needs no changes since it reads columns dynamically.

import { useEffect, useState } from "react";
import { http } from "./http";

// TEMPORARY — the `billing_location` table in the backend does not have
// columns for bank_name / account_name / account_number / ifsc_code /
// default_gst_percentage / qr_code_url yet (see note above). Until those
// columns are added, we hardcode Roofze's single shared bank account here
// so the invoice preview / bank details section isn't blank. Remove this
// block and read the real columns in fromApi() once the DB is updated.
const TEMP_BANK_DETAILS = {
  bank_name: "Indusind Bank",
  account_name: "ROOFZE DIGITAL HUB LLP",
  account_number: "258916532869",
  ifsc_code: "INDB0001889",
  qr_code_url: null, // no hosted QR image yet — InvoicePreview shows a placeholder box
};
const TEMP_DEFAULT_GST_PERCENTAGE = 18;

// MySQL BIT(1) columns (like gst_applicable / is_active if created as BIT in
// Workbench) reach the browser as {type:"Buffer",data:[1]} — an object, which is
// always "truthy" in JS. This turns every flavour (BIT, TINYINT, "0"/"1", bool)
// into a real true/false.
function toBool(v) {
  if (v && typeof v === "object" && Array.isArray(v.data)) return v.data[0] === 1;
  if (typeof v === "string") return v !== "" && v !== "0";
  return !!v;
}

function fromApi(row) {
  const isGst = toBool(row.gst_applicable);
  return {
    id: row.id,
    code: row.location_code || "",
    name: row.location_name || "",
    legalName: row.legal_name || "",
    state: row.state_name || "",
    stateCode: row.state_code || "",
    location_type: isGst ? "GST" : "NON_GST",
    gst_number: row.gstin || null,
    pan_number: row.pan || null,
    default_gst_percentage: isGst ? TEMP_DEFAULT_GST_PERCENTAGE : null, // TEMP — not in DB yet
    bank_name: TEMP_BANK_DETAILS.bank_name, // TEMP — not in DB yet
    account_name: TEMP_BANK_DETAILS.account_name, // TEMP — not in DB yet
    account_number: TEMP_BANK_DETAILS.account_number, // TEMP — not in DB yet
    ifsc_code: TEMP_BANK_DETAILS.ifsc_code, // TEMP — not in DB yet
    qr_code_url: TEMP_BANK_DETAILS.qr_code_url, // TEMP — not in DB yet
    address_line1: row.address_line1 || "",
    address_line2: row.address_line2 || "",
    city: row.city || "",
    pincode: row.pincode || "",
    country: row.country || "India",
    phone: row.phone || "",
    email: row.email || "",
    website: row.website || "",
    is_active: row.is_active === undefined ? true : toBool(row.is_active),
  };
}

function toApi(form) {
  return {
    location_code: form.code,
    location_name: form.name,
    legal_name: form.legalName || null,
    gst_applicable: form.location_type === "GST" ? 1 : 0,
    gstin: form.gst_number || null,
    pan: form.pan_number || null,
    state_name: form.state,
    state_code: form.stateCode || undefined,
    address_line1: form.address_line1 || null,
    address_line2: form.address_line2 || null,
    city: form.city || null,
    pincode: form.pincode || null,
    country: form.country || "India",
    phone: form.phone || null,
    email: form.email || null,
    website: form.website || null,
    is_active: form.is_active === false ? 0 : 1,
  };
}

export async function getBillingLocations() {
  const res = await http.get("/billing-locations?limit=500");
  return res.data.map(fromApi);
}

export async function createBillingLocation(form) {
  const res = await http.post("/billing-locations", toApi(form));
  return fromApi(res.data);
}

export async function updateBillingLocation(id, form) {
  const res = await http.put(`/billing-locations/${id}`, toApi(form));
  return fromApi(res.data);
}

export async function deleteBillingLocation(id) {
  await http.delete(`/billing-locations/${id}`);
}

// Shared hook for any page that just needs to read the list once
// (Dashboard, InvoicesList, InvoiceDetail, CreateInvoice).
//
// Locations are loaded from the database (GET /api/billing-locations) so the
// ids in the dropdown are always real billing_location ids. (The old version
// used hardcoded ids 1 and 2 from data/billingLocations.js — if those ids were
// not in the table, saving / previewing an invoice number failed with
// "Billing location 1 does not exist in the billing_location table".)
export function useBillingLocations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getBillingLocations()
      .then((data) => {
        if (!cancelled) setLocations(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load billing locations");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { locations, loading, error };
}
