import { getSession } from "../../utils/auth";
import { IconMenu, IconSearch, IconBell, IconChevronDown } from "../icons/Icons";

function Navbar({ breadcrumbs, onMenuClick }) {
  const session = getSession();

  return (
    <div className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <IconMenu />
        </button>

        <div className="relative hidden max-w-md flex-1 md:block">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
            <IconSearch />
          </span>
          <input
            type="text"
            placeholder="Search clients, invoices, services…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100"
          />
        </div>

        <div className="flex-1 md:hidden" />

        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="ml-4 hidden items-center gap-1.5 text-xs text-slate-400 xl:flex">
            {breadcrumbs.map((crumb, idx) => (
              <span key={crumb} className="flex items-center gap-1.5">
                {idx > 0 && <span>/</span>}
                <span className={idx === breadcrumbs.length - 1 ? "font-semibold text-slate-700" : ""}>{crumb}</span>
              </span>
            ))}
          </div>
        )}

        {/* ml-auto pins this group to the far right edge of the navbar,
            no matter how wide the search box or breadcrumbs are. */}
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Notifications"
          >
            <IconBell />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500" />
          </button>

          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
              {(session?.name || "A").slice(0, 1).toUpperCase()}
            </div>
            <div className="hidden leading-tight sm:block">
              <div className="text-sm font-semibold text-slate-800">{session?.name || "Admin"}</div>
              <div className="text-[11px] text-slate-400">{session?.role || "User"}</div>
            </div>
            <IconChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Navbar;
