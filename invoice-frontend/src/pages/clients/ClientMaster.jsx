import { useEffect, useMemo, useState } from "react";
import AppLayout from "../../components/layout/AppLayout";
import {
  IconSearch,
  IconPlus,
  IconUsers,
  IconPin,
  IconSave,
  IconChevronDown,
} from "../../components/icons/Icons";
import { getClients, createClient, updateClient, updateClientStatus } from "../../api/clients";
import { INDIAN_STATES, STATE_GST_CODES } from "../../data/invoiceFormOptions";
import { STATE_CITIES } from "../../data/indiaLocations";
import SearchableSelect from "../../components/common/SearchableSelect";

// Alphabetical is easier to scan/search than GST-code order, and makes it
// obvious that every state is actually present in the list.
const SORTED_STATES = [...INDIAN_STATES].sort((a, b) => a.localeCompare(b));

const emptyForm = {
  name: "",
  contact: "",
  phone: "",
  email: "",
  website: "",
  type: "Business",
  address: "",
  city: "",
  state: "",
  stateCode: "",
  pincode: "",
  country: "India",
  pan: "",
  gstin: "",
  notes: "",
};

function SectionTitle({ icon, children, tone = "mint" }) {
  return (
    <div
      className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${
        tone === "blue" ? "bg-sky-50 text-slate-700" : "bg-emerald-50 text-slate-700"
      }`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full ${
          tone === "blue" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"
        }`}
      >
        {icon}
      </span>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Which client fields are COMPULSORY. Every field NOT listed here is optional.
// To make a field optional: remove its name from this list.
// To make a field compulsory: add its name to this list.
// (This one list controls both the red * and the "please fill" check.)
// ---------------------------------------------------------------------------
const REQUIRED_FIELDS = ["name", "contact", "phone", "address", "country", "state", "city"];

// Friendly names, used in the error message.
const FIELD_LABELS = {
  name: "Client / Business Name",
  contact: "Contact Person",
  phone: "Phone",
  address: "Billing Address",
  country: "Country",
  state: "State",
  city: "City",
  pincode: "Pincode",
};

const isRequired = (field) => REQUIRED_FIELDS.includes(field);

function Field({ label, required = false, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-100";

function ClientForm({ editingClient, onSaved, onCancel }) {
  // Backfill stateCode for records saved before this field existed, so
  // editing an older client doesn't lose its GST state code.
  const initialForm = editingClient
    ? { ...emptyForm, ...editingClient, stateCode: editingClient.stateCode || STATE_GST_CODES[editingClient.state] || "" }
    : emptyForm;
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // true = the user typed/kept their own Pincode, so picking a City must NOT
  // overwrite it. (A saved pincode on an existing client counts as "own".)
  const [pincodeEdited, setPincodeEdited] = useState(Boolean(editingClient?.pincode));

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (error) setError("");
  };

  // Selecting a State clears City/Pincode — the previous city almost
  // certainly doesn't belong to the newly chosen state. We also capture the
  // official 2-digit GST state code here (was never being set before), so
  // it travels with the client record and is ready for CGST/SGST vs IGST
  // logic on invoices.
  const handleStateChange = (state) => {
    setPincodeEdited(false); // new state -> pincode starts fresh
    setForm((current) => ({
      ...current,
      state,
      stateCode: STATE_GST_CODES[state] || "",
      city: "",
      pincode: "",
    }));
    if (error) setError("");
  };

  // Selecting a City auto-fills its representative Pincode. The Pincode
  // field stays editable right after, in case the exact locality's PIN is
  // different from this city-level default.
  const handleCityChange = (cityName) => {
    const cityList = STATE_CITIES[form.state] || [];
    const match = cityList.find((c) => c.name === cityName);
    setForm((current) => ({
      ...current,
      city: cityName,
      pincode: match && !pincodeEdited ? match.pincode : current.pincode,
    }));
    if (error) setError("");
  };

  const submit = async (event) => {
    event.preventDefault();

    const missing = REQUIRED_FIELDS.filter((key) => !String(form[key] ?? "").trim());
    if (missing.length > 0) {
      setError(`Please fill: ${missing.map((key) => FIELD_LABELS[key] || key).join(", ")}.`);
      return;
    }

    const payload = {
      ...form,
      name: form.name.trim(),
      contact: (form.contact || "").trim(),
      fullContact: (form.contact || "").trim(),
      status: editingClient?.status || "Active",
    };

    setSaving(true);
    setError("");
    try {
      const saved = editingClient
        ? await updateClient(editingClient.id, payload)
        : await createClient(payload);
      onSaved(saved);
    } catch (err) {
      setError(err.message || "Could not save client. Is the backend server running?");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <SectionTitle icon={<IconUsers className="h-4 w-4" />}>Basic Information</SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Client / Business Name" required={isRequired("name")}>
            <input className={inputClass} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Enter client or business name" />
          </Field>
          <Field label="Contact Person" required={isRequired("contact")}>
            <input className={inputClass} value={form.contact} onChange={(e) => update("contact", e.target.value)} placeholder="Enter contact person" />
          </Field>
          <Field label="Phone" required={isRequired("phone")}>
            <input className={inputClass} value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="Enter phone number" />
          </Field>
          <Field label="Email">
            <input type="email" className={inputClass} value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="client@example.com" />
          </Field>
          <Field label="Website">
            <input className={inputClass} value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://example.com" />
          </Field>
          <Field label="Client Type">
            <div className="relative">
              <select className={`${inputClass} appearance-none pr-9`} value={form.type} onChange={(e) => update("type", e.target.value)}>
                <option>Business</option>
                <option>Individual</option>
                <option>Company</option>
                <option>Agency</option>
              </select>
              <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </Field>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <SectionTitle icon={<IconPin className="h-4 w-4" />} tone="blue">Address Information</SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Billing Address" required={isRequired("address")} className="md:col-span-2">
            <textarea rows="3" className={`${inputClass} resize-none`} value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Enter complete billing address" />
          </Field>
          <Field label="Country" required={isRequired("country")}>
            <input className={inputClass} value={form.country} onChange={(e) => update("country", e.target.value)} placeholder="India" />
          </Field>
          <Field label="State" required={isRequired("state")}>
            <SearchableSelect
              options={SORTED_STATES}
              value={form.state}
              onChange={handleStateChange}
              placeholder="Search state…"
              emptyMessage="No matching state."
            />
          </Field>
          <Field label="City" required={isRequired("city")}>
            <SearchableSelect
              options={(STATE_CITIES[form.state] || []).map((c) => c.name)}
              value={form.city}
              onChange={handleCityChange}
              placeholder={form.state ? "Search city…" : "Select state first"}
              disabled={!form.state}
              emptyMessage="No matching city."
            />
          </Field>
          <Field label="Pincode" required={isRequired("pincode")}>
            <input
              className={inputClass}
              value={form.pincode}
              onChange={(e) => {
                setPincodeEdited(e.target.value.trim() !== ""); // emptied -> city may auto-fill again
                update("pincode", e.target.value);
              }}
              inputMode="numeric"
              placeholder="400001 (optional)"
            />
          </Field>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <SectionTitle icon={<span className="text-xs font-black">₹</span>}>Tax & Registration Details</SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="PAN">
            <input className={inputClass} value={form.pan} onChange={(e) => update("pan", e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
          </Field>
          <Field label="GSTIN">
            <input className={inputClass} value={form.gstin} onChange={(e) => update("gstin", e.target.value.toUpperCase())} placeholder="27ABCDE1234F1Z5" maxLength={15} />
          </Field>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <SectionTitle icon={<span className="text-xs font-black">i</span>} tone="blue">Other Information</SectionTitle>
        <Field label="Notes">
          <textarea rows="4" className={`${inputClass} resize-none`} value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Add any notes about this client..." />
        </Field>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <IconSave className="h-4 w-4" />
          {saving ? "Saving…" : editingClient ? "Update Client" : "Save Client"}
        </button>
      </div>
    </form>
  );
}

/** Active / Inactive switch. Green + "Active" when on, grey + "Inactive" when off. */
function StatusToggle({ active, busy, onChange, clientName }) {
  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={`${active ? "Deactivate" : "Activate"} ${clientName}`}
        disabled={busy}
        onClick={onChange}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-wait disabled:opacity-60 ${
          active ? "bg-emerald-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            active ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
      <span className={`text-xs font-bold ${active ? "text-emerald-700" : "text-slate-500"}`}>
        {active ? "Active" : "Inactive"}
      </span>
    </div>
  );
}

function ClientList({ clients, onAdd, onEdit, onToggleStatus, togglingIds }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) =>
      [client.name, client.contact, client.city, client.state, client.phone, client.email]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [clients, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const changeSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Clients ({clients.length})</h2>
          <p className="mt-0.5 text-xs text-slate-500">View and manage your client / business information.</p>
        </div>
        <button onClick={onAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800">
          <IconPlus className="h-4 w-4" />
          Add New Client
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <div className="relative max-w-md">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => changeSearch(e.target.value)}
              placeholder="Search by name, phone, city or state..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Client Name</th>
                <th className="px-4 py-3 font-semibold">Contact Person</th>
                <th className="px-4 py-3 font-semibold">City</th>
                <th className="px-4 py-3 font-semibold">State</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((client, index) => (
                  <tr key={client.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-xs font-semibold text-slate-500">
                      {(currentPage - 1) * pageSize + index + 1}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{client.name}</td>
                    <td className="px-4 py-3 text-slate-600">{client.contact || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{client.city || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{client.state || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusToggle
                        active={client.status !== "Inactive"}
                        busy={togglingIds.includes(client.id)}
                        onChange={() => onToggleStatus(client)}
                        clientName={client.name}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => onEdit(client)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-5 py-14 text-center">
                    <div className="text-sm font-bold text-slate-800">No clients found</div>
                    <div className="mt-1 text-xs text-slate-400">Try a different search or add a new client.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {filtered.length ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} clients
          </span>
          <div className="flex items-center gap-1">
            <button disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)} className="h-8 w-8 rounded-lg border border-slate-200 disabled:opacity-40">‹</button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).slice(0, 5).map((number) => (
              <button key={number} onClick={() => setPage(number)} className={`h-8 min-w-8 rounded-lg px-2 font-semibold ${number === currentPage ? "bg-teal-700 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                {number}
              </button>
            ))}
            <button disabled={currentPage === pageCount} onClick={() => setPage((value) => value + 1)} className="h-8 w-8 rounded-lg border border-slate-200 disabled:opacity-40">›</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClientMaster() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState("clients");
  const [editingClient, setEditingClient] = useState(null);
  const [togglingIds, setTogglingIds] = useState([]);
  const [actionError, setActionError] = useState("");

  const refreshClients = () => {
    setLoading(true);
    setLoadError("");
    getClients()
      .then(setClients)
      .catch((err) => setLoadError(err.message || "Could not reach the backend server."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refreshClients();
  }, []);

  const openAdd = () => {
    setEditingClient(null);
    setActiveTab("add");
  };

  const openEdit = (client) => {
    setEditingClient(client);
    setActiveTab("add");
  };

  // Optimistic toggle: flip instantly, save in the background, roll back on error.
  const toggleClientStatus = async (client) => {
    if (togglingIds.includes(client.id)) return; // ignore double clicks
    const nextStatus = client.status === "Inactive" ? "Active" : "Inactive";
    setActionError("");
    setTogglingIds((ids) => [...ids, client.id]);
    setClients((list) => list.map((c) => (c.id === client.id ? { ...c, status: nextStatus } : c)));
    try {
      const saved = await updateClientStatus(client.id, nextStatus === "Active");
      setClients((list) => list.map((c) => (c.id === client.id ? { ...c, status: saved.status } : c)));
    } catch (err) {
      setClients((list) => list.map((c) => (c.id === client.id ? { ...c, status: client.status } : c)));
      setActionError(err.message || "Could not update client status.");
    } finally {
      setTogglingIds((ids) => ids.filter((id) => id !== client.id));
    }
  };

  const handleSaved = () => {
    refreshClients();
    setEditingClient(null);
    setActiveTab("clients");
  };

  return (
    <AppLayout
      title="Client Master"
      subtitle="Manage your clients / business details. Add, edit or view client information."
      breadcrumbs={["Dashboard", "Clients"]}
    >
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1">
            <button
              onClick={() => { setActiveTab("clients"); setEditingClient(null); }}
              className={`relative px-4 py-3 text-sm font-bold transition ${
                activeTab === "clients" ? "text-teal-700" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span className="inline-flex items-center gap-2"><IconUsers className="h-4 w-4" /> Clients</span>
              {activeTab === "clients" && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-teal-700" />}
            </button>
            <button
              onClick={openAdd}
              className={`relative px-4 py-3 text-sm font-bold transition ${
                activeTab === "add" ? "text-teal-700" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span className="inline-flex items-center gap-2"><IconPlus className="h-4 w-4" /> {editingClient ? "Edit Client" : "Add Client"}</span>
              {activeTab === "add" && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-teal-700" />}
            </button>
          </div>
        </div>

        {loadError && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {loadError} — make sure the backend is running (`npm run dev` in invoice-backend) and VITE_API_BASE_URL is correct.
          </div>
        )}

        {actionError && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {actionError}
          </div>
        )}

        {activeTab === "clients" ? (
          loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
              Loading clients…
            </div>
          ) : (
            <ClientList clients={clients} onAdd={openAdd} onEdit={openEdit} onToggleStatus={toggleClientStatus} togglingIds={togglingIds} />
          )
        ) : (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">{editingClient ? "Edit Client" : "Add / Edit Client"}</h2>
                <p className="mt-0.5 text-xs text-slate-500">Enter client / business information.</p>
              </div>
              <button onClick={() => { setActiveTab("clients"); setEditingClient(null); }} className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:block">
                Back to Clients
              </button>
            </div>
            <ClientForm
              editingClient={editingClient}
              onSaved={handleSaved}
              onCancel={() => { setActiveTab("clients"); setEditingClient(null); }}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default ClientMaster;
