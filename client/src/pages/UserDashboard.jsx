// ============================================================
//  User Dashboard Page
//  Features:
//  - Sidebar navigation (Sidebar component)
//  - Welcome header with quick-stat cards
//  - Active Applications grid (status badges + progress)
//  - Recent activity timeline
//  - New Application CTA
// ============================================================
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlusCircle, Clock, CheckCircle, XCircle, AlertCircle,
  FileText, ChevronRight, Calendar, Search, Filter,
  TrendingUp, Globe, ArrowLeft, User, CreditCard,
} from "lucide-react";
import { StatusBadge } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { motion } from "framer-motion";
import Sidebar from "../components/layout/Sidebar";
import { useAuthStore } from "../store/authStore";
import { useDataStore } from "../store/dataStore";
import axios from "axios";

// ── Format date helper ────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return "N/A";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// ── Recent activity — derive from BOOKINGS ────────────────
const RECENT_ACTIVITY = [
  { id: 1, icon: CheckCircle, color: "text-emerald-400", text: "USA visa approved", sub: "B1/B2 Tourist Visa", time: "Dec 15, 2025" },
  { id: 2, icon: AlertCircle, color: "text-blue-400",    text: "UK application under review", sub: "Documents submitted", time: "Jan 8, 2026" },
  { id: 3, icon: FileText,    color: "text-cyan",         text: "Japan application submitted", sub: "Processing started", time: "Feb 20, 2026" },
  { id: 4, icon: Clock,       color: "text-amber-400",   text: "Documents requested", sub: "UK Standard Visitor", time: "Jan 12, 2026" },
];

// ─────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────
const UserDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { bookings, fetchUserApplications } = useDataStore();

  // ── Filter state ──────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch user data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (token) {
          const { data } = await axios.get("http://localhost:5000/api/users/payments/my-transactions", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (data.success) setTransactions(data.transactions);
        }
        await fetchUserApplications();
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user, fetchUserApplications]);

  // Filter local bookings (now synced with backend)
  const safeBookings = Array.isArray(bookings) ? bookings : [];

  const filteredBookings = safeBookings.filter((b) => {
    const countryName = b.countryName || "";
    const matchSearch = countryName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "all" || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── Quick stat counts ─────────────────────────────────────
  const stats = {
    total:    safeBookings.length,
    approved: safeBookings.filter((b) => b.status === "approved").length,
    pending:  safeBookings.filter((b) => b.status === "pending" || b.status === "pending_payment").length,
    review:   safeBookings.filter((b) => b.status === "review").length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan/20 border-t-cyan rounded-full animate-spin" />
          <p className="text-text-secondary animate-pulse">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Sidebar ── */}
      <Sidebar />

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto min-w-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

          {/* ── Welcome header ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <button
              onClick={() => navigate("/")}
              className="group flex items-center gap-2 text-sm text-text-muted hover:text-cyan transition-colors mb-5 w-fit"
              id="back-to-home-btn"
            >
              <span className="p-1.5 rounded-lg bg-surface-2 border border-border group-hover:border-cyan/50 transition-colors">
                <ArrowLeft size={14} />
              </span>
              Back to Homepage
            </button>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">
                  Good morning, {user?.name?.split(" ")[0] || "Traveler"} 👋
                </h1>
                <p className="text-text-secondary mt-1">
                  Here's an overview of your visa applications.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  leftIcon={<User size={16} />}
                  onClick={() => navigate("/dashboard/profile")}
                >
                  My Profile
                </Button>
                <Button
                  variant="primary"
                  leftIcon={<PlusCircle size={16} />}
                  onClick={() => navigate("/apply")}
                  id="new-application-btn"
                >
                  New Application
                </Button>
              </div>
            </div>
          </motion.div>

          {/* ── Quick stats ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Applications", value: stats.total,    icon: FileText,     color: "text-cyan",         bg: "bg-cyan/10" },
              { label: "Approved",           value: stats.approved, icon: CheckCircle,  color: "text-emerald-400",  bg: "bg-emerald-500/10" },
              { label: "Under Review",       value: stats.review,   icon: TrendingUp,   color: "text-blue-400",     bg: "bg-blue-500/10" },
              { label: "Pending Action",     value: stats.pending,  icon: Clock,        color: "text-amber-400",    bg: "bg-amber-500/10" },
            ].map(({ label, value, icon: Icon, color, bg }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={22} className={color} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-text-primary">{value}</div>
                    <div className="text-xs text-text-muted">{label}</div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* ── Applications section ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* Left: Applications list */}
            <div className="xl:col-span-2">
              {/* Filter toolbar */}
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <h2 className="text-lg font-semibold text-text-primary flex-1">
                  My Applications
                </h2>

                {/* Search */}
                <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-xl px-3 py-2">
                  <Search size={14} className="text-text-muted" />
                  <input
                    type="text"
                    placeholder="Search country..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none w-32"
                    aria-label="Search applications"
                    id="dashboard-search"
                  />
                </div>

                {/* Status filter */}
                <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-xl px-3 py-2">
                  <Filter size={14} className="text-text-muted" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-transparent text-sm text-text-secondary focus:outline-none cursor-pointer"
                    aria-label="Filter by status"
                    id="status-filter"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="review">Under Review</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {/* Applications cards */}
              <div className="space-y-3">
                {filteredBookings.length === 0 ? (
                  <Card className="text-center py-12">
                    <Globe size={40} className="text-text-muted mx-auto mb-3" />
                    <p className="text-text-secondary">No applications found.</p>
                    <Button
                      variant="primary"
                      size="sm"
                      className="mt-4"
                      onClick={() => navigate("/apply")}
                    >
                      Start New Application
                    </Button>
                  </Card>
                ) : (
                  filteredBookings.map((booking, i) => (
                    <motion.div
                      key={booking._id || booking.id || i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <Card
                        hoverable
                        padding="sm"
                        className="flex flex-wrap items-center gap-4"
                        onClick={() => navigate(`/dashboard/application/${booking._id || booking.id}`)}
                      >
                        {/* Flag */}
                        <div className="w-12 h-12 rounded-xl bg-surface-3 flex items-center justify-center text-2xl flex-shrink-0">
                          {booking.flagEmoji || "🛂"}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-semibold text-text-primary">
                              {booking.countryName || "Unknown Country"}
                            </h3>
                            <StatusBadge status={booking.status || "pending"} />
                          </div>
                          <p className="text-xs text-text-muted">{booking.visaType || "Visa Application"}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="flex items-center gap-1 text-xs text-text-muted">
                              <Calendar size={11} />
                              Applied: {fmtDate(booking.createdAt)}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-text-muted">
                              ✈️ Travel: {fmtDate(booking.travelDate)}
                            </span>
                          </div>
                        </div>

                        {/* Fee + action */}
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-text-primary">₹{booking.fee || 0}</div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/application/${booking._id || booking.id}`); }}
                            className="mt-1 flex items-center gap-1 text-xs text-cyan hover:text-cyan-dim transition-colors"
                          >
                            View Details <ChevronRight size={12} />
                          </button>
                        </div>
                      </Card>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Activity + CTA */}
            <div className="space-y-5">
              {/* New application CTA card */}
              <Card bordered className="text-center py-6 px-4">
                <div className="w-14 h-14 rounded-2xl bg-cyan/10 border border-cyan/20 flex items-center justify-center mx-auto mb-4">
                  <Globe size={26} className="text-cyan" />
                </div>
                <h3 className="font-semibold text-text-primary mb-2">
                  Plan a New Trip?
                </h3>
                <p className="text-xs text-text-secondary mb-5">
                  Browse 150+ destinations and start your visa application in minutes.
                </p>
                <Button
                  variant="primary"
                  fullWidth
                  leftIcon={<PlusCircle size={15} />}
                  onClick={() => navigate("/apply")}
                  id="sidebar-new-app-btn"
                >
                  New Application
                </Button>
              </Card>

              {/* Recent activity feed */}
              <Card>
                <h3 className="font-semibold text-text-primary mb-4">Recent Activity</h3>
                <div className="space-y-4">
                  {RECENT_ACTIVITY.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.id} className="flex gap-3">
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center gap-1 flex-shrink-0">
                          <Icon size={16} className={item.color} />
                          <div className="flex-1 w-px bg-border min-h-[16px]" />
                        </div>
                        <div className="pb-2 min-w-0">
                          <p className="text-sm text-text-primary font-medium">{item.text}</p>
                          <p className="text-xs text-text-muted">{item.sub}</p>
                          <p className="text-2xs text-text-muted mt-1">{item.time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Transactions feed */}
              <Card>
                <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <CreditCard size={18} className="text-cyan" />
                  My Transactions
                </h3>
                <div className="space-y-4">
                  {!Array.isArray(transactions) || transactions.length === 0 ? (
                    <p className="text-sm text-text-muted">No transactions yet.</p>
                  ) : (
                    transactions.map((tx) => (
                      <div key={tx._id || Math.random()} className="flex justify-between items-center pb-3 border-b border-border/50 last:border-0 last:pb-0">
                        <div>
                          <p className="text-sm text-text-primary font-medium">
                            {tx.application?.countryName ? `${tx.application.countryName} Visa` : 'Visa Application'}
                          </p>
                          <p className="text-xs text-text-muted font-mono">{tx.razorpayPaymentId || tx.razorpayOrderId}</p>
                          <p className="text-2xs text-text-muted mt-0.5">{new Date(tx.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-text-primary">${tx.amount}.00</p>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${tx.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              {/* Help card */}
              <Card className="bg-gradient-to-br from-cyan/5 to-transparent border-cyan/20">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle size={16} className="text-cyan" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary mb-1">Need Help?</h4>
                    <p className="text-xs text-text-secondary mb-3">
                      Our visa experts are available 24/7 to answer your questions.
                    </p>
                    <button className="text-xs text-cyan hover:text-cyan-dim font-medium transition-colors">
                      Chat with an Expert →
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserDashboard;
