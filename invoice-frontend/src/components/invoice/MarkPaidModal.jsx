import { useEffect, useState } from "react";

import { PAYMENT_MODE_OPTIONS } from "../../data/invoiceFormOptions";

const todayISO = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const inputClass = (hasError) =>
  `w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 ${
    hasError
      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
      : "border-slate-300 focus:border-teal-500 focus:ring-teal-100"
  }`;

/**
 * Popup shown when an invoice is marked as Paid. All four fields are required.
 * onSubmit receives { payment_mode, payment_reference, payment_date, amount_paid }
 * and may return a promise (the modal stays open until it resolves).
 */
function MarkPaidModal({ open, invoiceNumber, totalAmount, submitting, serverError, onSubmit, onClose }) {
  const [form, setForm] = useState({
    payment_mode: "",
    payment_reference: "",
    payment_date: todayISO(),
    amount_paid: "",
  });
  const [errors, setErrors] = useState({});

  // Fresh form every time the popup opens; amount defaults to the invoice total.
  useEffect(() => {
    if (!open) return;
    setForm({
      payment_mode: "",
      payment_reference: "",
      payment_date: todayISO(),
      amount_paid: totalAmount ? String(totalAmount) : "",
    });
    setErrors({});
  }, [open, totalAmount]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const setField = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.payment_mode) e.payment_mode = "Payment Mode is required.";
    if (!form.payment_reference.trim()) e.payment_reference = "Reference ID is required.";
    if (!form.payment_date) e.payment_date = "Payment Date is required.";
    const amt = Number(form.amount_paid);
    if (form.amount_paid === "") e.amount_paid = "Total Payment is required.";
    else if (!Number.isFinite(amt) || amt <= 0) e.amount_paid = "Enter an amount greater than 0.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    if (submitting || !validate()) return;
    onSubmit({
      payment_mode: form.payment_mode,
      payment_reference: form.payment_reference.trim(),
      payment_date: form.payment_date,
      amount_paid: Number(form.amount_paid),
    });
  };

  const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";
  const errorText = (name) =>
    errors[name] ? <p className="mt-1 text-xs font-medium text-red-500">{errors[name]}</p> : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mark-paid-title"
    >
      <form
        onSubmit={handleSubmit}
        noValidate
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-5">
          <h2 id="mark-paid-title" className="text-lg font-bold text-slate-900">
            Mark as Paid
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Enter the payment details{invoiceNumber ? ` for ${invoiceNumber}` : ""}. All fields are required.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="pay-mode" className={labelClass}>
              Payment Mode <span className="text-red-500">*</span>
            </label>
            <select
              id="pay-mode"
              value={form.payment_mode}
              onChange={(e) => setField("payment_mode", e.target.value)}
              className={inputClass(errors.payment_mode)}
            >
              <option value="">Select payment mode</option>
              {PAYMENT_MODE_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            {errorText("payment_mode")}
          </div>

          <div>
            <label htmlFor="pay-ref" className={labelClass}>
              Reference ID <span className="text-red-500">*</span>
            </label>
            <input
              id="pay-ref"
              type="text"
              maxLength={100}
              value={form.payment_reference}
              onChange={(e) => setField("payment_reference", e.target.value)}
              placeholder="Transaction / UTR / cheque number"
              className={inputClass(errors.payment_reference)}
            />
            {errorText("payment_reference")}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pay-date" className={labelClass}>
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                id="pay-date"
                type="date"
                value={form.payment_date}
                onChange={(e) => setField("payment_date", e.target.value)}
                className={inputClass(errors.payment_date)}
              />
              {errorText("payment_date")}
            </div>

            <div>
              <label htmlFor="pay-amount" className={labelClass}>
                Total Payment (₹) <span className="text-red-500">*</span>
              </label>
              <input
                id="pay-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.amount_paid}
                onChange={(e) => setField("amount_paid", e.target.value)}
                placeholder="0.00"
                className={inputClass(errors.amount_paid)}
              />
              {errorText("amount_paid")}
            </div>
          </div>
        </div>

        {serverError && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            {serverError}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Confirm Payment"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default MarkPaidModal;
