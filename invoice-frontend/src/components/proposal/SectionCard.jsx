import { IconGrip, IconCopy, IconTrash, IconUp, IconDown } from "./ProposalIcons";

const TYPE_STYLE = {
  CONTENT: { label: "Content", cls: "bg-teal-50 text-teal-700" },
  TABLE: { label: "Table", cls: "bg-indigo-50 text-indigo-700" },
  TERMS: { label: "Terms (Mandatory)", cls: "bg-orange-50 text-orange-600" },
};

function IconBtn({ title, onClick, disabled, danger, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30 ${
        danger ? "text-red-500 hover:bg-red-50" : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * One block of the proposal (CONTENT / TABLE / TERMS): drag handle, number,
 * editable title, type badge, move up/down, duplicate, delete.
 * Drag & drop only reorders - the parent just changes the array order, which
 * the backend stores as sort_order.
 */
function SectionCard({
  index,
  total,
  section,
  onTitleChange,
  onDuplicate,
  onDelete,
  onMove,
  dnd, // { onHandleDragStart, onDragOver, onDrop, onDragEnd, isDragging, isOver }
  children,
}) {
  const type = TYPE_STYLE[section.section_type];
  const isTerms = section.section_type === "TERMS";

  return (
    <div
      data-section-card
      onDragOver={dnd.onDragOver}
      onDrop={dnd.onDrop}
      className={`rounded-2xl border bg-white shadow-sm transition ${
        dnd.isOver ? "border-teal-400 ring-2 ring-teal-200" : "border-slate-200"
      } ${dnd.isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5 sm:flex-nowrap">
        <span
          draggable
          onDragStart={dnd.onHandleDragStart}
          onDragEnd={dnd.onDragEnd}
          title="Drag to reorder"
          className="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center text-slate-400 hover:text-slate-600 active:cursor-grabbing"
        >
          <IconGrip />
        </span>

        <span className="shrink-0 text-sm font-bold text-slate-400">{index + 1}.</span>

        <input
          value={section.title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={isTerms ? "Terms & Conditions" : "Section title"}
          maxLength={255}
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-bold text-slate-900 outline-none hover:border-slate-200 focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100"
        />

        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${type.cls}`}>{type.label}</span>

        <div className="ml-auto flex shrink-0 items-center">
          <IconBtn title="Move up" onClick={() => onMove(-1)} disabled={index === 0}><IconUp /></IconBtn>
          <IconBtn title="Move down" onClick={() => onMove(1)} disabled={index === total - 1}><IconDown /></IconBtn>
          <IconBtn title="Duplicate section" onClick={onDuplicate} disabled={isTerms}><IconCopy /></IconBtn>
          <IconBtn title={isTerms ? "Mandatory - cannot be removed" : "Delete section"} onClick={onDelete} danger>
            <IconTrash />
          </IconBtn>
        </div>
      </div>

      <div className="p-3 sm:p-4">{children}</div>
    </div>
  );
}

export default SectionCard;
