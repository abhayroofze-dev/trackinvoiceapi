import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AppLayout from "../../components/layout/AppLayout";
import BillingLocationSelect from "../../components/invoice/BillingLocationSelect";
import ClientSelect from "../../components/invoice/ClientSelect";
import InvoiceTypeTabs from "../../components/invoice/InvoiceTypeTabs";
import ServiceItemsTable from "../../components/invoice/ServiceItemsTable";
import InvoiceSummaryCard from "../../components/invoice/InvoiceSummaryCard";
import InvoicePreview from "../../components/invoice/InvoicePreview";
import { IconCalendar, IconChevronDown, IconCopy, IconEye, IconSave } from "../../components/icons/Icons";

import { useBillingLocations } from "../../api/billingLocations";
import { getClients } from "../../api/clients";
import { createInvoice, getNextInvoiceNumber } from "../../api/invoices";
import { INDIAN_STATES, INVOICE_TYPES, TERMS_PRESETS, PAYMENT_METHOD_OPTIONS } from "../../data/invoiceFormOptions";
import {
  getFinancialYear,
  calculateInvoiceSummaryV2,
  calculateItemBreakdown,
  billedPercentFromMilestones,
  defaultMilestones,
} from "../../utils/InvoiceCalculations";

const todayStr = () => new Date().toISOString().slice(0, 10);

const fieldClass =
  "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
const labelClass = "mb-1.5 block text-xs font-semibold text-slate-500 truncate";

function SectionCard({ number, title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-200 text-xs font-extrabold text-slate-900">
          {number}
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function CreateInvoice() {
  const navigate = useNavigate();

  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayStr());
  const [invoiceType, setInvoiceType] = useState("DIRECT");

  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientState, setClientState] = useState("");
  const [clientPan, setClientPan] = useState("");
  const [clientGstNumber, setClientGstNumber] = useState("");
  // Once an existing client is picked from the dropdown, every field except
  // the Client/Business Name itself is locked (greyed out, not editable) so
  // the invoice always carries the client's real record. Editing the name
  // away from the locked client's name (i.e. typing a different/new name)
  // releases the lock again — see handleClientNameChange below.
  const [lockedClientId, setLockedClientId] = useState(null);
  // The real Client Master id (clients.id) of the picked client. It is saved
  // on the invoice as a link to the client. Stays null when the client was
  // typed in by hand (the typed details are still saved on the invoice).
  const [clientId, setClientId] = useState(null);

  const [items, setItems] = useState([
    { service_description: "Website Design & Development", qty: 1, total_price: "", price_percentage: 100, tax_rate: 18 },
  ]);

  const [termsPreset, setTermsPreset] = useState(TERMS_PRESETS[0].value);
  const [termsText, setTermsText] = useState(TERMS_PRESETS[0].text);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHOD_OPTIONS[0].value);
  const [showBankDetails, setShowBankDetails] = useState(true);

  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const { locations: billingLocations, loading: locationsLoading, error: locationsError } = useBillingLocations();

  // Existing Client Master list (§ "client vale me sare client dropdown me
  // dikhaye, search bhi ho, select karne pe fields autofill ho"). Loaded
  // once on mount, same list every existing client can be searched from.
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    getClients()
      .then((data) => {
        // Inactive clients (switched off in Client Master) can't be billed.
        if (!cancelled) setClients(data.filter((c) => c.status !== "Inactive"));
      })
      .catch(() => {
        // Non-fatal — client search just falls back to free-text entry.
      })
      .finally(() => {
        if (!cancelled) setClientsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectClient = (client) => {
    setClientName(client.name || "");
    setClientContact([client.contact, client.phone].filter(Boolean).join(" : "));
    setClientAddress(client.address || "");
    // Prefer a human-readable state name; fall back to a raw code if that's
    // all the backend has for this client (see api/clients.js).
    setClientState(client.state || client.stateCode || "");
    setClientPan(client.pan || "");
    setClientGstNumber(client.gstin || "");
    setLockedClientId(client.id ?? client.name ?? true);
    setClientId(client.id ?? null);
  };

  // Typing in the Client/Business Name field. If it still matches the
  // locked client's name, the lock stays; typing anything else means the
  // person is entering a different/new client, so the rest of the fields
  // unlock and become editable again (they keep their current values —
  // nothing is cleared — the user can now type fresh details).
  const handleClientNameChange = (value) => {
    setClientName(value);
    if (lockedClientId) {
      const stillSame = clients.some(
        (c) => (c.id ?? c.name ?? true) === lockedClientId && c.name === value
      );
      if (!stillSame) {
        setLockedClientId(null);
        setClientId(null);
      }
    }
  };

  const handleClearClient = () => {
    setClientName("");
    setClientContact("");
    setClientAddress("");
    setClientState("");
    setClientPan("");
    setClientGstNumber("");
    setLockedClientId(null);
    setClientId(null);
  };

  const isClientLocked = !!lockedClientId;
  const lockedFieldClass = `${fieldClass} disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400`;

  const selectedLocation = billingLocations.find((loc) => String(loc.id) === String(selectedLocationId));
  const isGst = selectedLocation?.location_type === "GST";

  // Keep item GST rates synced to the location's default whenever it changes
  const handleLocationChange = (id) => {
    setSelectedLocationId(id);
    const loc = billingLocations.find((l) => String(l.id) === String(id));
    if (loc?.location_type === "GST") {
      setItems((prev) => prev.map((item) => ({ ...item, tax_rate: loc.default_gst_percentage || 18 })));
    }
  };

  // Direct  -> plain items, always billed at 100% (milestones dropped).
  // Milestone -> every item starts with a single "Milestone 1" = 100%.
  const handleInvoiceTypeChange = (type) => {
    setInvoiceType(type);
    setItems((prev) =>
      prev.map((item) =>
        type === "MILESTONE"
          ? { ...item, price_percentage: 100, milestones: item.milestones?.length ? item.milestones : defaultMilestones() }
          : { ...item, price_percentage: 100, milestones: undefined }
      )
    );
  };

  const handleTermsPresetChange = (value) => {
    setTermsPreset(value);
    const preset = TERMS_PRESETS.find((p) => p.value === value);
    if (preset && preset.value !== "CUSTOM") setTermsText(preset.text);
  };

  const financialYear = useMemo(() => getFinancialYear(invoiceDate), [invoiceDate]);

  // The next invoice number comes from the database (per location + financial
  // year). This is only a preview — the number is actually reserved when the
  // invoice is saved.
  const [nextNumber, setNextNumber] = useState(null); // null = loading
  useEffect(() => {
    if (!selectedLocation) {
      setNextNumber(null);
      return undefined;
    }
    let cancelled = false;
    setNextNumber(null);
    getNextInvoiceNumber({
      locationId: selectedLocation.id,
      date: invoiceDate,
      locationType: selectedLocation.location_type,
    })
      .then((data) => {
        if (!cancelled) setNextNumber(data.invoice_number);
      })
      .catch(() => {
        if (!cancelled) setNextNumber("Unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLocation, invoiceDate]);
  const nextNumberPreview = selectedLocation ? nextNumber ?? "…" : "—";

  const summary = useMemo(() => calculateInvoiceSummaryV2(items, selectedLocation), [items, selectedLocation]);

  const invoiceTypeLabel = INVOICE_TYPES.find((t) => t.value === invoiceType)?.label || "Direct Invoice";

  const handleCopyNumber = async () => {
    try {
      await navigator.clipboard.writeText(nextNumberPreview);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — silently ignore, the number is still visible.
    }
  };

  const draftInvoice = useMemo(
    () => ({
      invoice_number: nextNumberPreview,
      financial_year: financialYear,
      invoice_date: invoiceDate,
      client_name: clientName,
      client_contact: clientContact,
      client_gst_number: clientGstNumber || null,
      payment_status: "PENDING",
      payment_mode: "",
      subtotal_amount: summary.taxableAmount,
      gst_percentage: summary.isGst ? summary.effectiveGstRate : null,
      gst_amount: summary.isGst ? summary.taxAmount : null,
      total_amount: summary.totalAmount,
      items: items.map((item, idx) => {
        const breakdown = calculateItemBreakdown(item, isGst);
        return {
          id: idx,
          service_description: item.service_description,
          total_price: Number(item.total_price) || 0,
          price_percentage: item.milestones?.length
            ? billedPercentFromMilestones(item.milestones)
            : item.price_percentage === ""
            ? 100
            : Number(item.price_percentage),
          milestones: item.milestones || null,
          subtotal: breakdown.taxable,
        };
      }),
    }),
    [nextNumberPreview, financialYear, invoiceDate, clientName, clientContact, clientGstNumber, summary, items, isGst]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setError("");

    if (!selectedLocation) {
      setError("Please select a billing location.");
      return;
    }
    if (clientName.trim() === "") {
      setError("Please enter the client name.");
      return;
    }
    if (clientContact.trim() === "") {
      setError("Please enter a contact person / phone.");
      return;
    }
    const validItems = items.filter((item) => item.service_description.trim() !== "" && Number(item.total_price) > 0);
    if (validItems.length === 0) {
      setError("Add at least one service item with a price.");
      return;
    }

    setSaving(true);
    try {
      // Only raw inputs are sent — the backend calculates taxable amount,
      // tax and totals itself and hands out the final invoice number.
      const invoice = await createInvoice({
        billing_location_id: selectedLocation.id,
        location_type: selectedLocation.location_type,
        invoice_date: invoiceDate,
        invoice_type: invoiceType,
        client_id: clientId,
        client_name: clientName.trim(),
        client_contact: clientContact.trim(),
        client_address: clientAddress.trim(),
        client_state: clientState,
        client_pan: clientPan.trim(),
        client_gst_number: clientGstNumber.trim() || null,
        items: validItems.map((item) => ({
          service_description: item.service_description.trim(),
          qty: item.qty === "" || item.qty == null ? 1 : Number(item.qty),
          total_price: Number(item.total_price),
          tax_rate: item.tax_rate,
          milestones:
            invoiceType === "MILESTONE"
              ? (item.milestones || []).map((m) => ({ percent: Number(m.percent) || 0, billed: !!m.billed }))
              : undefined,
        })),
        payment_status: "PENDING",
        payment_mode: paymentMethod,
        terms: termsText,
        show_bank_details: showBankDetails,
      });

      navigate(`/dashboard/invoices/${invoice.id}`);
    } catch (err) {
      setError(err.message || "Could not save the invoice. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout
      title="Create Invoice"
      subtitle="Select billing location and invoice type — taxes and totals are calculated automatically."
      breadcrumbs={["Dashboard", "Create Invoice"]}
    >
      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-3 lg:items-start lg:gap-6">
        <div className="space-y-5 lg:col-span-2">
          {/* 1. Billing & Invoice Type */}
          <SectionCard number={1} title="Billing & Invoice Type" subtitle="Choose your billing location and invoice type details">
            {locationsError && (
              <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                {locationsError} — make sure the backend is running (`npm run dev` in invoice-backend).
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <BillingLocationSelect
                  locations={billingLocations}
                  selectedLocationId={selectedLocationId}
                  onLocationChange={handleLocationChange}
                  disabled={locationsLoading}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Invoice Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className={`${fieldClass} pr-9 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-9 [&::-webkit-calendar-picker-indicator]:opacity-0`}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                    <IconCalendar />
                  </span>
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  Financial Year <span className="text-red-500">*</span>
                </label>
                <div className={`${fieldClass} flex items-center justify-between bg-slate-50 font-semibold text-slate-600`}>
                  <span>{`20${financialYear.slice(0, 2)} - ${financialYear.slice(2, 4)}`}</span>
                  <IconChevronDown className="h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div className="sm:col-span-2 lg:col-span-2">
                <InvoiceTypeTabs value={invoiceType} onChange={handleInvoiceTypeChange} />
              </div>

              <div>
                <label className={labelClass}>Invoice No.</label>
                <div className="flex h-10 items-stretch gap-2">
                  <div
                    className={`flex flex-1 items-center truncate rounded-lg border px-3 text-sm font-semibold ${
                      selectedLocation
                        ? "border-slate-300 bg-slate-50 text-slate-600"
                        : "border-dashed border-slate-300 bg-slate-50 text-slate-400"
                    }`}
                  >
                    {selectedLocation ? nextNumberPreview : "—"}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyNumber}
                    disabled={!selectedLocation}
                    className="flex w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Copy invoice number"
                  >
                    <IconCopy />
                  </button>
                </div>
                {copied && <p className="mt-1 text-[11px] font-medium text-teal-600">Copied!</p>}
              </div>
            </div>
          </SectionCard>

          {/* 2. Client Details */}
          <SectionCard number={2} title="Client Details" subtitle="Enter client / business information">
            {isClientLocked && (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-teal-100 bg-teal-50 px-4 py-2.5 text-xs font-medium text-teal-700">
                <span>Details loaded from Client Master — locked so they can't be edited by mistake.</span>
                <button
                  type="button"
                  onClick={handleClearClient}
                  className="shrink-0 font-semibold text-teal-800 underline hover:text-teal-900"
                >
                  Change client
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className={labelClass}>
                  Client / Business Name <span className="text-red-500">*</span>
                </label>
                <ClientSelect
                  clients={clients}
                  value={clientName}
                  onChange={handleClientNameChange}
                  onSelectClient={handleSelectClient}
                  loading={clientsLoading}
                  placeholder="S-five Luxury"
                  disabled={isClientLocked}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Contact Person / Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={clientContact}
                  onChange={(e) => setClientContact(e.target.value)}
                  placeholder="Swapnil Sitaram Ufale : 7208465016"
                  disabled={isClientLocked}
                  className={lockedFieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Address</label>
                <input
                  type="text"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Mumbai, Maharashtra"
                  disabled={isClientLocked}
                  className={lockedFieldClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  State <span className="text-red-500">*</span>
                </label>
                <select
                  value={clientState}
                  onChange={(e) => setClientState(e.target.value)}
                  disabled={isClientLocked}
                  className={lockedFieldClass}
                >
                  <option value="">Select state…</option>
                  {/* If the client's state isn't one of the standard names (e.g. an
                      unmapped code from the backend), keep it visible instead of
                      silently showing a blank dropdown. */}
                  {clientState && !INDIAN_STATES.includes(clientState) && (
                    <option value={clientState}>{clientState}</option>
                  )}
                  {INDIAN_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  PAN <span className="text-slate-300">(optional)</span>
                </label>
                <input
                  type="text"
                  value={clientPan}
                  onChange={(e) => setClientPan(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  disabled={isClientLocked}
                  maxLength={10}
                  className={`${lockedFieldClass} uppercase`}
                />
              </div>
              <div>
                <label className={labelClass}>
                  GSTIN <span className="text-slate-300">(optional)</span>
                </label>
                <input
                  type="text"
                  value={clientGstNumber}
                  onChange={(e) => setClientGstNumber(e.target.value.toUpperCase())}
                  placeholder="27AEZPU8067N1Z0"
                  disabled={isClientLocked}
                  maxLength={15}
                  className={`${lockedFieldClass} uppercase`}
                />
              </div>
            </div>
          </SectionCard>

          {/* 3. Service Items */}
          <SectionCard number={3} title="Service Items" subtitle="Add the services/products for this invoice">
            <ServiceItemsTable
              items={items}
              onChange={setItems}
              location={selectedLocation}
              isGst={isGst}
              invoiceType={invoiceType}
            />
          </SectionCard>

          {/* 4. Terms & Payment */}
          <SectionCard number={4} title="Terms & Payment" subtitle="Add terms & conditions and payment information">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Terms & Conditions</label>
                <select value={termsPreset} onChange={(e) => handleTermsPresetChange(e.target.value)} className={`${fieldClass} mb-2.5`}>
                  {TERMS_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <textarea
                  value={termsText}
                  onChange={(e) => setTermsText(e.target.value)}
                  rows={3}
                  placeholder="Please ensure that payment is made within seven days of receipt of this invoice."
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label className={labelClass}>Payment Details</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={`${fieldClass} mb-2.5`}
                >
                  {PAYMENT_METHOD_OPTIONS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={showBankDetails}
                    onChange={(e) => setShowBankDetails(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  Show bank details on invoice
                </label>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Summary sidebar */}
        <div className="lg:col-span-1">
          <InvoiceSummaryCard
            summary={summary}
            location={selectedLocation}
            invoiceTypeLabel={invoiceTypeLabel}
            showPricePercentageRow={invoiceType !== "DIRECT"}
            error={error}
          />
        </div>

        {/* Action bar */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end lg:col-span-3">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
          >
            <IconEye /> {showPreview ? "Hide Preview" : "Preview Invoice"}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <IconSave /> {saving ? "Saving…" : "Save Invoice"}

          </button>
        </div>

        {showPreview && selectedLocation && (
          <div className="lg:col-span-3">
            <InvoicePreview invoice={draftInvoice} location={selectedLocation} />
          </div>
        )}
        {showPreview && !selectedLocation && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400 lg:col-span-3">
            Select a billing location to preview the invoice.
          </div>
        )}
      </form>
    </AppLayout>
  );
}

export default CreateInvoice;
