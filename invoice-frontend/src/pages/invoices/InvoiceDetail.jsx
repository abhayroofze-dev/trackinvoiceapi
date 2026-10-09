import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import AppLayout from "../../components/layout/AppLayout";
import InvoicePreview from "../../components/invoice/InvoicePreview";
import MarkPaidModal from "../../components/invoice/MarkPaidModal";
import { useBillingLocations } from "../../api/billingLocations";
import { getInvoice, updateInvoiceStatus } from "../../api/invoices";

function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [modalError, setModalError] = useState("");
  const { locations: billingLocations } = useBillingLocations();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    getInvoice(id)
      .then((data) => {
        if (!cancelled) setInvoice(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || "Could not load this invoice.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <AppLayout title="Invoice">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
          Loading invoice…
        </div>
      </AppLayout>
    );
  }

  if (!invoice) {
    return (
      <AppLayout title="Invoice not found">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="mb-4 text-sm text-slate-500">{loadError || "This invoice may have been removed."}</p>
          <Link
            to="/dashboard/invoices"
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Back to invoices
          </Link>
        </div>
      </AppLayout>
    );
  }

  const location = billingLocations.find((loc) => String(loc.id) === String(invoice.billing_location_id));
  const isPaid = invoice.payment_status === "PAID";

  // Paid -> Pending happens straight away; Pending -> Paid opens the popup first.
  const handleStatusClick = async () => {
    if (updating) return;
    if (!isPaid) {
      setModalError("");
      setShowPaidModal(true);
      return;
    }
    setUpdating(true);
    setActionError("");
    try {
      const updated = await updateInvoiceStatus(invoice.id, "PENDING");
      setInvoice(updated);
    } catch (err) {
      setActionError(err.message || "Could not update the status.");
    } finally {
      setUpdating(false);
    }
  };

  const confirmPaid = async (details) => {
    setUpdating(true);
    setModalError("");
    try {
      const updated = await updateInvoiceStatus(invoice.id, "PAID", details);
      setInvoice(updated);
      setShowPaidModal(false);
    } catch (err) {
      setModalError(err.message || "Could not mark this invoice as paid.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <AppLayout title={invoice.invoice_number} subtitle="Review, update status, or print this invoice.">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => navigate("/dashboard/invoices")}
            className="text-left text-sm font-semibold text-slate-500 hover:text-slate-900"
          >
            ← Back to invoices
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleStatusClick}
              disabled={updating}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Mark as {isPaid ? "Pending" : "Paid"}
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Print / Save PDF
            </button>
          </div>
        </div>

        {actionError && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 print:hidden">
            {actionError}
          </div>
        )}

        <InvoicePreview invoice={invoice} location={location} />

        <MarkPaidModal
          open={showPaidModal}
          invoiceNumber={invoice.invoice_number}
          totalAmount={invoice.total_amount}
          submitting={updating}
          serverError={modalError}
          onSubmit={confirmPaid}
          onClose={() => setShowPaidModal(false)}
        />
      </div>
    </AppLayout>
  );
}

export default InvoiceDetail;
