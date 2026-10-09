// ---------------------------------------------------------------------------
// Frontend-only data + calculation layer.
//
// Everything here reads/writes localStorage and mirrors the shape of the
// future MySQL/Postgres tables from the dev spec (invoice_sequences,
// invoices, invoice_items) so swapping this for real API calls later is a
// drop-in change — the function names and return shapes can stay the same.
// ---------------------------------------------------------------------------

const SEQ_KEY = "rfz_invoice_sequences"; // { "<locationId>_<fy>": lastSequence }
const INVOICES_KEY = "rfz_invoices"; // [{ ...invoice, items: [...] }]

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("Storage write failed:", err);
  }
}

/** Section 4.1 — Financial Year helper (Apr–Mar). e.g. "2627" for FY 2026-27 */
export function getFinancialYear(date = new Date()) {
  const d = typeof date === "string" ? new Date(date) : date;
  const month = d.getMonth() + 1; // 1-12
  const year = d.getFullYear();
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}${String(endYear).slice(-2)}`;
}

export function financialYearLabel(fy) {
  if (!fy || fy.length !== 4) return fy || "";
  return `FY 20${fy.slice(0, 2)}-${fy.slice(2, 4)}`;
}

/** GST locations start numbering at 1 (0001...), Non-GST at 1001 (1001...) */
export function startSequenceFor(locationType) {
  return locationType === "GST" ? 1 : 1001;
}

/** Preview the next number WITHOUT consuming it (like GET /invoices/preview-number) */
export function peekNextSequence(location, financialYear) {
  if (!location) return null;
  const sequences = readJSON(SEQ_KEY, {});
  const key = `${location.id}_${financialYear}`;
  const start = startSequenceFor(location.location_type);
  return key in sequences ? sequences[key] + 1 : start;
}

/**
 * Consume the next sequence number for a location + financial year.
 * Only call this at the moment an invoice is actually saved (Section 4.4) —
 * never on preview/render, or numbers will get skipped.
 */
export function consumeSequence(location, financialYear) {
  const sequences = readJSON(SEQ_KEY, {});
  const key = `${location.id}_${financialYear}`;
  const start = startSequenceFor(location.location_type);
  const next = key in sequences ? sequences[key] + 1 : start;
  sequences[key] = next;
  writeJSON(SEQ_KEY, sequences);
  return next;
}

/** Section 4.3 — RFZ/<FY>/<0000> */
export function buildInvoiceNumber(financialYear, sequence) {
  return `RFZ/${financialYear}/${String(sequence).padStart(4, "0")}`;
}

export function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

export function formatINR(n) {
  const num = Number(n || 0);
  // No trailing ".00" for whole numbers (matches the reference design),
  // but keeps up to 2 decimals when the amount actually has paise.
  return "₹" + num.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** subtotal for one service row: total_price * price_percentage / 100 */
export function calculateItemSubtotal(totalPrice, pricePercentage) {
  const total = Number(totalPrice) || 0;
  const pct = pricePercentage === "" || pricePercentage == null ? 100 : Number(pricePercentage);
  return round2((total * pct) / 100);
}

/** Full totals block for a set of items + a location (Section 4.4 logic) */
export function calculateInvoiceTotals(items, location, gstPercentage) {
  const subtotal = round2(
    items.reduce((sum, item) => sum + calculateItemSubtotal(item.total_price, item.price_percentage), 0)
  );
  const isGst = location?.location_type === "GST";
  const gstAmount = isGst ? round2((subtotal * Number(gstPercentage || 0)) / 100) : null;
  const total = isGst ? round2(subtotal + gstAmount) : subtotal;
  return { subtotal, gstAmount, total, isGst };
}

/* ------------------------ Per-row tax breakdown (v2) ------------------------
 * Used by the redesigned Create Invoice form, which adds qty + a per-row
 * tax treatment (GST rate) on top of the original total_price/price_percentage
 * fields. Additive only — the functions above stay untouched so existing
 * saved invoices / other pages keep working unchanged.
 * ---------------------------------------------------------------------------- */

/** taxable amount for one row: total_price * qty * price_percentage / 100
 *  If the row has milestones, the % actually billed on THIS invoice is the
 *  sum of whichever milestone(s) are marked "billed" — price_percentage is
 *  ignored in that case (milestones take over as the source of truth).
 */
export function calculateItemTaxable(item) {
  const total = Number(item.total_price) || 0;
  const qty = item.qty === "" || item.qty == null ? 1 : Number(item.qty) || 0;
  const milestonePct = billedPercentFromMilestones(item.milestones);
  const pct =
    milestonePct !== null
      ? milestonePct
      : item.price_percentage === "" || item.price_percentage == null
      ? 100
      : Number(item.price_percentage);
  return round2(total * qty * (pct / 100));
}

/* --------------------------- Milestones (per item) ---------------------------
 * A service item can optionally be split into payment milestones (Milestone
 * 1, 2, 3...). Editing one milestone's % "locks" it in place; whatever %
 * is left over is always shared out equally across the milestones that are
 * still unlocked, so the set keeps adding up to exactly 100%. Example from
 * spec: total 10,000, 4 milestones — set #1 to 40% → the remaining 60% is
 * split 20/20/20 across #2–#4. Then set #2 to 10% → the remaining 50% is
 * re-split 25/25 across #3–#4.
 * One milestone is marked "billed" (radio) — that is the milestone actually
 * invoiced on this particular invoice; its % becomes the item's effective
 * price_percentage feeding calculateItemTaxable/Breakdown above, so GST and
 * totals stay correct automatically.
 * ---------------------------------------------------------------------------- */

/** Share the leftover % (100 - locked total) equally across unlocked rows. */
function rebalanceUnlocked(milestones) {
  const lockedSum = round2(milestones.filter((m) => m.locked).reduce((s, m) => s + (Number(m.percent) || 0), 0));
  const unlocked = milestones.filter((m) => !m.locked);
  if (unlocked.length === 0) return milestones;

  const remaining = round2(100 - lockedSum);
  const share = round2(remaining / unlocked.length);
  let assigned = 0;
  let seen = 0;
  return milestones.map((m) => {
    if (m.locked) return m;
    seen += 1;
    // last unlocked row absorbs any rounding leftover so the total is exact
    const value = seen === unlocked.length ? round2(remaining - assigned) : share;
    assigned = round2(assigned + value);
    return { ...m, percent: Math.max(0, value) };
  });
}

export function createMilestone(order, percent, billed = false) {
  return {
    id: `ms_${order}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    label: `Milestone ${order}`,
    percent,
    locked: false,
    billed,
  };
}

/**
 * Starting set of milestones. Default is ONE milestone = 100%, pre-selected
 * as billed. More milestones appear automatically as the % is lowered.
 */
export function defaultMilestones(count = 1) {
  const n = Math.max(1, count);
  const pct = round2(100 / n);
  const list = Array.from({ length: n }, (_, i) => createMilestone(i + 1, pct, i === 0));
  const sumExceptLast = round2(list.slice(0, -1).reduce((s, m) => s + m.percent, 0));
  list[list.length - 1].percent = round2(100 - sumExceptLast);
  return list;
}

/**
 * Single source of truth that keeps a milestone set valid after ANY edit:
 *  - a lone milestone is always 100%
 *  - if locked (typed) milestones leave a remainder and there is no open
 *    milestone to hold it, a new "Milestone N" is added with that remainder
 *  - if locked milestones already reach 100%, empty open milestones are dropped
 *  - leftover is shared equally across open milestones (exact 100% total)
 *  - labels are renumbered and exactly one milestone stays marked "billed"
 */
function normalizeMilestones(list) {
  let next = list.map((m) => ({ ...m }));

  const lockedSum = round2(next.filter((m) => m.locked).reduce((s, m) => s + (Number(m.percent) || 0), 0));
  const remainder = round2(100 - lockedSum);
  const hasOpen = next.some((m) => !m.locked);

  if (remainder <= 0 && hasOpen && next.some((m) => m.locked)) {
    next = next.filter((m) => m.locked); // locked ones already make 100%
  } else if (remainder > 0 && !hasOpen) {
    next = [...next, createMilestone(next.length + 1, remainder)]; // auto-add next milestone
  }
  next = rebalanceUnlocked(next);

  // a lone milestone always holds the full 100%
  if (next.length === 1) next = [{ ...next[0], percent: 100, locked: false }];

  next = next.map((m, i) => ({ ...m, label: `Milestone ${i + 1}` }));
  if (!next.some((m) => m.billed)) next[0] = { ...next[0], billed: true };
  // guard against more than one billed flag
  const firstBilled = next.findIndex((m) => m.billed);
  return next.map((m, i) => ({ ...m, billed: i === firstBilled }));
}

/**
 * User typed a % into milestone `index`. It is locked at that value (capped so
 * all locked milestones never exceed 100%) and the remainder flows into the
 * next milestone — which is created automatically if it does not exist yet.
 */
export function redistributeMilestones(milestones, index, newPercent) {
  const otherLocked = round2(
    milestones.reduce((s, m, i) => (i !== index && m.locked ? s + (Number(m.percent) || 0) : s), 0)
  );
  const maxAllowed = Math.max(0, round2(100 - otherLocked));
  const raw = Number(newPercent);
  const pct = round2(Math.max(0, Math.min(maxAllowed, Number.isFinite(raw) ? raw : 0)));
  const next = milestones.map((m, i) => (i === index ? { ...m, percent: pct, locked: true } : m));
  return normalizeMilestones(next);
}

/** Free a locked milestone back into the shared pool. */
export function unlockMilestone(milestones, index) {
  return normalizeMilestones(milestones.map((m, i) => (i === index ? { ...m, locked: false } : m)));
}

/** Add one more milestone at the end; its share comes out of the unlocked pool. */
export function addMilestoneToList(milestones) {
  const next = milestones.map((m, i, arr) => (i === arr.length - 1 ? { ...m, locked: false } : m));
  return normalizeMilestones([...next, createMilestone(milestones.length + 1, 0)]);
}

/** Remove a milestone; its % is absorbed by the last remaining milestone. */
export function removeMilestoneAt(milestones, index) {
  if (milestones.length <= 1) return milestones;
  let next = milestones.filter((_, i) => i !== index);
  // free the last one so it soaks up the removed share (total stays 100%)
  next = next.map((m, i) => (i === next.length - 1 ? { ...m, locked: false } : m));
  return normalizeMilestones(next);
}

export function milestonesTotal(milestones) {
  return round2((milestones || []).reduce((s, m) => s + (Number(m.percent) || 0), 0));
}

/** % of the item actually billed on THIS invoice = the milestone marked billed.
 *  Returns null when the item has no milestones (falls back to price_percentage).
 */
export function billedPercentFromMilestones(milestones) {
  if (!milestones || milestones.length === 0) return null;
  const billed = milestones.find((m) => m.billed);
  return billed ? round2(Number(billed.percent) || 0) : 0;
}

/** { taxable, tax, lineTotal } for one row, given its own tax_rate (%) */
export function calculateItemBreakdown(item, isGst) {
  const taxable = calculateItemTaxable(item);
  const rate = isGst ? Number(item.tax_rate || 0) : 0;
  const tax = isGst ? round2((taxable * rate) / 100) : 0;
  const lineTotal = round2(taxable + tax);
  return { taxable, tax, lineTotal, rate };
}

/**
 * Full summary for the redesigned form: totals across all rows, plus a
 * blended price-% and GST rate for display (falls back gracefully when
 * rows use different percentages/rates).
 */
export function calculateInvoiceSummaryV2(items, location) {
  const isGst = location?.location_type === "GST";

  let totalPrice = 0;
  let taxableAmount = 0;
  let taxAmount = 0;

  items.forEach((item) => {
    const qty = item.qty === "" || item.qty == null ? 1 : Number(item.qty) || 0;
    totalPrice += (Number(item.total_price) || 0) * qty;
    const { taxable, tax } = calculateItemBreakdown(item, isGst);
    taxableAmount += taxable;
    taxAmount += tax;
  });

  totalPrice = round2(totalPrice);
  taxableAmount = round2(taxableAmount);
  taxAmount = round2(taxAmount);

  const pricePercentage = totalPrice > 0 ? round2((taxableAmount / totalPrice) * 100) : 100;
  const effectiveGstRate = isGst && taxableAmount > 0 ? round2((taxAmount / taxableAmount) * 100) : location?.default_gst_percentage || 0;
  const totalAmount = round2(taxableAmount + taxAmount);

  return { totalPrice, pricePercentage, taxableAmount, taxAmount, effectiveGstRate, totalAmount, isGst };
}

/* ------------------------------ Invoices CRUD ------------------------------ */

export function getInvoices() {
  return readJSON(INVOICES_KEY, []);
}

export function getInvoiceById(id) {
  return getInvoices().find((inv) => String(inv.id) === String(id)) || null;
}

/**
 * Create + persist an invoice (Section 4.4 "createInvoice" flow, done
 * client-side for now). Consumes the sequence number as the final step,
 * mirroring "sequence only updates once the invoice is actually saved".
 */
export function createInvoice({
  location,
  invoiceDate,
  invoiceType,
  client,
  items,
  gstPercentage,
  paymentStatus,
  paymentMode,
  terms,
  showBankDetails,
}) {
  const financialYear = getFinancialYear(invoiceDate);
  const summary = calculateInvoiceSummaryV2(items, location);
  const sequence = consumeSequence(location, financialYear);
  const invoiceNumber = buildInvoiceNumber(financialYear, sequence);

  const invoice = {
    id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    invoice_number: invoiceNumber,
    billing_location_id: location.id,
    financial_year: financialYear,
    sequence_number: sequence,
    invoice_date: invoiceDate,
    invoice_type: invoiceType || "DIRECT",
    client_name: client.client_name,
    client_contact: client.client_contact || "",
    client_address: client.client_address || "",
    client_state: client.client_state || "",
    client_pan: client.client_pan || "",
    client_gst_number: client.client_gst_number || null,
    gst_percentage: summary.isGst ? Number(gstPercentage ?? summary.effectiveGstRate) : null,
    gst_amount: summary.isGst ? summary.taxAmount : null,
    subtotal_amount: summary.taxableAmount,
    total_amount: summary.totalAmount,
    payment_status: paymentStatus,
    payment_mode: paymentMode || null,
    terms: terms || "",
    show_bank_details: showBankDetails !== false,
    items: items.map((item, idx) => {
      const breakdown = calculateItemBreakdown(item, summary.isGst);
      return {
        id: `item_${idx}_${Date.now()}`,
        service_description: item.service_description,
        qty: item.qty === "" || item.qty == null ? 1 : Number(item.qty),
        total_price: Number(item.total_price) || 0,
        price_percentage:
          item.milestones?.length
            ? billedPercentFromMilestones(item.milestones)
            : item.price_percentage === ""
            ? 100
            : Number(item.price_percentage),
        milestones: item.milestones || null,
        tax_rate: breakdown.rate,
        taxable_amount: breakdown.taxable,
        tax_amount: breakdown.tax,
        line_total: breakdown.lineTotal,
        subtotal: breakdown.taxable,
      };
    }),
    created_at: Date.now(),
  };

  const invoices = getInvoices();
  invoices.push(invoice);
  // console.log("SAVED INVOICE JSON:");
  // console.log(JSON.stringify(invoice, null, 2));
  writeJSON(INVOICES_KEY, invoices);
  return invoice;
}

export function updateInvoiceStatus(id, paymentStatus) {
  const invoices = getInvoices();
  const idx = invoices.findIndex((inv) => String(inv.id) === String(id));
  if (idx === -1) return null;
  invoices[idx].payment_status = paymentStatus;
  writeJSON(INVOICES_KEY, invoices);
  return invoices[idx];
}

export function deleteInvoice(id) {
  const invoices = getInvoices().filter((inv) => String(inv.id) !== String(id));
  writeJSON(INVOICES_KEY, invoices);
}
