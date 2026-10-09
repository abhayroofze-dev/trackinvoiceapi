import { IconPlus } from "../icons/Icons";
import { IconX } from "./ProposalIcons";
import { MAX_COLUMNS, MAX_ROWS, tmpId } from "./proposalUtils";

/**
 * Fully dynamic table: any number of columns and rows, every header and cell
 * editable. Cells are keyed by column id, never by fixed field names.
 */
function TableEditor({ table, onChange }) {
  const { columns, rows } = table;

  const setHeader = (colId, name) =>
    onChange({ ...table, columns: columns.map((c) => (c.id === colId ? { ...c, name } : c)) });

  const setCell = (rowId, colId, value) =>
    onChange({
      ...table,
      rows: rows.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r)),
    });

  const addRow = () => {
    if (rows.length >= MAX_ROWS) return;
    onChange({
      ...table,
      rows: [...rows, { id: tmpId("row"), cells: Object.fromEntries(columns.map((c) => [c.id, ""])) }],
    });
  };

  const deleteRow = (rowId) => {
    if (rows.length <= 1) return;
    onChange({ ...table, rows: rows.filter((r) => r.id !== rowId) });
  };

  const addColumn = () => {
    if (columns.length >= MAX_COLUMNS) return;
    const id = tmpId("col");
    onChange({
      columns: [...columns, { id, name: `Column ${columns.length + 1}` }],
      rows: rows.map((r) => ({ ...r, cells: { ...r.cells, [id]: "" } })),
    });
  };

  const deleteColumn = (colId) => {
    if (columns.length <= 1) return;
    onChange({
      columns: columns.filter((c) => c.id !== colId),
      rows: rows.map((r) => {
        const cells = { ...r.cells };
        delete cells[colId];
        return { ...r, cells };
      }),
    });
  };

  const cellCls =
    "w-full min-w-[9rem] bg-transparent px-3 py-2 text-sm outline-none focus:bg-teal-50/60";

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-teal-600">
              {columns.map((c) => (
                <th key={c.id} className="group relative border-r border-teal-500/50 p-0 last:border-r-0">
                  <input
                    value={c.name}
                    onChange={(e) => setHeader(c.id, e.target.value)}
                    placeholder="Header"
                    aria-label="Column header"
                    className={`${cellCls} pr-8 font-bold text-white placeholder:text-white/50 focus:bg-teal-700`}
                  />
                  {columns.length > 1 && (
                    <button
                      type="button"
                      title="Delete column"
                      aria-label="Delete column"
                      onClick={() => deleteColumn(c.id)}
                      className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-white/70 opacity-60 hover:bg-white/20 hover:text-white group-hover:opacity-100"
                    >
                      <IconX className="h-3 w-3" />
                    </button>
                  )}
                </th>
              ))}
              <th className="w-9 bg-teal-600" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.id} className={ri % 2 ? "bg-slate-50" : "bg-white"}>
                {columns.map((c) => (
                  <td key={c.id} className="border-r border-t border-slate-200 p-0 last:border-r-0">
                    <input
                      value={r.cells?.[c.id] ?? ""}
                      onChange={(e) => setCell(r.id, c.id, e.target.value)}
                      aria-label={`${c.name || "Column"} row ${ri + 1}`}
                      className={cellCls}
                    />
                  </td>
                ))}
                <td className="w-9 border-t border-slate-200 text-center">
                  {rows.length > 1 && (
                    <button
                      type="button"
                      title="Delete row"
                      aria-label="Delete row"
                      onClick={() => deleteRow(r.id)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <IconX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= MAX_ROWS}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <IconPlus /> Add row
        </button>
        <button
          type="button"
          onClick={addColumn}
          disabled={columns.length >= MAX_COLUMNS}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <IconPlus /> Add column
        </button>
        <span className="text-[11px] text-slate-400">
          {columns.length} column{columns.length === 1 ? "" : "s"} × {rows.length} row{rows.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

export default TableEditor;
