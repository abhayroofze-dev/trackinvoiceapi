import { INVOICE_TYPES } from "../../data/invoiceFormOptions";

const SHORT_LABEL = { DIRECT: "Direct", MILESTONE: "Milestone" };

function InvoiceTypeTabs({ value, onChange, required = true }) {
  return (
    <div>
      <label className="mb-1.5 block truncate text-xs font-semibold text-slate-500">
        Invoice Type {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex h-10 w-full rounded-lg border border-slate-300 bg-white p-1">
        {INVOICE_TYPES.map((type) => {
          const isActive = value === type.value;
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => onChange(type.value)}
              title={type.label}
              className={`flex flex-1 items-center justify-center whitespace-nowrap rounded-md px-1.5 text-[11px] font-semibold transition sm:text-xs ${
                isActive ? "bg-teal-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span className="hidden sm:inline">{type.label}</span>
              <span className="sm:hidden">{SHORT_LABEL[type.value]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default InvoiceTypeTabs;
