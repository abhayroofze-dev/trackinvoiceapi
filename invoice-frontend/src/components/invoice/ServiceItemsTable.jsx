import { useEffect, useState } from "react";
import { GST_RATES, SERVICE_CATALOG } from "../../data/invoiceFormOptions";
import {
  calculateItemBreakdown,
  formatINR,
  round2,
  defaultMilestones,
  redistributeMilestones,
  removeMilestoneAt,
  milestonesTotal,
  billedPercentFromMilestones,
} from "../../utils/InvoiceCalculations";
import { IconGrip, IconTrash, IconChevronDown, IconPlus } from "../icons/Icons";

/**
 * Percent box for one milestone. Keeps what the user is typing locally so the
 * field can be cleared / edited freely, and only commits valid numbers (0-100).
 * Resets to the real value on blur or whenever the value changes elsewhere.
 */
function MilestonePercentInput({ value, onCommit, className }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value;
    setDraft(raw);
    if (raw === "" || raw === ".") return; // still typing
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0) return; // 0% milestone is not allowed
    onCommit(num);
  };

  return (
    <input
      type="number"
      min="0.01"
      max="100"
      step="0.01"
      inputMode="decimal"
      value={draft}
      onChange={handleChange}
      onBlur={() => setDraft(String(value))}
      className={className}
    />
  );
}

/**
 * items: [{ service_description, qty, total_price, price_percentage, tax_rate, milestones? }]
 * onChange(nextItems) — parent (CreateInvoice) owns the array in state.
 * location: selected billing location, used to build the Tax Treatment options.
 * invoiceType: "DIRECT" | "MILESTONE". Milestone fields (Price % + the
 * milestone split panel) only show for MILESTONE invoices.
 */
function ServiceItemsTable({ items, onChange, location, isGst, invoiceType }) {
  const isMilestone = invoiceType === "MILESTONE";

  const updateItem = (index, field, value) => {
    const next = items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    onChange(next);
  };

  // Typing a % in a milestone: the leftover automatically opens up as the
  // next milestone (see redistributeMilestones in InvoiceCalculations).
  const setMilestonePercent = (itemIndex, msIndex, value) => {
    const item = items[itemIndex];
    updateItem(itemIndex, "milestones", redistributeMilestones(item.milestones, msIndex, value));
  };

  const removeMilestoneRow = (itemIndex, msIndex) => {
    const item = items[itemIndex];
    updateItem(itemIndex, "milestones", removeMilestoneAt(item.milestones, msIndex));
  };

  const setBilledMilestone = (itemIndex, msIndex) => {
    const item = items[itemIndex];
    const next = item.milestones.map((m, i) => ({ ...m, billed: i === msIndex }));
    updateItem(itemIndex, "milestones", next);
  };

  const addRow = () => {
    onChange([
      ...items,
      {
        service_description: "",
        qty: 1,
        total_price: "",
        price_percentage: 100,
        tax_rate: location?.default_gst_percentage || 18,
        ...(isMilestone ? { milestones: defaultMilestones() } : {}),
      },
    ]);
  };

  const removeRow = (index) => {
    if (items.length === 1) return; // keep at least one row
    onChange(items.filter((_, i) => i !== index));
  };

  const fieldLabelClass = "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400";
  const computedBoxClass = "flex h-9 w-full items-center truncate rounded-lg bg-slate-100 px-2.5 text-sm font-medium text-slate-600";

  return (
    <div>
      <div className="space-y-3">
        {items.map((item, index) => {
        const { taxable, tax, lineTotal } = calculateItemBreakdown(item, isGst);
        const itemQty = item.qty === "" || item.qty == null ? 1 : Number(item.qty) || 0;
        const itemTotal = round2((Number(item.total_price) || 0) * itemQty);
        const itemRate = isGst ? Number(item.tax_rate) || 0 : 0;
        const withGst = (base) => round2(base + (base * itemRate) / 100);
        const itemTotalWithGst = withGst(itemTotal);
        return (
            <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
              {/* Row header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                  <IconGrip />
                  <span>Item {index + 1}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  disabled={items.length === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Remove item"
                  title="Remove item"
                >
                  <IconTrash />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {/* Service / description — spans the full row */}
                <div className="col-span-2 sm:col-span-3 lg:col-span-4">
                  <label className={fieldLabelClass}>Service / Description</label>
                  <div className="relative">
                    <select
                      value={
                        SERVICE_CATALOG.includes(item.service_description) ? item.service_description : "Custom Service"
                      }
                      onChange={(e) =>
                        updateItem(index, "service_description", e.target.value === "Custom Service" ? "" : e.target.value)
                      }
                      className="h-9 w-full appearance-none truncate rounded-lg border border-slate-300 bg-white pl-3 pr-8 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    >
                      {SERVICE_CATALOG.map((service) => (
                        <option key={service} value={service}>
                          {service}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-400">
                      <IconChevronDown className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  {(!SERVICE_CATALOG.includes(item.service_description) || item.service_description === "") && (
                    <input
                      type="text"
                      value={item.service_description}
                      onChange={(e) => updateItem(index, "service_description", e.target.value)}
                      placeholder="Describe the service…"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  )}
                </div>

                {/* Qty */}
                <div>
                  <label className={fieldLabelClass}>Qty</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.qty}
                    onChange={(e) => updateItem(index, "qty", e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                {/* Total price */}
                <div>
                  <label className={fieldLabelClass}>Total Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.total_price}
                    onChange={(e) => updateItem(index, "total_price", e.target.value)}
                    placeholder="15000"
                    className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                {/* Price % — milestone invoices only; comes from the milestone being billed */}
                {isMilestone && (
                  <div>
                    <label className={fieldLabelClass}>Price %</label>
                    <div className={computedBoxClass} title="Driven by the milestone marked 'Billing now' below">
                      {billedPercentFromMilestones(item.milestones) ?? 100}%
                    </div>
                  </div>
                )}

                {/* Taxable amount (computed) */}
                <div>
                  <label className={fieldLabelClass}>Taxable Amount (₹)</label>
                  <div className={computedBoxClass}>{taxable.toLocaleString("en-IN")}</div>
                </div>

                {/* Tax treatment */}
                <div>
                  <label className={fieldLabelClass}>Tax Treatment</label>
                  {isGst ? (
                    <div className="relative">
                      <select
                        value={item.tax_rate}
                        onChange={(e) => updateItem(index, "tax_rate", Number(e.target.value))}
                        className="h-9 w-full appearance-none rounded-lg border border-slate-300 bg-white pl-2.5 pr-7 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      >
                        {GST_RATES.map((rate) => (
                          <option key={rate} value={rate}>
                            GST {rate}%
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400">
                        <IconChevronDown className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  ) : (
                    <div className="flex h-9 w-full items-center truncate rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 text-xs text-slate-400">
                      No GST
                    </div>
                  )}
                </div>

                {/* Tax amount (computed) */}
                <div>
                  <label className={fieldLabelClass}>Tax Amount (₹)</label>
                  <div className={computedBoxClass}>{tax.toLocaleString("en-IN")}</div>
                </div>

                {/* Line total (computed) */}
                <div>
                  <label className={fieldLabelClass}>Line Total (₹)</label>
                  <div className="flex h-9 w-full items-center truncate text-sm font-bold text-slate-800">
                    {formatINR(lineTotal)}
                  </div>
                </div>
              </div>

              {/* Milestones panel — milestone invoices only, always visible under the row */}
              {isMilestone && item.milestones?.length > 0 && (
                <div className="mt-3 rounded-xl border border-teal-100 bg-teal-50/40 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600">
                      Payment split for this item · total {formatINR(itemTotalWithGst)}
                      {itemRate > 0 && (
                        <span className="ml-1 font-normal text-slate-400">
                          (₹{itemTotal.toLocaleString("en-IN")} + GST {itemRate}%)
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    {item.milestones.map((m, msIndex) => {
                    const baseAmount = round2((itemTotal * (Number(m.percent) || 0)) / 100);
                    const amount = withGst(baseAmount);                      
                    return (
                        <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-2.5 py-1.5">
                          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                            <input
                              type="radio"
                              name={`billed-milestone-${index}`}
                              checked={!!m.billed}
                              onChange={() => setBilledMilestone(index, msIndex)}
                              className="h-3.5 w-3.5 text-teal-600 focus:ring-teal-500"
                              title="Bill this milestone on the current invoice"
                            />
                            {m.label}
                          </label>

                          <div className="relative w-24">
                            <MilestonePercentInput
                              value={m.percent}
                              onCommit={(v) => setMilestonePercent(index, msIndex, v)}
                              className="h-8 w-full rounded-md border border-slate-300 px-2 pr-5 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-[11px] text-slate-400">%</span>
                          </div>

                                      <span className="w-28 shrink-0 text-xs font-semibold text-slate-700">
                                        {formatINR(amount)}
                                        {itemRate > 0 && (
                                          <span className="block text-[10px] font-normal text-slate-400">
                                            {formatINR(baseAmount)} + GST
                                          </span>
                                        )}
                                      </span>
                          {m.billed && <span className="text-[11px] font-semibold text-teal-600">Billing now</span>}

                          <button
                            type="button"
                            onClick={() => removeMilestoneRow(index, msIndex)}
                            disabled={item.milestones.length === 1}
                            className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-slate-300 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label="Remove milestone"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-2 flex justify-end">
                    <span
                      className={`text-[11px] font-semibold ${
                        milestonesTotal(item.milestones) === 100 ? "text-slate-400" : "text-red-500"
                      }`}
                    >
                      Total: {milestonesTotal(item.milestones)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="mt-4 flex items-center gap-1.5 rounded-lg border border-dashed border-teal-300 px-3 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-50"
      >
        <IconPlus /> Add another service
      </button>
    </div>
  );
}

export default ServiceItemsTable;
