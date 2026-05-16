import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  PlusCircle, Clock, CheckCircle, FileText, ChevronRight, Calendar, Search, Filter,
  TrendingUp, Globe, ArrowLeft, User, Mail, Smartphone, Download,
  CreditCard, Image as ImageIcon, ShieldCheck, Plane, Building2,
  Briefcase, Banknote, GraduationCap, Stethoscope, Stamp, Receipt,
  Home, Car, MapPin, ScrollText, HeartHandshake,
} from "lucide-react";
import { StatusBadge } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { motion } from "framer-motion";
import Sidebar from "../components/layout/Sidebar";
import { api, useAuthStore, SERVER_URL } from "../store/authStore";
import { useDataStore } from "../store/dataStore";
import { useUIStore } from "../store/uiStore";
import { getApplicationProgress, DOCUMENT_LABELS } from "../utils/applicationProgress";
import ContactVerificationModal from "../components/account/ContactVerificationModal";
import { needsPhoneContactGate, needsEmailContactGate } from "../utils/contactVerificationGate";

/**
 * Map every built-in doc key → its lucide icon component. Used to render the
 * tiny "missing documents" icon chips on each booking card. Unknown keys
 * (custom admin-added docs) fall back to a generic FileText icon.
 */
const DOCUMENT_ICONS = {
  passport: FileText,
  oldPassport: FileText,
  photo: ImageIcon,
  idCard: CreditCard,
  panCard: CreditCard,
  drivingLicense: Car,
  birthCertificate: FileText,
  dobCertificate: FileText,
  marriageCertificate: HeartHandshake,
  educationCertificate: GraduationCap,
  employmentLetter: Briefcase,
  offerLetter: Briefcase,
  salarySlip: Receipt,
  form16: Receipt,
  taxReturn: Receipt,
  bankStatement: Banknote,
  bankCertificate: Banknote,
  propertyDocuments: Home,
  travelInsurance: ShieldCheck,
  healthInsurance: ShieldCheck,
  flightTicket: Plane,
  hotelBooking: Building2,
  itinerary: MapPin,
  coverLetter: FileText,
  invitationLetter: FileText,
  sponsorLetter: FileText,
  policeClearance: ScrollText,
  noObjectionCertificate: ScrollText,
  yellowFever: Stethoscope,
  covidVaccination: Stethoscope,
  visaApplicationForm: Stamp,
  businessLicense: Briefcase,
  companyRegistration: Briefcase,
};
const getDocumentIcon = (key) => DOCUMENT_ICONS[key] || FileText;

const fmtDate = (iso) => {
  if (!iso) return "N/A";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "N/A"
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const UserDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, sessionAuthMethod } = useAuthStore();
  const { bookings, fetchUserApplications } = useDataStore();
  const { showToast } = useUIStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [dashContactOpen, setDashContactOpen] = useState(false);
  const [dashContactMode, setDashContactMode] = useState("phone");
  const [uploadSettings, setUploadSettings] = useState({
    enableGDriveUpload: true,
    enableFileUpload: true,
  });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/config/upload-settings");
        if (data?.success && data.config) {
          setUploadSettings(data.config);
        }
        await fetchUserApplications();
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user) loadData();
    else setLoading(false);
  }, [user, fetchUserApplications]);

  useEffect(() => {
    if (loading || !user) return;
    if (sessionStorage.getItem("vb_skip_contact_prompt") === "1") return;
    if (!localStorage.getItem("token")) return;
    const method = sessionAuthMethod ?? useAuthStore.getState().sessionAuthMethod;
    if (needsPhoneContactGate(method, user)) {
      setDashContactMode("phone");
      setDashContactOpen(true);
      return;
    }
    if (needsEmailContactGate(method, user)) {
      setDashContactMode("email");
      setDashContactOpen(true);
    }
  }, [user, loading, sessionAuthMethod]);

  useEffect(() => {
    const paymentState = searchParams.get("payment");
    if (!paymentState && searchParams.get("paid") !== "1") return;

    (async () => {
      try {
        await fetchUserApplications();
      } catch (e) {
        console.error(e);
      }
    })();

    if (paymentState === "success" || searchParams.get("paid") === "1") {
      showToast("Payment received. Your application is now in the dashboard.", "success");
    } else if (paymentState === "cancelled") {
      showToast("Payment was cancelled. Your application draft is saved and waiting for payment.", "info");
    } else if (paymentState === "failed") {
      showToast("Payment failed. Your application draft is saved and you can retry from the dashboard.", "error");
    }

    navigate("/dashboard", { replace: true });
  }, [searchParams, navigate, showToast, fetchUserApplications]);

  const safeBookings = Array.isArray(bookings)
    ? bookings.filter((booking) => booking && typeof booking === "object")
    : [];

  const filteredBookings = safeBookings.filter((booking) => {
    const q = searchQuery.toLowerCase();
    const countryName = String(booking.countryName || "").toLowerCase();
    const matchSearch = countryName.includes(q);
    const matchStatus = statusFilter === "all" || booking.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: safeBookings.length,
    approved: safeBookings.filter((b) => b.status === "approved").length,
    pending: safeBookings.filter((b) => b.status === "pending" || b.paymentStatus === "pending_payment").length,
    review: safeBookings.filter((b) => b.status === "review").length,
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
      <Sidebar />

      <main className="flex-1 overflow-auto min-w-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
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
                <p className="text-text-secondary mt-1">
                  Here&apos;s an overview of your visa applications.
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
                  onClick={() => navigate("/#destinations")}
                  id="new-application-btn"
                >
                  New Application
                </Button>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="mb-8 rounded-2xl border border-border bg-surface p-5 sm:p-6"
          >
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
              Your account
            </h2>
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="flex gap-3 min-w-0">
                <Mail className="text-cyan shrink-0 mt-0.5" size={18} aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs text-text-muted">Email</p>
                  <p className="text-sm font-medium text-text-primary break-all">
                    {user?.email || "—"}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 min-w-0">
                <Smartphone className="text-cyan shrink-0 mt-0.5" size={18} aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs text-text-muted">Phone</p>
                  <p className="text-sm font-medium text-text-primary">
                    {user?.phone || "—"}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Applications", value: stats.total, icon: FileText, color: "text-cyan", bg: "bg-cyan/10" },
              { label: "Approved", value: stats.approved, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { label: "Under Review", value: stats.review, icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/10" },
              { label: "Pending Action", value: stats.pending, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
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

          <div>
            <div className="mb-8">
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <h2 className="text-lg font-semibold text-text-primary flex-1">Received Visa Files</h2>
              </div>
              <div className="space-y-3">
                {safeBookings.filter((booking) => booking.visaFilePath).length === 0 ? (
                  <Card className="text-sm text-text-muted">
                    Approved visa files sent by admin will appear here.
                  </Card>
                ) : (
                  safeBookings
                    .filter((booking) => Boolean(booking?.visaFilePath))
                    .map((booking) => (
                      <Card key={`visa-file-${booking._id || booking.id}`} className="flex flex-wrap items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 flex-shrink-0">
                          <FileText size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-text-primary">
                            {booking.countryName || "Visa File"}
                          </p>
                          <p className="text-xs text-text-muted break-all">
                            {booking.visaFileName || booking.visaFilePath.split("/").pop()}
                          </p>
                          {booking.visaFileUploadedAt && (
                            <p className="text-xs text-text-muted mt-1">
                              Sent on {fmtDate(booking.visaFileUploadedAt)}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<Download size={14} />}
                          onClick={() => window.open(`${SERVER_URL}${booking.visaFilePath}`, "_blank")}
                        >
                          Open File
                        </Button>
                      </Card>
                    ))
                )}
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <h2 className="text-lg font-semibold text-text-primary flex-1">My Applications</h2>

                <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-xl px-3 py-2">
                  <Search size={14} className="text-text-muted" />
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="Search country..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none w-32"
                    aria-label="Search applications"
                    id="dashboard-search"
                  />
                </div>

                <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-xl px-3 py-2">
                  <Filter size={14} className="text-text-muted" />
                  <select
                    autoComplete="off"
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

              <div className="space-y-3">
                {filteredBookings.length === 0 ? (
                  <Card className="text-center py-12">
                    <Globe size={40} className="text-text-muted mx-auto mb-3" />
                    <p className="text-text-secondary">No applications found.</p>
                    <Button
                      variant="primary"
                      size="sm"
                      className="mt-4"
                      onClick={() => navigate("/#destinations")}
                    >
                      Start New Application
                    </Button>
                  </Card>
                ) : (
                  filteredBookings.map((booking, i) => {
                    const progress = getApplicationProgress(booking, uploadSettings);
                    const nextPendingTraveler = progress.missingByTraveler.find((item) => item.missingLabels.length);
                    const paymentLabel =
                      booking.paymentStatus === "completed"
                        ? "Paid"
                        : booking.paymentStatus === "failed"
                          ? "Payment failed"
                          : booking.paymentStatus === "cancelled"
                            ? "Payment cancelled"
                            : "Payment pending";
                    const paymentClass =
                      booking.paymentStatus === "completed"
                        ? "text-emerald-400 border-emerald-500/30"
                        : booking.paymentStatus === "failed"
                          ? "text-red-400 border-red-500/30"
                          : booking.paymentStatus === "cancelled"
                            ? "text-zinc-300 border-zinc-500/30"
                            : "text-amber-400 border-amber-500/30";

                    return (
                      <motion.div
                        key={booking._id || booking.id || i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                      >
                        <Card
                          hoverable
                          padding="sm"
                          className="flex items-start sm:items-center gap-3 sm:gap-4"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/application/${booking._id || booking.id}`);
                          }}
                        >
                          <div className="w-12 h-12 rounded-xl bg-surface-3 flex items-center justify-center text-2xl flex-shrink-0 mt-0.5 sm:mt-0">
                            {booking.flagEmoji || "🛂"}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="font-semibold text-text-primary truncate">
                                {booking.countryName || "Unknown Country"}
                              </h3>
                              <StatusBadge status={booking.status || "pending"} />
                              <span className={`hidden sm:inline-block text-2xs font-medium rounded-full px-2 py-0.5 border ${paymentClass}`}>
                                {paymentLabel}
                              </span>
                              {booking.detailsPending && (
                                <span className="hidden sm:inline-block text-2xs font-medium text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5">
                                  Complete details
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-text-muted">{booking.visaType || "Visa Application"}</p>
                            
                            {/* Simplified pending message for mobile */}
                            <div className="sm:hidden mt-1 space-y-0.5">
                              {!progress.allDocumentsUploaded && (
                                <p className="text-[10px] font-medium text-amber-500">
                                  {progress.totalMissingDocuments} document{progress.totalMissingDocuments === 1 ? "" : "s"} missing
                                </p>
                              )}
                              {booking.detailsPending && (
                                <p className="text-[10px] font-medium text-amber-500">
                                  Complete details required
                                </p>
                              )}
                            </div>
                            
                            {/* Detailed info hidden on mobile for a cleaner look */}
                            <div className="hidden sm:block">
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="flex items-center gap-1 text-xs text-text-muted">
                                  <Calendar size={11} />
                                  Applied: {fmtDate(booking.createdAt)}
                                </span>
                                <span className="flex items-center gap-1 text-xs text-text-muted">
                                  ✈️ Travel: {fmtDate(booking.travelDate)}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className={`text-xs font-medium ${progress.allDocumentsUploaded ? "text-emerald-400" : "text-amber-400"}`}>
                                  {progress.allDocumentsUploaded
                                    ? "All required documents uploaded"
                                    : `${progress.totalMissingDocuments} document${progress.totalMissingDocuments === 1 ? "" : "s"} missing`}
                                </span>
                                {booking.visaFilePath && (
                                  <span className="text-xs text-emerald-400">
                                    Visa file received
                                  </span>
                                )}
                                {!progress.allDocumentsUploaded && nextPendingTraveler && (
                                  <div className="flex items-center gap-2 text-xs text-text-muted min-w-0">
                                    <span className="shrink-0">{nextPendingTraveler.travelerName}:</span>
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {nextPendingTraveler.missingKeys?.length ? (
                                        nextPendingTraveler.missingKeys.slice(0, 5).map((key) => {
                                          const Icon = getDocumentIcon(key);
                                          const label = DOCUMENT_LABELS[key] || key;
                                          return (
                                            <span
                                              key={key}
                                              title={label}
                                              aria-label={label}
                                              className="h-5 w-5 inline-flex items-center justify-center rounded-md bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
                                            >
                                              <Icon size={11} strokeWidth={2} />
                                            </span>
                                          );
                                        })
                                      ) : (
                                        <span className="truncate">
                                          {nextPendingTraveler.missingLabels.slice(0, 2).join(", ")}
                                        </span>
                                      )}
                                      {nextPendingTraveler.missingKeys?.length > 5 && (
                                        <span className="text-[11px] text-amber-400">
                                          +{nextPendingTraveler.missingKeys.length - 5}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0 self-start sm:self-center">
                            <div className="text-sm font-bold text-text-primary">
                              ₹{Number(booking.fee || 0).toLocaleString("en-IN")}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/dashboard/application/${booking._id || booking.id}`);
                              }}
                              className="mt-1 flex items-center gap-1 text-xs text-cyan hover:text-cyan-dim transition-colors ml-auto"
                            >
                              View Details <ChevronRight size={12} />
                            </button>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <ContactVerificationModal
        isOpen={dashContactOpen}
        mode={dashContactMode}
        allowSkip
        onSkip={() => {
          sessionStorage.setItem("vb_skip_contact_prompt", "1");
          setDashContactOpen(false);
        }}
        onClose={() => setDashContactOpen(false)}
        onCompleted={() => setDashContactOpen(false)}
      />
    </div>
  );
};

export default UserDashboard;
