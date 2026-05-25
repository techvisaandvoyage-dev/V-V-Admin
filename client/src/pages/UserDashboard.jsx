import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  PlusCircle, Clock, CheckCircle, FileText, ChevronRight, Calendar, Search, Filter,
  TrendingUp, Globe, ArrowLeft, User, Mail, Smartphone, Download, Users, Star, Pencil, Trash2, ShieldCheck,
  Upload, ExternalLink,
} from "lucide-react";
import { StatusBadge } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Modal from "../components/ui/Modal";
import { motion } from "framer-motion";
import Sidebar from "../components/layout/Sidebar";
import { api, useAuthStore, SERVER_URL } from "../store/authStore";
import { useDataStore } from "../store/dataStore";
import { useUIStore } from "../store/uiStore";
import { getApplicationProgress, getDerivedApplicationProgress, resolveApplicationStatus } from "../utils/applicationProgress";
import ContactVerificationModal from "../components/account/ContactVerificationModal";
import { needsPhoneContactGate, needsEmailContactGate } from "../utils/contactVerificationGate";
import { formatOrdinalDate } from "../utils/dateUtils";

/**
 * Map every built-in doc key → its lucide icon component. Used to render the
 * tiny "missing documents" icon chips on each booking card. Unknown keys
 * (custom admin-added docs) fall back to a generic FileText icon.
 */
const fmtDate = (iso) => {
  if (!iso) return "N/A";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "N/A"
    : formatOrdinalDate(d);
};

const travelerFormDefaults = {
  fullName: "",
  dateOfBirth: "",
  gender: "",
  passportNumber: "",
  passportExpiryDate: "",
  nationality: "",
  mobileNumber: "",
  email: "",
  relationship: "Self",
  isDefault: false,
};

const getApplicationDocSuccessStorageKey = (applicationId) =>
  applicationId ? `application-doc-successes:${applicationId}` : "";

const getStoredUploadSuccesses = (booking) => {
  const applicationId = String(booking?._id || booking?.id || "");
  if (!applicationId) return {};

  try {
    const raw = localStorage.getItem(getApplicationDocSuccessStorageKey(applicationId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
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
    showTravelerDetails: true,
  });
  const [requiredDocsByCountry, setRequiredDocsByCountry] = useState({});
  const [travelers, setTravelers] = useState([]);
  const [travelersLoading, setTravelersLoading] = useState(true);
  const [travelerModalOpen, setTravelerModalOpen] = useState(false);
  const [editingTravelerId, setEditingTravelerId] = useState("");
  const [travelerForm, setTravelerForm] = useState({ ...travelerFormDefaults });
  const [travelerSubmitting, setTravelerSubmitting] = useState(false);
  const [travelerDeletingId, setTravelerDeletingId] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setTravelersLoading(true);
      try {
        const { data: configData } = await api.get("/config/upload-settings");
        if (configData?.success && configData.config) {
          setUploadSettings(configData.config);
        }
        const shouldShowTravelerDetails = configData?.config?.showTravelerDetails !== false;
        if (shouldShowTravelerDetails) {
          const travelersRes = await api.get("/travelers");
          setTravelers(Array.isArray(travelersRes?.data?.travelers) ? travelersRes.data.travelers : []);
        } else {
          setTravelers([]);
        }
        await fetchUserApplications();
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
        setTravelersLoading(false);
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

  useEffect(() => {
    const countryIdsToLoad = Array.from(
      new Set(
        (Array.isArray(bookings) ? bookings : [])
          .filter((booking) => booking && typeof booking === "object")
          .filter((booking) => !Array.isArray(booking.requiredDocuments) || !booking.requiredDocuments.length)
          .map((booking) => String(booking.countryId || "").trim())
          .filter(Boolean)
      )
    ).filter((countryId) => !requiredDocsByCountry[countryId]);

    if (!countryIdsToLoad.length) return;

    let cancelled = false;

    const loadCountryRequirements = async () => {
      const entries = await Promise.all(
        countryIdsToLoad.map(async (countryId) => {
          try {
            const { data } = await api.get(`/countries/${countryId}`);
            const docs = Array.isArray(data?.country?.requiredDocuments)
              ? data.country.requiredDocuments.filter(Boolean)
              : [];
            return [countryId, docs];
          } catch (error) {
            console.error(`Failed to load required documents for ${countryId}:`, error);
            return [countryId, []];
          }
        })
      );

      if (cancelled) return;

      setRequiredDocsByCountry((prev) => {
        const next = { ...prev };
        entries.forEach(([countryId, docs]) => {
          next[countryId] = docs;
        });
        return next;
      });
    };

    loadCountryRequirements();

    return () => {
      cancelled = true;
    };
  }, [bookings, requiredDocsByCountry]);

  const safeBookings = Array.isArray(bookings)
    ? bookings.filter((booking) => booking && typeof booking === "object")
    : [];

  const getBookingRequiredDocuments = (booking) => {
    if (Array.isArray(booking?.requiredDocuments) && booking.requiredDocuments.length) {
      return booking.requiredDocuments;
    }
    const countryId = String(booking?.countryId || "").trim();
    if (countryId && Array.isArray(requiredDocsByCountry[countryId]) && requiredDocsByCountry[countryId].length) {
      return requiredDocsByCountry[countryId];
    }
    return undefined;
  };

  const filteredBookings = safeBookings.filter((booking) => {
    const q = searchQuery.toLowerCase();
    const countryName = String(booking.countryName || "").toLowerCase();
    const professionalId = String(booking.applicationId || "").toLowerCase();
    const matchSearch = countryName.includes(q) || professionalId.includes(q);
    const uploadedDocSuccesses = getStoredUploadSuccesses(booking);
    const derivedProgress = getDerivedApplicationProgress(
      booking,
      getBookingRequiredDocuments(booking),
      uploadSettings,
      uploadedDocSuccesses
    );
    const resolvedStatus = resolveApplicationStatus(booking, derivedProgress);
    const matchStatus = statusFilter === "all" || resolvedStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: safeBookings.length,
    approved: safeBookings.filter((b) => b.status === "approved").length,
    pending: safeBookings.filter((b) => {
      const uploadedDocSuccesses = getStoredUploadSuccesses(b);
      const derivedProgress = getDerivedApplicationProgress(
        b,
        getBookingRequiredDocuments(b),
        uploadSettings,
        uploadedDocSuccesses
      );
      const resolvedStatus = resolveApplicationStatus(b, derivedProgress);
      return resolvedStatus === "pending" || resolvedStatus === "doc_pending" || resolvedStatus === "drive_link_pending";
    }).length,
    review: safeBookings.filter((b) => {
      const uploadedDocSuccesses = getStoredUploadSuccesses(b);
      const derivedProgress = getDerivedApplicationProgress(
        b,
        getBookingRequiredDocuments(b),
        uploadSettings,
        uploadedDocSuccesses
      );
      return resolveApplicationStatus(b, derivedProgress) === "review";
    }).length,
  };

  const openTravelerModal = (traveler = null) => {
    setEditingTravelerId(traveler?._id || "");
    setTravelerForm(
      traveler
        ? {
            fullName: traveler.fullName || "",
            dateOfBirth: traveler.dateOfBirth ? String(traveler.dateOfBirth).slice(0, 10) : "",
            gender: traveler.gender || "",
            passportNumber: traveler.passportNumber || "",
            passportExpiryDate: traveler.passportExpiryDate ? String(traveler.passportExpiryDate).slice(0, 10) : "",
            nationality: traveler.nationality || "",
            mobileNumber: traveler.mobileNumber || "",
            email: traveler.email || "",
            relationship: traveler.relationship || "Self",
            isDefault: traveler.isDefault === true,
          }
        : { ...travelerFormDefaults }
    );
    setTravelerModalOpen(true);
  };

  const closeTravelerModal = () => {
    setTravelerModalOpen(false);
    setEditingTravelerId("");
    setTravelerForm({ ...travelerFormDefaults });
    setTravelerSubmitting(false);
  };

  const refreshTravelers = async () => {
    if (uploadSettings.showTravelerDetails === false) {
      setTravelers([]);
      return;
    }
    const { data } = await api.get("/travelers");
    setTravelers(Array.isArray(data?.travelers) ? data.travelers : []);
  };

  const handleTravelerSubmit = async () => {
    const requiredFields = [
      ["fullName", "Traveler full name is required"],
      ["dateOfBirth", "Traveler date of birth is required"],
      ["gender", "Traveler gender is required"],
      ["passportNumber", "Traveler passport number is required"],
      ["passportExpiryDate", "Traveler passport expiry date is required"],
      ["nationality", "Traveler nationality is required"],
      ["mobileNumber", "Traveler mobile number is required"],
      ["email", "Traveler email is required"],
      ["relationship", "Traveler relationship is required"],
    ];

    for (const [key, message] of requiredFields) {
      if (!String(travelerForm[key] || "").trim()) {
        showToast(message, "error");
        return;
      }
    }

    setTravelerSubmitting(true);
    try {
      const payload = {
        ...travelerForm,
        passportNumber: String(travelerForm.passportNumber || "").toUpperCase(),
      };
      if (editingTravelerId) {
        await api.put(`/travelers/${editingTravelerId}`, payload);
        showToast("Traveler updated successfully.", "success");
      } else {
        await api.post("/travelers", payload);
        showToast("Traveler saved successfully.", "success");
      }
      await refreshTravelers();
      closeTravelerModal();
    } catch (error) {
      showToast(error.response?.data?.message || "Could not save traveler.", "error");
      setTravelerSubmitting(false);
    }
  };

  const handleDeleteTraveler = async (travelerId) => {
    setTravelerDeletingId(travelerId);
    try {
      await api.delete(`/travelers/${travelerId}`);
      await refreshTravelers();
      showToast("Traveler removed successfully.", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Could not delete traveler.", "error");
    } finally {
      setTravelerDeletingId("");
    }
  };

  const handleSetDefaultTraveler = async (travelerId) => {
    try {
      await api.patch(`/travelers/${travelerId}/default`);
      await refreshTravelers();
      showToast("Default traveler updated.", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Could not update default traveler.", "error");
    }
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
              onClick={() => navigate("/", { replace: true })}
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
                  onClick={() => navigate("/", { replace: true })}
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

          {uploadSettings.showTravelerDetails !== false && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="mb-8 rounded-3xl border border-border bg-surface p-5 sm:p-6"
            >
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">My Travelers</h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Save traveler details once and reuse them in future visa applications.
                  </p>
                </div>
                <Button variant="primary" leftIcon={<PlusCircle size={16} />} onClick={() => openTravelerModal()}>
                  Add Traveler
                </Button>
              </div>

              {travelersLoading ? (
                <Card className="flex items-center justify-center gap-3 py-8 text-text-secondary">
                  <div className="h-5 w-5 rounded-full border-2 border-cyan/20 border-t-cyan animate-spin" />
                  Loading saved travelers...
                </Card>
              ) : travelers.length === 0 ? (
                <Card className="border-dashed text-center py-10">
                  <Users size={38} className="mx-auto mb-3 text-cyan" />
                  <p className="text-base font-semibold text-text-primary">No traveler profiles saved yet</p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Add yourself, family members, or friends here so future applications start faster.
                  </p>
                  <Button variant="secondary" className="mt-4" onClick={() => openTravelerModal()}>
                    Create First Traveler
                  </Button>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {travelers.map((traveler) => (
                    <Card key={traveler._id} className="relative overflow-hidden">
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan via-blue-500 to-emerald-400" />
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-text-primary">{traveler.fullName}</h3>
                            {traveler.isDefault && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                                <Star size={12} /> Default
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-text-secondary">{traveler.relationship}</p>
                        </div>
                        <span className="rounded-2xl bg-cyan/10 p-2 text-cyan">
                          <ShieldCheck size={18} />
                        </span>
                      </div>

                      <div className="space-y-2 text-sm text-text-secondary">
                        <p><span className="text-text-primary font-medium">Passport:</span> {traveler.passportNumber}</p>
                        <p><span className="text-text-primary font-medium">Expiry:</span> {fmtDate(traveler.passportExpiryDate)}</p>
                        <p><span className="text-text-primary font-medium">Nationality:</span> {traveler.nationality}</p>
                        <p className="break-all"><span className="text-text-primary font-medium">Email:</span> {traveler.email}</p>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {!traveler.isDefault && (
                          <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={<Star size={14} />}
                            onClick={() => handleSetDefaultTraveler(traveler._id)}
                          >
                            Set Default
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<Pencil size={14} />}
                          onClick={() => openTravelerModal(traveler)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Trash2 size={14} />}
                          onClick={() => handleDeleteTraveler(traveler._id)}
                          disabled={travelerDeletingId === traveler._id}
                          className="text-red-400 hover:text-red-300"
                        >
                          {travelerDeletingId === traveler._id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </motion.div>
          )}

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
                    <option value="doc_pending">Doc Pending</option>
                    <option value="drive_link_pending">Upload Drive Link</option>
                    <option value="review">Under Review</option>
                    <option value="approved">Approved</option>
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
                      onClick={() => navigate("/", { replace: true })}
                    >
                      Start New Application
                    </Button>
                  </Card>
                ) : (
                  filteredBookings.map((booking, i) => {
                    const progress = getApplicationProgress(booking, uploadSettings);
                    const uploadedDocSuccesses = getStoredUploadSuccesses(booking);
                    const derivedProgress = getDerivedApplicationProgress(
                      booking,
                      getBookingRequiredDocuments(booking),
                      uploadSettings,
                      uploadedDocSuccesses
                    );
                    const resolvedStatus = resolveApplicationStatus(booking, derivedProgress);
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
                              <StatusBadge status={resolvedStatus} />
                              <span className={`hidden sm:inline-block text-2xs font-medium rounded-full px-2 py-0.5 border ${paymentClass}`}>
                                {paymentLabel}
                              </span>
                            </div>
                            <p className="text-[11px] font-mono text-text-muted mb-1">
                              Application ID: {booking.applicationId || booking._id || booking.id}
                            </p>
                            <p className="text-xs text-text-muted">{booking.visaType || "Visa Application"}</p>
                            
                            <div>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="flex items-center gap-1 text-xs text-text-muted">
                                  <Calendar size={11} />
                                  Applied: {fmtDate(booking.createdAt)}
                                </span>
                                <span className="hidden sm:flex items-center gap-1 text-xs text-text-muted">
                                  ✈️ Travel: {fmtDate(booking.travelDate)}
                                </span>
                              </div>
                              {booking.visaFilePath && (
                                <div className="mt-1.5">
                                  <span className="text-xs text-emerald-400">
                                    Visa file received
                                  </span>
                                </div>
                              )}
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {(() => {
                                  const travellers = Array.isArray(booking?.travellerDocuments) ? booking.travellerDocuments : [];
                                  const tc = Math.max(1, Number(booking?.travellerCount || 1));
                                  const hasPassport = travellers.some((entry) => {
                                    const docs = entry?.documents;
                                    if (!docs) return false;
                                    if (docs instanceof Map) return Boolean(docs.get("passport"));
                                    return Boolean(docs.passport);
                                  });
                                  const allPassports = tc > 0 && travellers.filter((entry) => {
                                    const docs = entry?.documents;
                                    if (!docs) return false;
                                    if (docs instanceof Map) return Boolean(docs.get("passport"));
                                    return Boolean(docs.passport);
                                  }).length >= tc;
                                  if (allPassports) {
                                    return (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                                        <CheckCircle size={11} /> Passport uploaded
                                      </span>
                                    );
                                  }
                                  if (hasPassport) {
                                    return (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
                                        <Upload size={11} /> Passport partial
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-text-muted">
                                      <Upload size={11} /> No passport
                                    </span>
                                  );
                                })()}
                                {(() => {
                                  const rootDrive = String(booking?.gdriveLink || "").trim();
                                  const travellers = Array.isArray(booking?.travellerDocuments) ? booking.travellerDocuments : [];
                                  const hasDrive = Boolean(rootDrive) || travellers.some((entry) => String(entry?.gdriveLink || "").trim());
                                  if (hasDrive) {
                                    return (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                                        <ExternalLink size={11} /> Drive link added
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-text-muted">
                                      <ExternalLink size={11} /> Drive link not added
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0 self-start sm:self-center">
                            <div className="group relative inline-flex flex-col items-end">
                              <div className="text-sm font-bold text-text-primary cursor-default">
                                ₹{Number(booking.totalAmount ?? booking.fee ?? 0).toLocaleString("en-IN")}
                              </div>
                              <div className="pointer-events-none invisible absolute right-0 top-full z-30 mt-2 w-64 translate-y-1 rounded-2xl border border-cyan/20 bg-surface px-3 py-3 text-left opacity-0 shadow-[0_18px_40px_-20px_rgba(0,212,255,0.28)] transition duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                                <div className="space-y-2 text-xs">
                                  <div className="flex items-center justify-between gap-3 text-text-secondary">
                                    <span>
                                      Government Fee
                                      {Number(booking.travellerCount || 1) > 1 ? ` x${Number(booking.travellerCount || 1)}` : ""}
                                    </span>
                                    <span className="font-semibold text-text-primary">
                                      ₹{Number(booking.governmentFeeTotal || 0).toLocaleString("en-IN")}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3 text-text-secondary">
                                    <span>
                                      Our Service Fee
                                      {Number(booking.travellerCount || 1) > 1 ? ` x${Number(booking.travellerCount || 1)}` : ""}
                                    </span>
                                    <span className="font-semibold text-text-primary">
                                      ₹{Number(booking.serviceFeeTotal || 0).toLocaleString("en-IN")}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3 text-text-secondary">
                                    <span>GST</span>
                                    <span className="font-semibold text-text-primary">
                                      ₹{Number(booking.gstAmount || 0).toLocaleString("en-IN")}
                                    </span>
                                  </div>
                                  <div className="border-t border-border pt-2">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="font-semibold text-text-primary">Total Amount</span>
                                      <span className="font-bold text-cyan">
                                        ₹{Number(booking.totalAmount ?? booking.fee ?? 0).toLocaleString("en-IN")}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
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

      <Modal
        isOpen={travelerModalOpen}
        onClose={closeTravelerModal}
        title={editingTravelerId ? "Edit Traveler" : "Add Traveler"}
        size="lg"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={closeTravelerModal}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleTravelerSubmit} disabled={travelerSubmitting}>
              {travelerSubmitting ? "Saving..." : editingTravelerId ? "Save Changes" : "Save Traveler"}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs text-text-muted">Full Name</label>
            <input
              type="text"
              value={travelerForm.fullName}
              onChange={(e) => setTravelerForm((prev) => ({ ...prev, fullName: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-text-muted">Date of Birth</label>
            <input
              type="date"
              value={travelerForm.dateOfBirth}
              onChange={(e) => setTravelerForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-text-muted">Gender</label>
            <select
              value={travelerForm.gender}
              onChange={(e) => setTravelerForm((prev) => ({ ...prev, gender: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-text-muted">Passport Number</label>
            <input
              type="text"
              value={travelerForm.passportNumber}
              onChange={(e) => setTravelerForm((prev) => ({ ...prev, passportNumber: e.target.value.toUpperCase() }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-text-muted">Passport Expiry Date</label>
            <input
              type="date"
              value={travelerForm.passportExpiryDate}
              onChange={(e) => setTravelerForm((prev) => ({ ...prev, passportExpiryDate: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-text-muted">Nationality</label>
            <input
              type="text"
              value={travelerForm.nationality}
              onChange={(e) => setTravelerForm((prev) => ({ ...prev, nationality: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-text-muted">Relationship</label>
            <select
              value={travelerForm.relationship}
              onChange={(e) => setTravelerForm((prev) => ({ ...prev, relationship: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
            >
              <option value="Self">Self</option>
              <option value="Family member">Family member</option>
              <option value="Friend/Other">Friend/Other</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-text-muted">Mobile Number</label>
            <input
              type="text"
              value={travelerForm.mobileNumber}
              onChange={(e) => setTravelerForm((prev) => ({ ...prev, mobileNumber: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs text-text-muted">Email</label>
            <input
              type="email"
              value={travelerForm.email}
              onChange={(e) => setTravelerForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
            />
          </div>
          <label className="sm:col-span-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={travelerForm.isDefault}
              onChange={(e) => setTravelerForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
              className="h-4 w-4 rounded border-border text-cyan focus:ring-cyan/40"
            />
            Set as my default traveler
          </label>
        </div>
      </Modal>
    </div>
  );
};

export default UserDashboard;
