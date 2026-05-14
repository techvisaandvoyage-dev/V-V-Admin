// ============================================================
//  Sidebar Component
//  Collapsible left sidebar for User Dashboard & Admin Panel.
//  Icons + labels. Collapses to icon-only on toggle.
//  On mobile: slide-in drawer from left.
// ============================================================
import { NavLink, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard, FileText, PlusCircle, Globe, Settings,
  LogOut, ChevronLeft, ChevronRight, Shield, BarChart2,
  MapPin, Plane, CreditCard, BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "../../store/authStore";
import { useUIStore } from "../../store/uiStore";

// ── Nav item groups per role ───────────────────────────────
const USER_NAV = [
  { label: "Overview",         icon: LayoutDashboard,  to: "/dashboard",         id: "nav-overview" },
  { label: "My Applications",  icon: FileText,          to: "/dashboard/apps",    id: "nav-my-apps" },
  { label: "New Application",  icon: PlusCircle,        to: "/apply",             id: "nav-new-app" },
  { label: "Destinations",     icon: Globe,             to: "/dashboard/countries", id: "nav-countries" },
  { label: "Settings",         icon: Settings,          to: "/dashboard/settings", id: "nav-settings" },
];

const ADMIN_NAV = [
  { label: "Analytics",        icon: BarChart2,         to: "/",             id: "nav-admin-analytics" },
  { label: "Static Pages",     icon: Globe,             to: "/pages",        id: "nav-admin-pages" },
  { label: "Blog",            icon: BookOpen,          to: "/blogs",        id: "nav-admin-blogs" },
  { label: "Transactions",     icon: CreditCard,        to: "/transactions", id: "nav-admin-tx" },
  { label: "Applications",     icon: FileText,          to: "/applications", id: "nav-admin-apps" },
  { label: "Country Manager",  icon: MapPin,            to: "/countries",   id: "nav-admin-countries" },
  { label: "Settings",         icon: Settings,          to: "/settings",    id: "nav-admin-settings" },
];

const Sidebar = () => {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore();
  const navigate = useNavigate();

  // Choose nav items based on user role
  const navItems = user?.role === "admin" ? ADMIN_NAV : USER_NAV;
  const isAdmin  = user?.role === "admin";

  const handleLogout = () => {
    logout();
    window.location.href = "/";
  };

  // ── Sidebar width based on open/closed state ──────────────
  const sidebarWidth = sidebarOpen ? "w-60" : "w-16";

  return (
    <>
      {/* ── Desktop Sidebar ─────────────────────────────────── */}
      <motion.aside
        animate={{ width: sidebarOpen ? 240 : 64 }}
        transition={{ type: "spring", stiffness: 250, damping: 25 }}
        className={`
          hidden lg:flex flex-col
          bg-surface border-r border-border
          h-screen sticky top-0 overflow-hidden flex-shrink-0
        `}
      >
        {/* Logo / Brand as Back Button & Collapse Toggle */}
        <div className="flex items-center h-16 px-4 border-b border-border flex-shrink-0">
          <Link to="/" className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity cursor-pointer group" title="Back to Home Site">
            <div className="w-8 h-8 rounded-lg bg-cyan flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <Plane size={16} className="text-background" strokeWidth={2.5} />
            </div>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="font-bold text-lg tracking-tight overflow-hidden whitespace-nowrap"
                >
                  <span className="text-gradient-cyan">VISAANDVOYAGE</span>
                </motion.span>
              )}
            </AnimatePresence>
          </Link>

          {/* Collapse toggle button */}
          <button
            id="sidebar-toggle-btn"
            onClick={(e) => {
              e.preventDefault();
              toggleSidebar();
            }}
            className={`
              p-1 rounded-lg text-text-muted hover:text-text-primary
              hover:bg-surface-3 transition-colors flex-shrink-0
            `}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Role badge */}
        {sidebarOpen && (
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-cyan/20 flex items-center justify-center flex-shrink-0">
                {isAdmin ? (
                  <Shield size={12} className="text-cyan" />
                ) : (
                  <span className="text-2xs font-bold text-cyan">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-text-primary truncate">{user?.name}</p>
                <p className="text-2xs text-text-muted capitalize">{user?.role} account</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation items */}
        <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden" aria-label="Sidebar navigation">
          <ul className="space-y-1 px-2">
            {navItems.map(({ label, icon: Icon, to, id }) => (
              <li key={id}>
                <NavLink
                  id={id}
                  to={to}
                  end={to === "/dashboard" || to === "/admin"}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                    transition-all duration-200 group relative
                    ${isActive
                      ? "bg-cyan/10 text-cyan border border-cyan/20"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-3"
                    }
                  `}
                >
                  <Icon size={18} className="flex-shrink-0" />

                  {/* Label only when expanded */}
                  <AnimatePresence>
                    {sidebarOpen && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        className="whitespace-nowrap overflow-hidden font-medium"
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* Tooltip on collapsed state */}
                  {!sidebarOpen && (
                    <span className="
                      absolute left-full ml-2 px-2 py-1 rounded-lg
                      bg-surface-3 border border-border text-xs text-text-primary
                      whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100
                      transition-opacity z-50
                    ">
                      {label}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Logout button at bottom */}
        <div className="px-2 py-4 border-t border-border flex-shrink-0">
          <button
            id="sidebar-logout-btn"
            onClick={handleLogout}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
              text-red-400 hover:bg-red-500/10 transition-colors
            `}
            aria-label="Sign out"
          >
            <LogOut size={18} className="flex-shrink-0" />
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="font-medium whitespace-nowrap"
                >
                  Sign Out
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* ── Mobile sidebar drawer ────────────────────────────── */}
      <AnimatePresence>
        {/* We use the mobileMenuOpen from a separate trigger — here we just
            expose a small bottom tab bar on mobile for convenience */}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
