// ============================================================
//  Sidebar Component
//  Collapsible left sidebar for User Dashboard & Admin Panel.
//  Icons + labels. Collapses to icon-only on toggle.
//  On mobile: slide-in drawer from left.
// ============================================================
import { useState, useEffect } from "react";
import { NavLink, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard, Home, FileText, PlusCircle, Globe, Settings,
  LogOut, LayoutTemplate, MonitorPlay, FileArchive, ShieldCheck, ChevronDown, ChevronLeft, ChevronRight, Shield, BarChart2,
  MapPin, CreditCard, BookOpen, Sliders, MessageSquare, Search,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore, api } from "../../store/authStore";
import { useUIStore } from "../../store/uiStore";
import { useSiteLogo } from "../../hooks/useSiteLogo";

// ── Nav item groups per role ───────────────────────────────
const USER_NAV = [
  { label: "Overview",         icon: LayoutDashboard,  to: "/dashboard",          id: "nav-overview" },
  { label: "My Applications",  icon: FileText,         to: "/dashboard/apps",     id: "nav-my-apps" },
  { label: "New Application",  icon: PlusCircle,       to: "/apply",              id: "nav-new-app" },
  { label: "Destinations",     icon: Globe,            to: "/dashboard/countries", id: "nav-countries" },
  { label: "Settings",         icon: Settings,         to: "/dashboard/settings", id: "nav-settings" },
];

const ADMIN_NAV = [
  { label: "Analytics",        icon: BarChart2,         to: "/",             id: "nav-admin-analytics" },
  { label: "Applications",     icon: FileText,          to: "/applications", id: "nav-admin-apps" },
  { label: "Transactions",     icon: CreditCard,        to: "/transactions", id: "nav-admin-tx" },
  { label: "Country Manager",  icon: MapPin,            to: "/countries",    id: "nav-admin-countries" },
  { label: "Landing Page",     icon: Home,              to: "/landing-page", id: "nav-admin-landing",
    subItems: [
      { label: "Navbar", isHeader: true },
      { label: "Site Logo", sectionKey: "site-logo", indent: true },
      { label: "Blog", sectionKey: "blog-manager", indent: true },
      { label: "Register Page", sectionKey: "register-page", indent: true },
      { label: "Main Page", isHeader: true },
      { label: "Landing Highlights", sectionKey: "landing-highlights", indent: true }
    ]
  },
  { label: "Cards",            icon: CreditCard,        to: "/cards",        id: "nav-admin-cards",
    subItems: [
      { label: "Visa Details Management", sectionKey: "visa-details-table" },
      { label: "Fee Update Manager", sectionKey: "fee-update-manager" },
      { label: "Why book now?", sectionKey: "why-book-now" },
      { label: "What's included", sectionKey: "whats-included" },
      { label: "How it works", sectionKey: "how-it-works" },
      { label: "FAQs", sectionKey: "faqs" },
      { label: "Visa Requirements", sectionKey: "visa-requirements" },
      { label: "Document Upload Methods", sectionKey: "upload-methods" },
    ]
  },
  { label: "Footer",           icon: LayoutTemplate,    to: "/footer",       id: "nav-admin-footer",
    subItems: [
      { label: "Static Pages", sectionKey: "static-pages" },
      { label: "Footer Controls", sectionKey: "footer-social-icons" }
    ]
  },


  { label: "System Display",   icon: MonitorPlay,       to: "/system-display", id: "nav-admin-system",
    subItems: [
      { label: "Site maintenance mode", sectionKey: "maintenance-mode" },
      { label: "Customer Support Widget", sectionKey: "customer-support" },
    ]
  },
  { label: "Support Chat",     icon: MessageSquare,     to: "/support-chat", id: "nav-admin-support-chat" },
  { label: "SEO Manager",      icon: Search,            to: "/seo",         id: "nav-admin-seo" },
  { label: "Settings",         icon: Settings,          to: "/settings",    id: "nav-admin-settings" },
];

const Sidebar = () => {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [hoveredNavItem, setHoveredNavItem] = useState(null);
  const siteLogo = useSiteLogo();

  useEffect(() => {
    if (user?.role !== "admin") return;
    const fetchUnread = async () => {
      try {
        const { data } = await api.get("/support/conversations");
        if (data?.success && data?.conversations) {
          const total = data.conversations.reduce((sum, c) => sum + (c.unread || 0), 0);
          setUnreadCount(total);
        }
      } catch (err) {
        console.error("Failed to load live unread count:", err);
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 3000);
    return () => clearInterval(interval);
  }, [user]);

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
          h-screen sticky top-0 overflow-visible flex-shrink-0 z-50
        `}
      >
        {/* Logo / Brand as Back Button & Collapse Toggle */}
        <div className="flex items-center h-16 px-4 border-b border-border flex-shrink-0">
          <Link to="/" className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity cursor-pointer group" title="Back to Home Site">
            <img
              src={siteLogo}
              alt="Visa & Voyage"
              className={sidebarOpen ? "block h-10 w-auto object-contain" : "block h-8 w-8 object-contain object-left"}
            />
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
        <nav className="flex-1 py-4 overflow-visible" aria-label="Sidebar navigation">
          <ul className="space-y-1 px-2">
            {navItems.map(({ label, icon: Icon, to, id, subItems }) => {
              const badge = id === "nav-admin-support-chat" && unreadCount > 0 ? unreadCount : null;
              const hasSubItems = Boolean(subItems && subItems.length > 0);
              const isHovered = hoveredNavItem === id;
              
              return (
                <li key={id} 
                    className="relative"
                    onMouseEnter={() => setHoveredNavItem(id)}
                    onMouseLeave={() => setHoveredNavItem(null)}>
                  <NavLink
                    id={id}
                    to={to}
                    end={to === "/dashboard" || to === "/admin" || to === "/"}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                      transition-all duration-200 group relative w-full text-left
                      ${isActive || isHovered
                        ? "bg-cyan/10 text-cyan border border-cyan/20"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-3 border border-transparent"
                      }
                    `}
                  >
                    <div className="relative">
                      <Icon size={18} className="flex-shrink-0" />
                      {!sidebarOpen && badge && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                      )}
                    </div>

                    <AnimatePresence>
                      {sidebarOpen && (
                        <div className="flex-1 flex items-center justify-between min-w-0">
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            className="whitespace-nowrap overflow-hidden font-medium truncate"
                          >
                            {label}
                          </motion.span>
                          {hasSubItems && (
                            <ChevronDown size={14} className={`transition-transform ${isHovered ? "-rotate-90" : ""}`} />
                          )}
                          {badge && (
                            <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm flex-shrink-0 animate-pulse">
                              {badge}
                            </span>
                          )}
                        </div>
                      )}
                    </AnimatePresence>

                  {!sidebarOpen && !hasSubItems && (
                    <span className="
                      absolute left-full ml-2 px-2 py-1 rounded-lg
                      bg-surface-3 border border-border text-xs text-text-primary
                      whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100
                      transition-opacity z-[200]
                    ">
                      {label}
                    </span>
                  )}
                  </NavLink>

                  {/* Flyout Submenu */}
                  <AnimatePresence>
                    {hasSubItems && isHovered && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-[calc(100%+0.5rem)] top-0 w-64 rounded-xl border border-border bg-white shadow-xl overflow-y-auto max-h-[70vh] z-[200]"
                      >
                        <div className="py-2">
                          <div className="px-4 py-2 text-xs font-bold text-text-muted uppercase tracking-wider border-b border-border mb-2">
                            {label}
                          </div>
                          {subItems.map((sub, idx) => (
                            sub.isHeader ? (
                              <div key={`header-${idx}`} className="px-4 py-1.5 mt-2 mb-1 text-[10px] font-bold text-text-muted uppercase tracking-wider bg-surface-2/50 border-y border-border">
                                {sub.label}
                              </div>
                            ) : (
                              <Link
                                key={sub.sectionKey || `link-${idx}`}
                                to={`${to}?section=${sub.sectionKey}`}
                                onClick={() => setHoveredNavItem(null)}
                                className={`block w-full text-left py-2 text-sm text-text-secondary hover:bg-cyan/10 hover:text-cyan transition ${sub.indent ? 'pl-6 pr-4' : 'px-4'}`}
                              >
                                {sub.label}
                              </Link>
                            )
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
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
