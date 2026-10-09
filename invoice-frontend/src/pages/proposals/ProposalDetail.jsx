import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import AppLayout from "../../components/layout/AppLayout";
import {
  ProposalPreview,
  ProposalPrintPortal,
  downloadProposalPdf,
} from "../../components/proposal/ProposalDocument";
import { IconDownload } from "../../components/proposal/ProposalIcons";
import { ProposalStatusBadge } from "./ProposalsList";
import {
  deleteProposal,
  finalizeProposal,
  getProposal,
  reopenProposal,
} from "../../api/proposals";
import {
  displayDate,
  toPayload,
} from "../../components/proposal/proposalUtils";

function ProposalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProposal(id)
      .then((p) => !cancelled && setProposal(p))
      .catch(
        (e) =>
          !cancelled && setError(e.message || "Could not load this proposal."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const doc = useMemo(() => proposal, [proposal]);

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleFinalize = () =>
    run(async () => {
      // the backend validates client, title, date, sections and Terms before it accepts this
      setProposal(
        await finalizeProposal(
          proposal.id,
          toPayload(
            { ...proposal, valid_till: proposal.valid_till },
            proposal.sections,
          ),
        ),
      );
    });

  const handleReopen = () =>
    run(async () => setProposal(await reopenProposal(proposal.id)));

  const handleDelete = () => {
    if (
      !window.confirm(
        `Delete proposal ${proposal.proposal_number}? This cannot be undone.`,
      )
    )
      return;
    run(async () => {
      await deleteProposal(proposal.id);
      navigate("/dashboard/proposals");
    });
  };

  if (loading) {
    return (
      <AppLayout title="Proposal">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
          Loading proposal…
        </div>
      </AppLayout>
    );
  }

  if (!proposal) {
    return (
      <AppLayout title="Proposal not found">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="mb-4 text-sm text-slate-500">
            {error || "This proposal may have been removed."}
          </p>
          <Link
            to="/dashboard/proposals"
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Back to proposals
          </Link>
        </div>
      </AppLayout>
    );
  }

  const btn =
    "rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

  return (
    <AppLayout
      title={proposal.proposal_number}
      subtitle="Review, edit, or download this proposal as a PDF."
      breadcrumbs={["Dashboard", "Proposals", proposal.proposal_number]}
    >
      <ProposalPrintPortal proposal={doc} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <ProposalStatusBadge status={proposal.status} />
          <span>
            <b className="text-slate-800">
              {proposal.client_name || "No client"}
            </b>
          </span>
          <span className="text-slate-400">•</span>
          <span>{displayDate(proposal.proposal_date)}</span>
          {proposal.valid_till && (
            <>
              <span className="text-slate-400">•</span>
              <span>Valid till {displayDate(proposal.valid_till)}</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              downloadProposalPdf({
                clientName: proposal.client_name,
                date: proposal.proposal_date,
                proposalNumber: proposal.proposal_number,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800"
          >
            <IconDownload /> Download PDF
          </button>
          <Link to={`/dashboard/proposals/${proposal.id}/edit`} className={btn}>
            Edit
          </Link>
          {proposal.status === "DRAFT" ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleFinalize}
              className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Finalize
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={handleReopen}
              className={btn}
            >
              Re-open as draft
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            className="rounded-xl border border-red-100 bg-white px-3.5 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
        >
          {error}
        </div>
      )}

      <div className="mx-auto max-w-[860px] rounded-2xl bg-slate-200/70 p-3 sm:p-5">
        <ProposalPreview proposal={doc} />
      </div>
    </AppLayout>
  );
}

export default ProposalDetail;
