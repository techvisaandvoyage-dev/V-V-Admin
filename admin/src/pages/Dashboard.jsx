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
  MapPin, Globe, Users, FileText, X, Save, AlertCircle, UploadCloud, Image as ImageIcon, Settings, CreditCard, IndianRupee, Sliders, HelpCircle, BookOpen,
  ExternalLink, GalleryVertical, BadgeCheck, ShieldCheck, ListChecks, ScrollText, CalendarDays,
  Briefcase, Banknote, GraduationCap, Stethoscope, Stamp, Receipt, Home, Car, HeartHandshake, Plane, Building2,
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
import BlogAdminPanel from "../components/blog/BlogAdminPanel";
import { useUIStore } from "../store/uiStore";
import { useDataStore } from "../store/dataStore";
import { useAuthStore, api, SERVER_URL } from "../store/authStore";
import { ANALYTICS, MONTHLY_REVENUE } from "../data/bookings";
import { getCountrySearchHint, matchesCountrySearch } from "../utils/countrySearch";
import { getApplicationProgress } from "../utils/applicationProgress";

/**
 * Icon mapping for every built-in document key (mirrors `DOCUMENT_META` on the
 * client). Any custom doc the admin adds falls back to a generic FileText icon
 * since custom labels can't ship icons. Used by both the universal Required
 * Documents control card and the per-country edit modal's checklist.
 */
const DOCUMENT_ICON_MAP = {
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
const getDocumentIcon = (key) => DOCUMENT_ICON_MAP[key] || FileText;

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
const DESTINATION_PAGE_DEFAULT_WHY_BOOK_NOW = [
  "Fast document pre-check by visa specialists",
  "Transparent pricing and status updates",
  "Dedicated support throughout your application",
];

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

const DESTINATION_PAGE_DEFAULT_HOW_IT_WORKS = [
  { title: "Apply with SprintVisa", description: "Upload your documents on SprintVisa or share over WhatsApp with our visa expert." },
  { title: "Experts review the documents", description: "Our visa experts will verify your documents." },
  { title: "Prepare the application", description: "Our visa expert will help you create the application for document submission." },
  { title: "Visit the Visa Application Center", description: "Traveller visits their nearest Visa Application Center for document submission." },
  { title: "Get your visa", description: "Traveller will collect their passport from VAC or via courier with a stamped visa." },
  { title: "Enjoy your vacation", description: "Thanks for choosing SprintVisa and we wish you an amazing journey." },
];

/** Suggestions shown in the Visa Type combo-box on the country edit modal — admins can pick or type their own. */
const VISA_TYPE_SUGGESTIONS = [
  "Tourist Visa",
  "Business Visa",
  "Student Visa",
  "Work Visa",
  "Transit Visa",
  "Schengen Visa",
  "eVisa",
  "Visa on Arrival",
  "e-Tourist Visa",
  "Sticker Visa",
  "Visa Free",
  "Medical Visa",
  "Type C Schengen",
  "Standard Visitor",
  "B1/B2 Tourist",
  "Temporary Visitor",
  "Temporary Resident",
  "Social Visit Pass",
  "Tourist Visa (600)",
];

/** Suggestions shown in the universal Validity control + country edit modal. */
const VALIDITY_SUGGESTIONS = [
  "7 Days",
  "15 Days",
  "30 Days",
  "60 Days",
  "90 Days",
  "180 Days",
  "1 Year",
  "5 Years",
];

/** Suggestions shown in the universal Processing Days control + country edit modal. */
const PROCESSING_DAYS_SUGGESTIONS = [
  "1-3 days",
  "3-5 days",
  "5-7 days",
  "5-10 days",
  "7-10 days",
  "10-15 days",
  "15-30 days",
  "2-3 weeks",
  "Per visa policy",
];

const DESTINATION_PAGE_DEFAULT_VISA_REQUIREMENTS = [
  "Original passport valid for at least 6 months with two blank pages",
  "Recent passport-size photograph on white background",
  "Confirmed return flight tickets",
  "Hotel booking or proof of accommodation for the entire stay",
  "Bank statements showing sufficient funds for the trip",
];

const mapDestinationWhyBookNowFromApi = (s) => {
  const a = s?.destinationWhyBookNow;
  return Array.isArray(a) && a.length
    ? a.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [...DESTINATION_PAGE_DEFAULT_WHY_BOOK_NOW];
};

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

const mapDestinationHowItWorksFromApi = (s) => {
  const a = s?.destinationHowItWorks;
  if (Array.isArray(a) && a.length) {
    return a.map((x) => ({
      title: String(x?.title ?? "").trim(),
      description: String(x?.description ?? "").trim(),
    }));
  }
  return DESTINATION_PAGE_DEFAULT_HOW_IT_WORKS.map((x) => ({ ...x }));
};

const mapDestinationVisaRequirementsFromApi = (s) => {
  const a = s?.destinationVisaRequirements;
  return Array.isArray(a) && a.length
    ? a.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [...DESTINATION_PAGE_DEFAULT_VISA_REQUIREMENTS];
};

/** Lowercase trim key for matching global destination bullets / FAQ questions. */
const normDestKey = (s) => String(s ?? "").trim().toLowerCase();

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
  destinationWhyBookNow: mapDestinationWhyBookNowFromApi(s),
  destinationIncludedItems: mapDestinationIncludedFromApi(s),
  destinationFaqs: mapDestinationFaqsFromApi(s),
  destinationHowItWorks: mapDestinationHowItWorksFromApi(s),
  destinationVisaRequirements: mapDestinationVisaRequirementsFromApi(s),
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

/**
 * Compact "switch" used inside each universal control card header. Renders as a
 * pill with an animated knob — green when the field is visible on the public
 * client, neutral when hidden. While the API call is in flight the button is
 * disabled so users can't double-click it.
 */
const DisplayToggle = ({ active, busy, onClick, labelOn = "Visible on client", labelOff = "Hidden on client" }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/60"
          : "border-border bg-surface-3 text-text-muted hover:border-cyan/30"
      } ${busy ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
      aria-pressed={active}
    >
      <span
        className={`relative inline-flex h-3.5 w-7 rounded-full transition-colors ${
          active ? "bg-emerald-500" : "bg-surface-2 border border-border"
        }`}
      >
        <span
          className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform ${
            active ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
      {active ? labelOn : labelOff}
    </button>
  );
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
    destinationWhyBookNow: [...DESTINATION_PAGE_DEFAULT_WHY_BOOK_NOW],
    destinationIncludedItems: [...DESTINATION_PAGE_DEFAULT_INCLUDED],
    destinationFaqs: DESTINATION_PAGE_DEFAULT_FAQS.map((f) => ({ ...f })),
    destinationHowItWorks: DESTINATION_PAGE_DEFAULT_HOW_IT_WORKS.map((x) => ({ ...x })),
    destinationVisaRequirements: [...DESTINATION_PAGE_DEFAULT_VISA_REQUIREMENTS],
  });
  /** Which settings subsection is currently saving (null = idle). */
  const [savingSettingsKey, setSavingSettingsKey] = useState(null);
  /**
   * Universal control system — admin sets a single global Visa Type / Validity that
   * applies to every country card and detail page unless an individual country edit
   * carries a per-country override. `defaults` mirrors the server state, while the
   * `*Picker`/`*Custom` pair drives the dropdown + free-text controls.
   */
  const [globalDefaults, setGlobalDefaults] = useState({
    globalVisaType: "",
    globalValidity: "",
    globalProcessingDays: "",
    globalRequiredDocuments: [],
  });
  const [globalDefaultStats, setGlobalDefaultStats] = useState({
    totalCountries: 0,
    usingGlobalVisaType: 0,
    usingGlobalValidity: 0,
    usingGlobalProcessingDays: 0,
    usingGlobalRequiredDocuments: 0,
    overridingVisaType: 0,
    overridingValidity: 0,
    overridingProcessingDays: 0,
    overridingRequiredDocuments: 0,
  });
  /** Mirrors `Settings.show*` — when false, the public client hides that tile/section. */
  const [displayToggles, setDisplayToggles] = useState({
    showVisaType: true,
    showValidity: true,
    showProcessingDays: true,
    showRequiredDocuments: true,
  });
  const [visaTypePicker, setVisaTypePicker] = useState("");
  const [visaTypeCustom, setVisaTypeCustom] = useState("");
  const [validityPicker, setValidityPicker] = useState("");
  const [validityCustom, setValidityCustom] = useState("");
  const [processingDaysPicker, setProcessingDaysPicker] = useState("");
  const [processingDaysCustom, setProcessingDaysCustom] = useState("");
  /** Merged built-in + admin's custom documents, populated from /admin/control/country-defaults. */
  const [documentCatalog, setDocumentCatalog] = useState([]);
  /** Current selection in the Required Documents universal-control checkbox grid. */
  const [requiredDocsDraft, setRequiredDocsDraft] = useState([]);
  /** Free-text field used to add a brand-new custom document type. */
  const [newCustomDocLabel, setNewCustomDocLabel] = useState("");
  const [savingCustomDoc, setSavingCustomDoc] = useState(false);
  const [savingControlKey, setSavingControlKey] = useState(null);
  /** Tracks which toggle is currently flipping (so we can disable just that switch). */
  const [togglingDisplayKey, setTogglingDisplayKey] = useState(null);
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
          await Promise.all([fetchCountries(), loadGlobalCountryDefaults()]);
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
              destinationWhyBookNow: mapDestinationWhyBookNowFromApi(s),
              destinationIncludedItems: mapDestinationIncludedFromApi(s),
              destinationFaqs: mapDestinationFaqsFromApi(s),
              destinationHowItWorks: mapDestinationHowItWorksFromApi(s),
              destinationVisaRequirements: mapDestinationVisaRequirementsFromApi(s),
            }));
          }
          await loadGlobalCountryDefaults();
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

  // Fallback document catalog used before the API returns the live list. The
  // canonical source is `Settings.customDocuments` + the server's built-in
  // catalog (see `server/controllers/countryController.js`). Keep this in
  // sync with that file so the admin sees the same set on first paint.
  const DOC_OPTIONS = [
    { key: "passport", label: "Passport" },
    { key: "oldPassport", label: "Old / Previous Passport" },
    { key: "photo", label: "Passport Photo" },
    { key: "idCard", label: "Aadhaar / ID Card" },
    { key: "panCard", label: "PAN Card" },
    { key: "drivingLicense", label: "Driving License" },
    { key: "birthCertificate", label: "Birth Certificate" },
    { key: "dobCertificate", label: "DOB Certificate" },
    { key: "marriageCertificate", label: "Marriage Certificate" },
    { key: "educationCertificate", label: "Education / Academic Records" },
    { key: "employmentLetter", label: "Employment Letter" },
    { key: "offerLetter", label: "Offer Letter" },
    { key: "salarySlip", label: "Salary Slip / Pay Stub" },
    { key: "form16", label: "Form 16" },
    { key: "taxReturn", label: "ITR / Tax Return" },
    { key: "bankStatement", label: "Bank Statement" },
    { key: "bankCertificate", label: "Bank Solvency Certificate" },
    { key: "propertyDocuments", label: "Property Documents" },
    { key: "travelInsurance", label: "Travel Insurance" },
    { key: "healthInsurance", label: "Health Insurance" },
    { key: "flightTicket", label: "Flight Ticket" },
    { key: "hotelBooking", label: "Hotel Booking" },
    { key: "itinerary", label: "Travel Itinerary" },
    { key: "coverLetter", label: "Cover Letter" },
    { key: "invitationLetter", label: "Invitation Letter" },
    { key: "sponsorLetter", label: "Sponsor / Affidavit Letter" },
    { key: "policeClearance", label: "Police Clearance Certificate" },
    { key: "noObjectionCertificate", label: "No Objection Certificate (NOC)" },
    { key: "yellowFever", label: "Yellow Fever Certificate" },
    { key: "covidVaccination", label: "COVID Vaccination Certificate" },
    { key: "visaApplicationForm", label: "Visa Application Form" },
    { key: "businessLicense", label: "Business License" },
    { key: "companyRegistration", label: "Company Registration Certificate" },
  ];

  // Country form state
  const [countryForm, setCountryForm] = useState({
    name: "", flagEmoji: "🌍", basePrice: "", processingDays: "", difficulty: "moderate",
    visaType: "", validity: "", continent: "", description: "", requirements: [""], imageUrl: "",
    requiredDocuments: ["passport"], successRate: "80", trending: false,
    whyBookNow: [], includedItems: [], faqs: [], howItWorks: [],
    excludeDestinationWhyBookNow: [],
    excludeDestinationIncludedItems: [],
    excludeDestinationFaqQuestions: [],
    excludeDestinationHowItWorksTitles: [],
    excludeDestinationVisaRequirements: [],
  });

  /** Snapshot of Settings → Destinations (for merging in the country edit modal). */
  const [countryModalGlobalDest, setCountryModalGlobalDest] = useState({
    whyBookNow: [],
    includedItems: [],
    faqs: [],
    howItWorks: [],
    visaRequirements: [],
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

  useEffect(() => {
    if (!countryModalOpen) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/admin/settings");
        if (cancelled || !data?.success || !data.settings) return;
        const s = data.settings;
        setCountryModalGlobalDest({
          whyBookNow: mapDestinationWhyBookNowFromApi(s),
          includedItems: mapDestinationIncludedFromApi(s),
          faqs: mapDestinationFaqsFromApi(s),
          howItWorks: mapDestinationHowItWorksFromApi(s),
          visaRequirements: mapDestinationVisaRequirementsFromApi(s),
        });
      } catch (err) {
        if (cancelled) return;
        if (err?.response?.status === 401) {
          handleUnauthorized();
          return;
        }
        setCountryModalGlobalDest({
          whyBookNow: [...DESTINATION_PAGE_DEFAULT_WHY_BOOK_NOW],
          includedItems: [...DESTINATION_PAGE_DEFAULT_INCLUDED],
          faqs: DESTINATION_PAGE_DEFAULT_FAQS.map((f) => ({ ...f })),
          howItWorks: DESTINATION_PAGE_DEFAULT_HOW_IT_WORKS.map((x) => ({ ...x })),
          visaRequirements: [...DESTINATION_PAGE_DEFAULT_VISA_REQUIREMENTS],
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countryModalOpen]);

  // ── Country Manager handlers ───────────────────────────────
  const [isSavingCountry, setIsSavingCountry] = useState(false);
  const openEditCountry = (country) => {
    setCountryForm({
      ...country,
      basePrice: String(country.basePrice),
      successRate: String(country.successRate ?? 80),
      trending: Boolean(country.trending),
      validity: String(country.validity ?? ""),
      requirements: country.requirements?.length ? country.requirements : [""],
      requiredDocuments: country.requiredDocuments || ["passport"],
      whyBookNow: Array.isArray(country.whyBookNow) ? [...country.whyBookNow] : [],
      includedItems: Array.isArray(country.includedItems) ? [...country.includedItems] : [],
      faqs: Array.isArray(country.faqs)
        ? country.faqs.map((f) => ({
            question: String(f?.question ?? ""),
            answer: String(f?.answer ?? ""),
          }))
        : [],
      howItWorks: Array.isArray(country.howItWorks)
        ? country.howItWorks.map((s) => ({
            title: String(s?.title ?? ""),
            description: String(s?.description ?? ""),
          }))
        : [],
      excludeDestinationWhyBookNow: Array.isArray(country.excludeDestinationWhyBookNow)
        ? [...country.excludeDestinationWhyBookNow]
        : [],
      excludeDestinationIncludedItems: Array.isArray(country.excludeDestinationIncludedItems)
        ? [...country.excludeDestinationIncludedItems]
        : [],
      excludeDestinationFaqQuestions: Array.isArray(country.excludeDestinationFaqQuestions)
        ? [...country.excludeDestinationFaqQuestions]
        : [],
      excludeDestinationHowItWorksTitles: Array.isArray(country.excludeDestinationHowItWorksTitles)
        ? [...country.excludeDestinationHowItWorksTitles]
        : [],
      excludeDestinationVisaRequirements: Array.isArray(country.excludeDestinationVisaRequirements)
        ? [...country.excludeDestinationVisaRequirements]
        : [],
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
      // Sent raw (no "5-10" fallback) so the server can auto-flip
      // `useGlobalProcessingDays = true` when the admin clears the field or
      // re-matches the global default. The DB-level default already supplies
      // "5-10" for brand-new countries created from `addCountry`.
      processingDays: String(countryForm.processingDays ?? "").trim(),
      validity: String(countryForm.validity ?? "").trim(),
      requirements: countryForm.requirements.filter(Boolean),
      requiredDocuments: countryForm.requiredDocuments,
      successRate: Number(countryForm.successRate) || 80,
      trending: Boolean(countryForm.trending),
      whyBookNow: (countryForm.whyBookNow || [])
        .map((s) => String(s ?? "").trim())
        .filter(Boolean),
      includedItems: (countryForm.includedItems || [])
        .map((s) => String(s ?? "").trim())
        .filter(Boolean),
      faqs: (countryForm.faqs || [])
        .map((f) => ({
          question: String(f?.question ?? "").trim(),
          answer: String(f?.answer ?? "").trim(),
        }))
        .filter((f) => f.question && f.answer),
      howItWorks: (countryForm.howItWorks || [])
        .map((s) => ({
          title: String(s?.title ?? "").trim(),
          description: String(s?.description ?? "").trim(),
        }))
        .filter((s) => s.title && s.description),
      excludeDestinationWhyBookNow: (countryForm.excludeDestinationWhyBookNow || [])
        .map((s) => normDestKey(s))
        .filter(Boolean),
      excludeDestinationIncludedItems: (countryForm.excludeDestinationIncludedItems || [])
        .map((s) => normDestKey(s))
        .filter(Boolean),
      excludeDestinationFaqQuestions: (countryForm.excludeDestinationFaqQuestions || [])
        .map((s) => normDestKey(s))
        .filter(Boolean),
      excludeDestinationHowItWorksTitles: (countryForm.excludeDestinationHowItWorksTitles || [])
        .map((s) => normDestKey(s))
        .filter(Boolean),
      excludeDestinationVisaRequirements: (countryForm.excludeDestinationVisaRequirements || [])
        .map((s) => normDestKey(s))
        .filter(Boolean),
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

  /**
   * Fetch the universal Visa Type / Validity defaults plus override stats. Called
   * when the Controls tab mounts and after each successful global update.
   */
  const loadGlobalCountryDefaults = async () => {
    try {
      const { data } = await api.get("/admin/control/country-defaults");
      if (data?.success) {
        const next = {
          globalVisaType: String(data.defaults?.globalVisaType ?? "").trim(),
          globalValidity: String(data.defaults?.globalValidity ?? "").trim(),
          globalProcessingDays: String(data.defaults?.globalProcessingDays ?? "").trim(),
          globalRequiredDocuments: Array.isArray(data.defaults?.globalRequiredDocuments)
            ? data.defaults.globalRequiredDocuments
                .map((k) => String(k ?? "").trim())
                .filter(Boolean)
            : [],
        };
        setGlobalDefaults(next);
        setGlobalDefaultStats({
          totalCountries: data.stats?.totalCountries ?? 0,
          usingGlobalVisaType: data.stats?.usingGlobalVisaType ?? 0,
          usingGlobalValidity: data.stats?.usingGlobalValidity ?? 0,
          usingGlobalProcessingDays: data.stats?.usingGlobalProcessingDays ?? 0,
          usingGlobalRequiredDocuments: data.stats?.usingGlobalRequiredDocuments ?? 0,
          overridingVisaType: data.stats?.overridingVisaType ?? 0,
          overridingValidity: data.stats?.overridingValidity ?? 0,
          overridingProcessingDays: data.stats?.overridingProcessingDays ?? 0,
          overridingRequiredDocuments: data.stats?.overridingRequiredDocuments ?? 0,
        });
        if (data.display) {
          setDisplayToggles({
            showVisaType: data.display.showVisaType !== false,
            showValidity: data.display.showValidity !== false,
            showProcessingDays: data.display.showProcessingDays !== false,
            showRequiredDocuments: data.display.showRequiredDocuments !== false,
          });
        }
        if (Array.isArray(data.documentCatalog)) {
          setDocumentCatalog(
            data.documentCatalog
              .map((d) => ({
                key: String(d?.key ?? "").trim(),
                label: String(d?.label ?? "").trim(),
                builtIn: d?.builtIn !== false,
              }))
              .filter((d) => d.key && d.label)
          );
        }
        // Pre-populate the required-docs draft from the live global selection so
        // the admin sees exactly what's currently applied. Falls back to just
        // "passport" if no global has been set yet — matches the legacy default.
        setRequiredDocsDraft(
          next.globalRequiredDocuments.length ? [...next.globalRequiredDocuments] : ["passport"]
        );
        // Pre-fill the dropdowns with whatever the global currently is so admins can
        // see at a glance what's live without first clicking around.
        if (next.globalVisaType && VISA_TYPE_SUGGESTIONS.includes(next.globalVisaType)) {
          setVisaTypePicker(next.globalVisaType);
          setVisaTypeCustom("");
        } else if (next.globalVisaType) {
          setVisaTypePicker("");
          setVisaTypeCustom(next.globalVisaType);
        }
        if (next.globalValidity && VALIDITY_SUGGESTIONS.includes(next.globalValidity)) {
          setValidityPicker(next.globalValidity);
          setValidityCustom("");
        } else if (next.globalValidity) {
          setValidityPicker("");
          setValidityCustom(next.globalValidity);
        }
        if (next.globalProcessingDays && PROCESSING_DAYS_SUGGESTIONS.includes(next.globalProcessingDays)) {
          setProcessingDaysPicker(next.globalProcessingDays);
          setProcessingDaysCustom("");
        } else if (next.globalProcessingDays) {
          setProcessingDaysPicker("");
          setProcessingDaysCustom(next.globalProcessingDays);
        }
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
      }
      // Defaults stay at their initial empty values — the UI will show "Not set yet".
    }
  };

  /**
   * Resolve the value the admin actually wants to apply. Custom input wins over the
   * dropdown so an admin can override one without clearing the other manually.
   */
  const resolveControlValue = (picker, custom) => {
    const trimmedCustom = String(custom ?? "").trim();
    if (trimmedCustom) return trimmedCustom;
    return String(picker ?? "").trim();
  };

  /**
   * POST the chosen Visa Type to the universal control endpoint. On success the
   * server flips `useGlobalVisaType=true` on every country so the change is visible
   * immediately on cards / details.
   */
  const runUpdateGlobalVisaType = async () => {
    const visaType = resolveControlValue(visaTypePicker, visaTypeCustom);
    if (!visaType) {
      showToast("Pick a Visa Type from the dropdown or type your own.", "error");
      return;
    }
    setSavingControlKey("visa-type");
    try {
      const { data } = await api.post("/admin/control/visa-type", { visaType });
      if (data?.success) {
        showToast(data.message || `Visa Type set to "${visaType}".`, "success");
        await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
        setVisaTypeCustom("");
      } else {
        showToast(data?.message || "Failed to update global visa type.", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      let toastMsg = serverMsg || error?.message || "Failed to update global visa type.";
      if (status === 404) {
        toastMsg =
          "Control endpoint not found — restart the API locally or redeploy the server so /api/admin/control/visa-type is available.";
      } else if (status) {
        toastMsg = `${toastMsg} (HTTP ${status})`;
      }
      // eslint-disable-next-line no-console
      console.error("Update global visa type failed:", { status, serverMsg, error });
      showToast(toastMsg, "error");
    } finally {
      setSavingControlKey(null);
    }
  };

  /** Same as `runUpdateGlobalVisaType` but for the universal Validity control. */
  const runUpdateGlobalValidity = async () => {
    const validity = resolveControlValue(validityPicker, validityCustom);
    if (!validity) {
      showToast("Pick a Validity from the dropdown or type your own.", "error");
      return;
    }
    setSavingControlKey("validity");
    try {
      const { data } = await api.post("/admin/control/validity", { validity });
      if (data?.success) {
        showToast(data.message || `Validity set to "${validity}".`, "success");
        await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
        setValidityCustom("");
      } else {
        showToast(data?.message || "Failed to update global validity.", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      let toastMsg = serverMsg || error?.message || "Failed to update global validity.";
      if (status === 404) {
        toastMsg =
          "Control endpoint not found — restart the API locally or redeploy the server so /api/admin/control/validity is available.";
      } else if (status) {
        toastMsg = `${toastMsg} (HTTP ${status})`;
      }
      // eslint-disable-next-line no-console
      console.error("Update global validity failed:", { status, serverMsg, error });
      showToast(toastMsg, "error");
    } finally {
      setSavingControlKey(null);
    }
  };

  /** Same as the other two but for the universal Processing Days control. */
  const runUpdateGlobalProcessingDays = async () => {
    const processingDays = resolveControlValue(processingDaysPicker, processingDaysCustom);
    if (!processingDays) {
      showToast("Pick Processing Days from the dropdown or type your own.", "error");
      return;
    }
    setSavingControlKey("processing-days");
    try {
      const { data } = await api.post("/admin/control/processing-days", { processingDays });
      if (data?.success) {
        showToast(data.message || `Processing Days set to "${processingDays}".`, "success");
        await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
        setProcessingDaysCustom("");
      } else {
        showToast(data?.message || "Failed to update global processing days.", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      let toastMsg = serverMsg || error?.message || "Failed to update global processing days.";
      if (status === 404) {
        toastMsg =
          "Control endpoint not found — restart the API locally or redeploy the server so /api/admin/control/processing-days is available.";
      } else if (status) {
        toastMsg = `${toastMsg} (HTTP ${status})`;
      }
      // eslint-disable-next-line no-console
      console.error("Update global processing days failed:", { status, serverMsg, error });
      showToast(toastMsg, "error");
    } finally {
      setSavingControlKey(null);
    }
  };

  /**
   * Apply the current Required Documents draft as the new universal default.
   * On success the server flips `useGlobalRequiredDocuments=true` on every
   * country so this list shows up immediately on the public site.
   */
  const runUpdateGlobalRequiredDocuments = async () => {
    const docs = Array.isArray(requiredDocsDraft) ? requiredDocsDraft.filter(Boolean) : [];
    setSavingControlKey("required-documents");
    try {
      const { data } = await api.post("/admin/control/required-documents", {
        requiredDocuments: docs,
      });
      if (data?.success) {
        showToast(
          data.message || `Required Documents set on all countries (${docs.length} item${docs.length === 1 ? "" : "s"}).`,
          "success"
        );
        await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
      } else {
        showToast(data?.message || "Failed to update required documents.", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      let toastMsg = serverMsg || error?.message || "Failed to update required documents.";
      if (status === 404) {
        toastMsg =
          "Control endpoint not found — restart the API so /api/admin/control/required-documents is available.";
      } else if (status) {
        toastMsg = `${toastMsg} (HTTP ${status})`;
      }
      // eslint-disable-next-line no-console
      console.error("Update global required documents failed:", { status, serverMsg, error });
      showToast(toastMsg, "error");
    } finally {
      setSavingControlKey(null);
    }
  };

  /** POST a new admin-defined document type to the catalog. */
  const runAddCustomDocument = async () => {
    const label = String(newCustomDocLabel ?? "").trim();
    if (!label) {
      showToast("Type a document label first.", "error");
      return;
    }
    setSavingCustomDoc(true);
    try {
      const { data } = await api.post("/admin/control/custom-documents", {
        action: "add",
        label,
      });
      if (data?.success) {
        showToast(data.message || `"${label}" added.`, "success");
        setNewCustomDocLabel("");
        await loadGlobalCountryDefaults();
      } else {
        showToast(data?.message || "Failed to add custom document.", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      let toastMsg = serverMsg || error?.message || "Failed to add custom document.";
      if (status === 404) {
        toastMsg =
          "Endpoint not found — restart the API so /api/admin/control/custom-documents is available.";
      } else if (status) {
        toastMsg = `${toastMsg} (HTTP ${status})`;
      }
      // eslint-disable-next-line no-console
      console.error("Add custom doc failed:", { status, serverMsg, error });
      showToast(toastMsg, "error");
    } finally {
      setSavingCustomDoc(false);
    }
  };

  /** Remove a custom document type from the catalog and every country. */
  const runRemoveCustomDocument = async (key, label) => {
    if (!key) return;
    if (!window.confirm(`Remove "${label}" from the document catalog and every country?`)) return;
    setSavingCustomDoc(true);
    try {
      const { data } = await api.post("/admin/control/custom-documents", {
        action: "remove",
        key,
      });
      if (data?.success) {
        showToast(data.message || "Custom document removed.", "success");
        await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
        // Drop the removed key from the local draft so the "Apply" payload
        // doesn't try to re-introduce a doc that no longer exists.
        setRequiredDocsDraft((prev) => prev.filter((k) => k !== key));
      } else {
        showToast(data?.message || "Failed to remove custom document.", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      const toastMsg = serverMsg || error?.message || "Failed to remove custom document.";
      // eslint-disable-next-line no-console
      console.error("Remove custom doc failed:", { status, serverMsg, error });
      showToast(toastMsg, "error");
    } finally {
      setSavingCustomDoc(false);
    }
  };

  /**
   * Flip one of the universal "show on client" toggles. We update local state
   * optimistically, then call the API. On failure we revert and surface a toast so
   * the admin sees that the switch didn't actually persist.
   */
  const runToggleDisplay = async (key) => {
    const next = !displayToggles[key];
    setDisplayToggles((prev) => ({ ...prev, [key]: next }));
    setTogglingDisplayKey(key);
    try {
      const { data } = await api.post("/admin/control/display-toggles", { [key]: next });
      if (data?.success) {
        const live = data.display || {};
        setDisplayToggles({
          showVisaType: live.showVisaType !== false,
          showValidity: live.showValidity !== false,
          showProcessingDays: live.showProcessingDays !== false,
          showRequiredDocuments: live.showRequiredDocuments !== false,
        });
        const labels = {
          showVisaType: "Visa Type",
          showValidity: "Validity",
          showProcessingDays: "Processing Days",
          showRequiredDocuments: "Required Documents",
        };
        showToast(`${labels[key]} ${next ? "shown" : "hidden"} on the public site.`, "success");
        // Bump country fetch so admin tables re-pull resolved values right away.
        await fetchCountries();
      } else {
        // Revert optimistic update if the server reports failure.
        setDisplayToggles((prev) => ({ ...prev, [key]: !next }));
        showToast(data?.message || "Failed to update display toggle.", "error");
      }
    } catch (error) {
      setDisplayToggles((prev) => ({ ...prev, [key]: !next }));
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      let toastMsg = serverMsg || error?.message || "Failed to update display toggle.";
      if (status === 404) {
        toastMsg =
          "Toggle endpoint not found — restart the API so /api/admin/control/display-toggles is available.";
      } else if (status) {
        toastMsg = `${toastMsg} (HTTP ${status})`;
      }
      // eslint-disable-next-line no-console
      console.error("Toggle display failed:", { status, serverMsg, error });
      showToast(toastMsg, "error");
    } finally {
      setTogglingDisplayKey(null);
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
    { id: "blogs",        label: "Blog",          icon: BookOpen },
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

          {activeTab === "blogs" && <BlogAdminPanel />}

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

              {/* ══════════════════════════════════════════════════════════
                  Universal Visa Type control — sets `Settings.globalVisaType`
                  and resets every country's `useGlobalVisaType=true`. Admins
                  can later override one country individually in Country Manager.
                  The toggle in the header hides the Visa Type tile on every
                  public card / details page when switched off.
                  ══════════════════════════════════════════════════════════ */}
              <Card>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-semibold text-text-primary flex items-center gap-2">
                        <ShieldCheck size={18} className="text-cyan" />
                        Update Visa Type (universal)
                      </h2>
                      <DisplayToggle
                        active={displayToggles.showVisaType}
                        busy={togglingDisplayKey === "showVisaType"}
                        onClick={() => runToggleDisplay("showVisaType")}
                        labelOn="Visible on client"
                        labelOff="Hidden on client"
                      />
                    </div>
                    <p className="text-xs text-text-muted mt-1.5 max-w-2xl leading-relaxed">
                      Sets a single <span className="text-text-primary font-medium">Visa Type</span> on every country card
                      and detail page. Pick a value from the dropdown <span className="text-text-primary font-medium">or</span>{" "}
                      type your own. Per-country overrides set in{" "}
                      <span className="text-text-primary font-medium">Country Manager</span> are restored to the global value
                      when you click <span className="text-text-primary font-medium">Update All Visa Types</span>. You can
                      re-introduce a per-country override at any time afterwards.
                    </p>
                    <p className="text-[11px] text-text-muted mt-2">
                      Current global:{" "}
                      <span className="text-text-primary font-medium">
                        {globalDefaults.globalVisaType || "Not set yet (cards fall back to each country's stored value)"}
                      </span>
                      {globalDefaultStats.totalCountries > 0 && (
                        <>
                          {" "}· {globalDefaultStats.usingGlobalVisaType}/{globalDefaultStats.totalCountries} countries use the global,{" "}
                          <span className="text-amber-400/90">{globalDefaultStats.overridingVisaType}</span> override it.
                        </>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="shrink-0"
                    leftIcon={<Save size={15} />}
                    loading={savingControlKey === "visa-type"}
                    disabled={!resolveControlValue(visaTypePicker, visaTypeCustom)}
                    onClick={runUpdateGlobalVisaType}
                  >
                    Update All Visa Types
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Pick a Visa Type"
                    value={visaTypePicker}
                    onChange={(e) => {
                      setVisaTypePicker(e.target.value);
                      setVisaTypeCustom("");
                    }}
                    options={VISA_TYPE_SUGGESTIONS.map((v) => ({ value: v, label: v }))}
                    placeholder="— choose one —"
                    id="control-visa-type-picker"
                  />
                  <Input
                    label="Or type a custom value"
                    value={visaTypeCustom}
                    onChange={(e) => {
                      setVisaTypeCustom(e.target.value);
                      if (e.target.value.trim()) setVisaTypePicker("");
                    }}
                    placeholder="e.g. Sticker Visa, Diplomatic Visa…"
                    id="control-visa-type-custom"
                    helper="Custom value overrides the dropdown above."
                  />
                </div>
              </Card>

              {/* ══════════════════════════════════════════════════════════
                  Universal Validity control — mirror of the Visa Type card.
                  ══════════════════════════════════════════════════════════ */}
              <Card>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-semibold text-text-primary flex items-center gap-2">
                        <CalendarDays size={18} className="text-cyan" />
                        Update Validity (universal)
                      </h2>
                      <DisplayToggle
                        active={displayToggles.showValidity}
                        busy={togglingDisplayKey === "showValidity"}
                        onClick={() => runToggleDisplay("showValidity")}
                        labelOn="Visible on client"
                        labelOff="Hidden on client"
                      />
                    </div>
                    <p className="text-xs text-text-muted mt-1.5 max-w-2xl leading-relaxed">
                      Same model as Visa Type — picks a single global <span className="text-text-primary font-medium">Validity</span>{" "}
                      (e.g. <span className="text-text-primary font-medium">90 Days</span>) applied to every country card and detail
                      page. Per-country overrides are restored to the global value when you click{" "}
                      <span className="text-text-primary font-medium">Update All Validities</span>.
                    </p>
                    <p className="text-[11px] text-text-muted mt-2">
                      Current global:{" "}
                      <span className="text-text-primary font-medium">
                        {globalDefaults.globalValidity || "Not set yet (cards show '—' when neither global nor per-country exists)"}
                      </span>
                      {globalDefaultStats.totalCountries > 0 && (
                        <>
                          {" "}· {globalDefaultStats.usingGlobalValidity}/{globalDefaultStats.totalCountries} countries use the global,{" "}
                          <span className="text-amber-400/90">{globalDefaultStats.overridingValidity}</span> override it.
                        </>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="shrink-0"
                    leftIcon={<Save size={15} />}
                    loading={savingControlKey === "validity"}
                    disabled={!resolveControlValue(validityPicker, validityCustom)}
                    onClick={runUpdateGlobalValidity}
                  >
                    Update All Validities
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Pick a Validity"
                    value={validityPicker}
                    onChange={(e) => {
                      setValidityPicker(e.target.value);
                      setValidityCustom("");
                    }}
                    options={VALIDITY_SUGGESTIONS.map((v) => ({ value: v, label: v }))}
                    placeholder="— choose one —"
                    id="control-validity-picker"
                  />
                  <Input
                    label="Or type a custom value"
                    value={validityCustom}
                    onChange={(e) => {
                      setValidityCustom(e.target.value);
                      if (e.target.value.trim()) setValidityPicker("");
                    }}
                    placeholder="e.g. 45 Days, 18 Months, Per visa policy…"
                    id="control-validity-custom"
                    helper="Custom value overrides the dropdown above."
                  />
                </div>
              </Card>

              {/* ══════════════════════════════════════════════════════════
                  Universal Processing Days control — mirror of the other two.
                  The toggle hides the Processing tile on the public client.
                  ══════════════════════════════════════════════════════════ */}
              <Card>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-semibold text-text-primary flex items-center gap-2">
                        <Clock size={18} className="text-cyan" />
                        Update Processing Days (universal)
                      </h2>
                      <DisplayToggle
                        active={displayToggles.showProcessingDays}
                        busy={togglingDisplayKey === "showProcessingDays"}
                        onClick={() => runToggleDisplay("showProcessingDays")}
                        labelOn="Visible on client"
                        labelOff="Hidden on client"
                      />
                    </div>
                    <p className="text-xs text-text-muted mt-1.5 max-w-2xl leading-relaxed">
                      Same model as Visa Type / Validity — sets a single global{" "}
                      <span className="text-text-primary font-medium">Processing Days</span>{" "}
                      (e.g. <span className="text-text-primary font-medium">5-10 days</span>) on every country card and detail page.
                      Per-country overrides are restored to the global value when you click{" "}
                      <span className="text-text-primary font-medium">Update All Processing Days</span>.
                    </p>
                    <p className="text-[11px] text-text-muted mt-2">
                      Current global:{" "}
                      <span className="text-text-primary font-medium">
                        {globalDefaults.globalProcessingDays || "Not set yet (cards fall back to each country's stored value)"}
                      </span>
                      {globalDefaultStats.totalCountries > 0 && (
                        <>
                          {" "}· {globalDefaultStats.usingGlobalProcessingDays}/{globalDefaultStats.totalCountries} countries use the global,{" "}
                          <span className="text-amber-400/90">{globalDefaultStats.overridingProcessingDays}</span> override it.
                        </>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="shrink-0"
                    leftIcon={<Save size={15} />}
                    loading={savingControlKey === "processing-days"}
                    disabled={!resolveControlValue(processingDaysPicker, processingDaysCustom)}
                    onClick={runUpdateGlobalProcessingDays}
                  >
                    Update All Processing Days
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Pick Processing Days"
                    value={processingDaysPicker}
                    onChange={(e) => {
                      setProcessingDaysPicker(e.target.value);
                      setProcessingDaysCustom("");
                    }}
                    options={PROCESSING_DAYS_SUGGESTIONS.map((v) => ({ value: v, label: v }))}
                    placeholder="— choose one —"
                    id="control-processing-days-picker"
                  />
                  <Input
                    label="Or type a custom value"
                    value={processingDaysCustom}
                    onChange={(e) => {
                      setProcessingDaysCustom(e.target.value);
                      if (e.target.value.trim()) setProcessingDaysPicker("");
                    }}
                    placeholder="e.g. 4-6 days, 2 weeks, Per visa policy…"
                    id="control-processing-days-custom"
                    helper="Custom value overrides the dropdown above."
                  />
                </div>
              </Card>

              {/* ══════════════════════════════════════════════════════════
                  Universal Required Documents control — admin picks the
                  catalog rows that apply to every country, can add custom
                  document types, and toggles the whole section on/off for
                  the public client.
                  ══════════════════════════════════════════════════════════ */}
              <Card>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-semibold text-text-primary flex items-center gap-2">
                        <FileText size={18} className="text-cyan" />
                        Required Documents (universal)
                      </h2>
                      <DisplayToggle
                        active={displayToggles.showRequiredDocuments}
                        busy={togglingDisplayKey === "showRequiredDocuments"}
                        onClick={() => runToggleDisplay("showRequiredDocuments")}
                        labelOn="Visible on client"
                        labelOff="Hidden on client"
                      />
                    </div>
                    <p className="text-xs text-text-muted mt-1.5 max-w-2xl leading-relaxed">
                      Tick every document type applicants must upload globally. Click{" "}
                      <span className="text-text-primary font-medium">Update All Required Documents</span>{" "}
                      to apply it to every country. Per-country edits in{" "}
                      <span className="text-text-primary font-medium">Country Manager</span> are restored to the
                      global list. Need a new document type? Add it below — it appears in this checklist and on
                      every country edit modal instantly.
                    </p>
                    <p className="text-[11px] text-text-muted mt-2">
                      Current global:{" "}
                      <span className="text-text-primary font-medium">
                        {globalDefaults.globalRequiredDocuments.length
                          ? `${globalDefaults.globalRequiredDocuments.length} document${
                              globalDefaults.globalRequiredDocuments.length === 1 ? "" : "s"
                            }`
                          : "Not set yet (countries fall back to their stored override)"}
                      </span>
                      {globalDefaultStats.totalCountries > 0 && (
                        <>
                          {" "}· {globalDefaultStats.usingGlobalRequiredDocuments}/{globalDefaultStats.totalCountries} countries use the global,{" "}
                          <span className="text-amber-400/90">{globalDefaultStats.overridingRequiredDocuments}</span> override it.
                        </>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="shrink-0"
                    leftIcon={<Save size={15} />}
                    loading={savingControlKey === "required-documents"}
                    onClick={runUpdateGlobalRequiredDocuments}
                  >
                    Update All Required Documents
                  </Button>
                </div>

                {/* Checkbox grid built from the merged catalog. Built-in rows
                    are non-removable; custom rows expose a small "Delete" pill. */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {documentCatalog.length === 0 && (
                    <p className="col-span-full text-sm text-text-muted">
                      Loading document catalog…
                    </p>
                  )}
                  {documentCatalog.map(({ key, label, builtIn }) => {
                    const checked = requiredDocsDraft.includes(key);
                    const DocIcon = getDocumentIcon(key);
                    return (
                      <div
                        key={key}
                        className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150 ${
                          checked
                            ? "border-cyan/60 bg-cyan/10 text-cyan"
                            : "border-border bg-surface-2 text-text-muted hover:border-cyan/30 hover:text-text-primary"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setRequiredDocsDraft((prev) =>
                              prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                            )
                          }
                          className="flex items-center gap-2 flex-1 text-left min-w-0"
                          id={`control-doc-toggle-${key}`}
                        >
                          <span
                            className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                              checked ? "bg-cyan border-cyan" : "border-border"
                            }`}
                          >
                            {checked && <CheckCircle size={10} className="text-background" />}
                          </span>
                          <DocIcon size={15} className={`flex-shrink-0 ${checked ? "text-cyan" : "text-text-muted"}`} />
                          <span className="truncate" title={label}>{label}</span>
                          {!builtIn && (
                            <span className="ml-auto text-[10px] uppercase tracking-wider text-cyan/70">custom</span>
                          )}
                        </button>
                        {!builtIn && (
                          <button
                            type="button"
                            onClick={() => runRemoveCustomDocument(key, label)}
                            disabled={savingCustomDoc}
                            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full border border-red-500/40 bg-background text-red-300 hover:bg-red-500/15 flex items-center justify-center transition-colors disabled:opacity-50"
                            title={`Remove "${label}"`}
                            aria-label={`Remove ${label}`}
                          >
                            <X size={11} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {requiredDocsDraft.length === 0 && (
                  <p className="text-xs text-amber-400 mt-3">
                    ⚠ With zero documents selected the public site will fall back to each country's stored override.
                  </p>
                )}

                {/* Add custom document — admin types a label, server slugifies + prefixes. */}
                <div className="mt-5 rounded-2xl border border-dashed border-border bg-surface-2/40 p-4">
                  <p className="text-xs font-semibold text-text-primary mb-2 flex items-center gap-2">
                    <Plus size={14} className="text-cyan" />
                    Add a custom document type
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder='e.g. "Medical Insurance Certificate"'
                      value={newCustomDocLabel}
                      onChange={(e) => setNewCustomDocLabel(e.target.value)}
                      id="control-custom-doc-label"
                      className="flex-1"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Plus size={14} />}
                      loading={savingCustomDoc}
                      disabled={!newCustomDocLabel.trim()}
                      onClick={runAddCustomDocument}
                    >
                      Add to catalog
                    </Button>
                  </div>
                  <p className="text-[11px] text-text-muted mt-2 leading-relaxed">
                    Custom types use a <span className="font-mono text-text-primary">custom_xxx</span> key under the hood
                    and appear in every country edit modal. Removing one strips it from the catalog{" "}
                    <span className="text-text-primary font-medium">and</span> every country that referenced it.
                  </p>
                </div>
              </Card>

              <Card>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="font-semibold text-text-primary">Destination pages (all countries)</h2>
                    <p className="text-xs text-text-muted mt-1.5 max-w-2xl leading-relaxed">
                      The sections <span className="text-text-primary font-medium">Why book now?</span>,{" "}
                      <span className="text-text-primary font-medium">What&apos;s included</span>,{" "}
                      <span className="text-text-primary font-medium">FAQs</span>,{" "}
                      <span className="text-text-primary font-medium">How it works</span> and{" "}
                      <span className="text-text-primary font-medium">Visa Requirements</span> on every public destination page read from here.
                      These items show on <span className="text-text-primary font-medium">every country</span>. Any extras you add in{" "}
                      <span className="text-text-primary font-medium">Country Manager → Edit Country</span> are appended <span className="text-text-primary font-medium">below</span> these for that one country (duplicates are skipped).
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="shrink-0"
                    leftIcon={<Save size={15} />}
                    loading={savingSettingsKey === "destination-content"}
                    onClick={() => {
                      const whyBookNow = settingsForm.destinationWhyBookNow
                        .map((s) => String(s ?? "").trim())
                        .filter(Boolean);
                      const included = settingsForm.destinationIncludedItems
                        .map((s) => String(s ?? "").trim())
                        .filter(Boolean);
                      const faqs = settingsForm.destinationFaqs
                        .map((f) => ({
                          question: String(f?.question ?? "").trim(),
                          answer: String(f?.answer ?? "").trim(),
                        }))
                        .filter((f) => f.question && f.answer);
                      const howItWorks = settingsForm.destinationHowItWorks
                        .map((s) => ({
                          title: String(s?.title ?? "").trim(),
                          description: String(s?.description ?? "").trim(),
                        }))
                        .filter((s) => s.title && s.description);
                      const visaRequirements = (settingsForm.destinationVisaRequirements || [])
                        .map((s) => String(s ?? "").trim())
                        .filter(Boolean);
                      saveSettingsPartial(
                        "destination-content",
                        {
                          destinationWhyBookNow: whyBookNow,
                          destinationIncludedItems: included,
                          destinationFaqs: faqs,
                          destinationHowItWorks: howItWorks,
                          destinationVisaRequirements: visaRequirements,
                        },
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
                      <BadgeCheck size={18} className="text-cyan" />
                      Why book now?
                    </h3>
                    <p className="text-xs text-text-muted mb-4">
                      One reason per line. These appear on every destination page unless a specific country overrides them.
                    </p>
                    <div className="space-y-3 max-w-2xl">
                      {(settingsForm.destinationWhyBookNow || []).map((line, idx) => (
                        <div key={`why-${idx}`} className="flex gap-2 items-start">
                          <Input
                            className="flex-1"
                            value={line}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSettingsForm((p) => {
                                const next = [...(p.destinationWhyBookNow || [])];
                                next[idx] = v;
                                return { ...p, destinationWhyBookNow: next };
                              });
                            }}
                            placeholder="e.g. Fast document pre-check by visa specialists"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-red-400 hover:text-red-300"
                            onClick={() =>
                              setSettingsForm((p) => ({
                                ...p,
                                destinationWhyBookNow: (p.destinationWhyBookNow || []).filter((_, i) => i !== idx),
                              }))
                            }
                            aria-label="Remove reason"
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
                            destinationWhyBookNow: [...(p.destinationWhyBookNow || []), ""],
                          }))
                        }
                      >
                        Add reason
                      </Button>
                    </div>
                  </div>

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

                  <div className="bg-surface-2 border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-text-primary border-b border-border pb-3 mb-4 flex items-center gap-2">
                      <ListChecks size={18} className="text-cyan" />
                      How it works
                    </h3>
                    <p className="text-xs text-text-muted mb-4">
                      Numbered steps shown above &quot;Document Requirements&quot; on every destination page. Step number is
                      auto-generated from order. Incomplete pairs are skipped when you save.
                    </p>
                    <div className="space-y-4 max-w-3xl">
                      {(settingsForm.destinationHowItWorks || []).map((step, idx) => (
                        <div key={`how-${idx}`} className="rounded-xl border border-border bg-background p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-text-muted">Step {idx + 1}</p>
                            <button
                              type="button"
                              className="text-xs text-red-400 hover:text-red-300"
                              onClick={() =>
                                setSettingsForm((p) => ({
                                  ...p,
                                  destinationHowItWorks: (p.destinationHowItWorks || []).filter((_, i) => i !== idx),
                                }))
                              }
                            >
                              Remove
                            </button>
                          </div>
                          <Input
                            label="Title"
                            value={step.title}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSettingsForm((p) => {
                                const next = [...(p.destinationHowItWorks || [])];
                                next[idx] = { ...next[idx], title: v };
                                return { ...p, destinationHowItWorks: next };
                              });
                            }}
                            placeholder="e.g. Apply with SprintVisa"
                          />
                          <Textarea
                            label="Description"
                            rows={2}
                            value={step.description}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSettingsForm((p) => {
                                const next = [...(p.destinationHowItWorks || [])];
                                next[idx] = { ...next[idx], description: v };
                                return { ...p, destinationHowItWorks: next };
                              });
                            }}
                            placeholder="Short instruction shown under the title"
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
                            destinationHowItWorks: [
                              ...(p.destinationHowItWorks || []),
                              { title: "", description: "" },
                            ],
                          }))
                        }
                      >
                        Add step
                      </Button>
                    </div>
                  </div>

                  <div className="bg-surface-2 border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-text-primary border-b border-border pb-3 mb-4 flex items-center gap-2">
                      <ScrollText size={18} className="text-cyan" />
                      Visa Requirements
                    </h3>
                    <p className="text-xs text-text-muted mb-4">
                      One requirement per line. These show on every destination page (below &quot;How it works&quot;). Per-country
                      extras you add inside Country Manager are appended below — duplicates are skipped.
                    </p>
                    <div className="space-y-3 max-w-2xl">
                      {(settingsForm.destinationVisaRequirements || []).map((line, idx) => (
                        <div key={`visa-${idx}`} className="flex gap-2 items-start">
                          <Textarea
                            rows={2}
                            value={line}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSettingsForm((p) => {
                                const next = [...(p.destinationVisaRequirements || [])];
                                next[idx] = v;
                                return { ...p, destinationVisaRequirements: next };
                              });
                            }}
                            placeholder="e.g. Original passport valid for at least 6 months"
                          />
                          <button
                            type="button"
                            className="mt-1.5 p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            onClick={() =>
                              setSettingsForm((p) => ({
                                ...p,
                                destinationVisaRequirements: (p.destinationVisaRequirements || []).filter((_, i) => i !== idx),
                              }))
                            }
                            aria-label={`Remove requirement ${idx + 1}`}
                            title="Remove"
                          >
                            <X size={15} />
                          </button>
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
                            destinationVisaRequirements: [...(p.destinationVisaRequirements || []), ""],
                          }))
                        }
                      >
                        Add requirement
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
        size="full"
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch max-w-[1400px] mx-auto w-full lg:h-[calc(100vh-11.5rem)]">
          {/* ════════════════════════════════════════════════════════════
              LEFT — country basics, cover image, fees, type, etc.
              Independent scrollbar on lg+ so left + right scroll separately.
              ════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-5 lg:h-full lg:overflow-y-auto lg:pr-3 lg:pb-2">
            <div className="flex items-center gap-2">
              <BadgeCheck size={14} className="text-cyan" />
              <h3 className="text-xs font-semibold uppercase tracking-widest text-text-primary">Country basics</h3>
            </div>
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

          {/* Visa type (dropdown + editable) + Validity + Continent */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Input
                label="Visa Type"
                value={countryForm.visaType}
                onChange={(e) => setCountryForm((p) => ({ ...p, visaType: e.target.value }))}
                id="country-visa-type"
                placeholder="Pick or type a visa type"
                list="country-visa-type-options"
                helper="Pick from the dropdown or type a custom value."
              />
              <datalist id="country-visa-type-options">
                {VISA_TYPE_SUGGESTIONS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              {/* Universal control hint: shows whether this country is following the
                  global default or carrying a per-country override. Toggles
                  automatically based on what the admin types — clear the field or
                  match the global value to revert to global. */}
              {selectedCountry?.useGlobalVisaType === false ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Custom override — clear or match the global ({globalDefaults.globalVisaType || "not set"}) to use global again.
                </p>
              ) : (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Using global value{globalDefaults.globalVisaType ? ` (${globalDefaults.globalVisaType})` : ""}. Type something different to override.
                </p>
              )}
            </div>
            <div>
              <Input
                label="Validity"
                value={countryForm.validity}
                onChange={(e) => setCountryForm((p) => ({ ...p, validity: e.target.value }))}
                id="country-validity"
                placeholder="Pick or type a validity"
                list="country-validity-options"
                helper="Shown between visa type and fee on the country card."
              />
              <datalist id="country-validity-options">
                {VALIDITY_SUGGESTIONS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              {selectedCountry?.useGlobalValidity === false ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Custom override — clear or match the global ({globalDefaults.globalValidity || "not set"}) to use global again.
                </p>
              ) : (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Using global value{globalDefaults.globalValidity ? ` (${globalDefaults.globalValidity})` : ""}. Type something different to override.
                </p>
              )}
            </div>
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
            <div>
              <Input
                label="Processing Days"
                value={countryForm.processingDays}
                onChange={(e) => setCountryForm((p) => ({ ...p, processingDays: e.target.value }))}
                id="country-processing"
                placeholder="Pick or type processing days"
                list="country-processing-days-options"
              />
              <datalist id="country-processing-days-options">
                {PROCESSING_DAYS_SUGGESTIONS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              {/* Mirrors the Visa Type / Validity hints — flips automatically based
                  on whether this country is currently following the global default
                  (`useGlobalProcessingDays`) or has its own override. */}
              {selectedCountry?.useGlobalProcessingDays === false ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Custom override — clear or match the global ({globalDefaults.globalProcessingDays || "not set"}) to use global again.
                </p>
              ) : (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Using global value{globalDefaults.globalProcessingDays ? ` (${globalDefaults.globalProcessingDays})` : ""}. Type something different to override.
                </p>
              )}
            </div>
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
          </div>{/* /LEFT column */}

          {/* ════════════════════════════════════════════════════════════
              RIGHT — required docs, free-text requirements, destination copy
              Independent scrollbar on lg+.
              ════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6 lg:h-full lg:overflow-y-auto lg:pr-3 lg:pb-2">
          {/* Required Documents — universal control aware. The checklist now
              uses the merged catalog (built-in + admin's custom doc types) and
              shows a green/amber badge plus a "Reset to global" helper button
              that mirrors the same pattern as Visa Type / Validity. */}
          <div className="rounded-2xl border border-border bg-surface-2/40 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <label className="text-sm font-semibold text-text-primary">
                Required Documents
                <span className="ml-2 text-xs text-text-muted font-normal">Select which documents applicants must upload</span>
              </label>
              {/* Quick "use global" helper — sets the local list to the global
                  default. Saving with the same set as global will flip the
                  flag back automatically (server-side comparison). */}
              {globalDefaults.globalRequiredDocuments.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setCountryForm((p) => ({
                      ...p,
                      requiredDocuments: [...globalDefaults.globalRequiredDocuments],
                    }))
                  }
                  className="text-[11px] font-medium text-cyan hover:underline"
                >
                  Reset to global ({globalDefaults.globalRequiredDocuments.length})
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(() => {
                // Catalog from the universal control + a graceful fallback to
                // the hardcoded `DOC_OPTIONS` shipped with the admin so this
                // block still renders before the API responds on first load.
                const rows = documentCatalog.length
                  ? documentCatalog
                  : DOC_OPTIONS.map((o) => ({ ...o, builtIn: true }));
                return rows.map(({ key, label, builtIn }) => {
                  const checked = countryForm.requiredDocuments.includes(key);
                  const DocIcon = getDocumentIcon(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleRequiredDoc(key)}
                      className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150 text-left min-w-0 ${
                        checked
                          ? "border-cyan/60 bg-cyan/10 text-cyan"
                          : "border-border bg-surface-2 text-text-muted hover:border-cyan/30 hover:text-text-primary"
                      }`}
                      id={`doc-toggle-${key}`}
                    >
                      <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${checked ? "bg-cyan border-cyan" : "border-border"}`}>
                        {checked && <CheckCircle size={10} className="text-background" />}
                      </span>
                      <DocIcon size={15} className={`flex-shrink-0 ${checked ? "text-cyan" : "text-text-muted"}`} />
                      <span className="truncate" title={label}>{label}</span>
                      {builtIn === false && (
                        <span className="ml-auto text-[10px] uppercase tracking-wider text-cyan/70">custom</span>
                      )}
                    </button>
                  );
                });
              })()}
            </div>
            {countryForm.requiredDocuments.length === 0 && (
              <p className="text-xs text-amber-400 mt-2">⚠ At least one document type should be selected.</p>
            )}
            {selectedCountry?.useGlobalRequiredDocuments === false ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Custom override — match the global selection (or click "Reset to global") to use the universal list again.
              </p>
            ) : (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Using global list{globalDefaults.globalRequiredDocuments.length ? ` (${globalDefaults.globalRequiredDocuments.length} document${globalDefaults.globalRequiredDocuments.length === 1 ? "" : "s"})` : ""}. Tick / untick anything to override on this country only.
              </p>
            )}
          </div>

          {/* ──────────────────────────────────────────────────
              Destination-page copy for THIS country.
              Shows global lines (from Settings → Destinations) with X to
              hide them on this country, then per-country additions below.
              ────────────────────────────────────────────────── */}
          {(() => {
            const excludedWhy = new Set(countryForm.excludeDestinationWhyBookNow || []);
            const excludedInc = new Set(countryForm.excludeDestinationIncludedItems || []);
            const excludedFaq = new Set(countryForm.excludeDestinationFaqQuestions || []);
            const excludedVisa = new Set(countryForm.excludeDestinationVisaRequirements || []);

            const toggleExclude = (field, key) => {
              setCountryForm((p) => {
                const list = new Set(p[field] || []);
                if (list.has(key)) list.delete(key);
                else list.add(key);
                return { ...p, [field]: Array.from(list) };
              });
            };

            const visibleGlobalCount = (list, excluded) =>
              (list || []).filter((line) => !excluded.has(normDestKey(line))).length;
            const visibleGlobalFaqCount = (list, excluded) =>
              (list || []).filter((f) => !excluded.has(normDestKey(f?.question))).length;

            return (
          <div className="rounded-2xl border border-border bg-surface-2/40 p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-text-primary">
                Destination page copy — {countryForm.name || "this country"}
              </h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                <span className="text-text-primary font-medium">Global items</span> from{" "}
                <span className="text-text-primary font-medium">Settings → Destinations</span> are shown first on every country.
                Click the <X size={11} className="inline -mt-0.5" /> next to a global item to hide it on{" "}
                {countryForm.name || "this country"} only — hidden items move to{" "}
                <span className="text-text-primary font-medium">Hidden on this country</span> below each section so you can restore them.
                Anything you add under{" "}
                <span className="text-text-primary font-medium">extras for this country</span> is appended below
                the global items (duplicates skipped).
              </p>
            </div>

            {/* Why book now */}
            <div className="bg-surface-2 border border-border rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-text-primary flex items-center gap-2">
                  <BadgeCheck size={14} className="text-cyan" />
                  Why book now?
                </h4>
                <span className="text-[10px] text-text-muted">
                  {visibleGlobalCount(countryModalGlobalDest.whyBookNow, excludedWhy)} global +{" "}
                  {(countryForm.whyBookNow || []).filter((s) => String(s ?? "").trim()).length} extra
                </span>
              </div>

              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">Global (every country)</p>
                {countryModalGlobalDest.whyBookNow.length === 0 ? (
                  <p className="text-xs text-text-muted italic px-1">
                    No global items yet — add them in Settings → Destinations.
                  </p>
                ) : (
                  (() => {
                    const all = countryModalGlobalDest.whyBookNow || [];
                    const visible = all.filter((line) => !excludedWhy.has(normDestKey(line)));
                    const hidden = all.filter((line) => excludedWhy.has(normDestKey(line)));
                    return (
                      <>
                        {visible.length === 0 ? (
                          <p className="text-xs text-text-muted italic px-1">
                            All global reasons are hidden on this country. Restore any below.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {visible.map((line) => {
                              const key = normDestKey(line);
                              return (
                                <div
                                  key={`global-why-${key}`}
                                  className="flex gap-2 items-center justify-between rounded-xl border border-border bg-background text-text-primary px-3 py-2 text-sm"
                                >
                                  <span className="flex-1 break-words">{line}</span>
                                  <button
                                    type="button"
                                    onClick={() => toggleExclude("excludeDestinationWhyBookNow", key)}
                                    className="shrink-0 p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    aria-label={`Hide "${line}" on this country`}
                                    title="Hide on this country"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {hidden.length > 0 && (
                          <div className="mt-3 rounded-xl border border-dashed border-border bg-background/40 p-3">
                            <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">
                              Hidden on this country ({hidden.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {hidden.map((line) => {
                                const key = normDestKey(line);
                                return (
                                  <button
                                    type="button"
                                    key={`hidden-why-${key}`}
                                    onClick={() => toggleExclude("excludeDestinationWhyBookNow", key)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[11px] text-text-muted hover:text-cyan hover:border-cyan/40 hover:bg-cyan/5 transition-colors max-w-full"
                                    title="Show on this country again"
                                    aria-label={`Show "${line}" on this country again`}
                                  >
                                    <Plus size={12} className="shrink-0" />
                                    <span className="truncate">{line}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">Extras for this country</p>
                <div className="space-y-2">
                  {(countryForm.whyBookNow || []).map((line, idx) => (
                    <div key={`country-why-${idx}`} className="flex gap-2 items-start">
                      <input
                        value={line}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCountryForm((p) => {
                            const next = [...(p.whyBookNow || [])];
                            next[idx] = v;
                            return { ...p, whyBookNow: next };
                          });
                        }}
                        placeholder={`Extra reason ${idx + 1}`}
                        className="flex-1 bg-background border border-border text-text-primary text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan placeholder-text-muted"
                        id={`country-why-${idx}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCountryForm((p) => ({
                            ...p,
                            whyBookNow: (p.whyBookNow || []).filter((_, i) => i !== idx),
                          }))
                        }
                        className="p-2 rounded-xl hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                        aria-label={`Remove extra reason ${idx + 1}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Plus size={14} />}
                    onClick={() =>
                      setCountryForm((p) => ({
                        ...p,
                        whyBookNow: [...(p.whyBookNow || []), ""],
                      }))
                    }
                    id="add-country-why-btn"
                  >
                    Add reason for this country
                  </Button>
                </div>
              </div>
            </div>

            {/* What's included */}
            <div className="bg-surface-2 border border-border rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-text-primary flex items-center gap-2">
                  <ShieldCheck size={14} className="text-cyan" />
                  What&apos;s included
                </h4>
                <span className="text-[10px] text-text-muted">
                  {visibleGlobalCount(countryModalGlobalDest.includedItems, excludedInc)} global +{" "}
                  {(countryForm.includedItems || []).filter((s) => String(s ?? "").trim()).length} extra
                </span>
              </div>

              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">Global (every country)</p>
                {countryModalGlobalDest.includedItems.length === 0 ? (
                  <p className="text-xs text-text-muted italic px-1">
                    No global items yet — add them in Settings → Destinations.
                  </p>
                ) : (
                  (() => {
                    const all = countryModalGlobalDest.includedItems || [];
                    const visible = all.filter((line) => !excludedInc.has(normDestKey(line)));
                    const hidden = all.filter((line) => excludedInc.has(normDestKey(line)));
                    return (
                      <>
                        {visible.length === 0 ? (
                          <p className="text-xs text-text-muted italic px-1">
                            All global bullets are hidden on this country. Restore any below.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {visible.map((line) => {
                              const key = normDestKey(line);
                              return (
                                <div
                                  key={`global-inc-${key}`}
                                  className="flex gap-2 items-center justify-between rounded-xl border border-border bg-background text-text-primary px-3 py-2 text-sm"
                                >
                                  <span className="flex-1 break-words">{line}</span>
                                  <button
                                    type="button"
                                    onClick={() => toggleExclude("excludeDestinationIncludedItems", key)}
                                    className="shrink-0 p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    aria-label={`Hide "${line}" on this country`}
                                    title="Hide on this country"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {hidden.length > 0 && (
                          <div className="mt-3 rounded-xl border border-dashed border-border bg-background/40 p-3">
                            <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">
                              Hidden on this country ({hidden.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {hidden.map((line) => {
                                const key = normDestKey(line);
                                return (
                                  <button
                                    type="button"
                                    key={`hidden-inc-${key}`}
                                    onClick={() => toggleExclude("excludeDestinationIncludedItems", key)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[11px] text-text-muted hover:text-cyan hover:border-cyan/40 hover:bg-cyan/5 transition-colors max-w-full"
                                    title="Show on this country again"
                                    aria-label={`Show "${line}" on this country again`}
                                  >
                                    <Plus size={12} className="shrink-0" />
                                    <span className="truncate">{line}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">Extras for this country</p>
                <div className="space-y-2">
                  {(countryForm.includedItems || []).map((line, idx) => (
                    <div key={`country-inc-${idx}`} className="flex gap-2 items-start">
                      <input
                        value={line}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCountryForm((p) => {
                            const next = [...(p.includedItems || [])];
                            next[idx] = v;
                            return { ...p, includedItems: next };
                          });
                        }}
                        placeholder={`Extra bullet ${idx + 1}`}
                        className="flex-1 bg-background border border-border text-text-primary text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan placeholder-text-muted"
                        id={`country-inc-${idx}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCountryForm((p) => ({
                            ...p,
                            includedItems: (p.includedItems || []).filter((_, i) => i !== idx),
                          }))
                        }
                        className="p-2 rounded-xl hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                        aria-label={`Remove extra bullet ${idx + 1}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Plus size={14} />}
                    onClick={() =>
                      setCountryForm((p) => ({
                        ...p,
                        includedItems: [...(p.includedItems || []), ""],
                      }))
                    }
                    id="add-country-inc-btn"
                  >
                    Add bullet for this country
                  </Button>
                </div>
              </div>
            </div>

            {/* FAQs */}
            <div className="bg-surface-2 border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-text-primary flex items-center gap-2">
                  <HelpCircle size={14} className="text-cyan" />
                  FAQs
                </h4>
                <span className="text-[10px] text-text-muted">
                  {visibleGlobalFaqCount(countryModalGlobalDest.faqs, excludedFaq)} global +{" "}
                  {(countryForm.faqs || []).filter((f) => String(f?.question ?? "").trim() && String(f?.answer ?? "").trim()).length} extra
                </span>
              </div>

              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">Global (every country)</p>
                {countryModalGlobalDest.faqs.length === 0 ? (
                  <p className="text-xs text-text-muted italic px-1">
                    No global FAQs yet — add them in Settings → Destinations.
                  </p>
                ) : (
                  (() => {
                    const all = countryModalGlobalDest.faqs || [];
                    const visible = all.filter((f) => !excludedFaq.has(normDestKey(f?.question)));
                    const hidden = all.filter((f) => excludedFaq.has(normDestKey(f?.question)));
                    return (
                      <>
                        {visible.length === 0 ? (
                          <p className="text-xs text-text-muted italic px-1">
                            All global FAQs are hidden on this country. Restore any below.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {visible.map((faq) => {
                              const key = normDestKey(faq.question);
                              return (
                                <div
                                  key={`global-faq-${key}`}
                                  className="rounded-xl border border-border bg-background text-text-primary px-3 py-2.5"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-medium flex-1 break-words">{faq.question}</p>
                                    <button
                                      type="button"
                                      onClick={() => toggleExclude("excludeDestinationFaqQuestions", key)}
                                      className="shrink-0 p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                      aria-label={`Hide "${faq.question}" on this country`}
                                      title="Hide on this country"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                  <p className="text-xs text-text-secondary mt-1 break-words">{faq.answer}</p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {hidden.length > 0 && (
                          <div className="mt-3 rounded-xl border border-dashed border-border bg-background/40 p-3">
                            <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">
                              Hidden on this country ({hidden.length})
                            </p>
                            <div className="flex flex-col gap-2">
                              {hidden.map((faq) => {
                                const key = normDestKey(faq.question);
                                return (
                                  <button
                                    type="button"
                                    key={`hidden-faq-${key}`}
                                    onClick={() => toggleExclude("excludeDestinationFaqQuestions", key)}
                                    className="text-left rounded-xl border border-border bg-surface px-3 py-2 text-[11px] text-text-muted hover:text-cyan hover:border-cyan/40 hover:bg-cyan/5 transition-colors"
                                    title="Show on this country again"
                                    aria-label={`Show FAQ "${faq.question}" on this country again`}
                                  >
                                    <span className="inline-flex items-start gap-1.5">
                                      <Plus size={12} className="shrink-0 mt-0.5" />
                                      <span>
                                        <span className="font-medium text-text-secondary block truncate">{faq.question}</span>
                                        <span className="text-text-muted line-clamp-2 mt-0.5">{faq.answer}</span>
                                      </span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">Extras for this country</p>
                <div className="space-y-4">
                  {(countryForm.faqs || []).map((faq, idx) => (
                    <div
                      key={`country-faq-${idx}`}
                      className="rounded-xl border border-border bg-background p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] uppercase tracking-wide font-semibold text-text-muted">Extra FAQ {idx + 1}</p>
                        <button
                          type="button"
                          onClick={() =>
                            setCountryForm((p) => ({
                              ...p,
                              faqs: (p.faqs || []).filter((_, i) => i !== idx),
                            }))
                          }
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                          aria-label={`Remove extra FAQ ${idx + 1}`}
                          title="Remove this FAQ"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <input
                        value={faq.question}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCountryForm((p) => {
                            const next = [...(p.faqs || [])];
                            next[idx] = { ...next[idx], question: v };
                            return { ...p, faqs: next };
                          });
                        }}
                        placeholder="Question"
                        className="w-full bg-surface-2 border border-border text-text-primary text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan placeholder-text-muted"
                        id={`country-faq-q-${idx}`}
                      />
                      <textarea
                        rows={3}
                        value={faq.answer}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCountryForm((p) => {
                            const next = [...(p.faqs || [])];
                            next[idx] = { ...next[idx], answer: v };
                            return { ...p, faqs: next };
                          });
                        }}
                        placeholder="Answer"
                        className="w-full bg-surface-2 border border-border text-text-primary text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan placeholder-text-muted resize-y"
                        id={`country-faq-a-${idx}`}
                      />
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Plus size={14} />}
                    onClick={() =>
                      setCountryForm((p) => ({
                        ...p,
                        faqs: [...(p.faqs || []), { question: "", answer: "" }],
                      }))
                    }
                    id="add-country-faq-btn"
                  >
                    Add FAQ for this country
                  </Button>
                </div>
              </div>
            </div>

            {/* How it works */}
            <div className="bg-surface-2 border border-border rounded-xl p-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-text-primary flex items-center gap-2">
                  <ListChecks size={14} className="text-cyan" />
                  How it works
                </h4>
                <span className="text-[10px] text-text-muted">
                  {(countryModalGlobalDest.howItWorks || []).filter((s) => !(new Set(countryForm.excludeDestinationHowItWorksTitles || [])).has(normDestKey(s?.title))).length} global +{" "}
                  {(countryForm.howItWorks || []).filter((s) => String(s?.title ?? "").trim() && String(s?.description ?? "").trim()).length} extra
                </span>
              </div>

              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">Global (every country)</p>
                {(() => {
                  const excludedKeys = new Set(countryForm.excludeDestinationHowItWorksTitles || []);
                  const visibleSteps = (countryModalGlobalDest.howItWorks || []).filter(
                    (s) => !excludedKeys.has(normDestKey(s?.title))
                  );
                  const hiddenSteps = (countryModalGlobalDest.howItWorks || []).filter(
                    (s) => excludedKeys.has(normDestKey(s?.title))
                  );

                  if ((countryModalGlobalDest.howItWorks || []).length === 0) {
                    return (
                      <p className="text-xs text-text-muted italic px-1">
                        No global steps yet — add them in Settings → Destinations.
                      </p>
                    );
                  }

                  return (
                    <>
                      {visibleSteps.length === 0 ? (
                        <p className="text-xs text-text-muted italic px-1">
                          All global steps are hidden on this country. Restore any below.
                        </p>
                      ) : (
                        <ol className="space-y-2">
                          {visibleSteps.map((step, vIdx) => {
                            const key = normDestKey(step.title);
                            return (
                              <li
                                key={`global-how-${key}`}
                                className="flex items-start gap-3 rounded-xl border border-border bg-background text-text-primary px-3 py-2.5"
                              >
                                <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center bg-cyan/10 text-cyan border border-cyan/30">
                                  {vIdx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium break-words">{step.title}</p>
                                  <p className="text-xs text-text-secondary mt-0.5 break-words">{step.description}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleExclude("excludeDestinationHowItWorksTitles", key)}
                                  className="shrink-0 p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                  aria-label={`Hide "${step.title}" on this country`}
                                  title="Hide on this country"
                                >
                                  <X size={14} />
                                </button>
                              </li>
                            );
                          })}
                        </ol>
                      )}

                      {hiddenSteps.length > 0 && (
                        <div className="mt-3 rounded-xl border border-dashed border-border bg-background/40 p-3">
                          <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">
                            Hidden on this country ({hiddenSteps.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {hiddenSteps.map((step) => {
                              const key = normDestKey(step.title);
                              return (
                                <button
                                  type="button"
                                  key={`hidden-how-${key}`}
                                  onClick={() => toggleExclude("excludeDestinationHowItWorksTitles", key)}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[11px] text-text-muted hover:text-cyan hover:border-cyan/40 hover:bg-cyan/5 transition-colors"
                                  title="Show on this country again"
                                  aria-label={`Show "${step.title}" on this country again`}
                                >
                                  <Plus size={12} />
                                  <span className="truncate max-w-[200px]">{step.title}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">Extras for this country</p>
                <div className="space-y-4">
                  {(countryForm.howItWorks || []).map((step, idx) => (
                    <div
                      key={`country-how-${idx}`}
                      className="rounded-xl border border-border bg-background p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] uppercase tracking-wide font-semibold text-text-muted">Extra step {idx + 1}</p>
                        <button
                          type="button"
                          onClick={() =>
                            setCountryForm((p) => ({
                              ...p,
                              howItWorks: (p.howItWorks || []).filter((_, i) => i !== idx),
                            }))
                          }
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                          aria-label={`Remove extra step ${idx + 1}`}
                          title="Remove this step"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <input
                        value={step.title}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCountryForm((p) => {
                            const next = [...(p.howItWorks || [])];
                            next[idx] = { ...next[idx], title: v };
                            return { ...p, howItWorks: next };
                          });
                        }}
                        placeholder="Step title (e.g. Pickup at airport)"
                        className="w-full bg-surface-2 border border-border text-text-primary text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan placeholder-text-muted"
                        id={`country-how-title-${idx}`}
                      />
                      <textarea
                        rows={2}
                        value={step.description}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCountryForm((p) => {
                            const next = [...(p.howItWorks || [])];
                            next[idx] = { ...next[idx], description: v };
                            return { ...p, howItWorks: next };
                          });
                        }}
                        placeholder="Short instruction shown under the title"
                        className="w-full bg-surface-2 border border-border text-text-primary text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan placeholder-text-muted resize-y"
                        id={`country-how-desc-${idx}`}
                      />
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Plus size={14} />}
                    onClick={() =>
                      setCountryForm((p) => ({
                        ...p,
                        howItWorks: [...(p.howItWorks || []), { title: "", description: "" }],
                      }))
                    }
                    id="add-country-how-btn"
                  >
                    Add step for this country
                  </Button>
                </div>
              </div>
            </div>

            {/* Visa Requirements */}
            <div className="bg-surface-2 border border-border rounded-xl p-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-text-primary flex items-center gap-2">
                  <ScrollText size={14} className="text-cyan" />
                  Visa Requirements
                </h4>
                <span className="text-[10px] text-text-muted">
                  {visibleGlobalCount(countryModalGlobalDest.visaRequirements, excludedVisa)} global +{" "}
                  {(countryForm.requirements || []).filter((s) => String(s ?? "").trim()).length} extra
                </span>
              </div>

              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">Global (every country)</p>
                {(countryModalGlobalDest.visaRequirements || []).length === 0 ? (
                  <p className="text-xs text-text-muted italic px-1">
                    No global requirements yet — add them in Settings → Destinations.
                  </p>
                ) : (
                  (() => {
                    const all = countryModalGlobalDest.visaRequirements || [];
                    const visible = all.filter((line) => !excludedVisa.has(normDestKey(line)));
                    const hidden = all.filter((line) => excludedVisa.has(normDestKey(line)));
                    return (
                      <>
                        {visible.length === 0 ? (
                          <p className="text-xs text-text-muted italic px-1">
                            All global requirements are hidden on this country. Restore any below.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {visible.map((line) => {
                              const key = normDestKey(line);
                              return (
                                <div
                                  key={`global-visa-${key}`}
                                  className="flex gap-2 items-center justify-between rounded-xl border border-border bg-background text-text-primary px-3 py-2 text-sm"
                                >
                                  <span className="flex-1 break-words">{line}</span>
                                  <button
                                    type="button"
                                    onClick={() => toggleExclude("excludeDestinationVisaRequirements", key)}
                                    className="shrink-0 p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    aria-label={`Hide "${line}" on this country`}
                                    title="Hide on this country"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {hidden.length > 0 && (
                          <div className="mt-3 rounded-xl border border-dashed border-border bg-background/40 p-3">
                            <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">
                              Hidden on this country ({hidden.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {hidden.map((line) => {
                                const key = normDestKey(line);
                                return (
                                  <button
                                    type="button"
                                    key={`hidden-visa-${key}`}
                                    onClick={() => toggleExclude("excludeDestinationVisaRequirements", key)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[11px] text-text-muted hover:text-cyan hover:border-cyan/40 hover:bg-cyan/5 transition-colors max-w-full"
                                    title="Show on this country again"
                                    aria-label={`Show "${line}" on this country again`}
                                  >
                                    <Plus size={12} className="shrink-0" />
                                    <span className="truncate">{line}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">Extras for this country</p>
                <div className="space-y-2">
                  {(countryForm.requirements || []).map((line, idx) => (
                    <div key={`country-visa-${idx}`} className="flex gap-2 items-start">
                      <input
                        value={line}
                        onChange={(e) => updateRequirement(idx, e.target.value)}
                        placeholder={`Extra requirement ${idx + 1}`}
                        className="flex-1 bg-background border border-border text-text-primary text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan placeholder-text-muted"
                        id={`country-visa-${idx}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeRequirement(idx)}
                        className="p-2 rounded-xl hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                        aria-label={`Remove extra requirement ${idx + 1}`}
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
                    id="add-country-visa-btn"
                  >
                    Add requirement for this country
                  </Button>
                </div>
              </div>
            </div>
          </div>
            );
          })()}
          </div>{/* /RIGHT column */}
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;
