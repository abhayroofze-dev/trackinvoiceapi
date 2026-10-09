import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AppLayout from "../../components/layout/AppLayout";
import { deleteProposal, getProposals } from "../../api/proposals";
import { displayDate } from "../../components/proposal/proposalUtils";

export function ProposalStatusBadge({ status }) {
  if (status === "FINALIZED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700">
        <span className="h-1.5 w-1.5 rounded-full bg-teal-600" /> FINALIZED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-600">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> DRAFT
    </span>
  );
}

function ProposalsList() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    getProposals()
      .then((d) => !cancelled && setProposals(d))
      .catch((e) => !cancelled && setError(e.message || "Could not load proposals."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return proposals.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (!q) return true;
      return [p.proposal_number, p.client_name, p.proposal_title].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [proposals, search, statusFilter]);

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete proposal ${p.proposal_number}? This cannot be undone.`)) return;
    try {
      await deleteProposal(p.id);
      setProposals((list) => list.filter((x) => x.id !== p.id));
    } catch (e) {
      setError(e.message);
    }
  };

  const field =
    "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100";

  return (
    <AppLayout
      title="All Proposals"
      subtitle="Draft and finalized proposals."
      breadcrumbs={["Dashboard", "Proposals"]}
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search number, client or title…"
          className={`${field} sm:w-72`}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={field}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="FINALIZED">Finalized</option>
        </select>
        <Link
          to="/dashboard/proposals/create"
          className="rounded-xl bg-teal-700 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-teal-800 sm:ml-auto"
        >
          + Create Proposal
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Proposal No.</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Valid Till</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Loading proposals…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  {proposals.length === 0 ? "No proposals yet — create your first one." : "No proposals match your filters."}
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr
                key={p.id}
                onClick={() => navigate(`/dashboard/proposals/${p.id}`)}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="px-4 py-3 font-semibold text-slate-900">{p.proposal_number}</td>
                <td className="px-4 py-3 text-slate-700">{p.client_name || "—"}</td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-700">{p.proposal_title || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{displayDate(p.proposal_date)}</td>
                <td className="px-4 py-3 text-slate-600">{displayDate(p.valid_till) || "—"}</td>
                <td className="px-4 py-3"><ProposalStatusBadge status={p.status} /></td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <Link to={`/dashboard/proposals/${p.id}`} className="mr-3 text-xs font-semibold text-teal-700 hover:underline">View</Link>
                  <Link to={`/dashboard/proposals/${p.id}/edit`} className="mr-3 text-xs font-semibold text-slate-600 hover:underline">Edit</Link>
                  <button type="button" onClick={() => handleDelete(p)} className="text-xs font-semibold text-red-500 hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}

export default ProposalsList;
