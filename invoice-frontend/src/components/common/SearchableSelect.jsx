import { useEffect, useRef, useState } from "react";
import { IconSearch, IconChevronDown } from "../icons/Icons";

// Generic "type to filter, click to pick" dropdown for a fixed list of
// options (e.g. all Indian states, or a state's cities). Unlike ClientSelect
// (which allows a brand-new typed name), this only ever accepts a value
// that's actually in `options` — closer to a searchable <select> than a
// free-text combobox, so State/City always stay valid, known values.
function SearchableSelect({ options, value, onChange, placeholder, disabled = false, emptyMessage }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // If this field becomes disabled (e.g. City before a State is picked),
  // make sure any open panel/search closes with it.
  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setQuery("");
    }
  }, [disabled]);

  const normalizedQuery = query.trim().toLowerCase();
  const matches = normalizedQuery
    ? options.filter((opt) => opt.toLowerCase().includes(normalizedQuery))
    : options;

  const handleSelect = (opt) => {
    onChange(opt);
    setQuery("");
    setOpen(false);
  };

  // While the panel is open we show what's being typed (query); once closed,
  // the field shows the actual selected value again.
  const displayValue = open ? query : value || "";

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
          <IconSearch className="h-4 w-4" />
        </span>
        <input
          type="text"
          value={displayValue}
          onChange={(e) => {
            if (disabled) return;
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (disabled) return;
            setQuery("");
            setOpen(true);
          }}
          placeholder={disabled ? placeholder : value || placeholder || "Search…"}
          disabled={disabled}
          autoComplete="off"
          className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
          <IconChevronDown className="h-4 w-4" />
        </span>
      </div>

      {open && !disabled && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {matches.length ? (
            matches.map((opt) => (
              <button
                type="button"
                key={opt}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(opt)}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-teal-50 ${
                  opt === value ? "bg-teal-50 font-semibold text-teal-700" : "text-slate-700"
                }`}
              >
                {opt}
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-xs text-slate-400">{emptyMessage || "No matches found."}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchableSelect;
