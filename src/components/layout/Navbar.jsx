// ============================================================
//  Navbar Component
//  Top navigation bar — transparent on landing, solid on scroll.
//  Shows auth buttons (Login/Register) or user avatar dropdown.
//  Responsive: hamburger icon on mobile.
// ============================================================
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Globe, ChevronDown, User, LayoutDashboard,
  Shield, LogOut, Menu, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "../../store/authStore";
import { useUIStore } from "../../store/uiStore";
import Button from "../ui/Button";
import { useSiteLogo } from "../../hooks/useSiteLogo";

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

  // ── Local state ──────────────────────────────────────────
  const [scrolled, setScrolled] = useState(false);       // Solid bg after scroll
  const [userMenuOpen, setUserMenuOpen] = useState(false); // User dropdown
  const userMenuRef = useRef(null);
  const siteLogo = useSiteLogo();

  // ── Detect scroll to toggle navbar style ─────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Close user dropdown on outside click ─────────────────
  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Close mobile menu on route change ────────────────────
  useEffect(() => { 
    closeMobileMenu(); 
  }, [location.pathname, closeMobileMenu]); // <-- ESLint warning fix

  // ── Public navigation links ───────────────────────────────
  const navLinks = [];

  const handleLogout = () => {
    logout();
    window.location.href = "/";
  };

  // ── Is this the landing page (for transparent bg logic) ──
  const isLanding = location.pathname === "/";

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
              className="flex h-16 items-center"
              aria-label="Visa & Voyage Home"
            >
              <img
                src={siteLogo}
                alt="Visa & Voyage"
                className="block h-11 w-auto object-contain sm:h-12"
              />
            </Link>

            {/* ── Desktop nav links ── */}
            <nav className="hidden md:flex items-center gap-2" aria-label="Main navigation">
  {navLinks.map((link) => (
    <Link
      key={link.label}
      to={link.href}
      className="
        px-4 py-2 text-sm font-medium text-text-secondary 
        rounded-lg transition-all duration-300 ease-out
        /* Hover Effects */
        hover:text-text-primary hover:bg-surface-3 
        hover:shadow-sm hover:scale-105
        /* Active/Tap Effect */
        active:scale-95
      "
    >
      {link.label}
    </Link>
  ))}
</nav>

            {/* ── Right side: auth buttons or user menu ── */}
            <div className="hidden md:flex items-center gap-3">
              {isAuthenticated && user ? (
                /* User avatar dropdown */
                <div className="relative" ref={userMenuRef}>
                  <button
                    id="user-menu-btn"
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-2 border border-border hover:border-cyan/30 transition-all duration-200"
                    aria-expanded={userMenuOpen}
                    aria-label="User menu"
                  >
                    {/* Avatar circle */}
                    <div className="w-7 h-7 rounded-full bg-cyan/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-cyan">
                        {user.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-text-primary max-w-[100px] truncate">
                      {user.name}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-text-muted transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {/* Dropdown menu */}
                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-48 bg-surface border border-border rounded-xl shadow-modal overflow-hidden"
                      >
                        {/* Role badge */}
                        <div className="px-4 py-3 border-b border-border">
                          <p className="text-xs text-text-muted">Logged in as</p>
                          <p className="text-sm font-semibold text-text-primary truncate">{user.email}</p>
                          <span className="text-xs text-cyan capitalize">{user.role}</span>
                        </div>

                        {/* Dashboard link */}
                        <button
                          id="nav-dashboard-link"
                          onClick={() => { navigate("/"); setUserMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
                        >
                          <Shield size={15} />
                          Admin Panel
                        </button>



                        {/* Logout */}
                        <div className="border-t border-border">
                          <button
                            id="nav-logout-btn"
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <LogOut size={15} />
                            Sign Out
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                /* Login / Register buttons */
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/login")}
                  >
                    Sign In
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate("/register")}
                  >
                    Get Started
                  </Button>
                </>
              )}
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
                {/* Nav links */}
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    to={link.href}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-3 rounded-lg transition-colors"
                  >
                    <Globe size={15} />
                    {link.label}
                  </Link>
                ))}

                {/* Auth buttons */}
                <div className="pt-2 border-t border-border flex flex-col gap-2">
                  {isAuthenticated ? (
                    <>
                      <button
                        onClick={() => navigate(user?.role === "admin" ? "/" : "/dashboard")}
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
                    <>
                      <Button fullWidth variant="ghost" onClick={() => navigate("/login")}>Sign In</Button>
                      <Button fullWidth variant="primary" onClick={() => navigate("/register")}>Get Started</Button>
                    </>
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
