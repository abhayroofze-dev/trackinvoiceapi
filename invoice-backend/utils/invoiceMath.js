// utils/invoiceMath.js
//
// Server-side invoice calculations. The backend NEVER trusts totals sent by
// the browser — it recomputes taxable amount / tax / totals from the raw
// item inputs (qty, total_price, milestones, tax_rate) so what is stored in
// the database is always internally consistent.
//
// Mirrors the rules of the frontend (invoice-frontend/src/utils/InvoiceCalculations.js):
//   taxable  = total_price * qty * (billed % / 100)
//   tax      = taxable * tax_rate / 100          (only for GST locations)
//   DIRECT invoices always bill 100%; MILESTONE invoices bill the % of the
//   one milestone marked "billed".

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

const INVOICE_TYPES = ['DIRECT', 'MILESTONE'];
const PAYMENT_STATUSES = ['PENDING', 'PAID'];

/** "2026-09-28" -> "2627" (Indian FY, Apr–Mar). Parsed by hand to avoid timezone shifts. */
function getFinancialYear(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  if (!m) throw new HttpError(400, 'Invoice date must be in YYYY-MM-DD format.');
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new HttpError(400, 'Invoice date is not a valid calendar date.');
  }
  const startYear = month >= 4 ? year : year - 1;
  return `${String(startYear).slice(-2)}${String(startYear + 1).slice(-2)}`;
}

/** GST locations number from 0001, Non-GST locations from 1001. */
function startSequenceFor(locationType) {
  return locationType === 'GST' ? 1 : 1001;
}

/** RFZ/<FY>/<0000> */
function buildInvoiceNumber(financialYear, sequence) {
  return `RFZ/${financialYear}/${String(sequence).padStart(4, '0')}`;
}

function toNumber(value, label, { min = 0, allowEmpty = false, fallback = 0 } = {}) {
  if (allowEmpty && (value === '' || value === null || value === undefined)) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new HttpError(400, `${label} must be a number.`);
  if (n < min) throw new HttpError(400, `${label} cannot be less than ${min}.`);
  return n;
}

function normaliseMilestones(rawMilestones, itemLabel, totalForItem) {
  if (!Array.isArray(rawMilestones) || rawMilestones.length === 0) {
    throw new HttpError(400, `${itemLabel}: a milestone invoice needs at least one milestone.`);
  }
  const milestones = rawMilestones.map((m, i) => {
    const percent = round2(toNumber(m.percent, `${itemLabel}, Milestone ${i + 1} %`));
    if (percent > 100) throw new HttpError(400, `${itemLabel}, Milestone ${i + 1}: % cannot exceed 100.`);
    return {
      milestone_no: i + 1,
      label: `Milestone ${i + 1}`,
      percent,
      amount: round2((totalForItem * percent) / 100),
      is_billed: !!m.billed,
    };
  });

  const sum = round2(milestones.reduce((s, m) => s + m.percent, 0));
  if (Math.abs(sum - 100) > 0.01) {
    throw new HttpError(400, `${itemLabel}: milestones add up to ${sum}%, they must add up to exactly 100%.`);
  }
  const billedCount = milestones.filter((m) => m.is_billed).length;
  if (billedCount !== 1) {
    throw new HttpError(400, `${itemLabel}: exactly one milestone must be marked "Billing now".`);
  }
  return milestones;
}

/**
 * Validate + compute every item. Returns { items, totals }.
 * items[] are ready to insert (numbers already rounded).
 */
function computeInvoice(rawItems, { invoiceType, isGst }) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new HttpError(400, 'Add at least one service item.');
  }

  let gross = 0;
  let taxableSum = 0;
  let taxSum = 0;

  const items = rawItems.map((raw, idx) => {
    const label = `Item ${idx + 1}`;
    const description = String(raw.service_description || '').trim();
    if (!description) throw new HttpError(400, `${label}: service description is required.`);

    const qty = toNumber(raw.qty, `${label} qty`, { allowEmpty: true, fallback: 1 });
    if (qty <= 0) throw new HttpError(400, `${label}: qty must be greater than 0.`);
    const totalPrice = toNumber(raw.total_price, `${label} total price`);
    if (totalPrice <= 0) throw new HttpError(400, `${label}: total price must be greater than 0.`);

    const baseAmount = round2(totalPrice * qty);

    let pricePercentage = 100;
    let milestones = [];
    if (invoiceType === 'MILESTONE') {
      milestones = normaliseMilestones(raw.milestones, label, baseAmount);
      pricePercentage = milestones.find((m) => m.is_billed).percent;
    }

    const taxRate = isGst ? toNumber(raw.tax_rate, `${label} tax rate`, { allowEmpty: true, fallback: 0 }) : 0;
    if (taxRate > 100) throw new HttpError(400, `${label}: tax rate cannot exceed 100%.`);

    const taxable = round2(baseAmount * (pricePercentage / 100));
    const tax = isGst ? round2((taxable * taxRate) / 100) : 0;

    gross += baseAmount;
    taxableSum += taxable;
    taxSum += tax;

    return {
      line_no: idx + 1,
      service_description: description,
      qty: round2(qty),
      total_price: round2(totalPrice),
      price_percentage: round2(pricePercentage),
      tax_rate: round2(taxRate),
      taxable_amount: taxable,
      tax_amount: tax,
      line_total: round2(taxable + tax),
      milestones,
    };
  });

  const subtotal = round2(taxableSum);
  const gstAmount = isGst ? round2(taxSum) : null;
  const totals = {
    gross_amount: round2(gross),
    subtotal_amount: subtotal,
    gst_amount: gstAmount,
    // blended rate, only meaningful for display (per-item rates are the source of truth)
    gst_percentage: isGst ? (subtotal > 0 ? round2((taxSum / subtotal) * 100) : 0) : null,
    total_amount: round2(subtotal + (gstAmount || 0)),
  };

  return { items, totals };
}

module.exports = {
  HttpError,
  round2,
  INVOICE_TYPES,
  PAYMENT_STATUSES,
  getFinancialYear,
  startSequenceFor,
  buildInvoiceNumber,
  computeInvoice,
};
