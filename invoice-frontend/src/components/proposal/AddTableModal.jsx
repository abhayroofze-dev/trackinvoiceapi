import { useState } from "react";
import { MAX_COLUMNS, MAX_ROWS } from "./proposalUtils";

/** Step 1 of "Add Table": ask title, number of columns and number of rows. */
function AddTableModal({ onCreate, onClose }) {
  const [title, setTitle] = useState("");
  const [columns, setColumns] = useState(2);
  const [rows, setRows] = useState(3);
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const c = Number(columns);
    const r = Number(rows);
    if (!title.trim()) return setError("Please enter a table title.");
    if (!Number.isInteger(c) || c < 1 || c > MAX_COLUMNS) return setError(`Columns must be between 1 and ${MAX_COLUMNS}.`);
    if (!Number.isInteger(r) || r < 1 || r > MAX_ROWS) return setError(`Rows must be between 1 and ${MAX_ROWS}.`);
    onCreate({ title: title.trim(), columns: c, rows: r });
  };

  const field =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 print:hidden" onMouseDown={onClose}>
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h3 className="text-lg font-bold text-slate-900">Add Table</h3>
        <p className="mt-0.5 text-xs text-slate-500">You can add or remove rows and columns later.</p>

        <label className="mt-4 block text-xs font-semibold text-slate-600">Table title</label>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Overall Investment Summary" className={`${field} mt-1`} />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600">Number of columns</label>
            <input type="number" min={1} max={MAX_COLUMNS} value={columns} onChange={(e) => setColumns(e.target.value)} className={`${field} mt-1`} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600">Number of rows</label>
            <input type="number" min={1} max={MAX_ROWS} value={rows} onChange={(e) => setRows(e.target.value)} className={`${field} mt-1`} />
          </div>
        </div>

        {error && <p className="mt-3 text-xs font-medium text-red-500">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
            Create Table
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddTableModal;
