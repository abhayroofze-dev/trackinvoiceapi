import { useEffect, useRef, useState } from "react";
import { IconSearch, IconChevronDown } from "../icons/Icons";

// Searchable "type to filter" client picker for Create Invoice §2.
// Typing filters the existing Client Master list by name/contact/phone/
// city/GSTIN; picking a result fires onSelectClient so the parent can
// auto-fill address, state, PAN, GSTIN, etc. Typing a name that doesn't
// match anyone is still allowed — it's treated as a new client name.
function ClientSelect({ clients, value, onChange, onSelectClient, loading, placeholder, disabled = false }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Once a real client is picked, the name field itself locks too (like
  // every other client field) — you can't just type over it. "Change
  // client" (rendered by the parent) is the only way out of the lock.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
 
  const query = value.trim().toLowerCase();
  const matches = query
    ? clients.filter((client) =>
        [client.name, client.contact, client.phone, client.city, client.gstin]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
    : clients;

  const handleSelect = (client) => {
    onSelectClient(client);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
          <IconSearch className="h-4 w-4" />
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            if (disabled) return;
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setOpen(true);
          }}
          placeholder={loading ? "Loading clients…" : placeholder || "Search existing client or type a new name…"}
          disabled={disabled}
          readOnly={disabled}
          className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-9 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          autoComplete="off"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
          <IconChevronDown className="h-4 w-4" />
        </span>
      </div>

      {open && !loading && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {matches.length ? (
            matches.slice(0, 30).map((client) => (
              <button
                type="button"
                key={client.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(client)}
                className="flex w-full flex-col items-start gap-0.5 border-b border-slate-50 px-3 py-2 text-left last:border-0 hover:bg-teal-50"
              >
                <span className="text-sm font-semibold text-slate-800">{client.name}</span>
                <span className="text-xs text-slate-400">
                  {[client.contact, client.phone, client.city].filter(Boolean).join(" · ") || "No contact info on file"}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-xs text-slate-400">
              No matching client — this will be treated as a new client name.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ClientSelect;
