import { IconDoc, IconInfo } from "../icons/Icons";
import { formatINR } from "../../utils/InvoiceCalculations";

/**
 * summary: return value of calculateInvoiceSummaryV2()
 * location: the selected billing location (for the CGST/SGST note)
 * showPricePercentageRow: hide for Direct Invoice (always 100%)
 */
function InvoiceSummaryCard({ summary, location, invoiceTypeLabel, showPricePercentageRow, error }) {
  const half = (summary.effectiveGstRate / 2).toFixed(summary.effectiveGstRate % 1 === 0 ? 0 : 1);

  return (
    <div className="lg:sticky lg:top-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <IconDoc />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Invoice Summary</h2>
            <p className="text-xs text-slate-400">Totals are calculated automatically</p>
          </div>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Total Price</dt>
            <dd className="font-semibold text-slate-800">{formatINR(summary.totalPrice)}</dd>
          </div>

          {showPricePercentageRow && (
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Price Percentage ({invoiceTypeLabel})</dt>
              <dd className="font-semibold text-slate-800">{summary.pricePercentage}%</dd>
            </div>
          )}

          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Taxable Amount</dt>
            <dd className="font-semibold text-slate-800">{formatINR(summary.taxableAmount)}</dd>
          </div>

          {summary.isGst && (
            <>
              <div className="border-t border-dashed border-slate-200 pt-3" />
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-slate-500">
                  GST {summary.effectiveGstRate}%
                  <span className="text-slate-300" title={`Split as CGST ${half}% + SGST ${half}%`}>
                    <IconInfo />
                  </span>
                </dt>
                <dd className="font-semibold text-slate-800">{formatINR(summary.taxAmount)}</dd>
              </div>
            </>
          )}
        </dl>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-teal-600 px-4 py-3.5">
          <span className="text-sm font-bold text-white">Total Amount</span>
          <span className="text-lg font-extrabold text-white">{formatINR(summary.totalAmount)}</span>
        </div>

        {summary.isGst && (
          <div className="mt-3 flex gap-2.5 rounded-xl border border-sky-100 bg-sky-50 p-3">
            <span className="mt-0.5 shrink-0 text-sky-500">
              <IconInfo />
            </span>
            <p className="text-xs leading-snug text-sky-700">
              <span className="font-semibold">
                CGST {half}% + SGST {half}% internally
              </span>
              <br />
              For {location?.state || "this location"}, GST {summary.effectiveGstRate}% is split into CGST {half}% and
              SGST {half}% in the backend.
            </p>
          </div>
        )}

        {error && <p className="mt-4 text-sm font-medium text-red-500">{error}</p>}
      </div>
    </div>
  );
}

export default InvoiceSummaryCard;
