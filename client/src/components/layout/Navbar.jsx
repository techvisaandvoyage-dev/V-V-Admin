import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { User, LayoutDashboard, LogOut, Menu, X, Plane, BookOpen, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "../../store/authStore";
import { useUIStore } from "../../store/uiStore";
import { getAdminAppUrl } from "../../utils/adminAppUrl";
import NotificationBell from "./NotificationBell";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Zustand Store Fixes (Performance Optimized) ──────────
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);

  const mobileMenuOpen = useUIStore((state) => state.mobileMenuOpen);
  const toggleMobileMenu = useUIStore((state) => state.toggleMobileMenu);
  const closeMobileMenu = useUIStore((state) => state.closeMobileMenu);

  const [scrolled, setScrolled] = useState(false);

  // ── Detect scroll to toggle navbar style ─────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    closeMobileMenu();
  }, [location.pathname, closeMobileMenu]);

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const isLanding = location.pathname === "/";
  const isTransientPage =
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname.startsWith("/apply") ||
    location.pathname.endsWith("/summary");

  const handleDashboardOpen = () => {
    if (user?.role === "admin") {
      window.location.href = getAdminAppUrl("/");
    } else {
      navigate("/dashboard", { replace: isTransientPage });
    }
  };

  const handleProfileIconClick = () => {
    if (isAuthenticated) {
      handleDashboardOpen();
    } else {
      navigate("/login", { replace: isTransientPage });
    }
  };

  return (
    <>
      <header
        className={`
          fixed top-0 left-0 right-0 z-40 transition-all duration-300
          ${scrolled || !isLanding
            ? "bg-surface/95 backdrop-blur-md border-b border-border shadow-card"
            : "bg-transparent"
          }
        `}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* ── Logo ── */}
            <Link
              to="/"
              replace
              className="flex items-center gap-2.5 group"
              aria-label="VISAANDVOYAGE Home"
            >
              <div className="w-8 h-8 rounded-lg bg-cyan flex items-center justify-center group-hover:shadow-cyan-glow transition-shadow duration-300">
                <Plane size={16} className="text-background" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-xl tracking-tight">
                <span className="text-gradient-cyan">VISAANDVOYAGE</span>
              </span>
            </Link>

            {/* ── Right side: public links + profile icon ── */}
            <div className="hidden md:flex items-center gap-2">
              <Link
                to="/destinations"
                replace={isTransientPage}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname.startsWith("/destination")
                    ? "text-black"
                    : "text-black hover:text-black/80"
                }`}
              >
                <Globe size={15} />
                Destinations
              </Link>
              <Link
                to="/blog"
                replace={isTransientPage}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname.startsWith("/blog")
                    ? "text-black"
                    : "text-black hover:text-black/80"
                }`}
              >
                <BookOpen size={15} />
                Blog
              </Link>
              <NotificationBell className="ml-2" />
              <button
                id="user-dashboard-btn"
                onClick={handleProfileIconClick}
                className="w-10 h-10 rounded-full bg-cyan/15 border border-cyan/30 flex items-center justify-center text-cyan hover:bg-cyan/20 hover:shadow-cyan-glow transition-all duration-200"
                aria-label={isAuthenticated ? "Open dashboard" : "Open login"}
              >
                <User size={18} />
              </button>
            </div>

            {/* ── Mobile hamburger ── */}
            <button
              id="mobile-menu-btn"
              onClick={toggleMobileMenu}
              className="md:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* ── Mobile menu drawer ── */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-border bg-surface overflow-hidden"
            >
              <div className="px-4 py-4 space-y-1">
                <Link
                  to="/destinations"
                  replace={isTransientPage}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-3 rounded-lg transition-colors"
                >
                  <Globe size={15} />
                  Destinations
                </Link>
                <Link
                  to="/blog"
                  replace={isTransientPage}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-3 rounded-lg transition-colors"
                >
                  <BookOpen size={15} />
                  Blog
                </Link>
                {/* Auth actions */}
                <div className="pt-2 border-t border-border flex flex-col gap-2">
                  {isAuthenticated ? (
                    <>
                      <button
                        onClick={() => {
                          if (user?.role === "admin") {
                            window.location.href = getAdminAppUrl("/");
                          } else {
                            navigate("/dashboard", { replace: isTransientPage });
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-cyan hover:bg-cyan/10 rounded-lg transition-colors"
                      >
                        <LayoutDashboard size={15} />
                        Dashboard
                      </button>
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <LogOut size={15} />
                        Sign Out
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => navigate("/login", { replace: isTransientPage })}
                      className="mx-4 my-2 px-4 py-2.5 bg-cyan text-background text-sm font-bold rounded-xl hover:bg-cyan/90 transition-all text-center shadow-lg shadow-cyan/20"
                    >
                      Sign In
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Spacer so content doesn't hide behind fixed navbar */}
      <div className="h-16" aria-hidden="true" />
    </>
  );
};

export default Navbar;
