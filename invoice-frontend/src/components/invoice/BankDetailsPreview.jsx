/**
 * Shows the bank details for the currently selected billing location.
 * Per spec 6.2: <BankDetailsPreview bank={selectedLocation.bank} showQr={!isGst} />
 * Here we just pass the whole location in, since our location objects
 * already carry the bank fields flat (bank_name, account_name, ...).
 */
function BankDetailsPreview({ location }) {
  if (!location) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-400">
        Select a billing location to see its bank details.
      </div>
    );
  }

  const showQr = location.location_type !== "GST";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Payment Details
      </h3>
      <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-sm">
        <dt className="text-slate-400">Bank Name</dt>
        <dd className="font-medium text-slate-700">{location.bank_name}</dd>

        <dt className="text-slate-400">A/c Name</dt>
        <dd className="font-medium text-slate-700">{location.account_name}</dd>

        <dt className="text-slate-400">A/c Number</dt>
        <dd className="font-medium text-slate-700">{location.account_number}</dd>

        <dt className="text-slate-400">IFSC Code</dt>
        <dd className="font-medium text-slate-700">{location.ifsc_code}</dd>
      </dl>

      {showQr && (
        <div className="mt-4 flex items-center gap-3 border-t border-slate-200 pt-3">
          {location.qr_code_url ? (
            <img
              src={location.qr_code_url}
              alt="Scan to pay QR code"
              className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
            />
          ) : (
            <div
              className="h-16 w-16 shrink-0 rounded-lg border border-slate-300"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, #14171A 0px, #14171A 2px, transparent 2px, transparent 6px), repeating-linear-gradient(90deg, #14171A 0px, #14171A 2px, transparent 2px, transparent 6px)",
                backgroundSize: "6px 6px",
                backgroundBlendMode: "multiply",
                opacity: 0.85,
              }}
              aria-label="QR code placeholder"
            />
          )}
          <p className="text-xs text-slate-500">
            Scan to pay via UPI. <br className="hidden sm:block" />
            This location has no GST, so a QR code appears on its invoices instead.
          </p>
        </div>
      )}
    </div>
  );
}

export default BankDetailsPreview;
