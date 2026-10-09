import { Link, useLocation, useNavigate } from "react-router-dom";
import { getSession, logout } from "../../utils/auth";
import { IconHome, IconInvoice, IconList, IconUsers, IconFileText, IconPlus } from "../icons/Icons";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: IconHome },
  { to: "/dashboard/invoices/Create", label: "Create Invoice", icon: IconInvoice },
  { to: "/dashboard/invoices", label: "All Invoices", icon: IconList },
  { to: "/dashboard/proposals/create", label: "Create Proposal", icon: IconPlus },
  { to: "/dashboard/proposals", label: "All Proposals", icon: IconFileText },
  { to: "/dashboard/clients", label: "Clients", icon: IconUsers },
];

/** True when `pathname` is exactly `to` or a child route of it (segment-aware). */
function matchesPath(pathname, to) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

/**
 * Only ONE nav item may be active: the most specific (longest) match.
 * e.g. /dashboard/invoices/create matches both "Create Invoice" and
 * "All Invoices" — the longer path wins, so only "Create Invoice" lights up.
 * Child pages like /dashboard/invoices/:id still highlight "All Invoices".
 */
function getActiveNavPath(pathname) {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const matches = NAV_ITEMS.filter((item) => matchesPath(clean, item.to));
  if (matches.length === 0) return null;
  return matches.reduce((best, item) => (item.to.length > best.to.length ? item : best)).to;
}

function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const session = getSession();
  const activePath = getActiveNavPath(location.pathname);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const content = (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-slate-900 text-white">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 ring-1 ring-white/20">
          <span className="text-sm font-extrabold text-lime-300">RZ</span>
        </div>
        <div className="leading-tight">
          <div className="text-sm font-extrabold">
            ROOF<span className="text-lime-300">ZE</span>
          </div>
          <div className="text-[10px] text-white/40">DIGITAL HUB LLP</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive = item.to === activePath;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive ? "bg-lime-300 text-slate-900" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-3 rounded-2xl bg-white/5 p-4">
        <p className="text-sm font-bold leading-snug">
          All Your <span className="text-lime-300">Digital Needs</span> Under One Roof
        </p>
        <div className="mt-2 h-0.5 w-8 bg-lime-300" />
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="mb-1 flex items-center gap-3 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-xs font-bold">
            {(session?.name || "A").slice(0, 1).toUpperCase()}
          </div>
          <div className="overflow-hidden leading-tight">
            <div className="truncate text-sm font-semibold">{session?.name || "Admin"}</div>
            <div className="truncate text-[11px] text-white/40">{session?.role || "User"}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full rounded-xl px-3 py-2 text-left text-sm text-white/60 transition hover:bg-red-500/10 hover:text-red-400"
        >
          Log out
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop: always visible, part of the flex layout */}
      <div className="hidden lg:block">{content}</div>

      {/* Mobile: off-canvas drawer */}
      <div className={`fixed inset-0 z-40 lg:hidden ${isOpen ? "" : "pointer-events-none"}`}>
        <div
          className={`absolute inset-0 bg-slate-900/50 transition-opacity ${isOpen ? "opacity-100" : "opacity-0"}`}
          onClick={onClose}
        />
        <div
          className={`absolute inset-y-0 left-0 transition-transform duration-200 ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {content}
        </div>
      </div>
    </>
  );
}

export default Sidebar;
