// ============================================================
//  Admin Dashboard Page
//  Sections:
//  1. Analytics overview (4 stat cards + Recharts line chart)
//  2. Applications management table (search, filter, status update)
//  3. Country Manager (add/edit countries via modal)
// ============================================================
import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  BarChart2, TrendingUp, DollarSign, Clock, CheckCircle,
  Search, Filter, ChevronDown, Plus, Edit3,
  MapPin, Globe, Users, FileText, X, Save, AlertCircle, UploadCloud, Image as ImageIcon, Settings, CreditCard, IndianRupee, Sliders, HelpCircle,
  ExternalLink, GalleryVertical,
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
import Input, { Select, Textarea } from "../components/ui/Input";
import StaticPagesManager from "../components/cms/StaticPagesManager";
import { useUIStore } from "../store/uiStore";
import { useDataStore } from "../store/dataStore";
import { useAuthStore, api, SERVER_URL } from "../store/authStore";
import { ANALYTICS, MONTHLY_REVENUE } from "../data/bookings";
import { getCountrySearchHint, matchesCountrySearch } from "../utils/countrySearch";
import { getApplicationProgress } from "../utils/applicationProgress";

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

/** Resolve `Country.imageUrl` for `<img src>` (https vs relative upload path). */
const resolveCountryBannerSrc = (imageUrl) => {
  const u = String(imageUrl || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  const base = SERVER_URL.replace(/\/+$/, "");
  return `${base}${u.startsWith("/") ? u : `/${u}`}`;
};

const bannerSourceLabel = (imageUrl) => {
  const u = String(imageUrl || "");
  if (/unsplash\.com/i.test(u)) return "Unsplash";
  if (u.startsWith("/uploads/") || /\/uploads\//i.test(u)) return "Upload";
  return "Other URL";
};

/** One integration block: title, hints, fields, and its own Save button. */
const SettingsSectionCard = ({
  title,
  description,
  whereToFind,
  children,
  saveLabel,
  onSave,
  isSaving,
  saveButtonId,
  statusSlot,
}) => (
  <Card>
    <div className="mb-5 space-y-3">
      <div>
        <h2 className="font-semibold text-text-primary text-base">{title}</h2>
        {description ? (
          <p className="text-sm text-text-muted mt-1.5 leading-relaxed">{description}</p>
        ) : null}
      </div>
      {whereToFind ? (
        <div className="rounded-lg border border-border bg-surface-2/60 px-3 py-2.5 text-xs text-text-muted leading-relaxed">
          <span className="text-text-primary font-semibold">Where to get these values: </span>
          {whereToFind}
        </div>
      ) : null}
      {statusSlot}
    </div>
    <div className="space-y-4">{children}</div>
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-6 pt-4 border-t border-border">
      <p className="text-[11px] text-text-muted order-2 sm:order-1">
        Only this section is saved — other sections are unchanged.
      </p>
      <Button
        variant="primary"
        size="sm"
        className="order-1 sm:order-2 shrink-0"
        leftIcon={<Save size={15} />}
        loading={isSaving}
        onClick={onSave}
        id={saveButtonId}
      >
        {saveLabel}
      </Button>
    </div>
  </Card>
);

/** Defaults match client destination page — used until admin saves custom copy. */
const DESTINATION_PAGE_DEFAULT_INCLUDED = [
  "Application form guidance",
  "Document checklist and validation",
  "End-to-end support till submission",
];

const DESTINATION_PAGE_DEFAULT_FAQS = [
  {
    question: "How long does processing take?",
    answer:
      "Typical processing varies by destination — each country page lists estimated timelines based on current embassy guidance.",
  },
  {
    question: "Can I track my application?",
    answer: "Yes, you can track status updates from your user dashboard after applying.",
  },
  {
    question: "Is this fee refundable?",
    answer: "Government and service fees depend on visa policy and review stage.",
  },
];

const mapDestinationIncludedFromApi = (s) => {
  const a = s?.destinationIncludedItems;
  return Array.isArray(a) && a.length
    ? a.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [...DESTINATION_PAGE_DEFAULT_INCLUDED];
};

const mapDestinationFaqsFromApi = (s) => {
  const a = s?.destinationFaqs;
  if (Array.isArray(a) && a.length) {
    return a.map((f) => ({
      question: String(f?.question ?? "").trim(),
      answer: String(f?.answer ?? "").trim(),
    }));
  }
  return DESTINATION_PAGE_DEFAULT_FAQS.map((f) => ({ ...f }));
};

/** Map `/admin/settings` API document to the dashboard settings form (GET + PUT). */
const mapApiSettingsToFormState = (s) => ({
  razorpayKeyId: s.razorpayKeyId || "",
  razorpayKeySecret: s.razorpayKeySecret || "",
  firebaseApiKey: s.firebaseApiKey || "",
  firebaseAuthDomain: s.firebaseAuthDomain || "",
  firebaseProjectId: s.firebaseProjectId || "",
  googleClientId: s.googleClientId || "",
  googleClientSecret: s.googleClientSecret || "",
  firebaseStorageBucket: s.firebaseStorageBucket || "",
  firebaseMessagingSenderId: s.firebaseMessagingSenderId || "",
  firebaseAppId: s.firebaseAppId || "",
  firebaseAdminFromEnv: Boolean(s.firebaseAdminFromEnv),
  sms91AuthKey: s.sms91AuthKey || "",
  sms91TemplateId: s.sms91TemplateId || "",
  sms91OtpLength: s.sms91OtpLength || "6",
  smtpEmailUser: s.smtpEmailUser || "",
  smtpEmailPass: s.smtpEmailPass || "",
  smtpEmailService: s.smtpEmailService?.trim() || "gmail",
  enableGDriveUpload: s.enableGDriveUpload !== false,
  enableFileUpload: s.enableFileUpload !== false,
  unsplashApplicationId: s.unsplashApplicationId || "",
  unsplashAccessKey: s.unsplashAccessKey || "",
  unsplashSecretKey: s.unsplashSecretKey || "",
  destinationIncludedItems: mapDestinationIncludedFromApi(s),
  destinationFaqs: mapDestinationFaqsFromApi(s),
});

const integrationFlagsFromSettings = (s) => {
  const hasFirebasePublicConfig = Boolean(
    s.firebaseApiKey?.trim() &&
      s.firebaseAuthDomain?.trim() &&
      s.firebaseProjectId?.trim() &&
      s.firebaseAppId?.trim(),
  );
  return {
    isRazorpayConfigured: Boolean(s.razorpayKeyId?.trim() && s.razorpayKeySecret?.trim()),
    isFirebaseConfigured: hasFirebasePublicConfig && Boolean(s.firebaseAdminFromEnv),
    isSmtpConfigured: Boolean(s.smtpEmailUser?.trim() && s.smtpEmailPass?.trim()),
    isSms91Configured: Boolean(s.sms91AuthKey?.trim() && s.sms91TemplateId?.trim()),
    isUnsplashConfigured: Boolean(s.unsplashAccessKey?.trim()),
  };
};

// ─────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { showToast, countryModalOpen, selectedCountry, openCountryModal, closeCountryModal } = useUIStore();

  // ── Route & State Navigation ──────────────────────────────
  const navigate       = useNavigate();
  const { activeTab: tabParam } = useParams();
  const activeTab      = tabParam || "analytics";

  // ── Global Data Store ──────────────────────────────────────
  const { bookings, countries, fetchAllApplications, fetchCountries, fetchPages, updateCountry } = useDataStore();

  // ── Local state ──────────────────────────────────────────
  const [searchQuery, setSearchQuery]        = useState("");
  const [countrySearchQuery, setCountrySearchQuery] = useState("");
  const [statusFilter, setStatusFilter]      = useState("all");
  const [activeChart, setActiveChart]        = useState("revenue"); // "revenue"|"bookings"
  const [transactions, setTransactions]      = useState([]);
  const [settingsForm, setSettingsForm]      = useState({
    razorpayKeyId: "",
    razorpayKeySecret: "",
    firebaseApiKey: "",
    firebaseAuthDomain: "",
    firebaseProjectId: "",
    googleClientId: "",
    googleClientSecret: "",
    firebaseStorageBucket: "",
    firebaseMessagingSenderId: "",
    firebaseAppId: "",
    firebaseAdminFromEnv: false,
    sms91AuthKey: "",
    sms91TemplateId: "",
    sms91OtpLength: "6",
    smtpEmailUser: "",
    smtpEmailPass: "",
    smtpEmailService: "gmail",
    enableGDriveUpload: true,
    enableFileUpload: true,
    unsplashApplicationId: "",
    unsplashAccessKey: "",
    unsplashSecretKey: "",
    destinationIncludedItems: [...DESTINATION_PAGE_DEFAULT_INCLUDED],
    destinationFaqs: DESTINATION_PAGE_DEFAULT_FAQS.map((f) => ({ ...f })),
  });
  /** Which settings subsection is currently saving (null = idle). */
  const [savingSettingsKey, setSavingSettingsKey] = useState(null);
  const [unsplashFetchRunning, setUnsplashFetchRunning] = useState(false);
  /** Shown under the Unsplash fetch buttons while batches run. */
  const [unsplashFetchProgress, setUnsplashFetchProgress] = useState("");
  const [fetchedCountriesModalOpen, setFetchedCountriesModalOpen] = useState(false);
  const [fetchedCountriesLoading, setFetchedCountriesLoading] = useState(false);
  const [fetchedCountriesSearch, setFetchedCountriesSearch] = useState("");
  const [isRazorpayConfigured, setIsRazorpayConfigured] = useState(false);
  const [isFirebaseConfigured, setIsFirebaseConfigured] = useState(false);
  const [isSmtpConfigured, setIsSmtpConfigured] = useState(false);
  const [isSms91Configured, setIsSms91Configured] = useState(false);
  const [isUnsplashConfigured, setIsUnsplashConfigured] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const { changeAdminPassword, logout } = useAuthStore();

  const handleUnauthorized = () => {
    logout();
    showToast("Session expired. Please login again.", "error");
    navigate("/login", { replace: true });
  };

  const countriesWithBanner = useMemo(() => {
    return [...countries]
      .filter((c) => String(c.imageUrl || "").trim())
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [countries]);

  const filteredFetchedCountries = useMemo(() => {
    const q = fetchedCountriesSearch.trim().toLowerCase();
    if (!q) return countriesWithBanner;
    return countriesWithBanner.filter(
      (c) =>
        String(c.name || "").toLowerCase().includes(q) ||
        String(c.slug || "").toLowerCase().includes(q),
    );
  }, [countriesWithBanner, fetchedCountriesSearch]);

  const closeFetchedCountriesModal = () => {
    setFetchedCountriesModalOpen(false);
    setFetchedCountriesSearch("");
  };

  const openFetchedCountriesModal = async () => {
    setFetchedCountriesLoading(true);
    try {
      const result = await fetchCountries();
      if (!result?.success) {
        showToast(result?.message || "Could not load countries.", "error");
        return;
      }
      setFetchedCountriesModalOpen(true);
    } finally {
      setFetchedCountriesLoading(false);
    }
  };

  // Fetch Data when tabs change
  useEffect(() => {
    const fetchData = async () => {
      if (activeTab === "analytics" || activeTab === "applications" || activeTab === "transactions") {
        try {
          await fetchAllApplications();
        } catch (error) {
          console.error("Error fetching applications:", error);
          if (activeTab === "applications") {
            showToast(error?.response?.data?.message || "Failed to load applications.", "error");
          }
          if (error?.response?.status === 401) {
            handleUnauthorized();
            return;
          }
        }
      }

      try {
        if (activeTab === "countries") {
          await fetchCountries();
        } else if (activeTab === "pages") {
          await fetchPages({ page: 1, limit: 8 });
        } else if (activeTab === "transactions") {
          const { data } = await api.get("/admin/transactions");
          if (data.success) setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
        } else if (activeTab === "settings") {
          const { data } = await api.get("/admin/settings");
          if (data.success && data.settings) {
            const flags = integrationFlagsFromSettings(data.settings);
            setIsRazorpayConfigured(flags.isRazorpayConfigured);
            setIsFirebaseConfigured(flags.isFirebaseConfigured);
            setIsSmtpConfigured(flags.isSmtpConfigured);
            setIsSms91Configured(flags.isSms91Configured);
            setIsUnsplashConfigured(flags.isUnsplashConfigured);
            setSettingsForm(mapApiSettingsToFormState(data.settings));
          }
        } else if (activeTab === "controls") {
          const { data } = await api.get("/admin/settings");
          if (data.success && data.settings) {
            const s = data.settings;
            setSettingsForm((p) => ({
              ...p,
              enableGDriveUpload: s.enableGDriveUpload !== false,
              enableFileUpload: s.enableFileUpload !== false,
              destinationIncludedItems: mapDestinationIncludedFromApi(s),
              destinationFaqs: mapDestinationFaqsFromApi(s),
            }));
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        if (activeTab === "transactions") {
          setTransactions([]);
          showToast(error?.response?.data?.message || "Failed to load transactions.", "error");
        } else if (activeTab === "countries") {
          showToast(error?.response?.data?.message || "Failed to load countries.", "error");
        } else if (activeTab === "pages") {
          showToast(error?.response?.data?.message || "Failed to load pages.", "error");
        }
        if (error?.response?.status === 401) {
          handleUnauthorized();
        }
      }
    };
    fetchData();
  }, [activeTab, fetchAllApplications, fetchCountries]);

  // ── Drag & Drop state ────────────────────────────────────
  const [isDragging, setIsDragging]          = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef                         = useRef(null);

  // Document type options admin can require per country
  const DOC_OPTIONS = [
    { key: "passport",        label: "Passport" },
    { key: "idCard",          label: "Aadhaar / ID Card" },
    { key: "dobCertificate",  label: "DOB Certificate" },
    { key: "photo",           label: "Passport Photo" },
    { key: "bankStatement",   label: "Bank Statement" },
    { key: "travelInsurance", label: "Travel Insurance" },
    { key: "flightTicket",    label: "Flight Ticket" },
    { key: "hotelBooking",    label: "Hotel Booking" },
    { key: "coverLetter",     label: "Cover Letter" },
    { key: "invitationLetter", label: "Invitation Letter" },
    { key: "employmentLetter", label: "Employment Letter" },
    { key: "taxReturn",       label: "ITR / Tax Return" },
    { key: "marriageCertificate", label: "Marriage Certificate" },
  ];

  // Country form state
  const [countryForm, setCountryForm] = useState({
    name: "", flagEmoji: "🌍", basePrice: "", processingDays: "", difficulty: "moderate",
    visaType: "", continent: "", description: "", requirements: [""], imageUrl: "",
    requiredDocuments: ["passport"], successRate: "80", trending: false,
  });

  // ── Filter applications ───────────────────────────────────
  const filteredBookings = bookings.filter((b) => {
    const q = searchQuery.toLowerCase();
    const idStr = String(b._id || b.id || "").toLowerCase();
    const txnStr = String(b.transactionId || "").toLowerCase();
    const phoneDigits = String(b.user?.phone || "").replace(/\D/g, "");
    const qDigits = q.replace(/\D/g, "");
    const matchSearch =
      (b.countryName || "").toLowerCase().includes(q) ||
      (b.userName || "").toLowerCase().includes(q) ||
      (b.firstName && `${b.firstName} ${b.lastName || ""}`.toLowerCase().includes(q)) ||
      (b.email || b.userEmail || "").toLowerCase().includes(q) ||
      (b.user?.phone || "").toLowerCase().includes(q) ||
      (qDigits.length >= 3 && phoneDigits.includes(qDigits)) ||
      idStr.includes(q) ||
      txnStr.includes(q);
    const matchStatus = statusFilter === "all" || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const [geocodeCountryMatches, setGeocodeCountryMatches] = useState([]);
  const geocodeCountryReqSeq = useRef(0);

  useEffect(() => {
    const q = countrySearchQuery.trim();
    if (q.length < 3) {
      setGeocodeCountryMatches([]);
      return undefined;
    }
    const seq = ++geocodeCountryReqSeq.current;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/geocode/places", { params: { q } });
        if (seq !== geocodeCountryReqSeq.current) return;
        if (data?.success && Array.isArray(data.matches)) {
          setGeocodeCountryMatches(data.matches);
        } else {
          setGeocodeCountryMatches([]);
        }
      } catch {
        if (seq === geocodeCountryReqSeq.current) setGeocodeCountryMatches([]);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [countrySearchQuery]);

  const filteredCountries = useMemo(() => {
    const base = countries.filter((country) =>
      matchesCountrySearch(country, countrySearchQuery)
    );
    const q = countrySearchQuery.trim();
    if (!q || q.length < 3) return base;
    const byKey = new Map();
    for (const c of base) {
      byKey.set(c.slug || c._id || c.id, c);
    }
    for (const g of geocodeCountryMatches) {
      const c = countries.find(
        (x) => x.slug === g.id || x.name === g.name || x.id === g.id
      );
      if (c) {
        const key = c.slug || c._id || c.id;
        if (!byKey.has(key)) byKey.set(key, c);
      }
    }
    return Array.from(byKey.values());
  }, [countries, countrySearchQuery, geocodeCountryMatches]);

  // ── Country Manager handlers ───────────────────────────────
  const [isSavingCountry, setIsSavingCountry] = useState(false);
  const openEditCountry = (country) => {
    setCountryForm({
      ...country,
      basePrice: String(country.basePrice),
      successRate: String(country.successRate ?? 80),
      trending: Boolean(country.trending),
      requirements: country.requirements?.length ? country.requirements : [""],
      requiredDocuments: country.requiredDocuments || ["passport"],
    });
    openCountryModal("edit", country);
  };

  const saveCountry = async () => {
    if (!countryForm.name.trim() || !countryForm.basePrice) {
      showToast("Country name and base price are required.", "error");
      return;
    }
    setIsSavingCountry(true);
    const payload = {
      ...countryForm,
      basePrice: Number(countryForm.basePrice),
      processingDays: countryForm.processingDays || "5-10",
      requirements: countryForm.requirements.filter(Boolean),
      requiredDocuments: countryForm.requiredDocuments,
      successRate: Number(countryForm.successRate) || 80,
      trending: Boolean(countryForm.trending),
    };

    const id = selectedCountry?._id || selectedCountry?.id;
    const result = await updateCountry(id, payload);
    if (result?.success) {
      showToast(`Country "${countryForm.name}" updated.`, "success");
      closeCountryModal();
    } else {
      showToast(result?.message || "Failed to update country.", "error");
    }
    setIsSavingCountry(false);
  };

  const toggleRequiredDoc = (key) => {
    setCountryForm((p) => ({
      ...p,
      requiredDocuments: p.requiredDocuments.includes(key)
        ? p.requiredDocuments.filter((d) => d !== key)
        : [...p.requiredDocuments, key],
    }));
  };

  // ── Image upload helpers ─────────────────────────────────
  const uploadImageToServer = async (file) => {
    if (!file || !file.type.startsWith("image/")) {
      showToast("Please select a valid image file.", "error");
      return;
    }
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const { data } = await api.post("/admin/countries/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (data.success) {
        const fullUrl = `${SERVER_URL}${data.url}`;
        setCountryForm((p) => ({ ...p, imageUrl: fullUrl }));
        showToast("Image uploaded successfully.", "success");
      }
    } catch (err) {
      showToast("Failed to upload image.", "error");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // ── Drag & Drop handlers ─────────────────────────────────
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    uploadImageToServer(e.dataTransfer.files[0]);
  };
  const handleFileSelect = (e) => {
    uploadImageToServer(e.target.files[0]);
    e.target.value = "";
  };

  const saveSettingsPartial = async (sectionKey, payload, successMessage) => {
    setSavingSettingsKey(sectionKey);
    try {
      const { data } = await api.put("/admin/settings", payload);
      if (!data.success) {
        showToast(data.message || "Failed to save", "error");
        return;
      }
      if (data.settings) {
        const flags = integrationFlagsFromSettings(data.settings);
        setIsRazorpayConfigured(flags.isRazorpayConfigured);
        setIsFirebaseConfigured(flags.isFirebaseConfigured);
        setIsSmtpConfigured(flags.isSmtpConfigured);
        setIsSms91Configured(flags.isSms91Configured);
        setIsUnsplashConfigured(flags.isUnsplashConfigured);
        setSettingsForm(mapApiSettingsToFormState(data.settings));
      } else {
        switch (sectionKey) {
          case "razorpay":
            setIsRazorpayConfigured(
              Boolean(payload.razorpayKeyId?.trim() && payload.razorpayKeySecret?.trim()),
            );
            break;
          case "unsplash":
            setIsUnsplashConfigured(Boolean(payload.unsplashAccessKey?.trim()));
            break;
          case "firebase": {
            const pub = Boolean(
              payload.firebaseApiKey?.trim() &&
                payload.firebaseAuthDomain?.trim() &&
                payload.firebaseProjectId?.trim() &&
                payload.firebaseAppId?.trim(),
            );
            setIsFirebaseConfigured(pub && Boolean(data.settings?.firebaseAdminFromEnv));
            break;
          }
          case "smtp":
            setIsSmtpConfigured(
              Boolean(payload.smtpEmailUser?.trim() && payload.smtpEmailPass?.trim()),
            );
            break;
          case "sms91":
            setIsSms91Configured(
              Boolean(payload.sms91AuthKey?.trim() && payload.sms91TemplateId?.trim()),
            );
            break;
          default:
            break;
        }
      }
      showToast(successMessage, "success");
    } catch (error) {
      console.error("Error saving settings:", error);
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      showToast(error.response?.data?.message || "Failed to save settings", "error");
    } finally {
      setSavingSettingsKey(null);
    }
  };

  /** Uses saved Mongo key, or the Access Key typed in the form (sent as override for this run). */
  const runUnsplashImageFetch = async ({ onlyMissing, onlyTrending = false }) => {
    const keyFromForm = settingsForm.unsplashAccessKey?.trim();
    if (!keyFromForm && !isUnsplashConfigured) {
      showToast("Paste your Unsplash Access Key below (and save if you want it stored).", "error");
      return;
    }

    setUnsplashFetchRunning(true);
    const scopeLabel = onlyTrending ? "Featured / trending countries" : "Countries";
    setUnsplashFetchProgress(`Starting ${scopeLabel.toLowerCase()} — first batch may take ~10–20s (Unsplash rate limits)…`);
    let totalUpdated = 0;
    let totalFailed = 0;
    try {
      let skip = 0;
      const limit = 10;
      const maxBatches = 250;
      for (let b = 0; b < maxBatches; b++) {
        const body = { onlyMissing, onlyTrending, skip, limit };
        if (keyFromForm) body.accessKey = keyFromForm;

        const { data } = await api.post("/admin/countries/refresh-unsplash-images", body, {
          timeout: 0,
        });
        if (!data.success) {
          showToast(data.message || "Unsplash fetch failed", "error");
          return;
        }
        totalUpdated += data.updated || 0;
        totalFailed += data.failed || 0;
        const done = data.nextSkip ?? skip + (data.processed || 0);
        const total = typeof data.totalMatching === "number" ? data.totalMatching : null;
        const pct = total && total > 0 ? Math.round((Math.min(done, total) / total) * 100) : null;
        const scope = data.onlyTrending ? "Featured: " : "";
        setUnsplashFetchProgress(
          `${scope}Batch ${b + 1}: +${data.updated || 0} image(s) saved, ${data.failed || 0} no match this batch. ` +
            `Running total: ${totalUpdated} saved, ${totalFailed} no match. ` +
            (total != null ? `Progress: ${Math.min(done, total)} / ${total} countries${pct != null ? ` (${pct}%)` : ""}.` : `Processed so far: ${done} countries.`),
        );
        if (!data.hasMore) break;
        skip = data.nextSkip;
      }
      const scopeDone = onlyTrending ? "Featured / trending: " : "";
      showToast(
        `${scopeDone}${totalUpdated} country image(s) updated in MongoDB. ${totalFailed} had no Unsplash match.`,
        "success",
      );
      await fetchCountries();
    } catch (error) {
      console.error("Unsplash fetch:", error);
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const apiMsg = error.response?.data?.message;
      const base = apiMsg || error.message || "Unsplash fetch request failed";
      const netHint =
        !apiMsg && (error.code === "ECONNABORTED" || error.message === "Network Error")
          ? " Restart admin `npm run dev` after vite proxy changes, or set VITE_API_URL=http://localhost:5000 to bypass the proxy."
          : "";
      showToast(base + netHint, "error");
    } finally {
      setUnsplashFetchRunning(false);
      setUnsplashFetchProgress("");
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
    { id: "pages",        label: "Static Pages",  icon: Globe },
    { id: "transactions", label: "Transactions",  icon: CreditCard },
    { id: "applications", label: "Applications",  icon: FileText },
    { id: "countries",    label: "Country Manager", icon: MapPin },
    { id: "controls",     label: "Controls",        icon: Sliders },
    { id: "settings",     label: "Settings",        icon: Settings },
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
                              {tx.razorpayPaymentId || tx.paymentId || tx.razorpayOrderId || "N/A"}
                            </td>
                            <td className="py-3 px-4 font-medium text-text-primary">
                              ₹{Number(tx.amount || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${tx.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : tx.status === 'failed' ? 'bg-red-500/10 text-red-400' : tx.status === 'cancelled' ? 'bg-slate-500/10 text-slate-300' : 'bg-amber-500/10 text-amber-400'}`}>
                                {String(tx.status || "pending").charAt(0).toUpperCase() + String(tx.status || "pending").slice(1)}
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

          {activeTab === "pages" && <StaticPagesManager />}

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
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#0284c7', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          name="Revenue"
                          stroke="#0284c7"
                          strokeWidth={3}
                          dot={{ fill: "#ffffff", stroke: "#0284c7", strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, fill: "#0284c7", stroke: "#ffffff", strokeWidth: 2 }}
                          isAnimationActive={true}
                          animationDuration={1500}
                          animationEasing="ease-in-out"
                        />
                      </LineChart>
                    ) : (
                      <BarChart data={MONTHLY_REVENUE}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#e5e7eb', opacity: 0.6 }} />
                        <Bar 
                          dataKey="bookings" 
                          name="Bookings" 
                          fill="#0284c7" 
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
                        {["Application ID","Applicant","Destination","Travel Date","Fee","Payment","Documents","Status","Details"].map((h) => (
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
                              {b.user?.phone && (
                                <p className="text-xs text-text-muted mt-0.5">
                                  {String(b.user.phone).replace(/\D/g, "").length === 10
                                    ? `+91 ${String(b.user.phone).replace(/\D/g, "").slice(0, 5)} ${String(b.user.phone).replace(/\D/g, "").slice(5)}`
                                    : b.user.phone}
                                </p>
                              )}
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
                            <div className="space-y-1">
                              <p className={`text-xs font-medium ${
                                b.paymentStatus === "completed"
                                  ? "text-emerald-400"
                                  : b.paymentStatus === "failed"
                                    ? "text-red-400"
                                    : b.paymentStatus === "cancelled"
                                      ? "text-zinc-300"
                                      : "text-amber-400"
                              }`}>
                                {b.paymentStatus === "completed"
                                  ? "Paid"
                                  : b.paymentStatus === "failed"
                                    ? "Failed"
                                    : b.paymentStatus === "cancelled"
                                      ? "Cancelled"
                                      : "Pending payment"}
                              </p>
                              <p className="font-mono text-[11px] text-text-secondary max-w-[140px] truncate" title={b.transactionId || ""}>
                                {b.transactionId && b.transactionId !== "pending" ? b.transactionId : "—"}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 pr-6">
                            {(() => {
                              const progress = getApplicationProgress(b);
                              const nextPendingTraveler = progress.missingByTraveler.find((item) => item.missingLabels.length);
                              return (
                                <div className="space-y-1">
                                  <p className={`text-xs font-medium ${progress.allDocumentsUploaded ? "text-emerald-400" : "text-amber-400"}`}>
                                    {progress.allDocumentsUploaded ? "Complete" : `${progress.totalMissingDocuments} missing`}
                                  </p>
                                  {!progress.allDocumentsUploaded && nextPendingTraveler && (
                                    <p className="text-[11px] text-text-muted">
                                      {nextPendingTraveler.travelerName} pending
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-3 pr-6">
                            <StatusBadge status={b.status} />
                          </td>
                          <td className="py-3 pr-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/application/${b.id || b._id}`)}
                              className="px-3 py-1.5 bg-cyan/10 text-cyan hover:bg-cyan/20 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                              title="View Application Details"
                            >
                              View Details
                            </button>
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
                <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
                  <div>
                    <h2 className="font-semibold text-text-primary">Country Manager</h2>
                    <p className="text-xs text-text-muted">Edit pricing, visa type, documents, requirements, images, and display details for all 195 countries.</p>
                  </div>
                  <div className="relative w-full sm:w-80">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      value={countrySearchQuery}
                      onChange={(e) => setCountrySearchQuery(e.target.value)}
                      placeholder="Search country, city, visa type..."
                      className="w-full bg-surface-2 border border-border text-text-primary text-sm rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan placeholder-text-muted"
                      id="country-manager-search"
                    />
                  </div>
                </div>

                {/* Country cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {countries.length === 0 && (
                  <div className="col-span-3 text-center py-16 text-text-muted">
                    <Globe size={36} className="mx-auto mb-3 opacity-40" />
                    <p className="font-medium">No countries loaded yet.</p>
                    <p className="text-xs mt-1">The manager uses the 195 countries already present in MongoDB.</p>
                  </div>
                )}
                {countries.length > 0 && filteredCountries.length === 0 && (
                  <div className="col-span-3 text-center py-16 text-text-muted">
                    <Search size={36} className="mx-auto mb-3 opacity-40" />
                    <p className="font-medium">No country matches your search.</p>
                  </div>
                )}
                {filteredCountries.map((c) => (
                    <div
                      key={c._id || c.id}
                      className="bg-surface-2 border border-border rounded-xl overflow-hidden hover:border-cyan/20 transition-colors flex flex-col"
                    >
                      {/* Image Banner */}
                      <div 
                        className="h-28 bg-cover bg-center relative"
                        style={{ backgroundImage: `url('${c.imageUrl || '/images/visa-card-fallback.svg'}')` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                        <span className="absolute bottom-2 left-3 w-11 h-11 rounded-full bg-white/95 border border-white/70 shadow-lg flex items-center justify-center text-2xl">
                          {c.flagEmoji}
                        </span>
                      </div>

                      <div className="p-4 flex-1 flex flex-col">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div>
                              <h3 className="font-semibold text-text-primary text-sm">{c.name}</h3>
                              <p className="text-xs text-text-muted">{c.visaType}</p>
                              {getCountrySearchHint(c, countrySearchQuery) && (
                                <p className="text-[10px] text-cyan mt-1">{getCountrySearchHint(c, countrySearchQuery)}</p>
                              )}
                            </div>
                          </div>
                          {/* Actions */}
                          <div className="flex gap-1">
                          <button
                            id={`edit-country-${c._id || c.id}`}
                            onClick={() => openEditCountry(c)}
                            className="p-1.5 rounded-lg hover:bg-cyan/10 text-text-muted hover:text-cyan transition-colors"
                            aria-label={`Edit ${c.name}`}
                          >
                            <Edit3 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Required docs badges */}
                      {c.requiredDocuments?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {c.requiredDocuments.map((d) => (
                            <span key={d} className="px-2 py-0.5 text-[10px] rounded-md bg-cyan/10 text-cyan border border-cyan/20 font-medium">
                              {DOC_OPTIONS.find((o) => o.key === d)?.label || d}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Details row */}
                      <div className="flex items-center gap-4 text-xs text-text-muted mt-auto pt-3 border-t border-border/40">
                        <span className="flex items-center gap-1">
                          <IndianRupee size={11} /> ₹{c.basePrice}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {c.processingDays}
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
              TAB 4: CONTROLS
              ══════════════════════════════════════ */}
          {activeTab === "controls" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-semibold text-text-primary">System Controls</h2>
                    <p className="text-xs text-text-muted">Manage active features and modules</p>
                  </div>
                  <Button 
                    variant="primary" 
                    size="sm" 
                    leftIcon={<Save size={15} />}
                    loading={savingSettingsKey === "upload-controls"}
                    onClick={() =>
                      saveSettingsPartial(
                        "upload-controls",
                        {
                          enableGDriveUpload: settingsForm.enableGDriveUpload,
                          enableFileUpload: settingsForm.enableFileUpload,
                        },
                        "Document upload options saved.",
                      )
                    }
                  >
                    Save upload options
                  </Button>
                </div>
                
                <div className="space-y-6">
                  <div className="bg-surface-2 border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-text-primary border-b border-border pb-3 mb-4 flex items-center gap-2">
                      <UploadCloud size={18} className="text-cyan" />
                      Document Upload Methods
                    </h3>
                    <p className="text-xs text-text-muted mb-6">
                      Turn on one or both options. With both on, applicants see file uploads and Google Drive on the same screen—they can use either method (all files or one Drive link per traveler). Turn both upload methods off to hide document uploads until you enable at least one. Use <span className="text-text-primary font-medium">Save upload options</span> at the top when you are done — only that section is saved.
                    </p>
                    
                    <div className="space-y-4 max-w-lg">
                      <label className="flex items-center justify-between bg-background p-4 rounded-xl border border-border cursor-pointer hover:border-cyan/30 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-text-primary">File Uploads</p>
                          <p className="text-xs text-text-muted mt-0.5">Allow users to upload files (PDF, JPG, PNG)</p>
                        </div>
                        <div className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 ${settingsForm.enableFileUpload ? 'bg-emerald-500' : 'bg-surface-3 border border-border'}`}>
                          <input 
                            type="checkbox" 
                            className="sr-only" 
                            checked={settingsForm.enableFileUpload}
                            onChange={(e) => setSettingsForm((p) => ({ ...p, enableFileUpload: e.target.checked }))}
                          />
                          <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${settingsForm.enableFileUpload ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </label>
                      
                      <label className="flex items-center justify-between bg-background p-4 rounded-xl border border-border cursor-pointer hover:border-cyan/30 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-text-primary">Google Drive Links</p>
                          <p className="text-xs text-text-muted mt-0.5">Allow users to paste a link to a Google Drive folder</p>
                        </div>
                        <div className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 ${settingsForm.enableGDriveUpload ? 'bg-emerald-500' : 'bg-surface-3 border border-border'}`}>
                          <input 
                            type="checkbox" 
                            className="sr-only" 
                            checked={settingsForm.enableGDriveUpload}
                            onChange={(e) => setSettingsForm((p) => ({ ...p, enableGDriveUpload: e.target.checked }))}
                          />
                          <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${settingsForm.enableGDriveUpload ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="font-semibold text-text-primary">Destination pages (all countries)</h2>
                    <p className="text-xs text-text-muted mt-1.5 max-w-2xl leading-relaxed">
                      The sections <span className="text-text-primary font-medium">What&apos;s included</span> and{" "}
                      <span className="text-text-primary font-medium">FAQs</span> on every public destination page read from here. Saving updates the live site for all destinations at once.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="shrink-0"
                    leftIcon={<Save size={15} />}
                    loading={savingSettingsKey === "destination-content"}
                    onClick={() => {
                      const included = settingsForm.destinationIncludedItems
                        .map((s) => String(s ?? "").trim())
                        .filter(Boolean);
                      const faqs = settingsForm.destinationFaqs
                        .map((f) => ({
                          question: String(f?.question ?? "").trim(),
                          answer: String(f?.answer ?? "").trim(),
                        }))
                        .filter((f) => f.question && f.answer);
                      saveSettingsPartial(
                        "destination-content",
                        { destinationIncludedItems: included, destinationFaqs: faqs },
                        "Destination copy saved — visible on all country pages.",
                      );
                    }}
                  >
                    Save destination copy
                  </Button>
                </div>

                <div className="space-y-8">
                  <div className="bg-surface-2 border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-text-primary border-b border-border pb-3 mb-4 flex items-center gap-2">
                      <CheckCircle size={18} className="text-cyan" />
                      What&apos;s included
                    </h3>
                    <p className="text-xs text-text-muted mb-4">
                      One bullet per line. Empty rows are ignored when you save.
                    </p>
                    <div className="space-y-3 max-w-2xl">
                      {(settingsForm.destinationIncludedItems || []).map((line, idx) => (
                        <div key={`inc-${idx}`} className="flex gap-2 items-start">
                          <Input
                            className="flex-1"
                            value={line}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSettingsForm((p) => {
                                const next = [...(p.destinationIncludedItems || [])];
                                next[idx] = v;
                                return { ...p, destinationIncludedItems: next };
                              });
                            }}
                            placeholder="e.g. Dedicated visa specialist review"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-red-400 hover:text-red-300"
                            onClick={() =>
                              setSettingsForm((p) => ({
                                ...p,
                                destinationIncludedItems: (p.destinationIncludedItems || []).filter((_, i) => i !== idx),
                              }))
                            }
                            aria-label="Remove bullet"
                          >
                            <X size={16} />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        leftIcon={<Plus size={15} />}
                        onClick={() =>
                          setSettingsForm((p) => ({
                            ...p,
                            destinationIncludedItems: [...(p.destinationIncludedItems || []), ""],
                          }))
                        }
                      >
                        Add bullet
                      </Button>
                    </div>
                  </div>

                  <div className="bg-surface-2 border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-text-primary border-b border-border pb-3 mb-4 flex items-center gap-2">
                      <HelpCircle size={18} className="text-cyan" />
                      FAQs
                    </h3>
                    <p className="text-xs text-text-muted mb-4">
                      Question and answer pairs. Incomplete pairs are skipped when you save.
                    </p>
                    <div className="space-y-6 max-w-3xl">
                      {(settingsForm.destinationFaqs || []).map((faq, idx) => (
                        <div key={`faq-${idx}`} className="rounded-xl border border-border bg-background p-4 space-y-3">
                          <div className="flex justify-between gap-2">
                            <p className="text-xs font-semibold text-text-muted">FAQ {idx + 1}</p>
                            <button
                              type="button"
                              className="text-xs text-red-400 hover:text-red-300"
                              onClick={() =>
                                setSettingsForm((p) => ({
                                  ...p,
                                  destinationFaqs: (p.destinationFaqs || []).filter((_, i) => i !== idx),
                                }))
                              }
                            >
                              Remove
                            </button>
                          </div>
                          <Input
                            label="Question"
                            value={faq.question}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSettingsForm((p) => {
                                const next = [...(p.destinationFaqs || [])];
                                next[idx] = { ...next[idx], question: v };
                                return { ...p, destinationFaqs: next };
                              });
                            }}
                          />
                          <Textarea
                            label="Answer"
                            rows={3}
                            value={faq.answer}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSettingsForm((p) => {
                                const next = [...(p.destinationFaqs || [])];
                                next[idx] = { ...next[idx], answer: v };
                                return { ...p, destinationFaqs: next };
                              });
                            }}
                          />
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        leftIcon={<Plus size={15} />}
                        onClick={() =>
                          setSettingsForm((p) => ({
                            ...p,
                            destinationFaqs: [...(p.destinationFaqs || []), { question: "", answer: "" }],
                          }))
                        }
                      >
                        Add FAQ
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ══════════════════════════════════════
              TAB 5: SETTINGS
              ══════════════════════════════════════ */}
          {activeTab === "settings" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <Card bordered>
                <h2 className="font-semibold text-text-primary text-lg">Settings</h2>
                <p className="text-sm text-text-muted mt-2 leading-relaxed">
                  Each card below is <span className="text-text-primary font-medium">saved separately</span>. Paste or update values in that card, then click{" "}
                  <span className="text-text-primary font-medium">Save</span> at the bottom of the same card. You do not need to fill everything at once.
                </p>
              </Card>

              <Card>
                <h2 className="font-semibold text-text-primary text-base">Appearance</h2>
                <p className="text-sm text-text-muted mt-1.5 leading-relaxed">
                  Dashboard look is fixed for now. There is no server setting to change here — skip this block if you are only configuring payments or auth.
                </p>
              </Card>

              <SettingsSectionCard
                title="Payments — Razorpay"
                description="Used when customers pay on the site. Paste both keys from the same Razorpay account."
                whereToFind={
                  <>
                    Razorpay Dashboard → <span className="text-text-secondary">Account &amp; Settings</span> →{" "}
                    <span className="text-text-secondary">API Keys</span>: copy <strong className="text-text-primary">Key ID</strong> and{" "}
                    <strong className="text-text-primary">Key Secret</strong> into the fields below.
                  </>
                }
                statusSlot={
                  <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${isRazorpayConfigured ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
                    {isRazorpayConfigured ? "Razorpay looks complete (Key ID + Secret on file)." : "Add Key ID and Key Secret, then save this card."}
                  </div>
                }
                saveLabel="Save Razorpay"
                saveButtonId="save-settings-razorpay"
                isSaving={savingSettingsKey === "razorpay"}
                onSave={() =>
                  saveSettingsPartial(
                    "razorpay",
                    {
                      razorpayKeyId: settingsForm.razorpayKeyId,
                      razorpayKeySecret: settingsForm.razorpayKeySecret,
                    },
                    "Razorpay keys saved.",
                  )
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Paste Key ID here"
                    type="text"
                    value={settingsForm.razorpayKeyId}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, razorpayKeyId: e.target.value }))}
                    id="setting-razorpay-key"
                    placeholder="rzp_live_… or rzp_test_…"
                  />
                  <Input
                    label="Paste Key Secret here"
                    type="password"
                    value={settingsForm.razorpayKeySecret}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, razorpayKeySecret: e.target.value }))}
                    id="setting-razorpay-secret"
                  />
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Country images — Unsplash"
                description="Store your Unsplash app keys, then fetch photo URLs into MongoDB the same way as searching the country name on Unsplash (name first, then landmark hints). Optional: set UNSPLASH_ORIENTATION on the server to restrict orientation."
                whereToFind={
                  <>
                    <a href="https://unsplash.com/oauth/applications" target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">
                      unsplash.com/oauth/applications
                    </a>{" "}
                    → your app → copy <strong className="text-text-primary">Application ID</strong> (optional),{" "}
                    <strong className="text-text-primary">Access Key</strong> (required for image fetch), and{" "}
                    <strong className="text-text-primary">Secret Key</strong> (optional; for OAuth only).
                  </>
                }
                statusSlot={
                  <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${isUnsplashConfigured ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
                    {isUnsplashConfigured
                      ? "Access Key is on file — you can fetch images into MongoDB below or run node fetchCountryImages.js on the server."
                      : "Paste an Access Key below to fetch, or save this card to store keys for the CLI (node fetchCountryImages.js)."}
                  </div>
                }
                saveLabel="Save Unsplash"
                saveButtonId="save-settings-unsplash"
                isSaving={savingSettingsKey === "unsplash"}
                onSave={() =>
                  saveSettingsPartial(
                    "unsplash",
                    {
                      unsplashApplicationId: settingsForm.unsplashApplicationId,
                      unsplashAccessKey: settingsForm.unsplashAccessKey,
                      unsplashSecretKey: settingsForm.unsplashSecretKey,
                    },
                    "Unsplash keys saved.",
                  )
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Application ID (optional)"
                    value={settingsForm.unsplashApplicationId}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, unsplashApplicationId: e.target.value }))}
                    id="setting-unsplash-app-id"
                    placeholder="From Unsplash app page"
                  />
                  <Input
                    label="Access Key — paste here"
                    type="password"
                    value={settingsForm.unsplashAccessKey}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, unsplashAccessKey: e.target.value }))}
                    id="setting-unsplash-access-key"
                    placeholder="Required — used by Fetch buttons and fetchCountryImages.js"
                  />
                  <Input
                    label="Secret Key (optional)"
                    type="password"
                    value={settingsForm.unsplashSecretKey}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, unsplashSecretKey: e.target.value }))}
                    id="setting-unsplash-secret-key"
                    placeholder="OAuth only — not used by image script"
                  />
                </div>

                <div className="rounded-xl border border-border bg-surface-2/60 p-4 mt-5 space-y-3">
                  <p className="text-xs text-text-muted leading-relaxed">
                    Calls the Unsplash Search API the way the site does: <span className="text-text-primary font-medium">country name first</span> (“France”, “France travel”, …), then famous-place phrases for that slug, then a few landmark fallbacks. No forced orientation unless you set <code className="text-text-secondary">UNSPLASH_ORIENTATION</code> in <code className="text-text-secondary">server/.env</code>. Results save to <span className="text-text-primary font-medium">Country.imageUrl</span>.
                    Work runs in batches (10 countries per request, repeated until done) with delays to respect rate limits — keep this tab open until the success toast.
                    Watch the status line below while it runs. In DevTools → Network, each <code className="text-text-secondary">refresh-unsplash-images</code> request completes one batch.
                    <span className="text-text-primary font-medium">Featured / trending</span> countries (the ones marked “Show as trending” in Country Manager — same list as the landing page) can be refreshed alone with landmark searches. “Fetch all” processes those first, then every other country.
                    You can use the Access Key above without saving first; saving stores it for CLI scripts.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="gold"
                      size="sm"
                      leftIcon={<TrendingUp size={15} />}
                      loading={unsplashFetchRunning}
                      disabled={unsplashFetchRunning}
                      onClick={() => runUnsplashImageFetch({ onlyMissing: false, onlyTrending: true })}
                      id="btn-unsplash-fetch-featured"
                    >
                      Fetch images (featured / trending only)
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      leftIcon={<ImageIcon size={15} />}
                      loading={unsplashFetchRunning}
                      disabled={unsplashFetchRunning}
                      onClick={() => runUnsplashImageFetch({ onlyMissing: true, onlyTrending: false })}
                      id="btn-unsplash-fetch-missing"
                    >
                      Fetch images (missing only)
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      leftIcon={<ImageIcon size={15} />}
                      loading={unsplashFetchRunning}
                      disabled={unsplashFetchRunning}
                      onClick={() => runUnsplashImageFetch({ onlyMissing: false, onlyTrending: false })}
                      id="btn-unsplash-fetch-all"
                    >
                      Fetch images (all countries)
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      leftIcon={<GalleryVertical size={15} />}
                      loading={fetchedCountriesLoading}
                      disabled={unsplashFetchRunning || fetchedCountriesLoading}
                      onClick={openFetchedCountriesModal}
                      id="btn-unsplash-view-fetched"
                    >
                      View fetched countries
                    </Button>
                  </div>
                  {unsplashFetchRunning && unsplashFetchProgress ? (
                    <p
                      className="text-xs text-black leading-relaxed font-mono border border-cyan-500/25 rounded-lg px-3 py-2 bg-cyan-950/20"
                      role="status"
                      aria-live="polite"
                    >
                      {unsplashFetchProgress}
                    </p>
                  ) : null}
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Firebase — web app + server verification"
                description="Paste the Firebase web app fields below for the client. The service account private key is not stored here — set FIREBASE_SERVICE_ACCOUNT_JSON on the server (e.g. server/.env) and restart the API."
                whereToFind={
                  <>
                    Firebase Console → <span className="text-text-secondary">Project settings</span> → <span className="text-text-secondary">General</span> → Your apps (Web) → copy into the fields below. For the Admin SDK JSON:{" "}
                    <span className="text-text-secondary">Project settings</span> → <span className="text-text-secondary">Service accounts</span> → <strong className="text-text-primary">Generate new private key</strong> → put the whole JSON in server environment variable <code className="text-cyan">FIREBASE_SERVICE_ACCOUNT_JSON</code> (single line or use newline escaping per your host).
                  </>
                }
                statusSlot={
                  <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${isFirebaseConfigured ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
                    {isFirebaseConfigured
                      ? "Web config is saved and the server reports Firebase Admin credentials (env)."
                      : settingsForm.firebaseAdminFromEnv
                        ? "Server has Admin JSON in env — finish the web fields above and save."
                        : "Save the web fields below, then set FIREBASE_SERVICE_ACCOUNT_JSON on the server and restart the API."}
                  </div>
                }
                saveLabel="Save Firebase"
                saveButtonId="save-settings-firebase"
                isSaving={savingSettingsKey === "firebase"}
                onSave={() =>
                  saveSettingsPartial(
                    "firebase",
                    {
                      firebaseApiKey: settingsForm.firebaseApiKey,
                      firebaseAuthDomain: settingsForm.firebaseAuthDomain,
                      firebaseProjectId: settingsForm.firebaseProjectId,
                      firebaseStorageBucket: settingsForm.firebaseStorageBucket,
                      firebaseMessagingSenderId: settingsForm.firebaseMessagingSenderId,
                      firebaseAppId: settingsForm.firebaseAppId,
                    },
                    "Firebase settings saved.",
                  )
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="API Key — paste here"
                    type="password"
                    value={settingsForm.firebaseApiKey}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, firebaseApiKey: e.target.value }))}
                    id="setting-firebase-api-key"
                  />
                  <Input
                    label="Auth Domain — paste here"
                    value={settingsForm.firebaseAuthDomain}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, firebaseAuthDomain: e.target.value }))}
                    id="setting-firebase-auth-domain"
                    placeholder="your-project.firebaseapp.com"
                    helper="Must be your-project-id.firebaseapp.com from Firebase → Project settings → Web app (never your Vercel/Render URL). Putting a deploy URL here breaks OAuth: Google sends you to that-host/__/auth/handler and you get 404. Authorized domains is separate — add Render hostname there."
                  />
                  <Input
                    label="Project ID — paste here"
                    value={settingsForm.firebaseProjectId}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, firebaseProjectId: e.target.value }))}
                    id="setting-firebase-project-id"
                  />
                  <Input
                    label="App ID — paste here"
                    type="password"
                    value={settingsForm.firebaseAppId}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, firebaseAppId: e.target.value }))}
                    id="setting-firebase-app-id"
                  />
                  <Input
                    label="Storage bucket — paste here"
                    value={settingsForm.firebaseStorageBucket}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, firebaseStorageBucket: e.target.value }))}
                    id="setting-firebase-storage-bucket"
                  />
                  <Input
                    label="Messaging sender ID — paste here"
                    value={settingsForm.firebaseMessagingSenderId}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, firebaseMessagingSenderId: e.target.value }))}
                    id="setting-firebase-sender-id"
                  />
                </div>
                <div className="mt-4 rounded-xl border border-border bg-surface-2/80 px-4 py-3 text-xs text-text-secondary leading-relaxed">
                  <p className="font-medium text-text-primary mb-1">Service account (server only)</p>
                  <p>
                    Set environment variable <code className="text-cyan">FIREBASE_SERVICE_ACCOUNT_JSON</code> on the machine that runs this API (see <code className="text-cyan">server/.env.example</code>). Value is the full JSON object as a string. After changing env, restart the server. Current API process:{" "}
                    <span className={settingsForm.firebaseAdminFromEnv ? "text-emerald-400 font-medium" : "text-amber-300 font-medium"}>
                      {settingsForm.firebaseAdminFromEnv ? "variable is set" : "variable not detected — Google / token login will fail until set"}
                    </span>
                    .
                  </p>
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Google OAuth (optional)"
                description="If you use Google sign-in flows that need a separate OAuth client, paste those credentials here. Many setups only need Firebase above."
                whereToFind={
                  <>
                    Google Cloud Console → <span className="text-text-secondary">APIs &amp; Services</span> → <span className="text-text-secondary">Credentials</span> → OAuth 2.0 Client IDs → copy <strong className="text-text-primary">Client ID</strong> and <strong className="text-text-primary">Client secret</strong>.
                  </>
                }
                saveLabel="Save Google OAuth"
                saveButtonId="save-settings-google-oauth"
                isSaving={savingSettingsKey === "google-oauth"}
                onSave={() =>
                  saveSettingsPartial(
                    "google-oauth",
                    {
                      googleClientId: settingsForm.googleClientId,
                      googleClientSecret: settingsForm.googleClientSecret,
                    },
                    "Google OAuth credentials saved.",
                  )
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Client ID — paste here"
                    value={settingsForm.googleClientId}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, googleClientId: e.target.value }))}
                    id="setting-google-client-id"
                    placeholder="….apps.googleusercontent.com"
                  />
                  <Input
                    label="Client secret — paste here"
                    type="password"
                    value={settingsForm.googleClientSecret}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, googleClientSecret: e.target.value }))}
                    id="setting-google-client-secret"
                    placeholder="GOCSPX-…"
                  />
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="Email OTP — SMTP"
                description="Used to send signup, login, and forgot-password OTP (same Nodemailer path for all). Save both email and app password on this card, or keep the app password only in server .env (EMAIL_PASS) with the mailbox here."
                whereToFind={
                  <>
                    Use your mail provider’s SMTP settings (e.g. Gmail: Google Account → Security → App passwords). Paste the mailbox address and app password below. Service is usually <strong className="text-text-primary">gmail</strong> for Nodemailer.
                  </>
                }
                statusSlot={
                  <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${isSmtpConfigured ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
                    {isSmtpConfigured
                      ? "SMTP email + password are on file."
                      : "Paste SMTP email and password, then save this card (or set EMAIL_USER / EMAIL_PASS on the server)."}
                  </div>
                }
                saveLabel="Save SMTP"
                saveButtonId="save-settings-smtp"
                isSaving={savingSettingsKey === "smtp"}
                onSave={() =>
                  saveSettingsPartial(
                    "smtp",
                    {
                      smtpEmailUser: settingsForm.smtpEmailUser,
                      smtpEmailPass: settingsForm.smtpEmailPass,
                      smtpEmailService: settingsForm.smtpEmailService,
                    },
                    "SMTP settings saved.",
                  )
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="SMTP email — paste login address"
                    type="email"
                    value={settingsForm.smtpEmailUser}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, smtpEmailUser: e.target.value }))}
                    id="setting-smtp-user"
                    placeholder="noreply@yourdomain.com"
                  />
                  <Input
                    label="SMTP password — paste app password"
                    type="password"
                    value={settingsForm.smtpEmailPass}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, smtpEmailPass: e.target.value }))}
                    id="setting-smtp-pass"
                  />
                  <Input
                    label="Nodemailer service name"
                    value={settingsForm.smtpEmailService}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, smtpEmailService: e.target.value }))}
                    id="setting-smtp-service"
                    placeholder="gmail"
                    helper="Often gmail — must match how Nodemailer is configured on the server."
                  />
                </div>
              </SettingsSectionCard>

              <SettingsSectionCard
                title="SMS91 — phone OTP (optional)"
                description="Real SMS codes for phone login. Leave empty if you only use email OTP."
                whereToFind={
                  <>
                    SMS91 dashboard → copy <strong className="text-text-primary">Auth key</strong> and your OTP <strong className="text-text-primary">Template ID</strong>. Pick OTP length to match your template.
                  </>
                }
                statusSlot={
                  <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${isSms91Configured ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
                    {isSms91Configured
                      ? "SMS91 auth key + template ID are on file."
                      : "Paste auth key and template ID, then save this card."}
                  </div>
                }
                saveLabel="Save SMS91"
                saveButtonId="save-settings-sms91"
                isSaving={savingSettingsKey === "sms91"}
                onSave={() =>
                  saveSettingsPartial(
                    "sms91",
                    {
                      sms91AuthKey: settingsForm.sms91AuthKey,
                      sms91TemplateId: settingsForm.sms91TemplateId,
                      sms91OtpLength: settingsForm.sms91OtpLength,
                    },
                    "SMS91 settings saved.",
                  )
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Auth key — paste here"
                    type="password"
                    value={settingsForm.sms91AuthKey}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, sms91AuthKey: e.target.value }))}
                    id="setting-sms91-auth-key"
                  />
                  <Input
                    label="Template ID — paste here"
                    value={settingsForm.sms91TemplateId}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, sms91TemplateId: e.target.value }))}
                    id="setting-sms91-template-id"
                  />
                  <Select
                    label="OTP length"
                    value={settingsForm.sms91OtpLength}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, sms91OtpLength: e.target.value }))}
                    options={[
                      { value: "6", label: "6 digits" },
                      { value: "4", label: "4 digits" },
                    ]}
                    id="setting-sms91-otp-length"
                  />
                </div>
              </SettingsSectionCard>

              {/* Security Card */}
              <Card>
                <div className="flex justify-between items-center mb-2">
                  <h2 className="font-semibold text-text-primary">Security</h2>
                </div>
                <p className="text-sm text-text-muted mb-6 leading-relaxed">
                  Change your admin login password. This is separate from API keys above — use <span className="text-text-primary font-medium">Change Password</span> only when updating credentials for this dashboard.
                </p>
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
          COUNTRIES WITH BANNER (UNSPLASH / UPLOADS)
          ══════════════════════════════════════ */}
      <Modal
        isOpen={fetchedCountriesModalOpen}
        onClose={closeFetchedCountriesModal}
        title="Countries with banner images"
        size="full"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-text-muted">
              {countriesWithBanner.length} with a saved image URL · {filteredFetchedCountries.length} shown
              {fetchedCountriesSearch.trim() ? " (filtered)" : ""}
            </p>
            <Button variant="primary" size="sm" onClick={closeFetchedCountriesModal} id="btn-fetched-countries-close">
              Close
            </Button>
          </div>
        }
      >
        <div className="mx-auto max-w-6xl space-y-4">
          <p className="text-sm text-text-muted leading-relaxed">
            Rows come from MongoDB <span className="text-text-primary font-medium">Country.imageUrl</span>. “Unsplash” means the URL points at images.unsplash.com; uploads use <span className="font-mono text-xs">/uploads/…</span>.
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} aria-hidden />
            <input
              type="search"
              value={fetchedCountriesSearch}
              onChange={(e) => setFetchedCountriesSearch(e.target.value)}
              placeholder="Filter by country name or slug…"
              className="w-full rounded-xl border border-border bg-surface-2 pl-10 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              id="fetched-countries-search"
            />
          </div>
          {filteredFetchedCountries.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface-2/60 px-4 py-8 text-center text-sm text-text-muted">
              {countriesWithBanner.length === 0
                ? "No countries have a banner URL yet. Run “Fetch images” above or upload images from Country Manager."
                : "No countries match your search."}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-surface-2 sticky top-0 z-[1] border-b border-border">
                  <tr className="text-text-muted text-xs uppercase tracking-wide">
                    <th className="px-3 py-3 w-28">Preview</th>
                    <th className="px-3 py-3">Country</th>
                    <th className="px-3 py-3">Slug</th>
                    <th className="px-3 py-3">Continent</th>
                    <th className="px-3 py-3">Source</th>
                    <th className="px-3 py-3">Updated</th>
                    <th className="px-3 py-3 w-24">Image</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredFetchedCountries.map((c) => {
                    const src = resolveCountryBannerSrc(c.imageUrl);
                    const source = bannerSourceLabel(c.imageUrl);
                    return (
                      <tr key={c._id || c.slug} className="hover:bg-surface-2/40 align-top">
                        <td className="px-3 py-2">
                          <div className="relative h-14 w-24 overflow-hidden rounded-lg border border-border bg-surface-3">
                            <img
                              src={src}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.opacity = "0.35";
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 font-medium text-text-primary">
                          <span className="mr-1.5" aria-hidden>
                            {c.flagEmoji || "🌍"}
                          </span>
                          {c.name}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-text-secondary">{c.slug}</td>
                        <td className="px-3 py-2 text-text-secondary">{c.continent || "—"}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                              source === "Unsplash"
                                ? "bg-cyan-500/15 text-cyan-300"
                                : source === "Upload"
                                  ? "bg-violet-500/15 text-violet-300"
                                  : "bg-surface-3 text-text-muted"
                            }`}
                          >
                            {source}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-text-muted text-xs whitespace-nowrap">{fmtDate(c.updatedAt)}</td>
                        <td className="px-3 py-2">
                          <a
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-400 hover:underline text-xs font-medium"
                            title={String(c.imageUrl || "")}
                          >
                            Open <ExternalLink size={12} />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* ══════════════════════════════════════
          COUNTRY MANAGER MODAL
          ══════════════════════════════════════ */}
      <Modal
        isOpen={countryModalOpen}
        onClose={closeCountryModal}
        title={`Edit ${selectedCountry?.name || "Country"}`}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={closeCountryModal} id="country-modal-cancel">Cancel</Button>
            <Button
              variant="primary"
              leftIcon={<Save size={15} />}
              onClick={saveCountry}
              disabled={isSavingCountry}
              id="country-modal-save"
            >
              {isSavingCountry ? "Saving..." : "Save Changes"}
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

          {/* Success rate + Trending */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Success Rate (%)"
              type="number"
              value={countryForm.successRate}
              onChange={(e) => setCountryForm((p) => ({ ...p, successRate: e.target.value }))}
              id="country-success-rate"
              placeholder="80"
            />
            <Select
              label="Featured / Trending"
              value={countryForm.trending ? "true" : "false"}
              onChange={(e) => setCountryForm((p) => ({ ...p, trending: e.target.value === "true" }))}
              options={[
                { value: "true", label: "Show as trending" },
                { value: "false", label: "Normal country" },
              ]}
              id="country-trending"
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
                ${isUploadingImage ? "pointer-events-none opacity-60" : "cursor-pointer"}
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploadingImage && fileInputRef.current?.click()}
            >
              {isUploadingImage ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-cyan/40 border-t-cyan animate-spin" />
                  <p className="text-sm text-text-muted">Uploading image…</p>
                </div>
              ) : countryForm.imageUrl ? (
                <div className="relative group mx-auto w-full max-w-[240px] rounded-lg overflow-hidden border border-border shadow-sm">
                  <img src={countryForm.imageUrl} alt="Preview" className="w-full h-32 object-cover" />
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-semibold text-text-primary px-3 py-1.5 bg-surface-2 rounded-lg cursor-pointer flex items-center gap-2 border border-border hover:border-cyan/50">
                      <ImageIcon size={14} /> Change Image
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-surface-3 flex items-center justify-center">
                    <UploadCloud size={24} className="text-text-muted" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">Click to upload or drag and drop</p>
                    <p className="text-xs text-text-muted mt-1">PNG, JPG or GIF (max. 5MB)</p>
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

            {/* Also allow pasting a direct URL */}
            <div className="mt-2">
              <input
                type="url"
                value={countryForm.imageUrl?.startsWith("blob:") ? "" : (countryForm.imageUrl || "")}
                onChange={(e) => setCountryForm((p) => ({ ...p, imageUrl: e.target.value }))}
                placeholder="Or paste an image URL (e.g. /images/visa-card-fallback.svg)"
                className="w-full bg-surface-2 border border-border text-text-primary text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan placeholder-text-muted"
                id="country-image-url"
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

          {/* Required Documents — checkboxes */}
          <div>
            <label className="text-sm font-medium text-text-secondary mb-3 block">
              Required Documents
              <span className="ml-2 text-xs text-text-muted font-normal">Select which documents applicants must upload</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DOC_OPTIONS.map(({ key, label }) => {
                const checked = countryForm.requiredDocuments.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleRequiredDoc(key)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150 text-left ${
                      checked
                        ? "border-cyan/60 bg-cyan/10 text-cyan"
                        : "border-border bg-surface-2 text-text-muted hover:border-cyan/30 hover:text-text-primary"
                    }`}
                    id={`doc-toggle-${key}`}
                  >
                    <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${checked ? "bg-cyan border-cyan" : "border-border"}`}>
                      {checked && <CheckCircle size={10} className="text-background" />}
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>
            {countryForm.requiredDocuments.length === 0 && (
              <p className="text-xs text-amber-400 mt-2">⚠ At least one document type should be selected.</p>
            )}
          </div>

          {/* Visa Requirements — dynamic free-text list */}
          <div>
            <label className="text-sm font-medium text-text-secondary mb-2 block">
              Visa Requirements
              <span className="ml-2 text-xs text-text-muted font-normal">Free-text info shown to applicants</span>
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
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;
