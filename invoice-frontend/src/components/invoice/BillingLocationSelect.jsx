import { IconBuilding, IconChevronDown } from "../icons/Icons";

const TYPE_LABEL = { GST: "GST", NON_GST: "Without GST" };
const TYPE_ORDER = ["GST", "NON_GST"];

function BillingLocationSelect({ locations, selectedLocationId, onLocationChange, required = true, disabled = false }) {
  const activeLocations = locations.filter((loc) => loc.is_active);

  // Spec §2.1: "Invoice create karte waqt user location select karega —
  // GST ya Without GST." So the dropdown always shows exactly these two
  // options — one per location type — instead of every named billing
  // location. Each type resolves to its (first) active location record.
  const options = TYPE_ORDER.map((type) => activeLocations.find((loc) => loc.location_type === type)).filter(Boolean);

  return (
    <div>
      <label className="mb-1.5 block truncate text-xs font-semibold text-slate-500">
        Billing Location {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
          <IconBuilding />
        </span>
        <select
          value={selectedLocationId}
          onChange={(e) => onLocationChange(e.target.value)}
          disabled={disabled}
          className="h-10 w-full appearance-none truncate rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm font-medium text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">{disabled ? "Loading…" : "Select location"}</option>
          {options.map((location) => (
            <option key={location.id} value={location.id}>
              {TYPE_LABEL[location.location_type] || location.name}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
          <IconChevronDown />
        </span>
      </div>
    </div>
  );
}

export default BillingLocationSelect;
