import { financialYearLabel, formatINR } from "../../utils/InvoiceCalculations";
import roofzeLogo from "../../assets/roofze-logo.png";

// Brand colours (taken from the Roofze invoice template)
const DARK = "#222222";
const TEAL = "#4bada0";
const LIME = "#c8e47d";

/** The milestone actually billed on this invoice for one item, if any. */
function getBilledMilestone(item) {
  if (!item.milestones || item.milestones.length === 0) return null;
  const billed = item.milestones.find((m) => m.billed);
  if (!billed) return null;
  const order = item.milestones.findIndex((m) => m.billed) + 1;
  return { ...billed, order, total: item.milestones.length };
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "shrink-0",
};

function GlobeIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9 7.5l1.4 2.4-1 1.1a6 6 0 003 3l1.1-1 2.4 1.4-.5 1.6c-.2.6-.8.9-1.4.8A9 9 0 017.2 9.3c-.1-.6.2-1.2.8-1.4L9 7.5z" />
    </svg>
  );
}

/**
 * Renders the actual invoice document — styled to match Roofze's invoice
 * template (dark header with slanted PAID/UNPAID block, teal contact bar,
 * lime/teal/dark table header, teal total box, slanted footer).
 *
 * Props:
 *  - invoice: the saved invoice object (or a "draft" shape built live from
 *    the create-invoice form, for the pre-submit preview)
 *  - location: the billing location object for this invoice
 */
function InvoicePreview({ invoice, location }) {
  if (!invoice || !location) return null;

  const isGst = location.location_type === "GST";
  const isPaid = invoice.payment_status === "PAID";

  return (
    <div
      id="invoice-print-area"
      className="relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:min-h-[296mm]"
      style={{ fontFamily: "'Poppins', 'Segoe UI', Arial, sans-serif" }}
    >
      {/* Header: dark bar + slanted PAID / UNPAID block */}
      <div className="flex h-20 items-stretch sm:h-24" style={{ backgroundColor: DARK }}>
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 sm:gap-3 sm:px-5">
          <img src={roofzeLogo} alt="Roofze" className="h-[72px] w-[72px] shrink-0 object-contain sm:h-[88px] sm:w-[88px]" />
          <div className="min-w-0">
            <div
              className="text-[13px] font-extrabold leading-tight tracking-tight sm:text-xl"
              style={{ color: LIME }}
            >
              ROOFZE DIGITAL HUB LLP
            </div>
            <div className="mt-1 text-[8px] tracking-[0.22em] text-white sm:text-[11px]">
              EMPOWER YOUR DIGITAL JOURNEY
            </div>
          </div>
        </div>
        <div
          className="flex w-28 shrink-0 items-center justify-center pl-4 text-lg font-extrabold sm:w-64 sm:text-3xl"
          style={{
            backgroundColor: isPaid ? LIME : "#ff5a5f",
            color: isPaid ? DARK : "#ffffff",
            clipPath: "polygon(18% 0, 100% 0, 100% 100%, 0 100%)",
          }}
        >
          {isPaid ? "PAID" : "UNPAID"}
        </div>
      </div>

      {/* Teal contact bar */}
      <div
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-[10px] font-medium text-white sm:px-6 sm:text-[12px]"
        style={{ backgroundColor: TEAL }}
      >
        <span className="flex items-center gap-2">
          <GlobeIcon /> www.roofze.com / www.roofze.in
        </span>
        <span className="flex items-center gap-2">
          <MailIcon /> roofzedigitalhub@gmail.com
        </span>
        <span className="flex items-center gap-2">
          <PhoneIcon /> +91 91677 00605 / 8356037700
        </span>
      </div>

      {/* Body */}
      <div className="relative flex-1 p-4 sm:px-8 sm:py-7">
        {/* Faint logo watermark */}
        <img
          src={roofzeLogo}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 w-[70%] -translate-x-1/2 -translate-y-1/2 select-none object-contain opacity-[0.05]"
        />

        <div className="relative">
          {/* Title row */}
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:justify-between">
            <div>
              <div className="text-xl font-bold leading-none" style={{ color: TEAL }}>
                INVOICE
              </div>
              <div className="mt-1 text-sm text-slate-900">
                Date:{" "}
                {new Date(invoice.invoice_date).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </div>
            <div className="sm:text-right">
              <div className="text-base font-bold text-slate-900">{invoice.invoice_number}</div>
              <div className="text-[11px] text-slate-500">{financialYearLabel(invoice.financial_year)}</div>
            </div>
          </div>

          {/* Billed to / Payment to */}
          <div className="mb-8 grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 sm:gap-6">
            <div>
              <div className="mb-1 text-slate-900">Billed to:</div>
              <div className="mb-0.5 text-base font-semibold" style={{ color: TEAL }}>
                {invoice.client_name || "—"}
              </div>
              <div className="text-slate-800">{invoice.client_contact}</div>
              {invoice.client_gst_number && (
                <div className="mt-1 font-bold text-slate-900">GST IN : {invoice.client_gst_number}</div>
              )}
            </div>
            <div className="sm:text-right">
              <div className="mb-1 text-slate-900">Payment to:</div>
              <div className="mb-0.5 text-base font-semibold" style={{ color: TEAL }}>
                ROOFZE DIGITAL HUB LLP
              </div>
              <div className="text-slate-800">Office : 9167700605</div>
              {isGst && (
                <>
                  <div className="mt-1 font-bold text-slate-900">GST IN : {location.gst_number}</div>
                  <div className="font-bold text-slate-900">PAN: {location.pan_number}</div>
                </>
              )}
            </div>
          </div>

          {/* Service items */}
          <div className="mb-4 overflow-x-auto">
            <div className="relative min-w-[480px]">
              {/* lime / teal / dark header strip */}
              <div
                className="absolute inset-x-0 top-0 h-10"
                style={{
                  background: `linear-gradient(106deg, ${LIME} 0 17%, ${TEAL} 17% 45%, ${DARK} 45% 100%)`,
                }}
              />
              <table className="relative w-full text-xs">
                <thead>
                  <tr className="h-10 text-left text-white">
                    <th className="w-[44%] px-4 font-bold" style={{ color: DARK }}>
                      SERVICE
                    </th>
                    <th className="px-3 text-right font-bold">TOTAL PRICE</th>
                    <th className="px-3 text-right font-bold">PRICE %</th>
                    <th className="px-4 text-right font-bold">SUBTOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx) => {
                    const billedMilestone = getBilledMilestone(item);
                    return (
                      <tr key={item.id || idx} className="align-top">
                        <td className="px-4 py-3 text-slate-800">
                          <div>{item.service_description}</div>
                          {billedMilestone && (
                            <div
                              className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ backgroundColor: "#e8f5f3", color: "#2f7f75" }}
                            >
                              {billedMilestone.label} of {billedMilestone.total} · {billedMilestone.percent}% billed
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-800">{formatINR(item.total_price)}</td>
                        <td className="px-3 py-3 text-right text-slate-800">{item.price_percentage}%</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {formatINR(item.subtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer note + totals */}
          <div className="flex flex-col-reverse justify-between gap-4 border-t-2 border-slate-900 pt-3 sm:flex-row sm:items-center">
            <div className="flex-1 text-xs sm:pr-6">
              {isPaid ? (
                <div className="text-sm font-bold leading-snug text-slate-900">
                  Thank you. Your payment has been received
                  {invoice.payment_mode ? ` by ${invoice.payment_mode}` : ""}.
                </div>
              ) : (
                <div>
                  <div className="mb-1 font-bold text-slate-900">Terms and conditions :</div>
                  <div className="italic text-slate-600">
                    Please ensure that payment is made within seven days of receipt of this invoice.
                  </div>
                </div>
              )}
            </div>
            <div className="w-full text-sm sm:w-64">
              {isGst && (
                <>
                  <div className="flex justify-between px-3 py-1">
                    <span className="text-slate-600">Subtotal</span>
                    <span>{formatINR(invoice.subtotal_amount)}</span>
                  </div>
                  <div className="flex justify-between px-3 py-1">
                    <span className="text-slate-600">GST {invoice.gst_percentage}%</span>
                    <span>{formatINR(invoice.gst_amount)}</span>
                  </div>
                </>
              )}
              <div
                className="mt-2 flex items-center justify-between px-3 py-3 text-white"
                style={{ backgroundColor: TEAL }}
              >
                <span className="font-semibold">Total</span>
                <span className="font-semibold">{formatINR(invoice.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Payment details */}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1 text-xs">
              <div className="mb-1.5 border-b-2 border-slate-900 pb-1.5 text-sm font-bold text-slate-900">
                Payment Details :
              </div>
              <div className="grid grid-cols-[92px_1fr] gap-y-0.5 pt-1 text-slate-800">
                <span>Bank Name</span>
                <span>: {location.bank_name}</span>
                <span>A/c Name</span>
                <span>: {location.account_name}</span>
                <span>A/c Number</span>
                <span>: {location.account_number}</span>
                <span>IFSC code</span>
                <span>: {location.ifsc_code}</span>
              </div>
            </div>

            {!isGst && (
              <div className="text-center sm:self-end">
                {location.qr_code_url ? (
                  <img
                    src={location.qr_code_url}
                    alt="Scan to pay"
                    className="mx-auto h-20 w-20 rounded-lg border border-slate-200 object-cover"
                  />
                ) : (
                  <div
                    className="mx-auto h-20 w-20 rounded-lg border border-slate-300"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(0deg, #14171A 0px, #14171A 3px, transparent 3px, transparent 9px), repeating-linear-gradient(90deg, #14171A 0px, #14171A 3px, transparent 3px, transparent 9px)",
                      backgroundSize: "9px 9px",
                      backgroundBlendMode: "multiply",
                    }}
                    aria-label="QR code placeholder"
                  />
                )}
                <div className="mt-1 text-[10px] text-slate-500">Scan to pay via UPI</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom border: teal slanted into dark (pinned to the bottom of the page) */}
      <div className="relative mt-auto h-5 sm:h-6" style={{ backgroundColor: DARK }}>
        <div
          className="absolute inset-y-0 left-0 w-[48%]"
          style={{
            backgroundColor: TEAL,
            clipPath: "polygon(0 0, 94% 0, 100% 100%, 0 100%)",
          }}
        />
      </div>
    </div>
  );
}

export default InvoicePreview;
