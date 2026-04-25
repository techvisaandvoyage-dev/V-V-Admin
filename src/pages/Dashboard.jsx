// ============================================================
//  Admin Dashboard Page
//  Sections:
//  1. Analytics overview (4 stat cards + Recharts line chart)
//  2. Applications management table (search, filter, status update)
//  3. Country Manager (add/edit countries via modal)
// ============================================================
import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  BarChart2, TrendingUp, DollarSign, Clock, CheckCircle,
  Search, Filter, ChevronDown, Plus, Edit3, Trash2,
  MapPin, Globe, Users, FileText, X, Save, AlertCircle, UploadCloud, Image as ImageIcon, Settings, CreditCard, IndianRupee,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import { motion } from "framer-motion";
import Sidebar from "../components/layout/Sidebar";
import { StatusBadge } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Modal from "../components/ui/Modal";
import Input, { Select } from "../components/ui/Input";
import { useUIStore } from "../store/uiStore";
import { useDataStore } from "../store/dataStore";
import { useAuthStore, api } from "../store/authStore";
import { ANALYTICS, MONTHLY_REVENUE } from "../data/bookings";

// ── Recharts custom tooltip ────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3 shadow-modal">
      <p className="text-xs font-semibold text-text-primary mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-xs" style={{ color: p.color }}>
          {p.name}: {p.dataKey === "revenue" ? `₹${p.value}` : p.value}
        </p>
      ))}
    </div>
  );
};

// ── Format date ────────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return "N/A";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// ─────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { showToast, countryModalOpen, countryModalMode, selectedCountry, openCountryModal, closeCountryModal } = useUIStore();

  // ── Route & State Navigation ──────────────────────────────
  const navigate       = useNavigate();
  const { activeTab: tabParam } = useParams();
  const activeTab      = tabParam || "analytics";

  // ── Global Data Store ──────────────────────────────────────
  const { bookings, countries, fetchAllApplications, updateBookingStatus, addCountry, updateCountry, deleteCountry: storeDeleteCountry } = useDataStore();

  // ── Local state ──────────────────────────────────────────
  const [searchQuery, setSearchQuery]        = useState("");
  const [statusFilter, setStatusFilter]      = useState("all");
  const [activeChart, setActiveChart]        = useState("revenue"); // "revenue"|"bookings"
  const [transactions, setTransactions]      = useState([]);
  const [settingsForm, setSettingsForm]      = useState({ razorpayKeyId: "", razorpayKeySecret: "" });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isRazorpayConfigured, setIsRazorpayConfigured] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const { changeAdminPassword } = useAuthStore();

  // Fetch Data when tabs change
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Always fetch latest applications for admin
        await fetchAllApplications();

        if (activeTab === "transactions") {
          const { data } = await api.get("/admin/transactions");
          if (data.success) setTransactions(data.transactions);
        } else if (activeTab === "settings") {
          const { data } = await api.get("/admin/settings");
          if (data.success && data.settings) {
            const hasKeyId = Boolean(data.settings.razorpayKeyId?.trim());
            const hasKeySecret = Boolean(data.settings.razorpayKeySecret?.trim());
            setIsRazorpayConfigured(hasKeyId && hasKeySecret);
            setSettingsForm({
              razorpayKeyId: data.settings.razorpayKeyId || "",
              razorpayKeySecret: data.settings.razorpayKeySecret || ""
            });
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, [activeTab, fetchAllApplications]);

  // ── Drag & Drop state ────────────────────────────────────
  const [isDragging, setIsDragging]          = useState(false);
  const fileInputRef                         = useRef(null);

  // Country form state
  const [countryForm, setCountryForm] = useState({
    name: "", flagEmoji: "🌍", basePrice: "", processingDays: "", difficulty: "moderate",
    visaType: "", continent: "", description: "", requirements: [""], imageUrl: ""
  });

  // ── Filter applications ───────────────────────────────────
  const filteredBookings = bookings.filter((b) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      b.countryName.toLowerCase().includes(q) ||
      b.userName.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── Update booking status ──────────────────────────────────
  const updateStatus = (bookingId, newStatus) => {
    updateBookingStatus(bookingId, newStatus);
    showToast(`Application ${bookingId} updated to ${newStatus}`, "success");
  };

  // ── Country Manager handlers ───────────────────────────────
  const openAddCountry = () => {
    setCountryForm({ name: "", flagEmoji: "🌍", basePrice: "", processingDays: "", difficulty: "moderate", visaType: "", continent: "", description: "", requirements: [""], imageUrl: "" });
    openCountryModal("add");
  };

  const openEditCountry = (country) => {
    setCountryForm({
      ...country,
      basePrice: String(country.basePrice),
      requirements: country.requirements || [""],
    });
    openCountryModal("edit", country);
  };

  const saveCountry = () => {
    if (countryModalMode === "add") {
      addCountry({
        ...countryForm,
        id: countryForm.name.toLowerCase().replace(/\s+/g, '-'),
        basePrice: Number(countryForm.basePrice),
        processingDays: Number(countryForm.processingDays),
      });
      showToast(`Country "${countryForm.name}" added successfully.`, "success");
    } else {
      updateCountry(countryForm.id, {
        ...countryForm,
        basePrice: Number(countryForm.basePrice),
        processingDays: Number(countryForm.processingDays),
      });
      showToast(`Country "${countryForm.name}" updated.`, "success");
    }
    closeCountryModal();
  };

  const deleteCountry = (id) => {
    storeDeleteCountry(id);
    showToast("Country removed.", "info");
  };

  // ── Drag & Drop handlers ─────────────────────────────────
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setCountryForm((p) => ({ ...p, imageUrl: url }));
    } else {
      showToast("Please drop a valid image file.", "error");
    }
  };
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setCountryForm((p) => ({ ...p, imageUrl: url }));
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const { data } = await api.put("/admin/settings", settingsForm);
      if (data.success) {
        const hasKeyId = Boolean(settingsForm.razorpayKeyId?.trim());
        const hasKeySecret = Boolean(settingsForm.razorpayKeySecret?.trim());
        setIsRazorpayConfigured(hasKeyId && hasKeySecret);
        showToast("Settings saved successfully", "success");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      showToast(error.response?.data?.message || "Failed to save settings", "error");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      return showToast("Please fill all password fields", "error");
    }
    setIsChangingPassword(true);
    const { success, message } = await changeAdminPassword(passwordForm.currentPassword, passwordForm.newPassword);
    if (success) {
      showToast("Password changed successfully", "success");
      setPasswordForm({ currentPassword: "", newPassword: "" });
    } else {
      showToast(message || "Failed to change password", "error");
    }
    setIsChangingPassword(false);
  };

  // ── Requirements field helpers ─────────────────────────────
  const addRequirement = () =>
    setCountryForm((p) => ({ ...p, requirements: [...p.requirements, ""] }));
  const updateRequirement = (index, value) =>
    setCountryForm((p) => {
      const reqs = [...p.requirements];
      reqs[index] = value;
      return { ...p, requirements: reqs };
    });
  const removeRequirement = (index) =>
    setCountryForm((p) => ({ ...p, requirements: p.requirements.filter((_, i) => i !== index) }));

  // ── Tabs config ───────────────────────────────────────────
  const tabs = [
    { id: "analytics",    label: "Analytics",     icon: BarChart2 },
    { id: "transactions", label: "Transactions",  icon: CreditCard },
    { id: "applications", label: "Applications",  icon: FileText },
    { id: "countries",    label: "Country Manager", icon: MapPin },
    { id: "users",        label: "Users Manager", icon: Users },
    { id: "settings",     label: "Settings",      icon: Settings },
  ];

  // ── Recalculate live analytics from state ─────────────────
  const liveAnalytics = {
    total:    bookings.length,
    revenue:  bookings.reduce((s, b) => s + b.fee, 0),
    pending:  bookings.filter((b) => b.status === "pending" || b.status === "review").length,
    approvalRate: Math.round((bookings.filter((b) => b.status === "approved").length / bookings.length) * 100),
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Sidebar ── */}
      <Sidebar />

      {/* ── Main ── */}
      <main className="flex-1 overflow-auto min-w-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

          {/* ── Admin header ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">Admin Dashboard</h1>
            <p className="text-text-secondary mt-1">Manage all applications, countries, and analytics.</p>
          </motion.div>

          {/* ── Tabs ── */}
          <div className="flex gap-1 bg-surface-2 p-1 rounded-xl mb-8 w-fit">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                id={`admin-tab-${id}`}
                onClick={() => {
                  if (id === "analytics") {
                    navigate("/");
                  } else {
                    navigate(`/${id}`);
                  }
                }}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${activeTab === id
                    ? "bg-cyan text-background shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                  }
                `}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════
              TAB: TRANSACTIONS
              ══════════════════════════════════════ */}
          {activeTab === "transactions" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <Card>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-semibold text-text-primary">Payment Transactions</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/50 text-sm text-text-muted">
                        <th className="py-3 px-4 font-medium">Date</th>
                        <th className="py-3 px-4 font-medium">User</th>
                        <th className="py-3 px-4 font-medium">Payment ID</th>
                        <th className="py-3 px-4 font-medium">Amount</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-8 text-center text-text-muted">No transactions found.</td>
                        </tr>
                      ) : (
                        transactions.map((tx) => (
                          <tr key={tx._id} className="border-b border-border/30 hover:bg-surface-2 transition-colors">
                            <td className="py-3 px-4 text-text-secondary">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-text-primary font-medium">
                              {tx.user?.name || 'Unknown'}
                              <div className="text-xs text-text-muted font-normal">{tx.user?.email || ''}</div>
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-text-secondary">
                              {tx.razorpayPaymentId || tx.razorpayOrderId}
                            </td>
                            <td className="py-3 px-4 font-medium text-text-primary">
                              ₹{tx.amount}.00
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${tx.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : tx.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ══════════════════════════════════════
              TAB 1: ANALYTICS
              ══════════════════════════════════════ */}
          {activeTab === "analytics" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Bookings",  value: liveAnalytics.total,           icon: FileText,   color: "text-cyan",        bg: "bg-cyan/10",          suffix: "" },
                  { label: "Total Revenue",   value: `₹${liveAnalytics.revenue}`,   icon: IndianRupee, color: "text-gold",        bg: "bg-gold/10",          suffix: "" },
                  { label: "Pending Review",  value: liveAnalytics.pending,          icon: Clock,      color: "text-amber-400",   bg: "bg-amber-500/10",     suffix: "" },
                  { label: "Approval Rate",   value: liveAnalytics.approvalRate,    icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10",   suffix: "%" },
                ].map(({ label, value, icon: Icon, color, bg, suffix }, i) => (
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
                        <div className="text-2xl font-bold text-text-primary">
                          {value}{suffix}
                        </div>
                        <div className="text-xs text-text-muted">{label}</div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Revenue + Bookings chart */}
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <h2 className="font-semibold text-text-primary">Monthly Overview</h2>
                  <div className="flex p-1 bg-surface-2 rounded-xl">
                    {[
                      { id: "revenue",  label: "Revenue" },
                      { id: "bookings", label: "Bookings" },
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        id={`chart-toggle-${id}`}
                        onClick={() => setActiveChart(id)}
                        className={`relative px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${activeChart === id ? "text-background" : "text-text-muted hover:text-text-primary"}`}
                      >
                        {activeChart === id && (
                          <motion.div
                            layoutId="chartTogglePill"
                            className="absolute inset-0 bg-cyan rounded-lg"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                        <span className="relative z-10">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recharts */}
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    {activeChart === "revenue" ? (
                      <LineChart data={MONTHLY_REVENUE}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#71717a", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#00d4ff', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          name="Revenue"
                          stroke="#00d4ff"
                          strokeWidth={3}
                          dot={{ fill: "#171717", stroke: "#00d4ff", strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, fill: "#00d4ff", stroke: "#171717", strokeWidth: 2 }}
                          isAnimationActive={true}
                          animationDuration={1500}
                          animationEasing="ease-in-out"
                        />
                      </LineChart>
                    ) : (
                      <BarChart data={MONTHLY_REVENUE}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#71717a", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#2a2a2a', opacity: 0.4 }} />
                        <Bar 
                          dataKey="bookings" 
                          name="Bookings" 
                          fill="#00d4ff" 
                          radius={[4, 4, 0, 0]} 
                          isAnimationActive={true}
                          animationDuration={1500}
                          animationEasing="ease-in-out"
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Status breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  { label: "Approved",    count: bookings.filter(b=>b.status==="approved").length,  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                  { label: "Under Review",count: bookings.filter(b=>b.status==="review").length,    color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20" },
                  { label: "Pending",     count: bookings.filter(b=>b.status==="pending").length,   color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20" },
                  { label: "Rejected",    count: bookings.filter(b=>b.status==="rejected").length,  color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/20" },
                  { label: "Cancelled",   count: bookings.filter(b=>b.status==="cancelled").length, color: "text-zinc-400",    bg: "bg-zinc-500/10",    border: "border-zinc-500/20" },
                ].map(({ label, count, color, bg, border }) => (
                  <div key={label} className={`${bg} border ${border} rounded-xl p-4 text-center`}>
                    <div className={`text-3xl font-bold ${color}`}>{count}</div>
                    <div className="text-xs text-text-muted mt-1">{label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════
              TAB 2: APPLICATIONS TABLE
              ══════════════════════════════════════ */}
          {activeTab === "applications" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <h2 className="font-semibold text-text-primary flex-1">All Applications</h2>

                  {/* Search */}
                  <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-xl px-3 py-2">
                    <Search size={14} className="text-text-muted" />
                    <input
                      type="text"
                      placeholder="Search by name, country, ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none w-48"
                      id="admin-search"
                      aria-label="Search applications"
                    />
                  </div>

                  {/* Status filter */}
                  <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-xl px-3 py-2">
                    <Filter size={14} className="text-text-muted" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-transparent text-sm text-text-secondary focus:outline-none cursor-pointer"
                      id="admin-status-filter"
                    >
                      <option value="all">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="review">Under Review</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                {/* Table — horizontally scrollable on mobile */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {["Application ID","Applicant","Destination","Travel Date","Fee","Status","Action"].map((h) => (
                          <th key={h} className="text-left text-xs font-semibold text-text-muted pb-3 pr-6 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {filteredBookings.map((b) => (
                        <tr key={b._id || b.id} className="hover:bg-surface-3/50 transition-colors group">
                          <td className="py-3 pr-6 font-mono text-xs text-text-muted whitespace-nowrap">
                            {b._id || b.id}
                          </td>
                          <td className="py-3 pr-6 whitespace-nowrap">
                            <div>
                              <p className="font-medium text-text-primary">
                                {b.firstName ? `${b.firstName} ${b.lastName}` : (b.userName || 'Unknown')}
                              </p>
                              <p className="text-xs text-text-muted">{b.email || b.userEmail}</p>
                            </div>
                          </td>
                          <td className="py-3 pr-6 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{b.flagEmoji}</span>
                              <span className="font-medium text-text-primary">{b.countryName}</span>
                            </div>
                          </td>
                          <td className="py-3 pr-6 text-text-secondary whitespace-nowrap">
                            {fmtDate(b.travelDate)}
                          </td>
                          <td className="py-3 pr-6 font-medium text-text-primary whitespace-nowrap">
                            ₹{b.fee}
                          </td>
                          <td className="py-3 pr-6">
                            <StatusBadge status={b.status} />
                          </td>
                          <td className="py-3 pr-2">
                            <div className="flex items-center gap-2">
                              {/* View Details Button */}
                              <button
                                onClick={() => navigate(`/application/${b.id || b._id}`)}
                                className="px-3 py-1.5 bg-cyan/10 text-cyan hover:bg-cyan/20 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                                title="View Application Details"
                              >
                                View Details
                              </button>

                              {/* Status update dropdown */}
                              <div className="relative group/select">
                                  <select
                                    id={`status-update-${b._id || b.id}`}
                                    defaultValue={b.status}
                                    onChange={(e) => updateStatus(b._id || b.id, e.target.value)}
                                    className="bg-surface-3 border border-border text-xs text-text-secondary rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan cursor-pointer"
                                    aria-label={`Update status for ${b._id || b.id}`}
                                  >
                                  <option value="pending">Pending</option>
                                  <option value="review">Under Review</option>
                                  <option value="approved">Approved</option>
                                  <option value="rejected">Rejected</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredBookings.length === 0 && (
                    <div className="text-center py-12 text-text-muted">
                      <AlertCircle size={32} className="mx-auto mb-3 opacity-50" />
                      <p>No applications match your search.</p>
                    </div>
                  )}
                </div>

                {/* Pagination stub */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                  <p className="text-xs text-text-muted">
                    Showing {filteredBookings.length} of {bookings.length} applications
                  </p>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 text-xs rounded-lg bg-surface-3 text-text-muted hover:text-text-primary transition-colors" id="admin-prev-page">← Prev</button>
                    <button className="px-3 py-1.5 text-xs rounded-lg bg-cyan text-background font-medium" id="admin-page-1">1</button>
                    <button className="px-3 py-1.5 text-xs rounded-lg bg-surface-3 text-text-muted hover:text-text-primary transition-colors" id="admin-next-page">Next →</button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ══════════════════════════════════════
              TAB 3: COUNTRY MANAGER
              ══════════════════════════════════════ */}
          {activeTab === "countries" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-semibold text-text-primary">Country Manager</h2>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus size={15} />}
                    onClick={openAddCountry}
                    id="add-country-btn"
                  >
                    Add Country
                  </Button>
                </div>

                {/* Country cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {countries.map((c) => (
                    <div
                      key={c.id}
                      className="bg-surface-2 border border-border rounded-xl overflow-hidden hover:border-cyan/20 transition-colors flex flex-col"
                    >
                      {/* Image Banner */}
                      <div 
                        className="h-28 bg-cover bg-center relative"
                        style={{ backgroundImage: `url('${c.imageUrl || 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&q=80&w=800'}')` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                        <span className="absolute bottom-2 left-3 text-2xl drop-shadow-md">{c.flagEmoji}</span>
                      </div>

                      <div className="p-4 flex-1 flex flex-col">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div>
                              <h3 className="font-semibold text-text-primary text-sm">{c.name}</h3>
                              <p className="text-xs text-text-muted">{c.visaType}</p>
                            </div>
                          </div>
                          {/* Actions */}
                          <div className="flex gap-1">
                          <button
                            id={`edit-country-${c.id}`}
                            onClick={() => openEditCountry(c)}
                            className="p-1.5 rounded-lg hover:bg-cyan/10 text-text-muted hover:text-cyan transition-colors"
                            aria-label={`Edit ${c.name}`}
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            id={`delete-country-${c.id}`}
                            onClick={() => deleteCountry(c.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                            aria-label={`Delete ${c.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Details row */}
                      <div className="flex items-center gap-4 text-xs text-text-muted mt-auto pt-3 border-t border-border/40">
                        <span className="flex items-center gap-1">
                          <IndianRupee size={11} /> ₹{c.basePrice}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {c.processingDays}d
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle size={11} /> {c.successRate}%
                        </span>
                      </div>
                    </div>
                  </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* ══════════════════════════════════════
              TAB 4: USERS MANAGER
              ══════════════════════════════════════ */}
          {activeTab === "users" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-semibold text-text-primary">Users Manager</h2>
                    <p className="text-xs text-text-muted">Manage system administrators and applicants</p>
                  </div>
                  <Button variant="primary" size="sm" leftIcon={<Plus size={15} />}>
                    Invite User
                  </Button>
                </div>
                
                <div className="text-center py-12 text-text-muted">
                  <Users size={32} className="mx-auto mb-3 opacity-50" />
                  <p>User management module coming soon.</p>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ══════════════════════════════════════
              TAB 5: SETTINGS
              ══════════════════════════════════════ */}
          {activeTab === "settings" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <Card>
                <h2 className="font-semibold text-text-primary mb-6">Global Platform Settings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-text-primary border-b border-border pb-2">Appearance</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-secondary">Default Theme</span>
                      <select className="bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:border-cyan outline-none">
                        <option>Dark Mode</option>
                        <option>Light Mode</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-text-primary border-b border-border pb-2">Payments (Razorpay)</h3>
                    <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${isRazorpayConfigured ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
                      {isRazorpayConfigured ? "Razorpay configured and ready" : "Razorpay keys missing. Add Key ID and Key Secret."}
                    </div>
                    <Input 
                      label="Key ID" 
                      type="text" 
                      value={settingsForm.razorpayKeyId} 
                      onChange={(e) => setSettingsForm(p => ({ ...p, razorpayKeyId: e.target.value }))}
                      id="setting-razorpay-key" 
                    />
                    <Input 
                      label="Key Secret" 
                      type="password" 
                      value={settingsForm.razorpayKeySecret} 
                      onChange={(e) => setSettingsForm(p => ({ ...p, razorpayKeySecret: e.target.value }))}
                      id="setting-razorpay-secret" 
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-6">
                  <Button 
                    variant="primary" 
                    leftIcon={<Save size={15} />} 
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                  >
                    {isSavingSettings ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </Card>

              {/* Security Card */}
              <Card>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-semibold text-text-primary">Security</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-text-primary border-b border-border pb-2">Change Password</h3>
                    <Input 
                      label="Current Password" 
                      type="password" 
                      value={passwordForm.currentPassword} 
                      onChange={(e) => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                      id="admin-current-password" 
                      placeholder="Enter current password"
                    />
                    <Input 
                      label="New Password" 
                      type="password" 
                      value={passwordForm.newPassword} 
                      onChange={(e) => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                      id="admin-new-password" 
                      placeholder="Enter new password"
                    />
                    <div className="flex justify-start mt-4">
                      <Button 
                        variant="primary" 
                        onClick={handleChangePassword}
                        disabled={isChangingPassword}
                      >
                        {isChangingPassword ? 'Updating...' : 'Change Password'}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

        </div>
      </main>

      {/* ══════════════════════════════════════
          COUNTRY MANAGER MODAL
          ══════════════════════════════════════ */}
      <Modal
        isOpen={countryModalOpen}
        onClose={closeCountryModal}
        title={countryModalMode === "add" ? "Add New Country" : `Edit — ${selectedCountry?.name}`}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={closeCountryModal} id="country-modal-cancel">Cancel</Button>
            <Button
              variant="primary"
              leftIcon={<Save size={15} />}
              onClick={saveCountry}
              id="country-modal-save"
            >
              {countryModalMode === "add" ? "Add Country" : "Save Changes"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Name + Flag emoji */}
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Flag Emoji"
              value={countryForm.flagEmoji}
              onChange={(e) => setCountryForm((p) => ({ ...p, flagEmoji: e.target.value }))}
              id="country-flag"
              placeholder="🌍"
            />
            <div className="col-span-2">
              <Input
                label="Country Name"
                value={countryForm.name}
                onChange={(e) => setCountryForm((p) => ({ ...p, name: e.target.value }))}
                id="country-name"
                placeholder="e.g. New Zealand"
              />
            </div>
          </div>

          {/* Visa type + Continent */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Visa Type"
              value={countryForm.visaType}
              onChange={(e) => setCountryForm((p) => ({ ...p, visaType: e.target.value }))}
              id="country-visa-type"
              placeholder="e.g. Tourist Visa"
            />
            <Input
              label="Continent"
              value={countryForm.continent}
              onChange={(e) => setCountryForm((p) => ({ ...p, continent: e.target.value }))}
              id="country-continent"
              placeholder="e.g. Oceania"
            />
          </div>

          {/* Base price + Processing days + Difficulty */}
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Base Price (₹)"
              type="number"
              value={countryForm.basePrice}
              onChange={(e) => setCountryForm((p) => ({ ...p, basePrice: e.target.value }))}
              id="country-price"
              placeholder="150"
            />
            <Input
              label="Processing Days"
              value={countryForm.processingDays}
              onChange={(e) => setCountryForm((p) => ({ ...p, processingDays: e.target.value }))}
              id="country-processing"
              placeholder="5-10"
            />
            <Select
              label="Difficulty"
              value={countryForm.difficulty}
              onChange={(e) => setCountryForm((p) => ({ ...p, difficulty: e.target.value }))}
              options={[
                { value: "easy", label: "Easy" },
                { value: "moderate", label: "Moderate" },
                { value: "hard", label: "Hard" },
              ]}
              id="country-difficulty"
            />
          </div>

          {/* Image & Description */}
          <div>
            <label className="text-sm font-medium text-text-secondary mb-2 block">
              Display Image
            </label>
            <div
              className={`
                relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
                ${isDragging ? "border-cyan bg-cyan/5" : "border-border hover:border-cyan/50 hover:bg-surface-2"}
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {countryForm.imageUrl ? (
                <div className="relative group mx-auto w-full max-w-[240px] rounded-lg overflow-hidden border border-border shadow-sm">
                  <img src={countryForm.imageUrl} alt="Preview" className="w-full h-32 object-cover" />
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-semibold text-text-primary px-3 py-1.5 bg-surface-2 rounded-lg cursor-pointer flex items-center gap-2 border border-border hover:border-cyan/50">
                      <ImageIcon size={14} /> Change Image
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 cursor-pointer">
                  <div className="w-12 h-12 rounded-full bg-surface-3 flex items-center justify-center">
                    <UploadCloud size={24} className="text-text-muted transition-colors group-hover:text-cyan" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">Click to upload or drag and drop</p>
                    <p className="text-xs text-text-muted mt-1">SVG, PNG, JPG or GIF (max. 5MB)</p>
                  </div>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
                id="country-image-upload"
              />
            </div>
          </div>
          <Input
            label="Short Description"
            value={countryForm.description}
            onChange={(e) => setCountryForm((p) => ({ ...p, description: e.target.value }))}
            id="country-description"
            placeholder="Brief description of the destination..."
          />

          {/* Requirements — dynamic list (JSON Schema approach) */}
          <div>
            <label className="text-sm font-medium text-text-secondary mb-2 block">
              Visa Requirements
            </label>
            <div className="space-y-2">
              {countryForm.requirements.map((req, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    value={req}
                    onChange={(e) => updateRequirement(index, e.target.value)}
                    placeholder={`Requirement ${index + 1}`}
                    className="flex-1 bg-surface-2 border border-border text-text-primary text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan placeholder-text-muted"
                    id={`requirement-${index}`}
                  />
                  <button
                    onClick={() => removeRequirement(index)}
                    className="p-2 rounded-xl hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                    aria-label={`Remove requirement ${index + 1}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={addRequirement}
                id="add-requirement-btn"
              >
                Add Requirement
              </Button>
            </div>
            <p className="text-xs text-text-muted mt-2">
              Requirements are stored as a JSON array in MongoDB and used to auto-generate the application form.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;
