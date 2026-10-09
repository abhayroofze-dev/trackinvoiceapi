const GST_OPTIONS = [5, 12, 18, 28];

/**
 * Renders only when the selected billing location is a GST location.
 * Parent (CreateInvoice) is responsible for the `{isGst && <GstFieldsSection ... />}`
 * conditional — this component just renders the field itself.
 */
function GstFieldsSection({ gstPercentage, onChange }) {
  return (
    <div className="max-w-[10rem]">
      <label className="mb-1.5 block text-xs font-semibold text-slate-500">GST %</label>
      <select
        value={gstPercentage}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      >
        {GST_OPTIONS.map((pct) => (
          <option key={pct} value={pct}>
            {pct}%
          </option>
        ))}
      </select>
    </div>
  );
}

export default GstFieldsSection;
