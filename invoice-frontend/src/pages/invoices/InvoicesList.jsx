import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import AppLayout from "../../components/layout/AppLayout";
import { useBillingLocations } from "../../api/billingLocations";
import { getInvoices } from "../../api/invoices";
import { formatINR, financialYearLabel } from "../../utils/InvoiceCalculations";

function StatusBadge({ status }) {
  if (status === "PAID") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700">
        <span className="h-1.5 w-1.5 rounded-full bg-teal-600" /> PAID
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-500">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> PENDING
    </span>
  );
}

function LocationTag({ locationId, locations }) {
  const loc = locations.find((l) => String(l.id) === String(locationId));
  if (!loc) return "—";
  return loc.location_type === "GST" ? (
    <span className="rounded-md bg-lime-100 px-2 py-0.5 text-[11px] font-bold text-slate-800">GST</span>
  ) : (
    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">NON-GST</span>
  );
}

function InvoicesList() {
  const { locations: billingLocations } = useBillingLocations();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getInvoices()
      .then((data) => {
        if (!cancelled) setInvoices(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || "Could not load invoices.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allInvoices = useMemo(
    () => [...invoices].sort((a, b) => b.created_at - a.created_at || b.id - a.id),
    [invoices]
  );

  const [locationFilter, setLocationFilter] = useState("");
  const [fyFilter, setFyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  // Spec §5 GET /api/invoices — "filters: location, FY, status, date range"
  const financialYears = useMemo(
    () => [...new Set(allInvoices.map((inv) => inv.financial_year).filter(Boolean))].sort().reverse(),
    [allInvoices]
  );

  const hasActiveFilters = locationFilter || fyFilter || statusFilter || dateFrom || dateTo || search;

  const clearFilters = () => {
    setLocationFilter("");
    setFyFilter("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  };

  const filtered = allInvoices.filter((inv) => {
    if (locationFilter && String(inv.billing_location_id) !== String(locationFilter)) return false;
    if (fyFilter && inv.financial_year !== fyFilter) return false;
    if (statusFilter && inv.payment_status !== statusFilter) return false;
    if (dateFrom && inv.invoice_date < dateFrom) return false;
    if (dateTo && inv.invoice_date > dateTo) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!inv.client_name.toLowerCase().includes(q) && !inv.invoice_number.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <AppLayout
      title="All Invoices"
      subtitle={
        hasActiveFilters
          ? `${filtered.length} of ${allInvoices.length} invoice${allInvoices.length === 1 ? "" : "s"} match your filters.`
          : `${allInvoices.length} invoice${allInvoices.length === 1 ? "" : "s"} total.`
      }
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
          >
            <option value="">All locations</option>
            {billingLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <select
            value={fyFilter}
            onChange={(e) => setFyFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
          >
            <option value="">All financial years</option>
            {financialYears.map((fy) => (
              <option key={fy} value={fy}>
                {financialYearLabel(fy)}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
          >
            <option value="">All statuses</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
          </select>
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[120px] text-xs font-medium text-slate-600 outline-none"
              aria-label="From date"
            />
            <span className="text-xs text-slate-300">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[120px] text-xs font-medium text-slate-600 outline-none"
              aria-label="To date"
            />
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client or invoice #"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium sm:min-w-[200px] sm:flex-none"
          />
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-700"
            >
              Clear filters
            </button>
          )}
        </div>
        <Link
          to="/dashboard/invoices/create"
          className="inline-flex items-center justify-center rounded-xl bg-lime-300 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-lime-400"
        >
          + New Invoice
        </Link>
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {loadError} — make sure the backend is running (`npm run dev` in invoice-backend).
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-6 py-14 text-center text-sm text-slate-400">Loading invoices…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="mb-1 text-sm font-bold text-slate-900">No invoices match</div>
            <div className="mb-4 max-w-xs text-xs text-slate-400">
              Try clearing filters, or create a new invoice.
            </div>
            <div className="flex gap-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Clear filters
                </button>
              )}
              <Link
                to="/dashboard/invoices/create"
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Create Invoice
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="px-5 py-3 font-semibold">Invoice #</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Client</th>
                  <th className="px-5 py-3 font-semibold">Location</th>
                  <th className="px-5 py-3 font-semibold">Total</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3 font-semibold">{inv.invoice_number}</td>
                    <td className="px-5 py-3 text-slate-500">
                      {new Date(inv.invoice_date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3">{inv.client_name}</td>
                    <td className="px-5 py-3">
                      <LocationTag locationId={inv.billing_location_id} locations={billingLocations} />
                    </td>
                    <td className="px-5 py-3 font-semibold">{formatINR(inv.total_amount)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={inv.payment_status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to={`/dashboard/invoices/${inv.id}`}
                        className="text-xs font-semibold text-teal-700 hover:underline"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default InvoicesList;
