// ============================================================
//  Admin Dashboard Page
//  Sections:
//  1. Analytics overview (4 stat cards + Recharts line chart)
//  2. Applications management table (search, filter, status update)
//  3. Country Manager (add/edit countries via modal)
// ============================================================
import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  BarChart2, TrendingUp, DollarSign, Clock, CheckCircle, CheckCheck, Smile, Send, MoreVertical,
  Search, Filter, ChevronDown, Plus, Edit3,
  MapPin, Globe, Users, FileText, X, Save, AlertCircle, UploadCloud, Image as ImageIcon, Settings, CreditCard, IndianRupee, Sliders, HelpCircle, BookOpen,
  ExternalLink, GalleryVertical, BadgeCheck, ShieldCheck, ListChecks, ScrollText, CalendarDays, MessageSquare, RotateCcw,
  Briefcase, Banknote, GraduationCap, Stethoscope, Stamp, Receipt, Home, Car, HeartHandshake, Plane, Building2, Zap, Lock,
  Mail, Youtube, Linkedin, Link as LinkIcon, MessageCircle, Trash2, Loader2, ChevronRight, PanelBottom, LayoutTemplate,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import { AnimatePresence, motion } from "framer-motion";
import { StatusBadge } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Modal from "../components/ui/Modal";
import Input, { Select, Textarea } from "../components/ui/Input";
import StaticPagesManager from "../components/cms/StaticPagesManager";
import BlogAdminPanel from "../components/blog/BlogAdminPanel";
import SeoManagerPanel from "../components/admin/SeoManagerPanel";
import AnalyticsPage from "./admin/AnalyticsPage";
import PaymentsPage from "./admin/PaymentsPage";
import VisaTypesManager from "../components/controls/VisaTypesManager";
import CountryVisibilitySelector from "../components/controls/CountryVisibilitySelector";
import FeeUpdateManager from "../components/controls/FeeUpdateManager";
import VisaDetailsTable from "../components/controls/VisaDetailsTable";
import FeeScopeConfigSection from "../components/controls/FeeScopeConfigSection";
import VisaTypeScopeConfigSection from "../components/controls/VisaTypeScopeConfigSection";
import AdminLayout from "../layouts/AdminLayout";
import { ADMIN_DASHBOARD_TABS } from "../constants/adminMenu";
import { useUIStore } from "../store/uiStore";
import { useDataStore } from "../store/dataStore";
import { useAuthStore, api, SERVER_URL } from "../store/authStore";
import { ANALYTICS, MONTHLY_REVENUE } from "../data/bookings";
import { getCountrySearchHint, matchesCountrySearch } from "../utils/countrySearch";
import { getApplicationProgress, resolveApplicationStatus } from "../utils/applicationProgress";
import { fmtDate } from "../utils/formatDate";

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

const REMIX_ICON_SUGGESTIONS = [
  "ri-file-list-3-line",
  "ri-passport-line",
  "ri-camera-lens-line",
  "ri-id-card-line",
  "ri-file-edit-line",
  "ri-route-line",
  "ri-flight-takeoff-line",
  "ri-hotel-line",
  "ri-shield-check-line",
  "ri-bank-card-line",
  "ri-award-line",
  "ri-briefcase-4-line",
  "ri-mail-open-line",
  "ri-ticket-2-line",
];

const REMIX_ICON_PICKER_OPTIONS = Array.from(
  new Set([
    ...REMIX_ICON_SUGGESTIONS,
    "ri-article-line",
    "ri-bank-line",
    "ri-bookmark-3-line",
    "ri-book-open-line",
    "ri-building-2-line",
    "ri-calendar-check-line",
    "ri-calendar-event-line",
    "ri-checkbox-circle-line",
    "ri-clipboard-line",
    "ri-copper-diamond-line",
    "ri-customer-service-2-line",
    "ri-edit-box-line",
    "ri-file-3-line",
    "ri-file-chart-line",
    "ri-file-copy-2-line",
    "ri-file-download-line",
    "ri-file-info-line",
    "ri-file-paper-2-line",
    "ri-files-line",
    "ri-folders-line",
    "ri-global-line",
    "ri-government-line",
    "ri-health-book-line",
    "ri-heart-pulse-line",
    "ri-home-4-line",
    "ri-image-2-line",
    "ri-mail-send-line",
    "ri-map-pin-2-line",
    "ri-medal-line",
    "ri-money-rupee-circle-line",
    "ri-pages-line",
    "ri-phone-line",
    "ri-plane-line",
    "ri-road-map-line",
    "ri-safe-2-line",
    "ri-scales-3-line",
    "ri-search-eye-line",
    "ri-secure-payment-line",
    "ri-shield-star-line",
    "ri-suitcase-3-line",
    "ri-team-line",
    "ri-time-line",
    "ri-todo-line",
    "ri-truck-line",
    "ri-user-heart-line",
    "ri-visa-line",
  ])
);

const sanitizeRemixIconClass = (value) => {
  const icon = String(value ?? "").trim();
  if (!icon) return "";
  return /^ri-[a-z0-9-]+$/.test(icon) ? icon : "";
};

const IconPickerPreviewButton = ({
  icon,
  onClick,
  fallbackIcon: FallbackIcon = FileText,
  title = "Choose icon",
  className = "",
}) => {
  const sanitized = sanitizeRemixIconClass(icon);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[46px] min-w-[56px] items-center justify-center rounded-xl border border-border bg-background text-cyan transition hover:border-cyan/40 hover:bg-surface-2 ${className}`}
      title={title}
      aria-label={title}
    >
      {sanitized ? <i className={`${sanitized} text-xl`} /> : <FallbackIcon size={18} className="text-text-muted" />}
    </button>
  );
};

// -- Recharts custom tooltip --------------------------------
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

const formatPriceINR = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Not set yet";
  return `₹${amount.toLocaleString("en-IN")}`;
};

const formatVisitCount = (value) => {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count.toLocaleString("en-IN") : "0";
};

const normalizeScopeFeeValues = (value, fallback = null) => ({
  all:
    Number.isFinite(Number(value?.all))
      ? Number(value.all)
      : Number.isFinite(Number(fallback))
        ? Number(fallback)
        : null,
  single: Number.isFinite(Number(value?.single)) ? Number(value.single) : null,
  some: Number.isFinite(Number(value?.some)) ? Number(value.some) : null,
});

const normalizeFeeScopeTargets = (value, availableCountryIds = []) => {
  const availableIds = new Set((availableCountryIds || []).map((id) => String(id ?? "").trim()).filter(Boolean));
  const singleCountryId = String(value?.singleCountryId ?? "").trim();
  const someCountryIds = normalizeCountrySelectorIds(value?.someCountryIds).filter((id) => availableIds.has(id));
  return {
    singleCountryId: availableIds.has(singleCountryId) ? singleCountryId : "",
    someCountryIds,
  };
};

const buildFeeSaveAllDraft = (scopeValues, scopeTargets, fallbackAll = null) => ({
  allCountries: {
    amount:
      Number.isFinite(Number(scopeValues?.all))
        ? String(Number(scopeValues.all))
        : Number.isFinite(Number(fallbackAll))
          ? String(Number(fallbackAll))
          : "",
  },
  singleCountry: {
    countryId: String(scopeTargets?.singleCountryId ?? "").trim(),
    amount: Number.isFinite(Number(scopeValues?.single)) ? String(Number(scopeValues.single)) : "",
  },
  someCountries: {
    countryIds: normalizeCountrySelectorIds(scopeTargets?.someCountryIds),
    amount: Number.isFinite(Number(scopeValues?.some)) ? String(Number(scopeValues.some)) : "",
  },
});

const buildPickerCustomDraft = (value, suggestions = []) => {
  const normalizedValue = String(value ?? "").trim();
  if (normalizedValue && suggestions.includes(normalizedValue)) {
    return { picker: normalizedValue, custom: "" };
  }
  return { picker: "", custom: normalizedValue };
};

const resolvePickerOrCustomValue = (picker, custom) => {
  const trimmedCustom = String(custom ?? "").trim();
  if (trimmedCustom) return trimmedCustom;
  return String(picker ?? "").trim();
};

const buildVisaTypeSaveAllDraft = (scopeValues, scopeTargets) => ({
  allCountries: {
    ...buildPickerCustomDraft(scopeValues?.all, VISA_TYPE_SUGGESTIONS),
  },
  singleCountry: {
    countryId: "",
    ...buildPickerCustomDraft("", VISA_TYPE_SUGGESTIONS),
  },
  singleCountryOverrides: Array.isArray(scopeTargets?.singleCountryOverrides)
    ? scopeTargets.singleCountryOverrides
        .map((item) => ({
          countryId: String(item?.countryId ?? "").trim(),
          ...buildPickerCustomDraft(item?.visaType, VISA_TYPE_SUGGESTIONS),
        }))
        .filter((item) => item.countryId && resolvePickerOrCustomValue(item.picker, item.custom))
    : (() => {
        const legacyCountryId = String(scopeTargets?.singleCountryId ?? "").trim();
        const legacyVisaType = String(scopeValues?.single ?? "").trim();
        if (!legacyCountryId || !legacyVisaType) return [];
        return [
          {
            countryId: legacyCountryId,
            ...buildPickerCustomDraft(legacyVisaType, VISA_TYPE_SUGGESTIONS),
          },
        ];
      })(),
  singleCountryDraft: {
    countryId: "",
    ...buildPickerCustomDraft("", VISA_TYPE_SUGGESTIONS),
  },
  someCountries: {
    countryIds: normalizeCountrySelectorIds(scopeTargets?.someCountryIds),
    ...buildPickerCustomDraft(scopeValues?.some, VISA_TYPE_SUGGESTIONS),
  },
});

const buildLengthOfStaySaveAllDraft = (scopeValues, scopeTargets) => ({
  allCountries: {
    ...buildPickerCustomDraft(scopeValues?.all, LENGTH_OF_STAY_SUGGESTIONS),
  },
  singleCountry: {
    countryId: "",
    ...buildPickerCustomDraft("", LENGTH_OF_STAY_SUGGESTIONS),
  },
  singleCountryOverrides: Array.isArray(scopeTargets?.singleCountryOverrides)
    ? scopeTargets.singleCountryOverrides
        .map((item) => ({
          countryId: String(item?.countryId ?? "").trim(),
          ...buildPickerCustomDraft(item?.lengthOfStay, LENGTH_OF_STAY_SUGGESTIONS),
        }))
        .filter((item) => item.countryId && resolvePickerOrCustomValue(item.picker, item.custom))
    : (() => {
        const legacyCountryId = String(scopeTargets?.singleCountryId ?? "").trim();
        const legacyLengthOfStay = String(scopeValues?.single ?? "").trim();
        if (!legacyCountryId || !legacyLengthOfStay) return [];
        return [
          {
            countryId: legacyCountryId,
            ...buildPickerCustomDraft(legacyLengthOfStay, LENGTH_OF_STAY_SUGGESTIONS),
          },
        ];
      })(),
  singleCountryDraft: {
    countryId: "",
    ...buildPickerCustomDraft("", LENGTH_OF_STAY_SUGGESTIONS),
  },
  someCountries: {
    countryIds: normalizeCountrySelectorIds(scopeTargets?.someCountryIds),
    ...buildPickerCustomDraft(scopeValues?.some, LENGTH_OF_STAY_SUGGESTIONS),
  },
});

const buildEntryTypeSaveAllDraft = (scopeValues, scopeTargets) => ({
  allCountries: {
    ...buildPickerCustomDraft(scopeValues?.all, ENTRY_TYPE_SUGGESTIONS),
  },
  singleCountry: {
    countryId: "",
    ...buildPickerCustomDraft("", ENTRY_TYPE_SUGGESTIONS),
  },
  singleCountryOverrides: Array.isArray(scopeTargets?.singleCountryOverrides)
    ? scopeTargets.singleCountryOverrides
        .map((item) => ({
          countryId: String(item?.countryId ?? "").trim(),
          ...buildPickerCustomDraft(item?.entryType, ENTRY_TYPE_SUGGESTIONS),
        }))
        .filter((item) => item.countryId && resolvePickerOrCustomValue(item.picker, item.custom))
    : (() => {
        const legacyCountryId = String(scopeTargets?.singleCountryId ?? "").trim();
        const legacyEntryType = String(scopeValues?.single ?? "").trim();
        if (!legacyCountryId || !legacyEntryType) return [];
        return [
          {
            countryId: legacyCountryId,
            ...buildPickerCustomDraft(legacyEntryType, ENTRY_TYPE_SUGGESTIONS),
          },
        ];
      })(),
  singleCountryDraft: {
    countryId: "",
    ...buildPickerCustomDraft("", ENTRY_TYPE_SUGGESTIONS),
  },
  someCountries: {
    countryIds: normalizeCountrySelectorIds(scopeTargets?.someCountryIds),
    ...buildPickerCustomDraft(scopeValues?.some, ENTRY_TYPE_SUGGESTIONS),
  },
});

const buildValiditySaveAllDraft = (scopeValues, scopeTargets) => ({
  allCountries: {
    ...buildPickerCustomDraft(scopeValues?.all, VALIDITY_SUGGESTIONS),
  },
  singleCountry: {
    countryId: "",
    ...buildPickerCustomDraft("", VALIDITY_SUGGESTIONS),
  },
  singleCountryOverrides: Array.isArray(scopeTargets?.singleCountryOverrides)
    ? scopeTargets.singleCountryOverrides
        .map((item) => ({
          countryId: String(item?.countryId ?? "").trim(),
          ...buildPickerCustomDraft(item?.validity, VALIDITY_SUGGESTIONS),
        }))
        .filter((item) => item.countryId && resolvePickerOrCustomValue(item.picker, item.custom))
    : (() => {
        const legacyCountryId = String(scopeTargets?.singleCountryId ?? "").trim();
        const legacyValidity = String(scopeValues?.single ?? "").trim();
        if (!legacyCountryId || !legacyValidity) return [];
        return [
          {
            countryId: legacyCountryId,
            ...buildPickerCustomDraft(legacyValidity, VALIDITY_SUGGESTIONS),
          },
        ];
      })(),
  singleCountryDraft: {
    countryId: "",
    ...buildPickerCustomDraft("", VALIDITY_SUGGESTIONS),
  },
  someCountries: {
    countryIds: normalizeCountrySelectorIds(scopeTargets?.someCountryIds),
    ...buildPickerCustomDraft(scopeValues?.some, VALIDITY_SUGGESTIONS),
  },
});

const buildProcessingDaysSaveAllDraft = (scopeValues, scopeTargets) => ({
  allCountries: {
    ...buildPickerCustomDraft(scopeValues?.all, PROCESSING_DAYS_SUGGESTIONS),
  },
  singleCountry: {
    countryId: "",
    ...buildPickerCustomDraft("", PROCESSING_DAYS_SUGGESTIONS),
  },
  singleCountryOverrides: Array.isArray(scopeTargets?.singleCountryOverrides)
    ? scopeTargets.singleCountryOverrides
        .map((item) => ({
          countryId: String(item?.countryId ?? "").trim(),
          ...buildPickerCustomDraft(item?.processingDays, PROCESSING_DAYS_SUGGESTIONS),
        }))
        .filter((item) => item.countryId && resolvePickerOrCustomValue(item.picker, item.custom))
    : (() => {
        const legacyCountryId = String(scopeTargets?.singleCountryId ?? "").trim();
        const legacyProcessingDays = String(scopeValues?.single ?? "").trim();
        if (!legacyCountryId || !legacyProcessingDays) return [];
        return [
          {
            countryId: legacyCountryId,
            ...buildPickerCustomDraft(legacyProcessingDays, PROCESSING_DAYS_SUGGESTIONS),
          },
        ];
      })(),
  singleCountryDraft: {
    countryId: "",
    ...buildPickerCustomDraft("", PROCESSING_DAYS_SUGGESTIONS),
  },
  someCountries: {
    countryIds: normalizeCountrySelectorIds(scopeTargets?.someCountryIds),
    ...buildPickerCustomDraft(scopeValues?.some, PROCESSING_DAYS_SUGGESTIONS),
  },
});

const normalizeServiceFeeOverrideRows = (rows) =>
  Array.isArray(rows)
    ? rows
        .map((row) => ({
          countryId: String(row?.countryId ?? "").trim(),
          countryName: String(row?.countryName ?? "").trim(),
          amount: Number(row?.amount),
          updatedAt: row?.updatedAt || null,
        }))
        .filter((row) => row.countryId && row.countryName && Number.isFinite(row.amount) && row.amount > 0)
        .sort((a, b) => a.countryName.localeCompare(b.countryName))
    : [];

const serializeFeeSaveAllDraft = (draft) =>
  JSON.stringify({
    allCountries: {
      amount: String(draft?.allCountries?.amount ?? "").trim(),
    },
    singleCountry: {
      countryId: String(draft?.singleCountry?.countryId ?? "").trim(),
      amount: String(draft?.singleCountry?.amount ?? "").trim(),
    },
    someCountries: {
      countryIds: normalizeCountrySelectorIds(draft?.someCountries?.countryIds),
      amount: String(draft?.someCountries?.amount ?? "").trim(),
    },
  });

const serializeVisaTypeSaveAllDraft = (draft) =>
  JSON.stringify({
    allCountries: {
      visaType: resolvePickerOrCustomValue(draft?.allCountries?.picker, draft?.allCountries?.custom),
    },
    singleCountryOverrides: (Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [])
      .map((item) => ({
        countryId: String(item?.countryId ?? "").trim(),
        visaType: resolvePickerOrCustomValue(item?.picker, item?.custom),
      }))
      .filter((item) => item.countryId && item.visaType)
      .sort((a, b) => a.countryId.localeCompare(b.countryId)),
    singleCountryDraft: {
      countryId: String(draft?.singleCountryDraft?.countryId ?? "").trim(),
      visaType: resolvePickerOrCustomValue(draft?.singleCountryDraft?.picker, draft?.singleCountryDraft?.custom),
    },
    someCountries: {
      countryIds: normalizeCountrySelectorIds(draft?.someCountries?.countryIds),
      visaType: resolvePickerOrCustomValue(draft?.someCountries?.picker, draft?.someCountries?.custom),
    },
  });

const serializeLengthOfStaySaveAllDraft = (draft) =>
  JSON.stringify({
    allCountries: {
      lengthOfStay: resolvePickerOrCustomValue(draft?.allCountries?.picker, draft?.allCountries?.custom),
    },
    singleCountryOverrides: (Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [])
      .map((item) => ({
        countryId: String(item?.countryId ?? "").trim(),
        lengthOfStay: resolvePickerOrCustomValue(item?.picker, item?.custom),
      }))
      .filter((item) => item.countryId && item.lengthOfStay)
      .sort((a, b) => a.countryId.localeCompare(b.countryId)),
    singleCountryDraft: {
      countryId: String(draft?.singleCountryDraft?.countryId ?? "").trim(),
      lengthOfStay: resolvePickerOrCustomValue(draft?.singleCountryDraft?.picker, draft?.singleCountryDraft?.custom),
    },
    someCountries: {
      countryIds: normalizeCountrySelectorIds(draft?.someCountries?.countryIds),
      lengthOfStay: resolvePickerOrCustomValue(draft?.someCountries?.picker, draft?.someCountries?.custom),
    },
  });

const serializeEntryTypeSaveAllDraft = (draft) =>
  JSON.stringify({
    allCountries: {
      entryType: resolvePickerOrCustomValue(draft?.allCountries?.picker, draft?.allCountries?.custom),
    },
    singleCountryOverrides: (Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [])
      .map((item) => ({
        countryId: String(item?.countryId ?? "").trim(),
        entryType: resolvePickerOrCustomValue(item?.picker, item?.custom),
      }))
      .filter((item) => item.countryId && item.entryType)
      .sort((a, b) => a.countryId.localeCompare(b.countryId)),
    singleCountryDraft: {
      countryId: String(draft?.singleCountryDraft?.countryId ?? "").trim(),
      entryType: resolvePickerOrCustomValue(draft?.singleCountryDraft?.picker, draft?.singleCountryDraft?.custom),
    },
    someCountries: {
      countryIds: normalizeCountrySelectorIds(draft?.someCountries?.countryIds),
      entryType: resolvePickerOrCustomValue(draft?.someCountries?.picker, draft?.someCountries?.custom),
    },
  });

const serializeValiditySaveAllDraft = (draft) =>
  JSON.stringify({
    allCountries: {
      validity: resolvePickerOrCustomValue(draft?.allCountries?.picker, draft?.allCountries?.custom),
    },
    singleCountryOverrides: (Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [])
      .map((item) => ({
        countryId: String(item?.countryId ?? "").trim(),
        validity: resolvePickerOrCustomValue(item?.picker, item?.custom),
      }))
      .filter((item) => item.countryId && item.validity)
      .sort((a, b) => a.countryId.localeCompare(b.countryId)),
    singleCountryDraft: {
      countryId: String(draft?.singleCountryDraft?.countryId ?? "").trim(),
      validity: resolvePickerOrCustomValue(draft?.singleCountryDraft?.picker, draft?.singleCountryDraft?.custom),
    },
    someCountries: {
      countryIds: normalizeCountrySelectorIds(draft?.someCountries?.countryIds),
      validity: resolvePickerOrCustomValue(draft?.someCountries?.picker, draft?.someCountries?.custom),
    },
  });

const serializeProcessingDaysSaveAllDraft = (draft) =>
  JSON.stringify({
    allCountries: {
      processingDays: resolvePickerOrCustomValue(draft?.allCountries?.picker, draft?.allCountries?.custom),
    },
    singleCountryOverrides: (Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [])
      .map((item) => ({
        countryId: String(item?.countryId ?? "").trim(),
        processingDays: resolvePickerOrCustomValue(item?.picker, item?.custom),
      }))
      .filter((item) => item.countryId && item.processingDays)
      .sort((a, b) => a.countryId.localeCompare(b.countryId)),
    singleCountryDraft: {
      countryId: String(draft?.singleCountryDraft?.countryId ?? "").trim(),
      processingDays: resolvePickerOrCustomValue(draft?.singleCountryDraft?.picker, draft?.singleCountryDraft?.custom),
    },
    someCountries: {
      countryIds: normalizeCountrySelectorIds(draft?.someCountries?.countryIds),
      processingDays: resolvePickerOrCustomValue(draft?.someCountries?.picker, draft?.someCountries?.custom),
    },
  });

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

const FooterInstagramIcon = ({ size = 18, className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    aria-hidden="true"
  >
    <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const FooterFacebookIcon = ({ size = 18, className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    width={size}
    height={size}
    aria-hidden="true"
  >
    <path d="M13.5 21v-7h2.4l.36-2.76H13.5V9.48c0-.8.22-1.35 1.37-1.35h1.47V5.66c-.25-.03-1.11-.11-2.11-.11-2.09 0-3.52 1.27-3.52 3.61v2.08H8.34V14h2.37v7h2.79Z" />
  </svg>
);

const FooterTwitterIcon = ({ size = 18, className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    width={size}
    height={size}
    aria-hidden="true"
  >
    <path d="M18.9 3H22l-6.77 7.74L23 21h-6.08l-4.76-6.22L6.72 21H3.6l7.24-8.28L1 3h6.23l4.3 5.68L18.9 3Zm-1.07 16.18h1.69L6.31 4.73H4.5l13.33 14.45Z" />
  </svg>
);

const FOOTER_SOCIAL_ICON_TYPE_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "twitter", label: "Twitter / X" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "email", label: "Email" },
  { value: "website", label: "Website" },
  { value: "custom", label: "Custom Link" },
];

const FOOTER_SOCIAL_ICON_TYPE_LABELS = Object.fromEntries(
  FOOTER_SOCIAL_ICON_TYPE_OPTIONS.map((option) => [option.value, option.label])
);

const FOOTER_SOCIAL_ICON_COMPONENTS = {
  instagram: FooterInstagramIcon,
  facebook: FooterFacebookIcon,
  twitter: FooterTwitterIcon,
  youtube: Youtube,
  linkedin: Linkedin,
  whatsapp: MessageCircle,
  telegram: Send,
  email: Mail,
  website: Globe,
  custom: LinkIcon,
};

const DEFAULT_FOOTER_SOCIAL_ICON_FORM = {
  label: "",
  type: "instagram",
  url: "",
  isActive: true,
};

const normalizeFooterSocialIconType = (value) => String(value ?? "").trim().toLowerCase();
const normalizeFooterEmailValue = (value) => String(value ?? "").trim().replace(/^mailto:/i, "");
const buildFooterEmailUrl = (value) => {
  const str = String(value || "").trim();
  if (!str) return "";
  if (/^https?:\/\//i.test(str)) return str;
  if (/^mailto:/i.test(str)) return str;
  if (str.includes("@")) return `mailto:${str}`;
  return str;
};
const isValidFooterHttpsUrl = (value) => /^https:\/\/.+/i.test(String(value || "").trim());
const isValidFooterMailto = (value) => /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(String(value || "").trim());
const isValidFooterEmailAddress = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(normalizeFooterEmailValue(value));
const isValidFooterGmailCompose = (value) => /^https:\/\/mail\.google\.com\/.+/i.test(String(value || "").trim());
const isValidFooterWhatsapp = (value) => /^https:\/\/wa\.me\/[0-9]{6,20}(?:\?.*)?$/i.test(String(value || "").trim());

const validateFooterSocialIconFormValues = (values) => {
  const nextErrors = {};
  const label = String(values?.label ?? "").trim();
  const type = normalizeFooterSocialIconType(values?.type);
  const url = String(values?.url ?? "").trim();

  if (!label) nextErrors.label = "Icon name is required.";
  if (!type || !FOOTER_SOCIAL_ICON_TYPE_LABELS[type]) {
    nextErrors.type = "Please choose a valid icon type.";
  }
  if (!url) {
    nextErrors.url = "Icon URL is required.";
  } else if (type === "email" && !isValidFooterMailto(url) && !isValidFooterEmailAddress(url) && !isValidFooterGmailCompose(url)) {
    nextErrors.url = "Use a valid email address, mailto: link, or Gmail compose URL.";
  } else if (type === "whatsapp" && !isValidFooterWhatsapp(url)) {
    nextErrors.url = "Use a valid https://wa.me/ link.";
  } else if (type !== "email" && type !== "whatsapp" && !isValidFooterHttpsUrl(url)) {
    nextErrors.url = "Use a valid https:// URL.";
  }

  return nextErrors;
};

const getFooterSocialIconTypeHelper = (type) => {
  switch (normalizeFooterSocialIconType(type)) {
    case "email":
      return "Example: support@visavoyage.com";
    case "whatsapp":
      return "Example: https://wa.me/919999999999";
    default:
      return "Example: https://example.com/profile";
  }
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
        Only this section is saved - other sections are unchanged.
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

const ExpandableAdminControlCard = ({
  children,
}) => {
  return (
    <Card className="min-w-0 max-w-full overflow-hidden">
      <div className="min-w-0">{children}</div>
    </Card>
  );
};

/** Defaults match client destination page - used until admin saves custom copy. */
const DESTINATION_PAGE_DEFAULT_WHY_BOOK_NOW = [
  "Fast document pre-check by visa specialists",
  "Transparent pricing and status updates",
  "Dedicated support throughout your application",
];

const DESTINATION_PAGE_DEFAULT_INCLUDED = [
  {
    title: "Application Form Guidance",
    description: "Step-by-step guidance to fill your visa application form accurately and confidently.",
    icon: "ri-file-edit-line",
    color: "blue",
  },
  {
    title: "Document Checklist & Validation",
    description: "We provide a complete checklist and verify your documents to ensure everything is in order.",
    icon: "ri-file-list-3-line",
    color: "green",
  },
  {
    title: "End-to-end Support till Submission",
    description: "Our experts assist you at every step until your application is successfully submitted.",
    icon: "ri-customer-service-2-line",
    color: "purple",
  },
];

const DESTINATION_PAGE_DEFAULT_FAQS = [
  {
    question: "How long does processing take?",
    answer:
      "Typical processing varies by destination - each country page lists estimated timelines based on current embassy guidance.",
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
  { title: "Apply with VisaAndVoyage", description: "Upload your documents on VisaAndVoyage or share over WhatsApp with our visa expert." },
  { title: "Experts review the documents", description: "Our visa experts will verify your documents." },
  { title: "Prepare the application", description: "Our visa expert will help you create the application for document submission." },
  { title: "Visit the Visa Application Center", description: "Traveller visits their nearest Visa Application Center for document submission." },
  { title: "Get your visa", description: "Traveller will collect their passport from VAC or via courier with a stamped visa." },
  { title: "Enjoy your vacation", description: "Thanks for choosing VisaAndVoyage and we wish you an amazing journey." },
];

/** Suggestions shown in the Visa Type combo-box on the country edit modal - admins can pick or type their own. */
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

const LENGTH_OF_STAY_SUGGESTIONS = [
  "7 Days",
  "15 Days",
  "30 Days",
  "60 Days",
  "90 Days",
  "180 Days",
];

const ENTRY_TYPE_SUGGESTIONS = [
  "Single Entry",
  "Double Entry",
  "Multiple Entry",
];

const DEFAULT_VISA_INFORMATION_ITEMS = Object.freeze([
  {
    id: "lengthOfStay",
    label: "Length of Stay",
    description: "You can stay up to the approved duration in the country.",
    icon: "calendar",
    color: "blue",
  },
  {
    id: "validity",
    label: "Validity",
    description: "Your visa remains valid for the approved duration after issue.",
    icon: "clock3",
    color: "green",
  },
  {
    id: "entry",
    label: "Entry",
    description: "This visa determines how many times you can enter the country.",
    icon: "door-open",
    color: "purple",
  },
]);

const createVisaInformationState = (source = {}) => {
  const data = source?.visaInformation && typeof source.visaInformation === "object"
    ? source.visaInformation
    : source && typeof source === "object"
      ? source
      : {};
  const getResolvedVisaInfoValue = (itemId) => {
    if (itemId === "lengthOfStay") {
      return String(source?.lengthOfStay ?? "").trim();
    }
    if (itemId === "validity") {
      return String(source?.validity ?? "").trim();
    }
    if (itemId === "entry") {
      return String(source?.entryType ?? "").trim();
    }
    return "";
  };
  const itemsById = new Map(
    (Array.isArray(data.items) ? data.items : [])
      .map((item) => ({
        id: String(item?.id ?? "").trim(),
        enabled: item?.enabled !== false,
        label: String(item?.label ?? "").trim(),
        value: String(item?.value ?? "").trim(),
        description: String(item?.description ?? "").trim(),
        icon: String(item?.icon ?? "").trim(),
        color: String(item?.color ?? "").trim(),
      }))
      .filter((item) => item.id)
      .map((item) => [item.id, item])
  );

  return {
    enabled: data.enabled !== false,
    badgeText: String(data.badgeText ?? "").trim() || "100% Online Process",
    title: String(data.title ?? "").trim() || "Visa Information",
    subtitle:
      String(data.subtitle ?? "").trim() ||
      "A 100% online visa application process that is simple, secure and hassle-free.",
    note:
      String(data.note ?? "").trim() ||
      "Visa rules and conditions may change. Please check the latest requirements before applying.",
    items: DEFAULT_VISA_INFORMATION_ITEMS.map((item) => {
      const next = itemsById.get(item.id);
      const fallbackValue = getResolvedVisaInfoValue(item.id) || (item.id === "entry" ? "Single" : "On request");
      return {
        ...item,
        enabled: next?.enabled !== false,
        label: next?.label || item.label,
        value: getResolvedVisaInfoValue(item.id) || next?.value || fallbackValue,
        description: next?.description || item.description,
        icon: next?.icon || item.icon,
        color: next?.color || item.color,
      };
    }),
  };
};

const sanitizeVisaInformationPayload = (visaInformation, fallback = {}) => {
  const state = createVisaInformationState({
    ...fallback,
    visaInformation,
  });
  return {
    enabled: state.enabled !== false,
    badgeText: String(state.badgeText ?? "").trim() || "100% Online Process",
    title: String(state.title ?? "").trim() || "Visa Information",
    subtitle:
      String(state.subtitle ?? "").trim() ||
      "A 100% online visa application process that is simple, secure and hassle-free.",
    note:
      String(state.note ?? "").trim() ||
      "Visa rules and conditions may change. Please check the latest requirements before applying.",
    items: state.items.map((item) => ({
      id: String(item?.id ?? "").trim(),
      enabled: item?.enabled !== false,
      label: String(item?.label ?? "").trim(),
      value: String(item?.value ?? "").trim(),
      description: String(item?.description ?? "").trim(),
      icon: String(item?.icon ?? "").trim(),
      color: String(item?.color ?? "").trim() || "blue",
    })),
  };
};

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

const LANDING_HERO_HIGHLIGHTS_DEFAULT = [
  {
    title: "Fast Processing",
    body: "Quick application flow and updates",
  },
  {
    title: "Trusted Guidance",
    body: "Accurate help for every step",
  },
  {
    title: "All-in-One Platform",
    body: "Search, apply, track, and upload",
  },
  {
    title: "Secure & Private",
    body: "Your documents stay protected",
  },
];

const LANDING_HIGHLIGHT_ICONS = ["Zap", "ShieldCheck", "FileText", "Lock"];
const AVAILABLE_ICONS = {
  Zap, ShieldCheck, FileText, Lock, CheckCircle, Clock,
  Globe, Users, CreditCard, MapPin, Plane, HeartHandshake, Smile, Search
};

const normalizeCountrySelectorIds = (list) =>
  Array.isArray(list)
    ? list.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];

const withCountryApplyMeta = (item, activeCountryIds = []) => ({
  ...item,
  applyToAllActiveCountries: (() => {
    const selected = normalizeCountrySelectorIds(item?.selectedCountries);
    const hasExplicitSubset = selected.length > 0 && selected.length < activeCountryIds.length;
    return hasExplicitSubset ? false : item?.applyToAllActiveCountries !== false;
  })(),
  selectedCountries: (() => {
    const selected = normalizeCountrySelectorIds(item?.selectedCountries);
    const hasExplicitSubset = selected.length > 0 && selected.length < activeCountryIds.length;
    const applyToAll = hasExplicitSubset ? false : item?.applyToAllActiveCountries !== false;
    return applyToAll ? [...activeCountryIds] : selected;
  })(),
});

const toFeeApplyScope = (item) => {
  const selectedCountries = normalizeCountrySelectorIds(item?.selectedCountries);
  if (item?.applyToAllActiveCountries !== false) {
    return { scope: "all", countryIds: [] };
  }
  if (selectedCountries.length === 1) {
    return { scope: "single", countryIds: selectedCountries };
  }
  return { scope: "some", countryIds: selectedCountries };
};

const countFeeApplyScopeCountries = (scopeState, allCountryIds = []) => {
  if (scopeState?.scope === "all") return allCountryIds.length;
  return normalizeCountrySelectorIds(scopeState?.countryIds).length;
};

const withCountryVisibilityMeta = (item, activeCountryIds = []) => {
  const selected = normalizeCountrySelectorIds(item?.selectedCountries);
  const hasExplicitSubset = selected.length > 0 && selected.length < activeCountryIds.length;
  const showInAllActiveCountries = hasExplicitSubset
    ? false
    : item?.showInAllActiveCountries !== false;

  return {
    ...item,
    showInAllActiveCountries,
    selectedCountries: showInAllActiveCountries ? [...activeCountryIds] : selected,
  };
};

const normalizeVisibleTextItems = (items, fallbackItems = [], activeCountryIds = []) => {
  const source = Array.isArray(items) && items.length
    ? items
    : fallbackItems.map((text) => ({ text }));
  return source
    .map((item) => {
      if (typeof item === "string") {
        const text = String(item).trim();
        return text
          ? withCountryVisibilityMeta({ text }, activeCountryIds)
          : null;
      }
      const text = String(item?.text ?? item ?? "").trim();
      return text
        ? withCountryVisibilityMeta({ ...item, text }, activeCountryIds)
        : null;
    })
    .filter(Boolean);
};

const normalizeVisibleIncludedItems = (items, fallbackItems = [], activeCountryIds = []) => {
  const source = Array.isArray(items) && items.length ? items : fallbackItems;
  return source
    .map((item) =>
      withCountryVisibilityMeta(
        {
          ...item,
          title: String(item?.title ?? "").trim(),
          description: String(item?.description ?? "").trim(),
          icon: String(item?.icon ?? "").trim(),
          color: String(item?.color ?? "blue").trim() || "blue",
        },
        activeCountryIds
      )
    )
    .filter((item) => item.title);
};

const normalizeVisibleFaqItems = (items, fallbackItems = [], activeCountryIds = []) => {
  const source = Array.isArray(items) && items.length ? items : fallbackItems;
  return source
    .map((item) =>
      withCountryVisibilityMeta(
        {
          ...item,
          question: String(item?.question ?? "").trim(),
          answer: String(item?.answer ?? "").trim(),
        },
        activeCountryIds
      )
    )
    .filter((item) => item.question && item.answer);
};

const normalizeVisibleHowItWorksItems = (items, fallbackItems = [], activeCountryIds = []) => {
  const source = Array.isArray(items) && items.length ? items : fallbackItems;
  return source
    .map((item) =>
      withCountryVisibilityMeta(
        {
          ...item,
          title: String(item?.title ?? "").trim(),
          description: String(item?.description ?? "").trim(),
        },
        activeCountryIds
      )
    )
    .filter((item) => item.title && item.description);
};

const normalizeGlobalRequiredDocumentEntriesFromApi = (items, fallbackKeys = [], activeCountryIds = []) => {
  const source = Array.isArray(items) && items.length
    ? items
    : fallbackKeys.map((key) => ({ key }));
  return source
    .map((item) => {
      const key = String(typeof item === "string" ? item : item?.key ?? "").trim();
      return key
        ? withCountryVisibilityMeta({ ...(typeof item === "string" ? {} : item), key }, activeCountryIds)
        : null;
    })
    .filter(Boolean);
};

const normalizeGlobalOptionalDocumentEntriesFromApi = normalizeGlobalRequiredDocumentEntriesFromApi;

const mapDestinationWhyBookNowFromApi = (s) => {
  const a = s?.destinationWhyBookNow;
  return Array.isArray(a) && a.length
    ? a.map((x) => String(x?.text ?? x ?? "").trim()).filter(Boolean)
    : [...DESTINATION_PAGE_DEFAULT_WHY_BOOK_NOW];
};

const safeMapIncludedItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((x) => {
    if (typeof x === "string") {
      return { title: x.trim(), description: "", icon: "", color: "blue" };
    }
    return {
      title: String(x?.title ?? "").trim(),
      description: String(x?.description ?? "").trim(),
      icon: String(x?.icon ?? "").trim(),
      color: String(x?.color ?? "blue").trim(),
    };
  });
};

const mapDestinationIncludedFromApi = (s) => {
  const a = s?.destinationIncludedItems;
  if (Array.isArray(a) && a.length) {
    return safeMapIncludedItems(a);
  }
  return DESTINATION_PAGE_DEFAULT_INCLUDED.map((f) => ({ ...f }));
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
    ? a.map((x) => String(x?.text ?? x ?? "").trim()).filter(Boolean)
    : [...DESTINATION_PAGE_DEFAULT_VISA_REQUIREMENTS];
};

const mapDestinationWhyBookNowItemsFromApi = (s, activeCountryIds = []) =>
  normalizeVisibleTextItems(s?.destinationWhyBookNow, DESTINATION_PAGE_DEFAULT_WHY_BOOK_NOW, activeCountryIds);

const mapDestinationIncludedItemsFromApi = (s, activeCountryIds = []) =>
  normalizeVisibleIncludedItems(s?.destinationIncludedItems, DESTINATION_PAGE_DEFAULT_INCLUDED, activeCountryIds);

const mapDestinationFaqItemsFromApi = (s, activeCountryIds = []) =>
  normalizeVisibleFaqItems(s?.destinationFaqs, DESTINATION_PAGE_DEFAULT_FAQS, activeCountryIds);

const mapDestinationHowItWorksItemsFromApi = (s, activeCountryIds = []) =>
  normalizeVisibleHowItWorksItems(s?.destinationHowItWorks, DESTINATION_PAGE_DEFAULT_HOW_IT_WORKS, activeCountryIds);

const mapDestinationVisaRequirementItemsFromApi = (s, activeCountryIds = []) =>
  normalizeVisibleTextItems(s?.destinationVisaRequirements, DESTINATION_PAGE_DEFAULT_VISA_REQUIREMENTS, activeCountryIds);

const mapLandingHeroHighlightsFromApi = (s) => {
  const a = s?.landingHeroHighlights;
  const sanitized = Array.isArray(a)
    ? a
        .map((item) => ({
          title: String(item?.title ?? "").trim(),
          body: String(item?.body ?? "").trim(),
        }))
        .filter((item) => item.title || item.body)
    : [];

  return LANDING_HERO_HIGHLIGHTS_DEFAULT.map((fallback, index) => ({
    title: sanitized[index]?.title || fallback.title,
    body: sanitized[index]?.body || fallback.body,
  }));
};

/** Lowercase trim key for matching global destination bullets / FAQ questions. */
const normDestKey = (s) => String(s ?? "").trim().toLowerCase();

/** Map `/admin/settings` API document to the dashboard settings form (GET + PUT). */
const mapApiSettingsToFormState = (s, activeCountryIds = []) => ({
  razorpayKeyId: s.razorpayKeyId || "",
  razorpayKeySecret: s.razorpayKeySecret || "",
  gstEnabled: s.gstEnabled !== false,
  gstRate: Number.isFinite(Number(s.gstRate)) ? String(Number(s.gstRate)) : "18",
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
  smtpFromEmail: s.smtpFromEmail || "",
  smtpEmailService: s.smtpEmailService?.trim() || "gmail",
  enableGDriveUpload: s.enableGDriveUpload !== false,
  enableFileUpload: s.enableFileUpload !== false,
  showTravelerDetails: s.showTravelerDetails !== false,
  allowedFileFormats: Array.isArray(s.allowedFileFormats) && s.allowedFileFormats.length > 0
    ? s.allowedFileFormats
    : ["pdf", "jpg", "jpeg", "png"],
  unsplashApplicationId: s.unsplashApplicationId || "",
  unsplashAccessKey: s.unsplashAccessKey || "",
  unsplashSecretKey: s.unsplashSecretKey || "",
  destinationWhyBookNow: mapDestinationWhyBookNowItemsFromApi(s, activeCountryIds),
  destinationIncludedItems: mapDestinationIncludedItemsFromApi(s, activeCountryIds),
  destinationFaqs: mapDestinationFaqItemsFromApi(s, activeCountryIds),
  destinationHowItWorks: mapDestinationHowItWorksItemsFromApi(s, activeCountryIds),
  destinationVisaRequirements: mapDestinationVisaRequirementItemsFromApi(s, activeCountryIds),
  landingHeroHighlights: mapLandingHeroHighlightsFromApi(s),
  customerChatEnabled: s.customerChatEnabled !== false,
  customerChatMode: s.customerChatMode || "external_link",
  customerChatLink: s.customerChatLink || "",
  customerChatTitle: s.customerChatTitle || "Continue with Chat",
  customerChatDescription: s.customerChatDescription || "Get instant support from our visa team",
  customerChatHeaderTitle: s.customerChatHeaderTitle || "Chat with us",
  customerChatHeaderSubtitle: s.customerChatHeaderSubtitle || "We typically reply in a few minutes",
  footerLogo: s.footerLogo || "",
  footerDescription: s.footerDescription || "",
  seoWebsiteTitle: s.seoWebsiteTitle || "Visa & Voyage",
  seoMetaDescription: s.seoMetaDescription || "",
  seoMetaKeywords: s.seoMetaKeywords || "",
  seoHomepageTitle: s.seoHomepageTitle || "",
  seoHomepageDescription: s.seoHomepageDescription || "",
  seoOpenGraphTitle: s.seoOpenGraphTitle || "",
  seoOpenGraphDescription: s.seoOpenGraphDescription || "",
  seoTwitterTitle: s.seoTwitterTitle || "",
  seoTwitterDescription: s.seoTwitterDescription || "",
  seoCanonicalUrl: s.seoCanonicalUrl || "https://visavo.in",
  seoFaviconUrl: s.seoFaviconUrl || "",
  seoFavicon32Url: s.seoFavicon32Url || "",
  seoFavicon192Url: s.seoFavicon192Url || "",
  seoAppleTouchIconUrl: s.seoAppleTouchIconUrl || "",
  seoRobotsIndex: s.seoRobotsIndex !== false,
  seoSitemapUrl: s.seoSitemapUrl || "https://visavo.in/sitemap.xml",
  whatsappTemplate: s.whatsappTemplate || "",
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

const DEFAULT_OTP_SETTINGS = {
  sms: { enabled: false, provider: "MSG91", authKey: "", templateId: "", otpLength: "6" },
  whatsapp: { enabled: false, provider: "MSG91 WhatsApp", authKey: "", templateId: "", businessNumber: "", otpLength: "6" },
  email: { enabled: true, provider: "Custom SMTP", apiKey: "", senderEmail: "", senderName: "", templateId: "", otpLength: "6" },
  priority: { primary: "whatsapp", fallback1: "sms", fallback2: "email" },
  testing: { enabled: false, autofillEnabled: true },
  authControls: {
    passwordEnabled: true,
    googleEnabled: true,
    facebookEnabled: false,
    phoneOtpEnabled: true,
    smsOtpEnabled: false,
    emailOtpEnabled: true,
  },
};

const mapApiOtpSettingsToFormState = (settings = {}) => ({
  sms: { ...DEFAULT_OTP_SETTINGS.sms, ...(settings.sms || {}) },
  whatsapp: { ...DEFAULT_OTP_SETTINGS.whatsapp, ...(settings.whatsapp || {}) },
  email: { ...DEFAULT_OTP_SETTINGS.email, ...(settings.email || {}) },
  priority: { ...DEFAULT_OTP_SETTINGS.priority, ...(settings.priority || {}) },
  testing: { ...DEFAULT_OTP_SETTINGS.testing, ...(settings.testing || {}) },
  authControls: { ...DEFAULT_OTP_SETTINGS.authControls, ...(settings.authControls || {}) },
});

/**
 * Compact "switch" used inside each universal control card header. Renders as a
 * pill with an animated knob - green when the field is visible on the public
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

const AuthControlToggle = ({ title, description, checked, onChange }) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-4">
    <div>
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <p className="mt-1 text-xs text-text-secondary">{description}</p>
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
        checked ? "border-emerald-500 bg-emerald-500" : "border-border bg-surface-2"
      }`}
      aria-pressed={checked}
      aria-label={title}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  </div>
);

const CountryCardActiveToggle = ({ active, busy, onClick, countryName }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center rounded-full border p-1 transition-colors ${
        active
          ? "border-cyan/40 bg-cyan/10 text-cyan hover:border-cyan/70"
          : "border-border bg-surface-3 text-text-muted hover:border-cyan/30"
      } ${busy ? "cursor-wait opacity-60" : "cursor-pointer"}`}
      aria-label={`${active ? "Disable" : "Enable"} ${countryName}`}
      aria-pressed={active}
      title={active ? "Visible on public site" : "Hidden on public site"}
    >
      <span
        className={`relative inline-flex h-4 w-8 rounded-full transition-colors ${
          active ? "bg-cyan" : "bg-surface-2 border border-border"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
            active ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
};

// -------------------------------------------------------------
//  COMPONENT
// -- Live Support Chat Mock Conversations & Workspace --------
const INITIAL_CONVERSATIONS = [
  {
    id: "1",
    name: "Rohit Sharma",
    email: "rohit.sharma@email.com",
    phone: "+91 98765 43210",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces",
    active: true,
    unread: 2,
    messages: [
      { id: "m1", sender: "user", text: "Hi, I need help with my Dubai visa application.", time: "10:30 AM" },
      { id: "m2", sender: "user", text: "What documents are required for a tourist visa?", time: "10:31 AM" },
      { id: "m3", sender: "admin", text: "Hello Rohit! Hi\n\nI'll be happy to help you with your Dubai visa.", time: "10:32 AM" },
      { id: "m4", sender: "admin", text: "For Dubai tourist visa, you need:\n- Passport (valid 6+ months)\n- Passport size photo\n- Confirmed return ticket\n- Hotel booking\n- Bank statement (last 3 months)\n\nAnything else I can help you with?", time: "10:33 AM" },
      { id: "m5", sender: "user", text: "Thank you! How long does it take to process?", time: "10:34 AM" },
      { id: "m6", sender: "admin", text: "It usually takes 3-4 working days. Let me know if you have any other questions.", time: "10:35 AM" }
    ]
  },
  {
    id: "2",
    name: "Priya Patel",
    email: "priya.patel@email.com",
    phone: "+91 87654 32109",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces",
    active: true,
    unread: 1,
    messages: [
      { id: "m2_1", sender: "user", text: "Can you tell me the document list for Singapore tourist eVisa?", time: "10:15 AM" }
    ]
  },
  {
    id: "3",
    name: "Amit Verma",
    email: "amit.verma@email.com",
    phone: "+91 76543 21098",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces",
    active: true,
    unread: 0,
    messages: [
      { id: "m3_1", sender: "user", text: "What is the processing time for Thailand eVisa on arrival?", time: "09:58 AM" }
    ]
  },
  {
    id: "4",
    name: "Neha Singh",
    email: "neha.singh@email.com",
    phone: "+91 65432 10987",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces",
    active: true,
    unread: 3,
    messages: [
      { id: "m4_1", sender: "user", text: "My payment is failed, but amount got deducted from my UPI. Can you check my status?", time: "09:40 AM" }
    ]
  },
  {
    id: "5",
    name: "Vikram Joshi",
    email: "vikram.joshi@email.com",
    phone: "+91 54321 09876",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop&crop=faces",
    active: false,
    unread: 0,
    messages: [
      { id: "m5_1", sender: "user", text: "Do you provide insurance also for Europe Schengen visas?", time: "Yesterday" }
    ]
  },
  {
    id: "6",
    name: "Anjali Mehta",
    email: "anjali.mehta@email.com",
    phone: "+91 43210 98765",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=faces",
    active: false,
    unread: 0,
    messages: [
      { id: "m6_1", sender: "user", text: "How can I track my application? I applied 2 days ago.", time: "Yesterday" }
    ]
  },
  {
    id: "7",
    name: "Sandeep Yadav",
    email: "sandeep.yadav@email.com",
    phone: "+91 32109 87654",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=faces",
    active: false,
    unread: 0,
    messages: [
      { id: "m7_1", sender: "user", text: "I want to change my travel date from June 10 to June 15.", time: "2 Days Ago" }
    ]
  },
  {
    id: "8",
    name: "Kavita Kumari",
    email: "kavita.kumari@email.com",
    phone: "+91 21098 76543",
    avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&h=100&fit=crop&crop=faces",
    active: false,
    unread: 0,
    messages: [
      { id: "m8_1", sender: "user", text: "Please help me with invitation letter guidelines for tourist visa.", time: "2 Days Ago" }
    ]
  }
];

const renderAvatar = (name, sizeClass = "w-10 h-10 text-xs") => {
  const initials = (name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const colors = [
    "bg-[linear-gradient(135deg,#FF6B6B_0%,#FF8E53_100%)]",
    "bg-[linear-gradient(135deg,#4E65FF_0%,#92EFFD_100%)]",
    "bg-[linear-gradient(135deg,#00C6FF_0%,#0072FF_100%)]",
    "bg-[linear-gradient(135deg,#7F00FF_0%,#E100FF_100%)]",
    "bg-[linear-gradient(135deg,#11998e_0%,#38ef7d_100%)]",
    "bg-[linear-gradient(135deg,#f857a6_0%,#ff5858_100%)]",
  ];
  const colorIndex = initials.charCodeAt(0) % colors.length;
  const gradient = colors[colorIndex];

  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center text-white font-bold uppercase tracking-wider ${gradient} border border-white/10 shadow-sm flex-shrink-0 select-none`}>
      {initials}
    </div>
  );
};

const SupportChatWorkspace = () => {
  const chatEmojis = [":)", ":D", "<3", "+1", "thanks", "done", "ok", "yes", "hello", "great"];
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState("1");
  const [activeTab, setActiveTab] = useState("all"); // "all" | "unread" | "resolved"
  const [search, setSearch] = useState("");
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const typingTimeoutRef = useRef(null);

  const activeConversation = conversations.find(c => c.id === selectedId);

  // Fetch active conversations and sync every 3 seconds
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const { data } = await api.get("/admin/chat/conversations");
        if (data?.success && data?.conversations) {
          setConversations(data.conversations);
          
          // Select the first conversation automatically only if no valid conversation is selected yet
          if (data.conversations.length > 0) {
            setSelectedId(prev => {
              if (prev === "1" || !data.conversations.some(c => c.id === prev)) {
                return data.conversations[0].id;
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.error("Failed to load live conversations:", err);
      }
    };

    fetchConversations();
    const interval = setInterval(fetchConversations, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-clear unread count when clicking conversation
  useEffect(() => {
    if (activeConversation && activeConversation.unread > 0) {
      api.post(`/support/conversations/${activeConversation.id}`, { unread: 0 })
        .then(({ data }) => {
          if (data?.success && data?.conversation) {
            setConversations(prev => prev.map(c => c.id === activeConversation.id ? data.conversation : c));
          }
        })
        .catch(err => console.error("Failed to reset unread count:", err));
    }
  }, [selectedId, activeConversation?.id]);

  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      // Filter by tab
      if (activeTab === "unread" && c.unread === 0) return false;
      if (activeTab === "resolved" && c.active) return false;
      if (activeTab === "all" && !c.active) return false; // resolved are inactive

      // Filter by search
      if (search.trim()) {
        const query = search.toLowerCase();
        return c.name.toLowerCase().includes(query) || c.email.toLowerCase().includes(query) || c.phone.includes(query);
      }
      return true;
    });
  }, [conversations, activeTab, search]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeConversation) return;

    const textToSend = inputText;
    setInputText("");
    setShowEmojiPicker(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    try {
      await api.post(`/admin/chat/conversations/${activeConversation.id}/typing`, {
        isTyping: false
      });
      const { data } = await api.post(`/admin/chat/conversations/${activeConversation.id}/reply`, {
        text: textToSend
      });
      
      if (data?.success && data?.conversation) {
        setConversations(prev => prev.map(c => c.id === activeConversation.id ? data.conversation : c));
      }

      // Simulate reply if this is one of our default mock accounts ending in @email.com
      if (activeConversation.email && activeConversation.email.endsWith("@email.com")) {
        setIsTyping(true);
        setTimeout(async () => {
          setIsTyping(false);
          const customerReplies = [
            "Thank you for the quick update! Highly appreciate it.",
            "Awesome, I will review these documents and upload them right away.",
            "Got it. Is there any extra fee for fast-track processing?",
            "Perfect, thanks! I'll complete this tonight.",
            "Okay, please let me know when it goes to the embassy.",
          ];
          const randomReply = customerReplies[Math.floor(Math.random() * customerReplies.length)];
          
          try {
            await api.post(`/support/conversations/${activeConversation.id}/messages`, {
              sender: "user",
              text: randomReply
            });
          } catch (simErr) {
            console.error("Simulation reply failed:", simErr);
          }
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to send live support reply:", err);
    }
  };

  const handleMarkResolved = async () => {
    if (!activeConversation) return;
    try {
      const newActive = !activeConversation.active;
      const { data } = await api.post(`/support/conversations/${activeConversation.id}`, {
        active: newActive
      });
      if (data?.success && data?.conversation) {
        setConversations(prev => prev.map(c => c.id === activeConversation.id ? data.conversation : c));
      }
    } catch (err) {
      console.error("Failed to update resolved status:", err);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setInputText((prev) => `${prev}${emoji}`);
    setShowEmojiPicker(false);
  };

  const handleComposerChange = async (value) => {
    setInputText(value);

    if (!activeConversation) return;

    try {
      await api.post(`/admin/chat/conversations/${activeConversation.id}/typing`, {
        isTyping: value.trim().length > 0
      });
    } catch (err) {
      console.error("Failed to update admin typing state:", err);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(async () => {
      try {
        await api.post(`/admin/chat/conversations/${activeConversation.id}/typing`, {
          isTyping: false
        });
      } catch (err) {
        console.error("Failed to clear admin typing state:", err);
      }
    }, 6000);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex bg-surface rounded-3xl border border-border overflow-hidden h-[calc(100vh-220px)] min-h-[600px] shadow-[0_20px_50px_rgba(0,0,0,0.03)]">
      {/* LEFT COLUMN - CONVERSATION LIST */}
      <div className="w-[380px] border-r border-border flex flex-col bg-surface flex-shrink-0">
        <div className="p-5 border-b border-border space-y-4">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Support Chat</h1>
            <p className="text-xs text-text-muted mt-0.5">Manage customer conversations</p>
          </div>

          {/* Top category tabs */}
          <div className="flex gap-4 border-b border-border pb-1">
            <button
              onClick={() => setActiveTab("all")}
              className={`pb-2 px-1 text-xs font-semibold relative transition-all ${activeTab === "all" ? "text-cyan" : "text-text-muted hover:text-text-secondary"}`}
            >
              All Conversations
              {conversations.filter(c => c.active).length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-cyan/10 text-cyan text-[10px] font-bold">
                  {conversations.filter(c => c.active).length}
                </span>
              )}
              {activeTab === "all" && <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan rounded-full" />}
            </button>
            <button
              onClick={() => setActiveTab("unread")}
              className={`pb-2 px-1 text-xs font-semibold relative transition-all ${activeTab === "unread" ? "text-cyan" : "text-text-muted hover:text-text-secondary"}`}
            >
              Unread
              {conversations.reduce((sum, c) => sum + c.unread, 0) > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
                  {conversations.reduce((sum, c) => sum + c.unread, 0)}
                </span>
              )}
              {activeTab === "unread" && <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan rounded-full" />}
            </button>
            <button
              onClick={() => setActiveTab("resolved")}
              className={`pb-2 px-1 text-xs font-semibold relative transition-all ${activeTab === "resolved" ? "text-cyan" : "text-text-muted hover:text-text-secondary"}`}
            >
              Resolved
              {activeTab === "resolved" && <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan rounded-full" />}
            </button>
          </div>

          {/* Search bar */}
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl py-2 pl-10 pr-10 text-xs focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/15 text-text-primary placeholder-text-muted"
            />
            <button className="absolute right-3 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors">
              <Filter className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Conversation list viewport */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted h-64">
              <MessageSquare className="h-8 w-8 text-border mb-2" />
              <p className="text-xs">No conversations found</p>
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isActive = c.id === selectedId;
              const lastMsg = c.messages[c.messages.length - 1];
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full p-4 flex gap-3 text-left transition-all relative ${isActive ? "bg-cyan/5 border-l-[3.5px] border-cyan" : "hover:bg-surface-2 border-l-[3.5px] border-transparent"}`}
                >
                  <div className="relative flex-shrink-0">
                    {renderAvatar(c.name, "w-10 h-10 text-xs")}
                    {c.active && (
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-[1.5px] border-surface" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="text-xs font-bold text-text-primary truncate">{c.name}</h4>
                      <span className="text-[10px] text-text-muted shrink-0">{lastMsg?.time || "10:00 AM"}</span>
                    </div>
                    <p className="text-xs text-text-secondary truncate pr-4">
                      {lastMsg ? lastMsg.text : "No messages yet"}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <span className="absolute right-4 bottom-4 flex h-4.5 min-w-[18px] px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shrink-0">
                      {c.unread}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer pagination */}
        <div className="p-4 border-t border-border flex items-center justify-between text-[11px] text-text-muted select-none">
          <span>Showing 1 to {filteredConversations.length} of {conversations.length}</span>
          <div className="flex gap-1.5 items-center">
            <button className="px-1.5 py-0.5 rounded border border-border bg-white text-text-muted hover:text-text-primary disabled:opacity-50" disabled>&lt;</button>
            <button className="px-2 py-0.5 rounded bg-cyan text-white font-bold">1</button>
            <button className="px-2 py-0.5 rounded border border-border bg-white text-text-muted hover:text-text-primary disabled:opacity-50" disabled>&gt;</button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - CHAT VIEWPORT */}
      <div className="flex-1 flex flex-col bg-surface">
        {!activeConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-text-muted bg-surface-2/10">
            <div className="h-16 w-16 rounded-full bg-cyan/5 flex items-center justify-center text-cyan mb-4 animate-bounce">
              <MessageSquare className="h-8 w-8" />
            </div>
            <h3 className="text-sm font-bold text-text-primary mb-1">No Active Chats</h3>
            <p className="text-xs text-text-muted max-w-[280px]">
              Active customer support chats will appear here automatically in real-time as users connect.
            </p>
          </div>
        ) : (
          <>
            {/* Top Active Chat Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-2/45 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {renderAvatar(activeConversation.name, "w-11 h-11 text-sm")}
                  {activeConversation.active && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-surface" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                    {activeConversation.name}
                    {activeConversation.active && <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded">Online</span>}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5 flex items-center gap-2">
                    <span className="truncate max-w-[150px] sm:max-w-[200px]">{activeConversation.email}</span>
                    <span className="text-border/60">·</span>
                    <span>{activeConversation.phone}</span>
                    <span className="text-border/60">·</span>
                    <a href="#profile" className="text-cyan font-bold hover:underline">View Profile</a>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleMarkResolved}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${activeConversation.active ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/10" : "border-border bg-surface-2 text-text-secondary hover:bg-surface-3"}`}
                >
                  <CheckCircle className="h-4 w-4" />
                  {activeConversation.active ? "Mark as Resolved" : "Reopen Conversation"}
                </button>
                <button className="p-1.5 rounded-lg border border-border hover:bg-surface-2 text-text-secondary transition-colors">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Chat Message Thread viewport */}
            <div className="flex-1 p-6 overflow-y-auto bg-surface-2/20 space-y-4">
              <div className="flex items-center my-4">
                <div className="flex-1 border-t border-border/40" />
                <span className="px-3 text-[10px] text-text-muted font-bold tracking-wider uppercase bg-surface py-0.5 border border-border/30 rounded-full shadow-sm">Today</span>
                <div className="flex-1 border-t border-border/40" />
              </div>

              {activeConversation.messages && activeConversation.messages.map((m) => {
                const isAdmin = m.sender === "admin";

                return (
                  <div key={m.id} className={`flex w-full ${isAdmin ? "justify-end" : "justify-start"}`}>
                    <div className={`flex gap-3 max-w-[70%] ${isAdmin ? "flex-row-reverse" : "flex-row"}`}>
                      {!isAdmin && (
                        renderAvatar(activeConversation.name, "w-7 h-7 text-[10px] mt-0.5")
                      )}
                      <div>
                        <div
                          className={`rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                            isAdmin
                              ? "bg-blue-600 text-white rounded-tr-none font-medium"
                              : "bg-surface-3 text-text-primary rounded-tl-none border border-border/30"
                          }`}
                          style={{ whiteSpace: "pre-line" }}
                        >
                          {m.text}
                        </div>
                        <div className={`flex items-center gap-1.5 mt-1 text-[10px] text-text-muted ${isAdmin ? "justify-end" : "justify-start"}`}>
                          <span>{m.time}</span>
                          {isAdmin && <CheckCheck className="h-3.5 w-3.5 text-blue-500" />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Simulated Typing Indicator */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex gap-3 max-w-[70%]">
                    {renderAvatar(activeConversation.name, "w-7 h-7 text-[10px] mt-0.5 animate-pulse")}
                    <div className="bg-surface-3 border border-border/30 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1.5 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Composer area */}
            <div className="p-4 border-t border-border flex-shrink-0 bg-surface">
              <div className="relative">
                <textarea
                  rows={3}
                  value={inputText}
                  onChange={e => handleComposerChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your message..."
                  className="w-full border border-border bg-surface-2 focus:border-cyan focus:ring-cyan/10 text-text-primary rounded-2xl p-4 text-xs focus:outline-none focus:ring-2 pr-16 resize-none leading-relaxed transition-all"
                />
                <div className="absolute bottom-3 left-4 flex gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker((prev) => !prev)}
                      aria-label="Open emoji picker"
                      className="p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
                    >
                    <Smile className="h-4 w-4" />
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-11 left-0 z-20 flex w-max max-w-[320px] gap-2 overflow-x-auto whitespace-nowrap rounded-2xl border border-border bg-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
                        {chatEmojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleEmojiSelect(emoji)}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-lg transition-colors hover:bg-surface-3"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="absolute bottom-3 right-4">
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md bg-cyan hover:bg-cyan/90 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
const Dashboard = () => {
  const {
    showToast,
    countryModalOpen,
    selectedCountry,
    openCountryModal,
    closeCountryModal,
    setSelectedCountry,
  } = useUIStore();

  // -- Route & State Navigation ------------------------------
  const navigate       = useNavigate();
  const { activeTab: tabParam } = useParams();
  const activeTab      = tabParam || "analytics";
  const [searchParams] = useSearchParams();
  const isControlsTab = ["controls", "landing-page", "cards", "footer", "settings", "activity", "chat"].includes(activeTab);
  const validAdminTabIds = useMemo(() => new Set(ADMIN_DASHBOARD_TABS.map((tab) => tab.id)), []);

  useEffect(() => {
    if (!tabParam) return;
    if (validAdminTabIds.has(tabParam)) return;
    navigate("/", { replace: true });
  }, [navigate, tabParam, validAdminTabIds]);

  // -- Global Data Store --------------------------------------
  const { bookings, countries, fetchAllApplications, fetchCountries, fetchPages, updateCountry } = useDataStore();
  const activeCountryOptions = useMemo(
    () =>
      (Array.isArray(countries) ? countries : [])
        .filter((country) => country?.isActive !== false)
        .map((country) => ({
          ...country,
          slug: country?.slug || country?.id,
        })),
    [countries]
  );
  const activeCountryIds = useMemo(
    () =>
      activeCountryOptions
        .map((country) => String(country?._id || country?.slug || country?.id || "").trim())
        .filter(Boolean),
    [activeCountryOptions]
  );
  const allCountryOptions = useMemo(
    () =>
      [...activeCountryOptions].sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""))),
    [activeCountryOptions]
  );
  const allCountryIds = useMemo(() => [...activeCountryIds], [activeCountryIds]);

  // -- Local state ------------------------------------------
  const [searchQuery, setSearchQuery]        = useState("");
  const [countrySearchQuery, setCountrySearchQuery] = useState("");
  const [statusFilter, setStatusFilter]      = useState("all");
  const [activeChart, setActiveChart]        = useState("revenue"); // "revenue"|"bookings"
  const [transactions, setTransactions]      = useState([]);
  const [settingsForm, setSettingsForm]      = useState({
    razorpayKeyId: "",
    razorpayKeySecret: "",
    gstEnabled: true,
    gstRate: "18",
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
    smtpFromEmail: "",
    smtpEmailService: "gmail",
    enableGDriveUpload: true,
    enableFileUpload: true,
    showTravelerDetails: true,
    allowedFileFormats: ["pdf", "jpg", "jpeg", "png"],
    unsplashApplicationId: "",
    unsplashAccessKey: "",
    unsplashSecretKey: "",
    destinationWhyBookNow: normalizeVisibleTextItems([], DESTINATION_PAGE_DEFAULT_WHY_BOOK_NOW, []),
    destinationIncludedItems: normalizeVisibleIncludedItems([], DESTINATION_PAGE_DEFAULT_INCLUDED, []),
    destinationFaqs: normalizeVisibleFaqItems([], DESTINATION_PAGE_DEFAULT_FAQS, []),
    destinationHowItWorks: normalizeVisibleHowItWorksItems([], DESTINATION_PAGE_DEFAULT_HOW_IT_WORKS, []),
    destinationVisaRequirements: normalizeVisibleTextItems([], DESTINATION_PAGE_DEFAULT_VISA_REQUIREMENTS, []),
    landingHeroHighlights: LANDING_HERO_HIGHLIGHTS_DEFAULT.map((item) => ({ ...item })),
    customerChatEnabled: true,
    customerChatMode: "external_link",
    customerChatLink: "",
    customerChatTitle: "Continue with Chat",
    customerChatDescription: "Get instant support from our visa team",
    customerChatHeaderTitle: "Chat with us",
    customerChatHeaderSubtitle: "We typically reply in a few minutes",
    footerLogo: "",
    footerDescription: "",
    seoWebsiteTitle: "Visa & Voyage",
    seoMetaDescription: "",
    seoMetaKeywords: "",
    seoHomepageTitle: "",
    seoHomepageDescription: "",
    seoOpenGraphTitle: "",
    seoOpenGraphDescription: "",
    seoTwitterTitle: "",
    seoTwitterDescription: "",
    seoCanonicalUrl: "https://visavo.in",
    seoFaviconUrl: "",
    seoFavicon32Url: "",
    seoFavicon192Url: "",
    seoAppleTouchIconUrl: "",
    seoRobotsIndex: true,
    seoSitemapUrl: "https://visavo.in/sitemap.xml",
    whatsappTemplate: "",
  });
  const [otpSettingsForm, setOtpSettingsForm] = useState(DEFAULT_OTP_SETTINGS);
  /** Which settings subsection is currently saving (null = idle). */
  const [savingSettingsKey, setSavingSettingsKey] = useState(null);
  /**
   * Universal control system - admin sets a single global Visa Type / Validity that
   * applies to every country card and detail page unless an individual country edit
   * carries a per-country override. `defaults` mirrors the server state, while the
   * `*Picker`/`*Custom` pair drives the dropdown + free-text controls.
   */
  const [globalDefaults, setGlobalDefaults] = useState({
    globalBasePrice: null,
    globalBasePriceVisibility: { applyToAllActiveCountries: true, selectedCountries: [] },
    serviceFeeScopeValues: { all: null, single: null, some: null },
    serviceFeeScopeTargets: { singleCountryId: "", someCountryIds: [] },
    globalGovernmentFee: null,
    globalGovernmentFeeVisibility: { applyToAllActiveCountries: true, selectedCountries: [] },
    governmentFeeScopeValues: { all: null, single: null, some: null },
    governmentFeeScopeTargets: { singleCountryId: "", someCountryIds: [] },
    globalVisaType: "",
    visaTypeScopeValues: { all: "", single: "", some: "" },
    visaTypeScopeTargets: { singleCountryId: "", someCountryIds: [], singleCountryOverrides: [] },
    globalValidity: "",
    validityScopeValues: { all: "", single: "", some: "" },
    validityScopeTargets: { singleCountryId: "", someCountryIds: [], singleCountryOverrides: [] },
    globalLengthOfStay: "",
    lengthOfStayScopeValues: { all: "", single: "", some: "" },
    lengthOfStayScopeTargets: { singleCountryId: "", someCountryIds: [], singleCountryOverrides: [] },
    globalEntryType: "",
    entryTypeScopeValues: { all: "", single: "", some: "" },
    entryTypeScopeTargets: { singleCountryId: "", someCountryIds: [], singleCountryOverrides: [] },
    globalEntryTypeVisibility: { applyToAllActiveCountries: true, selectedCountries: [] },
    globalProcessingDays: "",
    processingDaysScopeValues: { all: "", single: "", some: "" },
    processingDaysScopeTargets: { singleCountryId: "", someCountryIds: [], singleCountryOverrides: [] },
    globalProcessingDaysVisibility: { applyToAllActiveCountries: true, selectedCountries: [] },
    globalRequiredDocuments: [],
    globalRequiredDocumentEntries: [],
    globalOptionalDocuments: [],
    globalOptionalDocumentEntries: [],
    documentSectionCopy: {
      requiredHeading: "Documents Required",
      requiredDescription: "These are the country documents required for this application.",
      optionalHeading: "Optional Documents",
      optionalDescription: "You can also attach other documents in the same Drive link.",
    },
  });
  const [globalDefaultStats, setGlobalDefaultStats] = useState({
    totalCountries: 0,
    usingGlobalBasePrice: 0,
    usingGlobalGovernmentFee: 0,
    usingGlobalVisaType: 0,
    usingGlobalValidity: 0,
    usingGlobalLengthOfStay: 0,
    usingGlobalEntryType: 0,
    usingGlobalProcessingDays: 0,
    usingGlobalRequiredDocuments: 0,
    overridingBasePrice: 0,
    overridingGovernmentFee: 0,
    overridingVisaType: 0,
    overridingValidity: 0,
    overridingLengthOfStay: 0,
    overridingEntryType: 0,
    overridingProcessingDays: 0,
    overridingRequiredDocuments: 0,
  });
  /** Mirrors `Settings.show*` - when false, the public client hides that tile/section. */
  const [displayToggles, setDisplayToggles] = useState({
    showVisaType: true,
    showValidity: true,
    showLengthOfStay: true,
    showEntryType: true,
    showProcessingDays: true,
    showRequiredDocuments: true,
    showVisaRequirements: false,
    showHowItWorks: true,
    showWhyBookNow: true,
    showDestinationDocuments: true,
    showDestinationRequiredDocs: true,
    showDestinationOptionalDocs: true,
    showWhatsIncluded: true,
    showFaqs: true,
    maintenanceModeEnabled: false,
  });
  const getFirstControlLeaf = (sections = []) => {
    for (const section of sections) {
      if (Array.isArray(section.children) && section.children.length > 0) {
        const childLeaf = getFirstControlLeaf(section.children);
        if (childLeaf) return childLeaf;
      } else {
        return section;
      }
    }
    return null;
  };

  const flattenControlSections = (sections = [], path = []) =>
    sections.flatMap((section) => {
      const nextPath = [...path, section.label];
      if (Array.isArray(section.children) && section.children.length > 0) {
        return flattenControlSections(section.children, nextPath);
      }
      return [{ ...section, path: nextPath }];
    });

  const findControlNodePath = (sections = [], key, path = []) => {
    for (const section of sections) {
      const nextPath = [...path, section];
      if (section.key === key) return nextPath;
      if (Array.isArray(section.children) && section.children.length > 0) {
        const childPath = findControlNodePath(section.children, key, nextPath);
        if (childPath) return childPath;
      }
    }
    return null;
  };

  const hasControlNodeInPath = (sections = [], key) => Boolean(findControlNodePath(sections, key));

  const controlGroups = [
    {
      key: "activity",
      label: "Activity Center",
      icon: BarChart2,
      description: "Analytics, applications, and transactions",
      sections: [
        { key: "analytics", label: "Analytics" },
        { key: "applications", label: "Applications" },
        { key: "transactions", label: "Transactions" },
      ],
    },

    {
      key: "landing-page",
      label: "Header",
      icon: Home,
      description: "Branding, blog and authentication controls",
      sections: [
        {
          key: "navbar",
          label: "Navbar",
          children: [
            { key: "site-logo", label: "Logo" },
            { key: "blog-manager", label: "Blogs" },
            { key: "register-page", label: "Login/Signup" },
            { key: "user-notification-setting", label: "User Notification setting" },
          ],
        },
      ],
    },
    {
      key: "cards",
      label: "Body",
      icon: CreditCard,
      description: "Visa details, fees and documents",
      sections: [
        {
          key: "hero",
          label: "Hero",
          icon: LayoutTemplate,
          children: [
            { key: "searchbar", label: "Searchbar" },
            { key: "landing-highlights", label: "Landing Highlights" },
          ],
        },
        {
          key: "section-cards",
          label: "Cards",
          icon: FileText,
          children: [
            {
              key: "visa-details-and-fee-manager",
              label: "Visa Details and Fee Update",
              children: [
                { key: "visa-details-table", label: "Visa details" },
                { key: "fee-update-manager", label: "Fee update" },
                {
                  key: "country-thumbnails-razorpay",
                  label: "Country thumbnails/ Razor Pay",
                  children: [
                    { key: "country-images", label: "Country images - Unsplash" },
                    { key: "payments-razorpay", label: "Payments - Razorpay" },
                  ],
                },
              ],
            },
            {
              key: "card-content-details",
              label: "Visa Information Page",
              children: [
                { key: "how-it-works", label: "How it works" },
                { key: "why-book-now", label: "Why book now?" },
                { key: "documents", label: "Documents Required" },
                { key: "whats-included", label: "What's included" },
                { key: "faqs", label: "FAQs" },
                { key: "visa-requirements", label: "Visa Requirements" },
              ],
            },
            {
              key: "travel-details",
              label: "Start Application Page",
              icon: MapPin,
              children: [
                { key: "calendar-manager", label: "Calender" },
                { key: "traveler-form-manager", label: "Traveler Form" },
                { key: "upload-methods", label: "Document Upload Methods" },
                { key: "application-documents", label: "Documents" },
              ],
            },
          ],
        },
        {
          key: "testimonials",
          label: "Testimonials",
          icon: MessageSquare,
        },
      ],
    },
    {
      key: "footer",
      label: "Footer",
      icon: PanelBottom,
      description: "Static pages and footer social icons",
      sections: [
        {
          key: "footer-left-side-group",
          label: "left side",
          children: [
            { key: "footer-description", label: "Description" },
            { key: "footer-social-icons", label: "Social" },
          ],
        },
        { key: "static-pages", label: "Static Pages" },
        { key: "dynamic-page", label: "Dynamic Page" },
      ],
    },
    {
      key: "chat",
      label: "Chat",
      icon: MessageSquare,
      description: "Manage customer support widget and live chat",
      sections: [
        { key: "customer-support", label: "Customer Support Widget(FE)" },
        { key: "chat-support", label: "Chat support" },
      ],
    },
    {
      key: "settings",
      label: "Settings",
      icon: Settings,
      description: "Maintenance and configuration",
      sections: [
        { key: "password-update", label: "Password Update" },
        {
          key: "system-display",
          label: "System Display",
          children: [
            { key: "maintenance-mode", label: "Site maintenance mode" },
          ],
        },
        { key: "seo-manager", label: "SEO manager" },
      ],
    },
  ];

  const controlSections = controlGroups.flatMap((group) =>
    flattenControlSections(group.sections).map((section) => ({ ...section, groupKey: group.key, groupLabel: group.label }))
  );
  const [activeControlSection, setActiveControlSection] = useState(controlSections[0].key);
  const [activeControlNavKey, setActiveControlNavKey] = useState(null);
  const [expandedControlTabKeys, setExpandedControlTabKeys] = useState({});
  // State-based group key — clicking a parent menu item updates this, NOT the URL
  const [activeControlGroupKey, setActiveControlGroupKey] = useState(controlGroups[0].key);

  // Derive active group purely from state — no URL dependency
  const activeControlGroup = controlGroups.find((group) => group.key === activeControlGroupKey) || controlGroups[0];
  const activeControlGroupSections = activeControlGroup.sections;
  const activeControlSectionMeta = controlSections.find((s) => s.key === activeControlSection) || controlSections[0];
  const activeControlPageTitle = activeControlSectionMeta.label;
  const activeControlNavPath = activeControlNavKey ? findControlNodePath(activeControlGroupSections, activeControlNavKey) : null;
  const activeControlBreadcrumb = [
    activeControlGroup.label,
    ...((activeControlNavPath || []).map((item) => item.label)),
  ].filter(Boolean);
  const visibleControlSectionKeys = new Set([activeControlSection]);
  const isControlSectionVisible = (sectionKey) => visibleControlSectionKeys.has(sectionKey);
  const [expandedControlCards, setExpandedControlCards] = useState({});
  const selectControlSection = (nextKey) => {
    setActiveControlSection(nextKey);
  };
  // Selecting a parent group: update URL to trigger useEffect sync
  const selectControlGroup = (groupKey) => {
    navigate(groupKey === "controls" ? "/controls" : `/${groupKey}`);
  };
  // Sync group + section whenever the URL tab changes
  useEffect(() => {
    if (!isControlsTab) return;
    const sectionParam = searchParams.get("section");
    if (sectionParam) {
      // Sidebar flyout clicked with a ?section= param — set exact group + section
      const section = controlSections.find((s) => s.key === sectionParam);
      if (section) {
        const group = controlGroups.find((g) => g.key === section.groupKey);
        const sectionPath = group ? findControlNodePath(group.sections, section.key) : null;
        setActiveControlGroupKey(section.groupKey);
        setActiveControlNavKey(section.key);
        setExpandedControlTabKeys(
          Object.fromEntries((sectionPath || []).slice(0, -1).map((item) => [item.key, true]))
        );
        selectControlSection(section.key);
        return;
      }
    }
    // No section param — sync group from URL tab (e.g. /cards → "cards")
    const matchedGroup = controlGroups.find((g) => g.key === activeTab);
    if (matchedGroup) {
      setActiveControlGroupKey(matchedGroup.key);
      setActiveControlNavKey(null);
      const firstSectionKey = getFirstControlLeaf(matchedGroup.sections)?.key;
      if (firstSectionKey) selectControlSection(firstSectionKey);
    }
  }, [activeTab, searchParams]);
  const selectControlNavNode = (section) => {
    const hasChildren = Array.isArray(section.children) && section.children.length > 0;
    setActiveControlNavKey(section.key);
    if (hasChildren) {
      setExpandedControlTabKeys((prev) => {
        if (prev[section.key]) {
          const next = { ...prev };
          delete next[section.key];
          return next;
        }
        return { [section.key]: true };
      });
      const firstLeaf = getFirstControlLeaf(section.children);
      if (firstLeaf) selectControlSection(firstLeaf.key);
      return;
    }
    selectControlSection(section.key);
  };

  const renderControlSectionTabs = (sections = [], depth = 0) => (
    <div className={depth === 0 ? "flex w-max gap-2" : "mt-2 flex w-max gap-2"}>
      {sections.map((section) => {
        const hasChildren = Array.isArray(section.children) && section.children.length > 0;
        const expanded = Boolean(expandedControlTabKeys[section.key]);
        const active =
          activeControlNavKey === section.key ||
          activeControlSection === section.key ||
          (hasChildren && hasControlNodeInPath(section.children, activeControlNavKey || activeControlSection));

        return (
          <div key={section.key} className="flex flex-col">
            <button
              type="button"
              onClick={() => selectControlNavNode(section)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium transition ${
                active
                  ? "border-cyan bg-cyan text-white shadow-cyan-glow"
                  : "border-border bg-surface-2 text-text-secondary hover:border-cyan/40 hover:text-text-primary"
              }`}
            >
              {hasChildren && (
                <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-0" : "-rotate-90"}`} />
              )}
              <span>{section.label}</span>
            </button>
            {hasChildren && (
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    className="overflow-hidden pl-3"
                  >
                    {renderControlSectionTabs(section.children, depth + 1)}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        );
      })}
    </div>
  );
  const getControlCardExpansionProps = (key) => ({
    expanded: Boolean(expandedControlCards[key]),
    onExpandedChange: (nextValue) =>
      setExpandedControlCards((prev) => ({ ...prev, [key]: Boolean(nextValue) })),
  });
  const [footerSocialIcons, setFooterSocialIcons] = useState([]);
  const [footerSocialIconsLoading, setFooterSocialIconsLoading] = useState(false);
  const [footerSocialIconModalOpen, setFooterSocialIconModalOpen] = useState(false);
  const [footerSocialIconForm, setFooterSocialIconForm] = useState(DEFAULT_FOOTER_SOCIAL_ICON_FORM);
  const [footerSocialIconErrors, setFooterSocialIconErrors] = useState({});
  const [footerSocialIconEditingId, setFooterSocialIconEditingId] = useState("");
  const [savingFooterSocialIcon, setSavingFooterSocialIcon] = useState(false);
  const [footerSocialIconActionId, setFooterSocialIconActionId] = useState("");


  const resetFooterSocialIconForm = () => {
    setFooterSocialIconForm(DEFAULT_FOOTER_SOCIAL_ICON_FORM);
    setFooterSocialIconErrors({});
    setFooterSocialIconEditingId("");
  };

  const closeFooterSocialIconModal = () => {
    setFooterSocialIconModalOpen(false);
    resetFooterSocialIconForm();
  };

  const openCreateFooterSocialIconModal = () => {
    resetFooterSocialIconForm();
    setFooterSocialIconModalOpen(true);
  };

  const openEditFooterSocialIconModal = (icon) => {
    const type = normalizeFooterSocialIconType(icon?.type) || "instagram";
    setFooterSocialIconEditingId(String(icon?._id || ""));
    setFooterSocialIconForm({
      label: String(icon?.label || ""),
      type,
      url: type === "email" ? normalizeFooterEmailValue(icon?.url) : String(icon?.url || ""),
      isActive: icon?.isActive !== false,
    });
    setFooterSocialIconErrors({});
    setFooterSocialIconModalOpen(true);
  };

  const fetchFooterSocialIcons = async ({ silent = false } = {}) => {
    try {
      if (!silent) setFooterSocialIconsLoading(true);
      const { data } = await api.get("/admin/footer-social-icons");
      if (data?.success) {
        setFooterSocialIcons(Array.isArray(data.icons) ? data.icons : []);
      } else {
        setFooterSocialIcons([]);
        if (!silent) showToast(data?.message || "Failed to load footer social icons.", "error");
      }
    } catch (error) {
      setFooterSocialIcons([]);
      if (!silent) {
        showToast(error?.response?.data?.message || "Failed to load footer social icons.", "error");
      }
    } finally {
      if (!silent) setFooterSocialIconsLoading(false);
    }
  };

  const submitFooterSocialIcon = async () => {
    const type = normalizeFooterSocialIconType(footerSocialIconForm.type);
    const payload = {
      label: String(footerSocialIconForm.label || "").trim(),
      type,
      url:
        type === "email"
          ? buildFooterEmailUrl(footerSocialIconForm.url)
          : String(footerSocialIconForm.url || "").trim(),
      isActive: footerSocialIconForm.isActive !== false,
    };
    const nextErrors = validateFooterSocialIconFormValues(payload);
    setFooterSocialIconErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      showToast("Please fix the footer icon form errors.", "error");
      return;
    }

    try {
      setSavingFooterSocialIcon(true);
      const request = footerSocialIconEditingId
        ? api.put(`/admin/footer-social-icons/${footerSocialIconEditingId}`, payload)
        : api.post("/admin/footer-social-icons", payload);
      const { data } = await request;
      if (data?.success) {
        showToast(
          data.message || (footerSocialIconEditingId ? "Footer icon updated." : "Footer icon created."),
          "success"
        );
        closeFooterSocialIconModal();
        await fetchFooterSocialIcons({ silent: true });
      } else {
        showToast(data?.message || "Failed to save footer social icon.", "error");
      }
    } catch (error) {
      showToast(error?.response?.data?.message || "Failed to save footer social icon.", "error");
    } finally {
      setSavingFooterSocialIcon(false);
    }
  };

  const handleFooterSocialIconStatusToggle = async (icon) => {
    const iconId = String(icon?._id || "");
    if (!iconId) return;

    try {
      setFooterSocialIconActionId(iconId);
      const payload = {
        label: String(icon?.label || ""),
        type: normalizeFooterSocialIconType(icon?.type),
        url: String(icon?.url || ""),
        isActive: icon?.isActive === false,
        order: Number.isFinite(Number(icon?.order)) ? Number(icon.order) : 0,
      };
      const { data } = await api.put(`/admin/footer-social-icons/${iconId}`, payload);
      if (data?.success) {
        showToast(
          data.message || `"${payload.label}" ${payload.isActive ? "enabled" : "disabled"}.`,
          "success"
        );
        await fetchFooterSocialIcons({ silent: true });
      } else {
        showToast(data?.message || "Failed to update footer social icon.", "error");
      }
    } catch (error) {
      showToast(error?.response?.data?.message || "Failed to update footer social icon.", "error");
    } finally {
      setFooterSocialIconActionId("");
    }
  };

  const deleteFooterSocialIconItem = async (icon) => {
    const iconId = String(icon?._id || "");
    const label = String(icon?.label || "this icon").trim();
    if (!iconId) return;
    if (!window.confirm(`Delete "${label}" from the footer social icons?`)) return;

    try {
      setFooterSocialIconActionId(iconId);
      const { data } = await api.delete(`/admin/footer-social-icons/${iconId}`);
      if (data?.success) {
        showToast(data.message || `"${label}" deleted successfully.`, "success");
        await fetchFooterSocialIcons({ silent: true });
      } else {
        showToast(data?.message || "Failed to delete footer social icon.", "error");
      }
    } catch (error) {
      showToast(error?.response?.data?.message || "Failed to delete footer social icon.", "error");
    } finally {
      setFooterSocialIconActionId("");
    }
  };

  const [basePriceCustom, setBasePriceCustom] = useState("");
  const [governmentFeeCustom, setGovernmentFeeCustom] = useState("");
  const [basePriceApplyScope, setBasePriceApplyScope] = useState({ scope: "all", countryIds: [] });
  const [governmentFeeApplyScope, setGovernmentFeeApplyScope] = useState({ scope: "all", countryIds: [] });
  const [serviceFeeSaveAllDraft, setServiceFeeSaveAllDraft] = useState(() =>
    buildFeeSaveAllDraft({ all: null, single: null, some: null }, { singleCountryId: "", someCountryIds: [] })
  );
  const [serviceFeeSavedDraft, setServiceFeeSavedDraft] = useState(() =>
    buildFeeSaveAllDraft({ all: null, single: null, some: null }, { singleCountryId: "", someCountryIds: [] })
  );
  const [singleServiceFeeDraft, setSingleServiceFeeDraft] = useState({ countryId: "", amount: "" });
  const [serviceFeeCountryOverrides, setServiceFeeCountryOverrides] = useState([]);
  const [serviceFeeOverridesLoading, setServiceFeeOverridesLoading] = useState(false);
  const [serviceFeeOverrideBusyId, setServiceFeeOverrideBusyId] = useState("");
  const [governmentFeeSaveAllDraft, setGovernmentFeeSaveAllDraft] = useState(() =>
    buildFeeSaveAllDraft({ all: null, single: null, some: null }, { singleCountryId: "", someCountryIds: [] })
  );
  const [governmentFeeSavedDraft, setGovernmentFeeSavedDraft] = useState(() =>
    buildFeeSaveAllDraft({ all: null, single: null, some: null }, { singleCountryId: "", someCountryIds: [] })
  );
  const [singleGovernmentFeeDraft, setSingleGovernmentFeeDraft] = useState({ countryId: "", amount: "" });
  const [governmentFeeCountryOverrides, setGovernmentFeeCountryOverrides] = useState([]);
  const [governmentFeeOverridesLoading, setGovernmentFeeOverridesLoading] = useState(false);
  const [governmentFeeOverrideBusyId, setGovernmentFeeOverrideBusyId] = useState("");
  const [feeSaveModalState, setFeeSaveModalState] = useState({ open: false, feeType: "" });
  const [visaTypeSaveAllDraft, setVisaTypeSaveAllDraft] = useState(() =>
    buildVisaTypeSaveAllDraft({ all: "", single: "", some: "" }, { singleCountryId: "", someCountryIds: [] })
  );
  const [visaTypeSavedDraft, setVisaTypeSavedDraft] = useState(() =>
    buildVisaTypeSaveAllDraft({ all: "", single: "", some: "" }, { singleCountryId: "", someCountryIds: [] })
  );
  const [lengthOfStaySaveAllDraft, setLengthOfStaySaveAllDraft] = useState(() =>
    buildLengthOfStaySaveAllDraft({ all: "", single: "", some: "" }, { singleCountryId: "", someCountryIds: [] })
  );
  const [lengthOfStaySavedDraft, setLengthOfStaySavedDraft] = useState(() =>
    buildLengthOfStaySaveAllDraft({ all: "", single: "", some: "" }, { singleCountryId: "", someCountryIds: [] })
  );
  const [entryTypeSaveAllDraft, setEntryTypeSaveAllDraft] = useState(() =>
    buildEntryTypeSaveAllDraft({ all: "", single: "", some: "" }, { singleCountryId: "", someCountryIds: [] })
  );
  const [entryTypeSavedDraft, setEntryTypeSavedDraft] = useState(() =>
    buildEntryTypeSaveAllDraft({ all: "", single: "", some: "" }, { singleCountryId: "", someCountryIds: [] })
  );
  const [validitySaveAllDraft, setValiditySaveAllDraft] = useState(() =>
    buildValiditySaveAllDraft({ all: "", single: "", some: "" }, { singleCountryId: "", someCountryIds: [] })
  );
  const [validitySavedDraft, setValiditySavedDraft] = useState(() =>
    buildValiditySaveAllDraft({ all: "", single: "", some: "" }, { singleCountryId: "", someCountryIds: [] })
  );
  const [processingDaysSaveAllDraft, setProcessingDaysSaveAllDraft] = useState(() =>
    buildProcessingDaysSaveAllDraft({ all: "", single: "", some: "" }, { singleCountryId: "", someCountryIds: [] })
  );
  const [processingDaysSavedDraft, setProcessingDaysSavedDraft] = useState(() =>
    buildProcessingDaysSaveAllDraft({ all: "", single: "", some: "" }, { singleCountryId: "", someCountryIds: [] })
  );
  const [processingDaysPicker, setProcessingDaysPicker] = useState("");
  const [processingDaysCustom, setProcessingDaysCustom] = useState("");
  /** Merged built-in + admin's custom documents, populated from /admin/control/country-defaults. */
  const [documentCatalog, setDocumentCatalog] = useState([]);
  /** Current selection in the Required Documents universal-control checkbox grid. */
  const [requiredDocsDraft, setRequiredDocsDraft] = useState([]);
  /** Current selection in the Optional Documents universal-control checkbox grid. */
  const [optionalDocsDraft, setOptionalDocsDraft] = useState([]);
  /** Free-text field used to add a brand-new custom document type. */
  const [newCustomDocLabel, setNewCustomDocLabel] = useState("");
  const [newCustomDocDescription, setNewCustomDocDescription] = useState("");
  const [newCustomDocIcon, setNewCustomDocIcon] = useState("");
  const [savingCustomDoc, setSavingCustomDoc] = useState(false);
  const [savingDocumentMetaKey, setSavingDocumentMetaKey] = useState("");
  const [editingDocKey, setEditingDocKey] = useState(null);
  const [editingCatalogDocKey, setEditingCatalogDocKey] = useState(null);
  const [selectedCatalogDocs, setSelectedCatalogDocs] = useState([]);
  const [showCustomDocCreator, setShowCustomDocCreator] = useState(true);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconPickerSearch, setIconPickerSearch] = useState("");
  const [iconPickerTarget, setIconPickerTarget] = useState(null);
  const [savingControlKey, setSavingControlKey] = useState(null);
  const [togglingDisplayKey, setTogglingDisplayKey] = useState(null);
  const [unsplashFetchRunning, setUnsplashFetchRunning] = useState(false);
  const customDocCreatorRef = useRef(null);

  const filteredRemixIcons = useMemo(() => {
    const query = iconPickerSearch.trim().toLowerCase();
    if (!query) return REMIX_ICON_PICKER_OPTIONS;
    return REMIX_ICON_PICKER_OPTIONS.filter((icon) => icon.toLowerCase().includes(query));
  }, [iconPickerSearch]);

  const closeIconPicker = () => {
    setIconPickerOpen(false);
    setIconPickerSearch("");
    setIconPickerTarget(null);
  };

  const openIconPicker = (target) => {
    setIconPickerTarget(target);
    setIconPickerSearch("");
    setIconPickerOpen(true);
  };

  const applyPickedIcon = (nextIcon) => {
    if (!iconPickerTarget) return;

    switch (iconPickerTarget.type) {
      case "document-catalog":
        setDocumentCatalog((prev) =>
          prev.map((doc) =>
            doc.key === iconPickerTarget.key ? { ...doc, icon: nextIcon } : doc
          )
        );
        break;
      case "new-custom-document":
        setNewCustomDocIcon(nextIcon);
        break;
      case "destination-included-item":
        setSettingsForm((prev) => {
          const next = [...(prev.destinationIncludedItems || [])];
          if (!next[iconPickerTarget.index]) return prev;
          next[iconPickerTarget.index] = {
            ...next[iconPickerTarget.index],
            icon: nextIcon,
          };
          return { ...prev, destinationIncludedItems: next };
        });
        break;
      case "country-included-item":
        setCountryForm((prev) => {
          const next = [...(prev.includedItems || [])];
          if (!next[iconPickerTarget.index]) return prev;
          next[iconPickerTarget.index] = {
            ...next[iconPickerTarget.index],
            icon: nextIcon,
          };
          return { ...prev, includedItems: next };
        });
        break;
      default:
        break;
    }

    closeIconPicker();
  };

  const getCurrentPickedIcon = () => {
    if (!iconPickerTarget) return "";
    switch (iconPickerTarget.type) {
      case "document-catalog":
        return documentCatalog.find((doc) => doc.key === iconPickerTarget.key)?.icon || "";
      case "new-custom-document":
        return newCustomDocIcon;
      case "destination-included-item":
        return settingsForm.destinationIncludedItems?.[iconPickerTarget.index]?.icon || "";
      case "country-included-item":
        return countryForm.includedItems?.[iconPickerTarget.index]?.icon || "";
      default:
        return "";
    }
  };

  const validateCountryVisibilitySelection = (items, label, readSelectedCountries = (item) => item?.selectedCountries) => {
    for (const item of items || []) {
      if (item?.showInAllActiveCountries !== false) continue;
      const selected = normalizeCountrySelectorIds(readSelectedCountries(item));
      if (selected.length > 0) continue;
      showToast(`${label} must be assigned to at least one active country, or turn on "Show in all active countries".`, "error");
      return false;
    }
    return true;
  };

  const validateCountryApplySelection = (item) => {
    if (item?.applyToAllActiveCountries !== false) return true;
    if (normalizeCountrySelectorIds(item?.selectedCountries).length > 0) return true;
    showToast("Please select at least one country.", "error");
    return false;
  };

  const validateFeeApplyScope = (scopeState) => {
    const selected = normalizeCountrySelectorIds(scopeState?.countryIds);
    if (scopeState?.scope === "all") return true;
    if (scopeState?.scope === "single" && selected.length === 1) return true;
    if (scopeState?.scope === "some" && selected.length > 0) return true;
    showToast("Please select the required country scope.", "error");
    return false;
  };

  const confirmFeeScopeUpdate = (label, scopeState) => {
    const count = countFeeApplyScopeCountries(scopeState, allCountryIds);
    return window.confirm(`You are about to update ${label} for ${count} countr${count === 1 ? "y" : "ies"}. Continue?`);
  };

  const getFeeScopeHeading = (scope) => {
    if (scope === "single") return "For Single Country";
    if (scope === "some") return "For Some Countries";
    return "For All Countries";
  };

  const getScopeFeeInputValue = (scopeValues, scope, fallback = "") => {
    const nextValue = scopeValues?.[scope];
    if (Number.isFinite(Number(nextValue))) return String(Number(nextValue));
    if (scope === "all" && Number.isFinite(Number(fallback))) return String(Number(fallback));
    return "";
  };

  const buildGlobalRequiredDocumentEntriesPayload = () =>
    (Array.isArray(requiredDocsDraft) ? requiredDocsDraft.filter(Boolean) : []).map((key) => {
      const existing = (globalDefaults.globalRequiredDocumentEntries || []).find((item) => item.key === key);
      return {
        key,
        showInAllActiveCountries: existing?.showInAllActiveCountries !== false,
        selectedCountries:
          existing?.showInAllActiveCountries !== false
            ? [...activeCountryIds]
            : normalizeCountrySelectorIds(existing?.selectedCountries),
      };
    });

  const buildGlobalOptionalDocumentEntriesPayload = () =>
    (Array.isArray(optionalDocsDraft) ? optionalDocsDraft.filter(Boolean) : []).map((key) => {
      const existing = (globalDefaults.globalOptionalDocumentEntries || []).find((item) => item.key === key);
      return {
        key,
        showInAllActiveCountries: existing?.showInAllActiveCountries !== false,
        selectedCountries:
          existing?.showInAllActiveCountries !== false
            ? [...activeCountryIds]
            : normalizeCountrySelectorIds(existing?.selectedCountries),
      };
    });

  const buildDestinationWhyBookNowPayload = () =>
    (settingsForm.destinationWhyBookNow || [])
      .map((s) => ({
        text: String(s?.text ?? "").trim(),
        showInAllActiveCountries: s?.showInAllActiveCountries !== false,
        selectedCountries:
          s?.showInAllActiveCountries !== false
            ? [...activeCountryIds]
            : normalizeCountrySelectorIds(s?.selectedCountries),
      }))
      .filter((s) => s.text);

  const buildDestinationIncludedPayload = () =>
    (settingsForm.destinationIncludedItems || [])
      .map((x) => ({
        title: String(x?.title ?? "").trim(),
        description: String(x?.description ?? "").trim(),
        icon: String(x?.icon ?? "").trim(),
        color: String(x?.color ?? "blue").trim(),
        showInAllActiveCountries: x?.showInAllActiveCountries !== false,
        selectedCountries:
          x?.showInAllActiveCountries !== false
            ? [...activeCountryIds]
            : normalizeCountrySelectorIds(x?.selectedCountries),
      }))
      .filter((x) => x.title);

  const buildDestinationFaqsPayload = () =>
    (settingsForm.destinationFaqs || [])
      .map((f) => ({
        question: String(f?.question ?? "").trim(),
        answer: String(f?.answer ?? "").trim(),
        showInAllActiveCountries: f?.showInAllActiveCountries !== false,
        selectedCountries:
          f?.showInAllActiveCountries !== false
            ? [...activeCountryIds]
            : normalizeCountrySelectorIds(f?.selectedCountries),
      }))
      .filter((f) => f.question && f.answer);

  const buildDestinationHowItWorksPayload = () =>
    (settingsForm.destinationHowItWorks || [])
      .map((s) => ({
        title: String(s?.title ?? "").trim(),
        description: String(s?.description ?? "").trim(),
        showInAllActiveCountries: s?.showInAllActiveCountries !== false,
        selectedCountries:
          s?.showInAllActiveCountries !== false
            ? [...activeCountryIds]
            : normalizeCountrySelectorIds(s?.selectedCountries),
      }))
      .filter((s) => s.title && s.description);

  const buildDestinationVisaRequirementsPayload = () =>
    (settingsForm.destinationVisaRequirements || [])
      .map((s) => ({
        text: String(s?.text ?? "").trim(),
        showInAllActiveCountries: s?.showInAllActiveCountries !== false,
        selectedCountries:
          s?.showInAllActiveCountries !== false
            ? [...activeCountryIds]
            : normalizeCountrySelectorIds(s?.selectedCountries),
      }))
      .filter((s) => s.text);

  const saveDestinationContentSection = ({ sectionKey, validationLabel, payloadBuilder, payloadKey, successMessage }) => {
    const payloadItems = payloadBuilder();
    if (!validateCountryVisibilitySelection(payloadItems, validationLabel, (item) => item?.selectedCountries)) {
      return;
    }
    saveSettingsPartial(
      "destination-content",
      { [payloadKey]: payloadItems },
      successMessage || "Destination content saved."
    );
  };
            // Fetch settings once on mount for accurate progress calculation across all tabs
  useEffect(() => {
    const initSettings = async () => {
      try {
        await fetchCountries();
        const latestCountries = useDataStore.getState().countries || [];
        const activeOpts = latestCountries
          .filter((c) => c?.isActive !== false)
          .map((c) => ({ ...c, slug: c?.slug || c?.id }));
        const latestActiveCountryIds = activeOpts
          .map((c) => String(c?._id || c?.slug || c?.id || "").trim())
          .filter(Boolean);

        const { data } = await api.get("/admin/settings");
        if (data.success && data.settings) {
          const s = data.settings;
          const flags = integrationFlagsFromSettings(s);
          setIsRazorpayConfigured(flags.isRazorpayConfigured);
          setIsFirebaseConfigured(flags.isFirebaseConfigured);
          setIsSmtpConfigured(flags.isSmtpConfigured);
          setIsSms91Configured(flags.isSms91Configured);
          setIsUnsplashConfigured(flags.isUnsplashConfigured);
          setSettingsForm(mapApiSettingsToFormState(s, latestActiveCountryIds));
        }
        const otpRes = await api.get("/admin/auth-settings");
        if (otpRes.data?.success && otpRes.data?.settings) {
          setOtpSettingsForm(mapApiOtpSettingsToFormState(otpRes.data.settings));
        }
      } catch (error) {
        console.error("Error initializing settings:", error);
      }
    };
    initSettings();
  }, []);

  useEffect(() => {
    if (!showCustomDocCreator) return undefined;
    const handlePointerDown = (event) => {
      const node = customDocCreatorRef.current;
      if (!node) return;
      if (node.contains(event.target)) return;
      setShowCustomDocCreator(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showCustomDocCreator]);
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
      if (activeTab === "activity" || activeTab === "analytics" || activeTab === "applications" || activeTab === "transactions") {
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
        } else if (activeTab === "transactions" || activeTab === "activity") {
          const { data } = await api.get("/admin/transactions");
          if (data.success) setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
        } else if (activeTab === "settings" || activeTab === "seo") {
          await fetchCountries();
          const latestCountries = useDataStore.getState().countries || [];
          const activeOpts = latestCountries
            .filter((c) => c?.isActive !== false)
            .map((c) => ({ ...c, slug: c?.slug || c?.id }));
          const latestActiveCountryIds = activeOpts
            .map((c) => String(c?._id || c?.slug || c?.id || "").trim())
            .filter(Boolean);

          const { data } = await api.get("/admin/settings");
          if (data.success && data.settings) {
            const flags = integrationFlagsFromSettings(data.settings);
            setIsRazorpayConfigured(flags.isRazorpayConfigured);
            setIsFirebaseConfigured(flags.isFirebaseConfigured);
            setIsSmtpConfigured(flags.isSmtpConfigured);
            setIsSms91Configured(flags.isSms91Configured);
            setIsUnsplashConfigured(flags.isUnsplashConfigured);
            setSettingsForm(mapApiSettingsToFormState(data.settings, latestActiveCountryIds));
          }
        } else if (activeTab === "controls") {
          await fetchCountries();
          const latestCountries = useDataStore.getState().countries || [];
          const activeOpts = latestCountries
            .filter((c) => c?.isActive !== false)
            .map((c) => ({ ...c, slug: c?.slug || c?.id }));
          const latestActiveCountryIds = activeOpts
            .map((c) => String(c?._id || c?.slug || c?.id || "").trim())
            .filter(Boolean);

          const { data } = await api.get("/admin/settings");
          if (data.success && data.settings) {
            const s = data.settings;
            setSettingsForm((p) => ({
              ...p,
              enableGDriveUpload: s.enableGDriveUpload !== false,
              enableFileUpload: s.enableFileUpload !== false,
              showTravelerDetails: s.showTravelerDetails !== false,
              destinationWhyBookNow: mapDestinationWhyBookNowItemsFromApi(s, latestActiveCountryIds),
              destinationIncludedItems: mapDestinationIncludedItemsFromApi(s, latestActiveCountryIds),
              destinationFaqs: mapDestinationFaqItemsFromApi(s, latestActiveCountryIds),
              destinationHowItWorks: mapDestinationHowItWorksItemsFromApi(s, latestActiveCountryIds),
              destinationVisaRequirements: mapDestinationVisaRequirementItemsFromApi(s, latestActiveCountryIds),
              landingHeroHighlights: mapLandingHeroHighlightsFromApi(s),
              customerChatEnabled: s.customerChatEnabled !== false,
              customerChatMode: s.customerChatMode || "external_link",
              customerChatLink: s.customerChatLink || "",
              customerChatTitle: s.customerChatTitle || "Continue with Chat",
              customerChatDescription: s.customerChatDescription || "Get instant support from our visa team",
              customerChatHeaderTitle: s.customerChatHeaderTitle || "Chat with us",
              customerChatHeaderSubtitle: s.customerChatHeaderSubtitle || "We typically reply in a few minutes",
              footerLogo: s.footerLogo || "",
              footerDescription: s.footerDescription || "",
              whatsappTemplate: s.whatsappTemplate || "",
            }));
          }
          await fetchFooterSocialIcons();
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

  // -- Drag & Drop state ------------------------------------
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
  const countryDocLabelByKey = new Map(DOC_OPTIONS.map((doc) => [doc.key, doc.label]));
  const formatCountryDocLabel = (key) => countryDocLabelByKey.get(key) || key;
  const getCountryDocumentLabels = (country) =>
    (Array.isArray(country?.requiredDocuments) ? country.requiredDocuments : [])
      .map((doc) => formatCountryDocLabel(doc))
      .filter(Boolean);
  const countryMatchesManagerSearch = (country, rawTerm) => {
    const term = String(rawTerm || "").trim().toLowerCase();
    if (!term) return true;
    if (matchesCountrySearch(country, rawTerm)) return true;
    const searchableValues = [
      country?.city,
      country?.region,
      country?.subtitle,
      country?.governmentFee,
      country?.basePrice,
      country?.processingDays,
      country?.successRate,
      ...getCountryDocumentLabels(country),
      ...(Array.isArray(country?.cities) ? country.cities : []),
    ];
    return searchableValues.some((value) =>
      String(value ?? "").toLowerCase().includes(term)
    );
  };

  // Country form state
  const [countryForm, setCountryForm] = useState({
    name: "", flagEmoji: "??", basePrice: "", governmentFee: "", processingDays: "", difficulty: "moderate",
    visaType: "", validity: "", lengthOfStay: "", entryType: "", continent: "", description: "", requirements: [""], imageUrl: "",
    requiredDocuments: ["passport"], successRate: "80", isActive: true,
    visaInformation: createVisaInformationState({}),
    whyBookNow: [], includedItems: [], faqs: [], howItWorks: [],
    useGlobalGst: true,
    gstEnabled: true,
    gstRate: 18,
    useGlobalWhyBookNow: true,
    useGlobalIncludedItems: true,
    useGlobalFaqs: true,
    useGlobalHowItWorks: true,
    useGlobalVisaRequirements: true,
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

  // -- Filter applications -----------------------------------
  const filteredBookings = bookings.filter((b) => {
    const q = searchQuery.toLowerCase();
    const idStr = String(b.applicationId || b._id || b.id || "").toLowerCase();
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
    const progress = getApplicationProgress(b, settingsForm);
    const resolvedStatus = resolveApplicationStatus(b, progress);
    const matchStatus = statusFilter === "all" || resolvedStatus === statusFilter;
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
      countryMatchesManagerSearch(country, countrySearchQuery)
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

  // -- Country Manager handlers -------------------------------
  const [isSavingCountry, setIsSavingCountry] = useState(false);
  const [togglingCountryKey, setTogglingCountryKey] = useState(null);
  const [bulkCountryToggleBusy, setBulkCountryToggleBusy] = useState(false);
  const [resettingPopularityKey, setResettingPopularityKey] = useState(null);
  const [resettingAllPopularity, setResettingAllPopularity] = useState(false);
  const [showActiveCountriesFirst, setShowActiveCountriesFirst] = useState(false);
  const [countryStatusFilter, setCountryStatusFilter] = useState("all");
  const [countryVisaTypeFilter, setCountryVisaTypeFilter] = useState("all");
  const [countrySortMode, setCountrySortMode] = useState("default");
  const [countryPageSize, setCountryPageSize] = useState(25);
  const [countryPage, setCountryPage] = useState(1);
  const activeCountryCount = useMemo(
    () => countries.filter((country) => country?.isActive !== false).length,
    [countries]
  );
  const countryVisaTypes = useMemo(() => {
    const values = countries
      .map((country) => String(country?.visaType || "").trim())
      .filter(Boolean);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [countries]);
  const countryManagerRows = useMemo(() => {
    let rows = filteredCountries.filter((country) => {
      const isActive = country?.isActive !== false;
      if (countryStatusFilter === "active" && !isActive) return false;
      if (countryStatusFilter === "inactive" && isActive) return false;
      if (
        countryVisaTypeFilter !== "all" &&
        String(country?.visaType || "").trim() !== countryVisaTypeFilter
      ) {
        return false;
      }
      return true;
    });
    rows = [...rows];
    if (showActiveCountriesFirst) {
      rows.sort((a, b) => {
        const aActive = a?.isActive !== false ? 1 : 0;
        const bActive = b?.isActive !== false ? 1 : 0;
        return bActive - aActive;
      });
    }
    if (countrySortMode === "mostVisited") {
      rows.sort((a, b) => Number(b?.visitCount || 0) - Number(a?.visitCount || 0));
    }
    if (countrySortMode === "recentlyVisited") {
      rows.sort((a, b) => {
        const aTime = a?.lastVisitedAt ? new Date(a.lastVisitedAt).getTime() : 0;
        const bTime = b?.lastVisitedAt ? new Date(b.lastVisitedAt).getTime() : 0;
        return bTime - aTime;
      });
    }
    return rows;
  }, [
    filteredCountries,
    showActiveCountriesFirst,
    countryStatusFilter,
    countryVisaTypeFilter,
    countrySortMode,
  ]);
  const countryPageCount = Math.max(1, Math.ceil(countryManagerRows.length / countryPageSize));
  const countryPageRows = useMemo(() => {
    const safePage = Math.min(countryPage, countryPageCount);
    const start = (safePage - 1) * countryPageSize;
    return countryManagerRows.slice(start, start + countryPageSize);
  }, [countryManagerRows, countryPage, countryPageCount, countryPageSize]);
  useEffect(() => {
    setCountryPage(1);
  }, [
    countrySearchQuery,
    countryStatusFilter,
    countryVisaTypeFilter,
    countrySortMode,
    countryPageSize,
  ]);
  useEffect(() => {
    if (countryPage > countryPageCount) setCountryPage(countryPageCount);
  }, [countryPage, countryPageCount]);
  const countryVisibleStart =
    countryManagerRows.length === 0 ? 0 : (Math.min(countryPage, countryPageCount) - 1) * countryPageSize + 1;
  const countryVisibleEnd = Math.min(
    Math.min(countryPage, countryPageCount) * countryPageSize,
    countryManagerRows.length
  );
  const renderCountryDocuments = (country) => {
    const docs = getCountryDocumentLabels(country);
    if (docs.length === 0) {
      return <span className="text-xs text-text-muted">Missing</span>;
    }
    const visibleDocs = docs.slice(0, 3);
    const hiddenCount = docs.length - visibleDocs.length;
    return (
      <div className="flex max-w-[18rem] flex-wrap gap-1" title={docs.join(", ")}>
        {visibleDocs.map((doc) => (
          <span
            key={doc}
            className="rounded-md border border-cyan/15 bg-cyan/10 px-2 py-0.5 text-[11px] font-medium text-cyan"
          >
            {doc}
          </span>
        ))}
        {hiddenCount > 0 && (
          <span className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-text-secondary">
            +{hiddenCount} more
          </span>
        )}
      </div>
    );
  };
  const syncVisaInfoCoreField = (field, value) => {
    setCountryForm((prev) => {
      const visaInformation = createVisaInformationState(prev);
      return {
        ...prev,
        [field]: value,
        visaInformation: {
          ...visaInformation,
          items: visaInformation.items.map((item) =>
            (field === "lengthOfStay" && item.id === "lengthOfStay") ||
            (field === "validity" && item.id === "validity") ||
            (field === "entryType" && item.id === "entry")
              ? { ...item, value }
              : item
          ),
        },
      };
    });
  };

  const updateVisaInformationField = (field, value) => {
    setCountryForm((prev) => ({
      ...prev,
      visaInformation: {
        ...createVisaInformationState(prev),
        [field]: value,
      },
    }));
  };

  const updateVisaInformationItem = (itemId, patch) => {
    setCountryForm((prev) => {
      const visaInformation = createVisaInformationState(prev);
      const items = visaInformation.items.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item
      );
      const next = {
        ...prev,
        visaInformation: {
          ...visaInformation,
          items,
        },
      };
      const changed = items.find((item) => item.id === itemId);
      if (!changed) return next;
      if (itemId === "lengthOfStay" && Object.prototype.hasOwnProperty.call(patch, "value")) {
        next.lengthOfStay = changed.value;
      }
      if (itemId === "validity" && Object.prototype.hasOwnProperty.call(patch, "value")) {
        next.validity = changed.value;
      }
      if (itemId === "entry" && Object.prototype.hasOwnProperty.call(patch, "value")) {
        next.entryType = changed.value;
      }
      return next;
    });
  };

  const openEditCountry = (country) => {
    setCountryForm({
      ...country,
      basePrice: String(country.basePrice),
      governmentFee: String(country.governmentFee ?? 0),
      successRate: String(country.successRate ?? 80),
      isActive: country.isActive !== false,
      validity: String(country.validity ?? ""),
      lengthOfStay: String(country.lengthOfStay ?? ""),
      entryType: String(country.entryType ?? ""),
      visaInformation: createVisaInformationState(country),
      requirements: country.requirements?.length ? country.requirements : [""],
      requiredDocuments: country.requiredDocuments || ["passport"],
      whyBookNow: Array.isArray(country.whyBookNow) ? [...country.whyBookNow] : [],
      includedItems: safeMapIncludedItems(country.includedItems),
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
      useGlobalGst: country.useGlobalGst !== false,
      gstEnabled: country.gstEnabled !== false,
      gstRate: Number.isFinite(Number(country.gstRate)) ? Number(country.gstRate) : 18,
      useGlobalWhyBookNow: country.useGlobalWhyBookNow !== false,
      useGlobalIncludedItems: country.useGlobalIncludedItems !== false,
      useGlobalFaqs: country.useGlobalFaqs !== false,
      useGlobalHowItWorks: country.useGlobalHowItWorks !== false,
      useGlobalVisaRequirements: country.useGlobalVisaRequirements !== false,
    });
    openCountryModal("edit", country);
  };

  const saveCountry = async () => {
    if (!countryForm.name.trim() || !countryForm.basePrice) {
      showToast("Country name and service fee are required.", "error");
      return;
    }
    setIsSavingCountry(true);
    const payload = {
      ...countryForm,
      basePrice: Number(countryForm.basePrice),
      governmentFee: Number(countryForm.governmentFee || 0),
      // Sent raw (no "5-10" fallback) so the server can auto-flip
      // `useGlobalProcessingDays = true` when the admin clears the field or
      // re-matches the global default. The DB-level default already supplies
      // "5-10" for brand-new countries created from `addCountry`.
      processingDays: String(countryForm.processingDays ?? "").trim(),
      validity: String(countryForm.validity ?? "").trim(),
      lengthOfStay: String(countryForm.lengthOfStay ?? "").trim(),
      entryType: String(countryForm.entryType ?? "").trim(),
      visaInformation: sanitizeVisaInformationPayload(countryForm.visaInformation, {
        validity: countryForm.validity,
        lengthOfStay: countryForm.lengthOfStay,
        entryType: countryForm.entryType,
      }),
      requirements: countryForm.requirements.filter(Boolean),
      requiredDocuments: countryForm.requiredDocuments,
      successRate: Number(countryForm.successRate) || 80,
      isActive: Boolean(countryForm.isActive),
      whyBookNow: (countryForm.whyBookNow || [])
        .map((s) => String(s ?? "").trim())
        .filter(Boolean),
      includedItems: (countryForm.includedItems || [])
        .map((x) => ({
          title: String(x?.title ?? "").trim(),
          description: String(x?.description ?? "").trim(),
          icon: String(x?.icon ?? "").trim(),
          color: String(x?.color ?? "blue").trim(),
        }))
        .filter((x) => x.title),
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
      useGlobalGst: Boolean(countryForm.useGlobalGst),
      gstEnabled: Boolean(countryForm.gstEnabled),
      gstRate: Number.isFinite(Number(countryForm.gstRate)) ? Number(countryForm.gstRate) : 0,
      useGlobalWhyBookNow: Boolean(countryForm.useGlobalWhyBookNow),
      useGlobalIncludedItems: Boolean(countryForm.useGlobalIncludedItems),
      useGlobalFaqs: Boolean(countryForm.useGlobalFaqs),
      useGlobalHowItWorks: Boolean(countryForm.useGlobalHowItWorks),
      useGlobalVisaRequirements: Boolean(countryForm.useGlobalVisaRequirements),
    };

    const id = selectedCountry?._id || selectedCountry?.id;
    const result = await updateCountry(id, payload);
    if (result?.success) {
      if (result.country) {
        setSelectedCountry(result.country);
      }
      showToast(`Country "${countryForm.name}" updated.`, "success");
    } else {
      showToast(result?.message || "Failed to update country.", "error");
    }
    setIsSavingCountry(false);
  };

  const toggleCountryActive = async (country) => {
    const id = country?._id || country?.id || country?.slug;
    if (!id) return;
    const next = country.isActive === false;
    setTogglingCountryKey(String(id));
    try {
      const result = await updateCountry(id, { isActive: next });
      if (result?.success) {
        showToast(`Country "${country.name}" ${next ? "enabled" : "disabled"}.`, "success");
      } else {
        showToast(result?.message || "Failed to update country status.", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      showToast(error?.response?.data?.message || "Failed to update country status.", "error");
    } finally {
      setTogglingCountryKey(null);
    }
  };

  const bulkSetCountryActive = async (isActive) => {
    setBulkCountryToggleBusy(true);
    try {
      const { data } = await api.post("/admin/countries/visibility", { isActive });
      if (data?.success) {
        await fetchCountries();
        showToast(
          data.message ||
            (isActive
              ? "All countries are now visible on the public site."
              : "All countries are now hidden from the public site."),
          "success"
        );
      } else {
        showToast(data?.message || "Failed to update country visibility.", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const status = error?.response?.status;
      const shouldFallbackToPerCountry =
        status === 404 || status === 405 || status === 501;

      if (shouldFallbackToPerCountry) {
        try {
          const updates = await Promise.allSettled(
            countries.map((country) =>
              updateCountry(country._id || country.id || country.slug, { isActive })
            )
          );
          const failed = updates.filter(
            (result) => result.status === "rejected" || result.value?.success === false
          );
          if (failed.length === 0) {
            await fetchCountries();
            showToast(
              isActive
                ? "All countries are now visible on the public site."
                : "All countries are now hidden from the public site.",
              "success"
            );
            return;
          }
          showToast(
            `Updated ${updates.length - failed.length} of ${updates.length} countries. Please try again for the remaining ones.`,
            "error"
          );
          return;
        } catch (fallbackError) {
          showToast(
            fallbackError?.response?.data?.message || "Bulk visibility update failed.",
            "error"
          );
          return;
        }
      }

      showToast(
        error?.response?.data?.message ||
          (status ? `Failed to update country visibility. (HTTP ${status})` : "Failed to update country visibility."),
        "error"
      );
    } finally {
      setBulkCountryToggleBusy(false);
    }
  };

  const resetCountryPopularity = async (country) => {
    const id = country?._id || country?.id || country?.slug;
    if (!id) return;
    setResettingPopularityKey(String(id));
    try {
      const { data } = await api.post(`/admin/countries/${id}/reset-popularity`);
      if (data?.success) {
        await fetchCountries();
        showToast(data.message || `Popularity reset for ${country.name}.`, "success");
      } else {
        showToast(data?.message || "Failed to reset popularity.", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      showToast(error?.response?.data?.message || "Failed to reset popularity.", "error");
    } finally {
      setResettingPopularityKey(null);
    }
  };

  const resetAllPopularity = async () => {
    setResettingAllPopularity(true);
    try {
      const { data } = await api.post("/admin/countries/reset-popularity");
      if (data?.success) {
        await fetchCountries();
        showToast(data.message || "Popularity reset for all countries.", "success");
      } else {
        showToast(data?.message || "Failed to reset popularity.", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      showToast(error?.response?.data?.message || "Failed to reset popularity.", "error");
    } finally {
      setResettingAllPopularity(false);
    }
  };

  const toggleRequiredDoc = (key) => {
    setCountryForm((p) => ({
      ...p,
      requiredDocuments: p.requiredDocuments.includes(key)
        ? p.requiredDocuments.filter((d) => d !== key)
        : [...p.requiredDocuments, key],
    }));
  };

  // -- Image upload helpers ---------------------------------
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

  // -- Drag & Drop handlers ---------------------------------
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
      const safePayload = Object.fromEntries(
        Object.entries(payload || {}).filter(([, value]) => value !== undefined)
      );
      if ("destinationIncludedItems" in safePayload) {
        safePayload.destinationIncludedItems = Array.isArray(safePayload.destinationIncludedItems)
          ? safePayload.destinationIncludedItems
              .map((item) => ({
                title: String(item?.title ?? "").trim(),
                description: String(item?.description ?? "").trim(),
                icon: String(item?.icon ?? "").trim(),
                color: String(item?.color ?? "blue").trim() || "blue",
                showInAllActiveCountries: item?.showInAllActiveCountries !== false,
                selectedCountries:
                  item?.showInAllActiveCountries !== false
                    ? [...activeCountryIds]
                    : normalizeCountrySelectorIds(item?.selectedCountries),
              }))
              .filter((item) => item.title)
          : [];
      }
      const { data } = await api.put("/admin/settings", safePayload);
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
        const serverMapped = mapApiSettingsToFormState(data.settings, activeCountryIds);
        setSettingsForm((prev) => {
          const nextForm = { ...prev };
          Object.keys(safePayload).forEach((key) => {
            if (key in serverMapped) {
              nextForm[key] = serverMapped[key];
            }
          });
          return nextForm;
        });
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
          globalBasePrice:
            Number.isFinite(Number(data.defaults?.globalBasePrice)) && Number(data.defaults?.globalBasePrice) >= 0
              ? Number(data.defaults.globalBasePrice)
              : null,
          globalBasePriceVisibility: withCountryApplyMeta(
            data.defaults?.globalBasePriceVisibility || {},
            activeCountryIds
          ),
          serviceFeeScopeValues: normalizeScopeFeeValues(
            data.defaults?.serviceFeeScopeValues,
            data.defaults?.globalBasePrice
          ),
          serviceFeeScopeTargets: normalizeFeeScopeTargets(
            data.defaults?.serviceFeeScopeTargets,
            activeCountryIds
          ),
          globalGovernmentFee:
            Number.isFinite(Number(data.defaults?.globalGovernmentFee)) && Number(data.defaults?.globalGovernmentFee) >= 0
              ? Number(data.defaults.globalGovernmentFee)
              : null,
          globalGovernmentFeeVisibility: withCountryApplyMeta(
            data.defaults?.globalGovernmentFeeVisibility || {},
            activeCountryIds
          ),
          governmentFeeScopeValues: normalizeScopeFeeValues(
            data.defaults?.governmentFeeScopeValues,
            data.defaults?.globalGovernmentFee
          ),
          governmentFeeScopeTargets: normalizeFeeScopeTargets(
            data.defaults?.governmentFeeScopeTargets,
            activeCountryIds
          ),
          globalVisaType: String(data.defaults?.globalVisaType ?? "").trim(),
          visaTypeScopeValues: {
            all: String(data.defaults?.visaTypeScopeValues?.all ?? data.defaults?.globalVisaType ?? "").trim(),
            single: String(data.defaults?.visaTypeScopeValues?.single ?? "").trim(),
            some: String(data.defaults?.visaTypeScopeValues?.some ?? "").trim(),
          },
          visaTypeScopeTargets: normalizeFeeScopeTargets(
            data.defaults?.visaTypeScopeTargets,
            activeCountryIds
          ),
          // merged just below so the draft builder can read everything from one target object
          globalValidity: String(data.defaults?.globalValidity ?? "").trim(),
          validityScopeValues: {
            all: String(data.defaults?.validityScopeValues?.all ?? data.defaults?.globalValidity ?? "").trim(),
            single: String(data.defaults?.validityScopeValues?.single ?? "").trim(),
            some: String(data.defaults?.validityScopeValues?.some ?? "").trim(),
          },
          validityScopeTargets: normalizeFeeScopeTargets(
            data.defaults?.validityScopeTargets,
            activeCountryIds
          ),
          globalLengthOfStay: String(data.defaults?.globalLengthOfStay ?? "").trim(),
          lengthOfStayScopeValues: {
            all: String(data.defaults?.lengthOfStayScopeValues?.all ?? data.defaults?.globalLengthOfStay ?? "").trim(),
            single: String(data.defaults?.lengthOfStayScopeValues?.single ?? "").trim(),
            some: String(data.defaults?.lengthOfStayScopeValues?.some ?? "").trim(),
          },
          lengthOfStayScopeTargets: normalizeFeeScopeTargets(
            data.defaults?.lengthOfStayScopeTargets,
            activeCountryIds
          ),
          globalEntryType: String(data.defaults?.globalEntryType ?? "").trim(),
          entryTypeScopeValues: {
            all: String(data.defaults?.entryTypeScopeValues?.all ?? data.defaults?.globalEntryType ?? "").trim(),
            single: String(data.defaults?.entryTypeScopeValues?.single ?? "").trim(),
            some: String(data.defaults?.entryTypeScopeValues?.some ?? "").trim(),
          },
          entryTypeScopeTargets: normalizeFeeScopeTargets(
            data.defaults?.entryTypeScopeTargets,
            activeCountryIds
          ),
          globalEntryTypeVisibility: withCountryApplyMeta(
            data.defaults?.globalEntryTypeVisibility || {},
            activeCountryIds
          ),
          globalProcessingDays: String(data.defaults?.globalProcessingDays ?? "").trim(),
          processingDaysScopeValues: {
            all: String(data.defaults?.processingDaysScopeValues?.all ?? data.defaults?.globalProcessingDays ?? "").trim(),
            single: String(data.defaults?.processingDaysScopeValues?.single ?? "").trim(),
            some: String(data.defaults?.processingDaysScopeValues?.some ?? "").trim(),
          },
          processingDaysScopeTargets: normalizeFeeScopeTargets(
            data.defaults?.processingDaysScopeTargets,
            activeCountryIds
          ),
          globalProcessingDaysVisibility: withCountryApplyMeta(
            data.defaults?.globalProcessingDaysVisibility || {},
            activeCountryIds
          ),
          globalRequiredDocuments: Array.isArray(data.defaults?.globalRequiredDocuments)
            ? data.defaults.globalRequiredDocuments
                .map((k) => String(k ?? "").trim())
                .filter(Boolean)
            : [],
          globalRequiredDocumentEntries: normalizeGlobalRequiredDocumentEntriesFromApi(
            data.defaults?.globalRequiredDocumentEntries,
            data.defaults?.globalRequiredDocuments,
            activeCountryIds
          ),
          globalOptionalDocuments: Array.isArray(data.defaults?.globalOptionalDocuments)
            ? data.defaults.globalOptionalDocuments
                .map((k) => String(k ?? "").trim())
                .filter(Boolean)
            : [],
          globalOptionalDocumentEntries: normalizeGlobalOptionalDocumentEntriesFromApi(
            data.defaults?.globalOptionalDocumentEntries,
            data.defaults?.globalOptionalDocuments,
            activeCountryIds
          ),
          documentSectionCopy: {
            requiredHeading: String(data.defaults?.documentSectionCopy?.requiredHeading ?? "Documents Required").trim() || "Documents Required",
            requiredDescription:
              String(data.defaults?.documentSectionCopy?.requiredDescription ?? "These are the country documents required for this application.").trim() ||
              "These are the country documents required for this application.",
            optionalHeading: String(data.defaults?.documentSectionCopy?.optionalHeading ?? "Optional Documents").trim() || "Optional Documents",
            optionalDescription:
              String(data.defaults?.documentSectionCopy?.optionalDescription ?? "You can also attach other documents in the same Drive link.").trim() ||
              "You can also attach other documents in the same Drive link.",
          },
        };
        next.visaTypeScopeTargets = {
          ...next.visaTypeScopeTargets,
          singleCountryOverrides: Array.isArray(data.defaults?.visaTypeSingleCountryOverrides)
            ? data.defaults.visaTypeSingleCountryOverrides
                .map((item) => ({
                  countryId: String(item?.countryId ?? "").trim(),
                  visaType: String(item?.visaType ?? "").trim(),
                }))
                .filter((item) => item.countryId && item.visaType)
            : [],
        };
        next.validityScopeTargets = {
          ...next.validityScopeTargets,
          singleCountryOverrides: Array.isArray(data.defaults?.validitySingleCountryOverrides)
            ? data.defaults.validitySingleCountryOverrides
                .map((item) => ({
                  countryId: String(item?.countryId ?? "").trim(),
                  validity: String(item?.validity ?? "").trim(),
                }))
                .filter((item) => item.countryId && item.validity)
            : [],
        };
        next.lengthOfStayScopeTargets = {
          ...next.lengthOfStayScopeTargets,
          singleCountryOverrides: Array.isArray(data.defaults?.lengthOfStaySingleCountryOverrides)
            ? data.defaults.lengthOfStaySingleCountryOverrides
                .map((item) => ({
                  countryId: String(item?.countryId ?? "").trim(),
                  lengthOfStay: String(item?.lengthOfStay ?? "").trim(),
                }))
                .filter((item) => item.countryId && item.lengthOfStay)
            : [],
        };
        next.entryTypeScopeTargets = {
          ...next.entryTypeScopeTargets,
          singleCountryOverrides: Array.isArray(data.defaults?.entryTypeSingleCountryOverrides)
            ? data.defaults.entryTypeSingleCountryOverrides
                .map((item) => ({
                  countryId: String(item?.countryId ?? "").trim(),
                  entryType: String(item?.entryType ?? "").trim(),
                }))
                .filter((item) => item.countryId && item.entryType)
            : [],
        };
        next.processingDaysScopeTargets = {
          ...next.processingDaysScopeTargets,
          singleCountryOverrides: Array.isArray(data.defaults?.processingDaysSingleCountryOverrides)
            ? data.defaults.processingDaysSingleCountryOverrides
                .map((item) => ({
                  countryId: String(item?.countryId ?? "").trim(),
                  processingDays: String(item?.processingDays ?? "").trim(),
                }))
                .filter((item) => item.countryId && item.processingDays)
            : [],
        };
        setGlobalDefaults(next);
        setGlobalDefaultStats({
          totalCountries: data.stats?.totalCountries ?? 0,
          usingGlobalBasePrice: data.stats?.usingGlobalBasePrice ?? 0,
          usingGlobalGovernmentFee: data.stats?.usingGlobalGovernmentFee ?? 0,
          usingGlobalVisaType: data.stats?.usingGlobalVisaType ?? 0,
          usingGlobalValidity: data.stats?.usingGlobalValidity ?? 0,
          usingGlobalLengthOfStay: data.stats?.usingGlobalLengthOfStay ?? 0,
          usingGlobalEntryType: data.stats?.usingGlobalEntryType ?? 0,
          usingGlobalProcessingDays: data.stats?.usingGlobalProcessingDays ?? 0,
          usingGlobalRequiredDocuments: data.stats?.usingGlobalRequiredDocuments ?? 0,
          overridingBasePrice: data.stats?.overridingBasePrice ?? 0,
          overridingGovernmentFee: data.stats?.overridingGovernmentFee ?? 0,
          overridingVisaType: data.stats?.overridingVisaType ?? 0,
          overridingValidity: data.stats?.overridingValidity ?? 0,
          overridingLengthOfStay: data.stats?.overridingLengthOfStay ?? 0,
          overridingEntryType: data.stats?.overridingEntryType ?? 0,
          overridingProcessingDays: data.stats?.overridingProcessingDays ?? 0,
          overridingRequiredDocuments: data.stats?.overridingRequiredDocuments ?? 0,
        });
        if (data.display) {
          setDisplayToggles({
            showVisaType: data.display.showVisaType !== false,
            showValidity: data.display.showValidity !== false,
            showLengthOfStay: data.display.showLengthOfStay !== false,
            showEntryType: data.display.showEntryType !== false,
            showProcessingDays: data.display.showProcessingDays !== false,
            showRequiredDocuments: data.display.showRequiredDocuments !== false,
            showVisaRequirements: data.display.showVisaRequirements !== false,
            showHowItWorks: data.display.showHowItWorks !== false,
            showWhyBookNow: data.display.showWhyBookNow !== false,
            showDestinationDocuments: data.display.showDestinationDocuments !== false,
            showDestinationRequiredDocs: data.display.showDestinationRequiredDocs !== false,
            showDestinationOptionalDocs: data.display.showDestinationOptionalDocs !== false,
            showWhatsIncluded: data.display.showWhatsIncluded !== false,
            showFaqs: data.display.showFaqs !== false,
            maintenanceModeEnabled: data.display.maintenanceModeEnabled === true,
          });
        }
        if (Array.isArray(data.documentCatalog)) {
          const catalog = data.documentCatalog
            .map((d) => ({
              key: String(d?.key ?? "").trim(),
              label: String(d?.label ?? "").trim(),
              description: String(d?.description ?? "").trim(),
              icon: String(d?.icon ?? "").trim(),
              builtIn: d?.builtIn !== false,
              deleted: !!d?.deleted,
            }))
            .filter((d) => d.key && d.label);
          setDocumentCatalog(catalog);
          setSelectedCatalogDocs(catalog.filter((d) => !d.deleted).map((d) => d.key));
        }
        // Pre-populate the required-docs draft from the live global selection so
        // the admin sees exactly what's currently applied. Falls back to just
        // "passport" if no global has been set yet - matches the legacy default.
        setRequiredDocsDraft(
          next.globalRequiredDocuments.length ? [...next.globalRequiredDocuments] : ["passport"]
        );
        setOptionalDocsDraft(next.globalOptionalDocuments.length ? [...next.globalOptionalDocuments] : []);
        setBasePriceApplyScope(toFeeApplyScope(next.globalBasePriceVisibility));
        setGovernmentFeeApplyScope(toFeeApplyScope(next.globalGovernmentFeeVisibility));
        const nextServiceFeeDraft = buildFeeSaveAllDraft(
          next.serviceFeeScopeValues,
          next.serviceFeeScopeTargets,
          next.globalBasePrice
        );
        nextServiceFeeDraft.singleCountry = { countryId: "", amount: "" };
        const nextGovernmentFeeDraft = buildFeeSaveAllDraft(
          next.governmentFeeScopeValues,
          next.governmentFeeScopeTargets,
          next.globalGovernmentFee
        );
        nextGovernmentFeeDraft.singleCountry = { countryId: "", amount: "" };
        const nextVisaTypeDraft = buildVisaTypeSaveAllDraft(
          next.visaTypeScopeValues,
          next.visaTypeScopeTargets
        );
        const nextLengthOfStayDraft = buildLengthOfStaySaveAllDraft(
          next.lengthOfStayScopeValues,
          next.lengthOfStayScopeTargets
        );
        const nextEntryTypeDraft = buildEntryTypeSaveAllDraft(
          next.entryTypeScopeValues,
          next.entryTypeScopeTargets
        );
        const nextProcessingDaysDraft = buildProcessingDaysSaveAllDraft(
          next.processingDaysScopeValues,
          next.processingDaysScopeTargets
        );
        const nextValidityDraft = buildValiditySaveAllDraft(
          next.validityScopeValues,
          next.validityScopeTargets
        );
        setServiceFeeSaveAllDraft(nextServiceFeeDraft);
        setServiceFeeSavedDraft(nextServiceFeeDraft);
        setServiceFeeCountryOverrides(
          normalizeServiceFeeOverrideRows(data.defaults?.serviceFeeCountryOverrides)
        );
        setGovernmentFeeSaveAllDraft(nextGovernmentFeeDraft);
        setGovernmentFeeSavedDraft(nextGovernmentFeeDraft);
        setGovernmentFeeCountryOverrides(
          normalizeServiceFeeOverrideRows(data.defaults?.governmentFeeCountryOverrides)
        );
        setVisaTypeSaveAllDraft(nextVisaTypeDraft);
        setVisaTypeSavedDraft(nextVisaTypeDraft);
        setLengthOfStaySaveAllDraft(nextLengthOfStayDraft);
        setLengthOfStaySavedDraft(nextLengthOfStayDraft);
        setEntryTypeSaveAllDraft(nextEntryTypeDraft);
        setEntryTypeSavedDraft(nextEntryTypeDraft);
        setProcessingDaysSaveAllDraft(nextProcessingDaysDraft);
        setProcessingDaysSavedDraft(nextProcessingDaysDraft);
        setValiditySaveAllDraft(nextValidityDraft);
        setValiditySavedDraft(nextValidityDraft);
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
      }
      // Defaults stay at their initial empty values - the UI will show "Not set yet".
    }
  };

  const saveOtpSettingsCard = async (sectionKey, endpoint, payload, successMessage) => {
    setSavingSettingsKey(sectionKey);
    try {
      const { data } = await api.put(endpoint, payload);
      if (!data.success) {
        showToast(data.message || "Failed to save OTP settings", "error");
        return;
      }
      if (data.settings) {
        setOtpSettingsForm(mapApiOtpSettingsToFormState(data.settings));
      }
      showToast(successMessage, "success");
    } catch (error) {
      console.error("Error saving OTP settings:", error);
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      showToast(error.response?.data?.message || "Failed to save OTP settings", "error");
    } finally {
      setSavingSettingsKey(null);
    }
  };

  const loadServiceFeeCountryOverrides = async ({ silent = false } = {}) => {
    if (!silent) setServiceFeeOverridesLoading(true);
    try {
      const { data } = await api.get("/admin/service-fee-overrides");
      if (data?.success) {
        setServiceFeeCountryOverrides(normalizeServiceFeeOverrideRows(data.overrides));
      } else if (!silent) {
        showToast(data?.message || "Failed to load single-country service fee overrides", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!silent) {
        showToast(
          error?.response?.data?.message || "Failed to load single-country service fee overrides",
          "error"
        );
      }
    } finally {
      if (!silent) setServiceFeeOverridesLoading(false);
    }
  };

  const saveSingleServiceFeeOverride = async () => {
    const countryId = String(singleServiceFeeDraft.countryId ?? "").trim();
    const amount = Number(singleServiceFeeDraft.amount);
    if (!countryId) {
      showToast("Select one country for the custom service fee.", "error");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid custom service fee.", "error");
      return;
    }

    setServiceFeeOverrideBusyId(countryId);
    try {
      const { data } = await api.put(`/admin/service-fee-overrides/${encodeURIComponent(countryId)}`, {
        amount,
      });
      if (!data?.success) {
        showToast(data?.message || "Failed to save custom service fee", "error");
        return;
      }
      setServiceFeeCountryOverrides(normalizeServiceFeeOverrideRows(data.overrides));
      showToast(data?.message || "Custom service fee saved successfully", "success");
      await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
      setSingleServiceFeeDraft({ countryId: "", amount: "" });
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      showToast(error?.response?.data?.message || "Failed to save custom service fee", "error");
    } finally {
      setServiceFeeOverrideBusyId("");
    }
  };

  const removeSingleServiceFeeOverride = async (countryId) => {
    const resolvedCountryId = String(countryId ?? "").trim();
    if (!resolvedCountryId) return;
    setServiceFeeOverrideBusyId(resolvedCountryId);
    try {
      const { data } = await api.delete(`/admin/service-fee-overrides/${encodeURIComponent(resolvedCountryId)}`);
      if (!data?.success) {
        showToast(data?.message || "Failed to remove custom service fee", "error");
        return;
      }
      setServiceFeeCountryOverrides(normalizeServiceFeeOverrideRows(data.overrides));
      showToast(data?.message || "Custom service fee removed successfully", "success");
      await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      showToast(error?.response?.data?.message || "Failed to remove custom service fee", "error");
    } finally {
      setServiceFeeOverrideBusyId("");
    }
  };

  const loadGovernmentFeeCountryOverrides = async ({ silent = false } = {}) => {
    if (!silent) setGovernmentFeeOverridesLoading(true);
    try {
      const { data } = await api.get("/admin/government-fee-overrides");
      if (data?.success) {
        setGovernmentFeeCountryOverrides(normalizeServiceFeeOverrideRows(data.overrides));
      } else if (!silent) {
        showToast(data?.message || "Failed to load single-country government fee overrides", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!silent) {
        showToast(
          error?.response?.data?.message || "Failed to load single-country government fee overrides",
          "error"
        );
      }
    } finally {
      if (!silent) setGovernmentFeeOverridesLoading(false);
    }
  };

  const saveSingleGovernmentFeeOverride = async () => {
    const countryId = String(singleGovernmentFeeDraft.countryId ?? "").trim();
    const amount = Number(singleGovernmentFeeDraft.amount);
    if (!countryId) {
      showToast("Select one country for the custom government fee.", "error");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid custom government fee.", "error");
      return;
    }

    setGovernmentFeeOverrideBusyId(countryId);
    try {
      const { data } = await api.put(`/admin/government-fee-overrides/${encodeURIComponent(countryId)}`, {
        amount,
      });
      if (!data?.success) {
        showToast(data?.message || "Failed to save custom government fee", "error");
        return;
      }
      setGovernmentFeeCountryOverrides(normalizeServiceFeeOverrideRows(data.overrides));
      showToast(data?.message || "Custom government fee saved successfully", "success");
      await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
      setSingleGovernmentFeeDraft({ countryId: "", amount: "" });
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      showToast(error?.response?.data?.message || "Failed to save custom government fee", "error");
    } finally {
      setGovernmentFeeOverrideBusyId("");
    }
  };

  const removeSingleGovernmentFeeOverride = async (countryId) => {
    const resolvedCountryId = String(countryId ?? "").trim();
    if (!resolvedCountryId) return;
    setGovernmentFeeOverrideBusyId(resolvedCountryId);
    try {
      const { data } = await api.delete(`/admin/government-fee-overrides/${encodeURIComponent(resolvedCountryId)}`);
      if (!data?.success) {
        showToast(data?.message || "Failed to remove custom government fee", "error");
        return;
      }
      setGovernmentFeeCountryOverrides(normalizeServiceFeeOverrideRows(data.overrides));
      showToast(data?.message || "Custom government fee removed successfully", "success");
      setSingleGovernmentFeeDraft((prev) =>
        String(prev.countryId || "").trim() === resolvedCountryId ? { countryId: "", amount: "" } : prev
      );
      await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      showToast(error?.response?.data?.message || "Failed to remove custom government fee", "error");
    } finally {
      setGovernmentFeeOverrideBusyId("");
    }
  };

  useEffect(() => {
    if (!isControlSectionVisible("base-price")) return;
    loadServiceFeeCountryOverrides({ silent: serviceFeeCountryOverrides.length > 0 });
  }, [activeControlSection]);

  useEffect(() => {
    if (!isControlSectionVisible("government-fee")) return;
    loadGovernmentFeeCountryOverrides({ silent: governmentFeeCountryOverrides.length > 0 });
  }, [activeControlSection]);

  const serviceFeeHasUnsavedChanges =
    serializeFeeSaveAllDraft(serviceFeeSaveAllDraft) !== serializeFeeSaveAllDraft(serviceFeeSavedDraft);
  const governmentFeeHasUnsavedChanges =
    serializeFeeSaveAllDraft(governmentFeeSaveAllDraft) !== serializeFeeSaveAllDraft(governmentFeeSavedDraft);
  const visaTypeHasUnsavedChanges =
    serializeVisaTypeSaveAllDraft(visaTypeSaveAllDraft) !== serializeVisaTypeSaveAllDraft(visaTypeSavedDraft);
  const lengthOfStayHasUnsavedChanges =
    serializeLengthOfStaySaveAllDraft(lengthOfStaySaveAllDraft) !==
    serializeLengthOfStaySaveAllDraft(lengthOfStaySavedDraft);
  const entryTypeHasUnsavedChanges =
    serializeEntryTypeSaveAllDraft(entryTypeSaveAllDraft) !==
    serializeEntryTypeSaveAllDraft(entryTypeSavedDraft);
  const validityHasUnsavedChanges =
    serializeValiditySaveAllDraft(validitySaveAllDraft) !==
    serializeValiditySaveAllDraft(validitySavedDraft);
  const processingDaysHasUnsavedChanges =
    serializeProcessingDaysSaveAllDraft(processingDaysSaveAllDraft) !==
    serializeProcessingDaysSaveAllDraft(processingDaysSavedDraft);

  const validateFeeSaveAllDraft = (draft, label) => {
    const allAmount = Number(draft?.allCountries?.amount);
    if (!Number.isFinite(allAmount) || allAmount <= 0) {
      showToast(`Enter a valid ${label} for All Countries.`, "error");
      return false;
    }

    const singleCountryId = String(draft?.singleCountry?.countryId ?? "").trim();
    const singleAmountRaw = String(draft?.singleCountry?.amount ?? "").trim();
    const singleHasAnyValue = singleCountryId || singleAmountRaw;
    if (singleHasAnyValue) {
      if (!singleCountryId) {
        showToast(`Select one country for Single Country ${label}.`, "error");
        return false;
      }
      const singleAmount = Number(singleAmountRaw);
      if (!Number.isFinite(singleAmount) || singleAmount <= 0) {
        showToast(`Enter a valid Single Country ${label}.`, "error");
        return false;
      }
    }

    const someCountryIds = normalizeCountrySelectorIds(draft?.someCountries?.countryIds);
    const someAmountRaw = String(draft?.someCountries?.amount ?? "").trim();
    const someHasAnyValue = someCountryIds.length > 0 || someAmountRaw;
    if (someHasAnyValue) {
      if (someCountryIds.length === 0) {
        showToast(`Select at least one country for Some Countries ${label}.`, "error");
        return false;
      }
      const someAmount = Number(someAmountRaw);
      if (!Number.isFinite(someAmount) || someAmount <= 0) {
        showToast(`Enter a valid Some Countries ${label}.`, "error");
        return false;
      }
    }

    return true;
  };

  const buildFeeSaveAllPayload = (feeType, draft) => ({
    feeType,
    allCountries: {
      amount: Number(draft?.allCountries?.amount),
    },
    singleCountry: {
      countryId: String(draft?.singleCountry?.countryId ?? "").trim(),
      amount: String(draft?.singleCountry?.amount ?? "").trim(),
    },
    someCountries: {
      countryIds: normalizeCountrySelectorIds(draft?.someCountries?.countryIds),
      amount: String(draft?.someCountries?.amount ?? "").trim(),
    },
  });

  const openFeeSaveModal = (feeType) => setFeeSaveModalState({ open: true, feeType });
  const closeFeeSaveModal = () => setFeeSaveModalState({ open: false, feeType: "" });

  /**
   * Resolve the value the admin actually wants to apply. Custom input wins over the
   * dropdown so an admin can override one without clearing the other manually.
   */
  const resolveControlValue = (picker, custom) => {
    const trimmedCustom = String(custom ?? "").trim();
    if (trimmedCustom) return trimmedCustom;
    return String(picker ?? "").trim();
  };

  const validateVisaTypeSaveAllDraft = (draft) => {
    const allVisaType = resolvePickerOrCustomValue(draft?.allCountries?.picker, draft?.allCountries?.custom);
    if (!allVisaType) {
      showToast("Pick or type a Visa Type for All Countries.", "error");
      return false;
    }

    const singleCountryDraftId = String(draft?.singleCountryDraft?.countryId ?? "").trim();
    const singleCountryDraftVisaType = resolvePickerOrCustomValue(
      draft?.singleCountryDraft?.picker,
      draft?.singleCountryDraft?.custom
    );
    if (singleCountryDraftId || singleCountryDraftVisaType) {
      showToast("Add the single-country visa type to the list, or clear the draft first.", "error");
      return false;
    }

    const singleCountryOverrides = Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [];
    for (const item of singleCountryOverrides) {
      const countryId = String(item?.countryId ?? "").trim();
      const visaType = resolvePickerOrCustomValue(item?.picker, item?.custom);
      if (!countryId || !visaType) {
        showToast("Each single-country visa type entry needs both country and visa type.", "error");
        return false;
      }
    }

    const someCountryIds = normalizeCountrySelectorIds(draft?.someCountries?.countryIds);
    const someVisaType = resolvePickerOrCustomValue(draft?.someCountries?.picker, draft?.someCountries?.custom);
    const someHasAnyValue = Boolean(someCountryIds.length > 0 || someVisaType);
    if (someHasAnyValue) {
      if (someCountryIds.length === 0) {
        showToast("Select at least one country for Some Countries Visa Type.", "error");
        return false;
      }
      if (!someVisaType) {
        showToast("Pick or type a Visa Type for Some Countries.", "error");
        return false;
      }
    }

    return true;
  };

  const buildVisaTypeSaveAllPayload = (draft) => ({
    singleCountry: (() => {
      const firstOverride = (Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [])[0];
      return {
        countryId: String(firstOverride?.countryId ?? "").trim(),
        visaType: resolvePickerOrCustomValue(firstOverride?.picker, firstOverride?.custom),
      };
    })(),
    allCountries: {
      visaType: resolvePickerOrCustomValue(draft?.allCountries?.picker, draft?.allCountries?.custom),
    },
    singleCountryOverrides: (Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [])
      .map((item) => ({
        countryId: String(item?.countryId ?? "").trim(),
        visaType: resolvePickerOrCustomValue(item?.picker, item?.custom),
      }))
      .filter((item) => item.countryId && item.visaType),
    someCountries: {
      countryIds: normalizeCountrySelectorIds(draft?.someCountries?.countryIds),
      visaType: resolvePickerOrCustomValue(draft?.someCountries?.picker, draft?.someCountries?.custom),
    },
  });

  const cloneVisaTypeDraftForSave = (draft) => ({
    allCountries: { ...(draft?.allCountries || {}) },
    singleCountry: { ...(draft?.singleCountry || {}) },
    singleCountryDraft: { ...(draft?.singleCountryDraft || {}) },
    singleCountryOverrides: Array.isArray(draft?.singleCountryOverrides)
      ? draft.singleCountryOverrides.map((item) => ({ ...item }))
      : [],
    someCountries: {
      ...(draft?.someCountries || {}),
      countryIds: normalizeCountrySelectorIds(draft?.someCountries?.countryIds),
    },
  });

  const keepSavedSingleCountryVisaTypeRows = (draftSnapshot) => {
    const preservedOverrides = Array.isArray(draftSnapshot?.singleCountryOverrides)
      ? draftSnapshot.singleCountryOverrides.map((item) => ({ ...item }))
      : [];
    const clearedDraft = {
      countryId: "",
      ...buildPickerCustomDraft("", VISA_TYPE_SUGGESTIONS),
    };

    setVisaTypeSaveAllDraft((prev) => ({
      ...prev,
      singleCountryOverrides: preservedOverrides,
      singleCountryDraft: clearedDraft,
    }));
    setVisaTypeSavedDraft((prev) => ({
      ...prev,
      singleCountryOverrides: preservedOverrides,
      singleCountryDraft: clearedDraft,
    }));
  };

  const cloneLengthOfStayDraftForSave = (draft) => ({
    allCountries: { ...(draft?.allCountries || {}) },
    singleCountry: { ...(draft?.singleCountry || {}) },
    singleCountryDraft: { ...(draft?.singleCountryDraft || {}) },
    singleCountryOverrides: Array.isArray(draft?.singleCountryOverrides)
      ? draft.singleCountryOverrides.map((item) => ({ ...item }))
      : [],
    someCountries: {
      ...(draft?.someCountries || {}),
      countryIds: normalizeCountrySelectorIds(draft?.someCountries?.countryIds),
    },
  });

  const keepSavedSingleCountryLengthOfStayRows = (draftSnapshot) => {
    const preservedOverrides = Array.isArray(draftSnapshot?.singleCountryOverrides)
      ? draftSnapshot.singleCountryOverrides.map((item) => ({ ...item }))
      : [];
    const clearedDraft = {
      countryId: "",
      ...buildPickerCustomDraft("", LENGTH_OF_STAY_SUGGESTIONS),
    };

    setLengthOfStaySaveAllDraft((prev) => ({
      ...prev,
      singleCountryOverrides: preservedOverrides,
      singleCountryDraft: clearedDraft,
    }));
    setLengthOfStaySavedDraft((prev) => ({
      ...prev,
      singleCountryOverrides: preservedOverrides,
      singleCountryDraft: clearedDraft,
    }));
  };

  const cloneEntryTypeDraftForSave = (draft) => ({
    allCountries: { ...(draft?.allCountries || {}) },
    singleCountry: { ...(draft?.singleCountry || {}) },
    singleCountryDraft: { ...(draft?.singleCountryDraft || {}) },
    singleCountryOverrides: Array.isArray(draft?.singleCountryOverrides)
      ? draft.singleCountryOverrides.map((item) => ({ ...item }))
      : [],
    someCountries: {
      ...(draft?.someCountries || {}),
      countryIds: normalizeCountrySelectorIds(draft?.someCountries?.countryIds),
    },
  });

  const keepSavedSingleCountryEntryTypeRows = (draftSnapshot) => {
    const preservedOverrides = Array.isArray(draftSnapshot?.singleCountryOverrides)
      ? draftSnapshot.singleCountryOverrides.map((item) => ({ ...item }))
      : [];
    const clearedDraft = {
      countryId: "",
      ...buildPickerCustomDraft("", ENTRY_TYPE_SUGGESTIONS),
    };

    setEntryTypeSaveAllDraft((prev) => ({
      ...prev,
      singleCountryOverrides: preservedOverrides,
      singleCountryDraft: clearedDraft,
    }));
    setEntryTypeSavedDraft((prev) => ({
      ...prev,
      singleCountryOverrides: preservedOverrides,
      singleCountryDraft: clearedDraft,
    }));
  };

  const cloneValidityDraftForSave = (draft) => ({
    allCountries: { ...(draft?.allCountries || {}) },
    singleCountry: { ...(draft?.singleCountry || {}) },
    singleCountryDraft: { ...(draft?.singleCountryDraft || {}) },
    singleCountryOverrides: Array.isArray(draft?.singleCountryOverrides)
      ? draft.singleCountryOverrides.map((item) => ({ ...item }))
      : [],
    someCountries: {
      ...(draft?.someCountries || {}),
      countryIds: normalizeCountrySelectorIds(draft?.someCountries?.countryIds),
    },
  });

  const keepSavedSingleCountryValidityRows = (draftSnapshot) => {
    const preservedOverrides = Array.isArray(draftSnapshot?.singleCountryOverrides)
      ? draftSnapshot.singleCountryOverrides.map((item) => ({ ...item }))
      : [];
    const clearedDraft = {
      countryId: "",
      ...buildPickerCustomDraft("", VALIDITY_SUGGESTIONS),
    };

    setValiditySaveAllDraft((prev) => ({
      ...prev,
      singleCountryOverrides: preservedOverrides,
      singleCountryDraft: clearedDraft,
    }));
    setValiditySavedDraft((prev) => ({
      ...prev,
      singleCountryOverrides: preservedOverrides,
      singleCountryDraft: clearedDraft,
    }));
  };

  const cloneProcessingDaysDraftForSave = (draft) => ({
    allCountries: { ...(draft?.allCountries || {}) },
    singleCountry: { ...(draft?.singleCountry || {}) },
    singleCountryDraft: { ...(draft?.singleCountryDraft || {}) },
    singleCountryOverrides: Array.isArray(draft?.singleCountryOverrides)
      ? draft.singleCountryOverrides.map((item) => ({ ...item }))
      : [],
    someCountries: {
      ...(draft?.someCountries || {}),
      countryIds: normalizeCountrySelectorIds(draft?.someCountries?.countryIds),
    },
  });

  const keepSavedSingleCountryProcessingDaysRows = (draftSnapshot) => {
    const preservedOverrides = Array.isArray(draftSnapshot?.singleCountryOverrides)
      ? draftSnapshot.singleCountryOverrides.map((item) => ({ ...item }))
      : [];
    const clearedDraft = {
      countryId: "",
      ...buildPickerCustomDraft("", PROCESSING_DAYS_SUGGESTIONS),
    };

    setProcessingDaysSaveAllDraft((prev) => ({
      ...prev,
      singleCountryOverrides: preservedOverrides,
      singleCountryDraft: clearedDraft,
    }));
    setProcessingDaysSavedDraft((prev) => ({
      ...prev,
      singleCountryOverrides: preservedOverrides,
      singleCountryDraft: clearedDraft,
    }));
  };

  const addSingleCountryVisaTypeOverride = () => {
    const countryId = String(visaTypeSaveAllDraft?.singleCountryDraft?.countryId ?? "").trim();
    const visaType = resolvePickerOrCustomValue(
      visaTypeSaveAllDraft?.singleCountryDraft?.picker,
      visaTypeSaveAllDraft?.singleCountryDraft?.custom
    );
    if (!countryId) {
      showToast("Select one country before adding.", "error");
      return;
    }
    if (!visaType) {
      showToast("Pick or type a Visa Type before adding.", "error");
      return;
    }

    setVisaTypeSaveAllDraft((prev) => {
      const nextOverrides = Array.isArray(prev.singleCountryOverrides)
        ? prev.singleCountryOverrides.filter((item) => String(item?.countryId ?? "").trim() !== countryId)
        : [];
      nextOverrides.push({
        countryId,
        ...buildPickerCustomDraft(visaType, VISA_TYPE_SUGGESTIONS),
      });
      nextOverrides.sort((a, b) => String(a.countryId).localeCompare(String(b.countryId)));
      return {
        ...prev,
        singleCountryOverrides: nextOverrides,
        singleCountryDraft: {
          countryId: "",
          ...buildPickerCustomDraft("", VISA_TYPE_SUGGESTIONS),
        },
      };
    });
  };

  const removeSingleCountryVisaTypeOverride = (countryId) => {
    setVisaTypeSaveAllDraft((prev) => ({
      ...prev,
      singleCountryOverrides: (Array.isArray(prev.singleCountryOverrides) ? prev.singleCountryOverrides : []).filter(
        (item) => String(item?.countryId ?? "").trim() !== String(countryId ?? "").trim()
      ),
    }));
  };

  const runUpdateGlobalVisaType = async () => {
    if (!visaTypeHasUnsavedChanges) {
      showToast("No unsaved visa type changes.", "warning");
      return;
    }
    if (!validateVisaTypeSaveAllDraft(visaTypeSaveAllDraft)) {
      return;
    }
    const draftSnapshot = cloneVisaTypeDraftForSave(visaTypeSaveAllDraft);
    setSavingControlKey("visa-type");
    try {
      const { data } = await api.post("/admin/control/visa-type", buildVisaTypeSaveAllPayload(draftSnapshot));
      if (data?.success) {
        showToast(data.message || "Visa type changes saved successfully.", "success");
        await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
        keepSavedSingleCountryVisaTypeRows(draftSnapshot);
      } else {
        showToast(data?.message || "Failed to save visa type changes.", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      let toastMsg = serverMsg || error?.message || "Failed to save visa type changes.";
      if (status === 404) {
        toastMsg =
          "Control endpoint not found - restart the API locally or redeploy the server so /api/admin/control/visa-type is available.";
      } else if (status) {
        toastMsg = `${toastMsg} (HTTP ${status})`;
      }
      // eslint-disable-next-line no-console
      console.error("Save visa type changes failed:", { status, serverMsg, error });
      showToast(toastMsg, "error");
    } finally {
      setSavingControlKey(null);
    }
  };
  /** Same as `runUpdateGlobalVisaType` but for the universal Validity control. */
  const runUpdateGlobalValidity = async () => {
    if (!validityHasUnsavedChanges) {
      showToast("No unsaved validity changes.", "warning");
      return;
    }
    if (!validateValiditySaveAllDraft(validitySaveAllDraft)) {
      return;
    }
    const draftSnapshot = cloneValidityDraftForSave(validitySaveAllDraft);
    setSavingControlKey("validity");
    try {
      const { data } = await api.post("/admin/control/validity", buildValiditySaveAllPayload(draftSnapshot));
      if (data?.success) {
        showToast(data.message || "Validity changes saved successfully.", "success");
        await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
        keepSavedSingleCountryValidityRows(draftSnapshot);
      } else {
        showToast(data?.message || "Failed to save validity changes.", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      let toastMsg = serverMsg || error?.message || "Failed to save validity changes.";
      if (status === 404) {
        toastMsg =
          "Control endpoint not found - restart the API locally or redeploy the server so /api/admin/control/validity is available.";
      } else if (status) {
        toastMsg = `${toastMsg} (HTTP ${status})`;
      }
      console.error("Save validity changes failed:", { status, serverMsg, error });
      showToast(toastMsg, "error");
    } finally {
      setSavingControlKey(null);
    }
  };

  const validateLengthOfStaySaveAllDraft = (draft) => {
    const allLengthOfStay = resolvePickerOrCustomValue(draft?.allCountries?.picker, draft?.allCountries?.custom);
    if (!allLengthOfStay) {
      showToast("Please set Length of Stay for All Countries first.", "error");
      return false;
    }

    const singleCountryDraftId = String(draft?.singleCountryDraft?.countryId ?? "").trim();
    const singleCountryDraftLengthOfStay = resolvePickerOrCustomValue(
      draft?.singleCountryDraft?.picker,
      draft?.singleCountryDraft?.custom
    );
    if (singleCountryDraftId || singleCountryDraftLengthOfStay) {
      showToast("Add the single-country length of stay to the list, or clear the draft first.", "error");
      return false;
    }

    const singleCountryOverrides = Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [];
    for (const item of singleCountryOverrides) {
      const countryId = String(item?.countryId ?? "").trim();
      const lengthOfStay = resolvePickerOrCustomValue(item?.picker, item?.custom);
      if (!countryId || !lengthOfStay) {
        showToast("Each single-country length of stay entry needs both country and value.", "error");
        return false;
      }
    }

    const someCountryIds = normalizeCountrySelectorIds(draft?.someCountries?.countryIds);
    const someLengthOfStay = resolvePickerOrCustomValue(draft?.someCountries?.picker, draft?.someCountries?.custom);
    const someHasAnyValue = Boolean(someCountryIds.length > 0 || someLengthOfStay);
    if (someHasAnyValue) {
      if (someCountryIds.length === 0) {
        showToast("Select at least one country for Some Countries Length of Stay.", "error");
        return false;
      }
      if (!someLengthOfStay) {
        showToast("Pick or type a Length of Stay for Some Countries.", "error");
        return false;
      }
    }

    return true;
  };

  const buildLengthOfStaySaveAllPayload = (draft) => ({
    singleCountry: (() => {
      const firstOverride = (Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [])[0];
      return {
        countryId: String(firstOverride?.countryId ?? "").trim(),
        lengthOfStay: resolvePickerOrCustomValue(firstOverride?.picker, firstOverride?.custom),
      };
    })(),
    allCountries: {
      lengthOfStay: resolvePickerOrCustomValue(draft?.allCountries?.picker, draft?.allCountries?.custom),
    },
    singleCountryOverrides: (Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [])
      .map((item) => ({
        countryId: String(item?.countryId ?? "").trim(),
        lengthOfStay: resolvePickerOrCustomValue(item?.picker, item?.custom),
      }))
      .filter((item) => item.countryId && item.lengthOfStay),
    someCountries: {
      countryIds: normalizeCountrySelectorIds(draft?.someCountries?.countryIds),
      lengthOfStay: resolvePickerOrCustomValue(draft?.someCountries?.picker, draft?.someCountries?.custom),
    },
  });

  const addSingleCountryLengthOfStayOverride = () => {
    const countryId = String(lengthOfStaySaveAllDraft?.singleCountryDraft?.countryId ?? "").trim();
    const lengthOfStay = resolvePickerOrCustomValue(
      lengthOfStaySaveAllDraft?.singleCountryDraft?.picker,
      lengthOfStaySaveAllDraft?.singleCountryDraft?.custom
    );
    if (!countryId) {
      showToast("Select one country before adding.", "error");
      return;
    }
    if (!lengthOfStay) {
      showToast("Pick or type a Length of Stay before adding.", "error");
      return;
    }

    setLengthOfStaySaveAllDraft((prev) => {
      const nextOverrides = Array.isArray(prev.singleCountryOverrides)
        ? prev.singleCountryOverrides.filter((item) => String(item?.countryId ?? "").trim() !== countryId)
        : [];
      nextOverrides.push({
        countryId,
        ...buildPickerCustomDraft(lengthOfStay, LENGTH_OF_STAY_SUGGESTIONS),
      });
      nextOverrides.sort((a, b) => String(a.countryId).localeCompare(String(b.countryId)));
      return {
        ...prev,
        singleCountryOverrides: nextOverrides,
        singleCountryDraft: {
          countryId: "",
          ...buildPickerCustomDraft("", LENGTH_OF_STAY_SUGGESTIONS),
        },
      };
    });
  };

  const removeSingleCountryLengthOfStayOverride = (countryId) => {
    setLengthOfStaySaveAllDraft((prev) => ({
      ...prev,
      singleCountryOverrides: (Array.isArray(prev.singleCountryOverrides) ? prev.singleCountryOverrides : []).filter(
        (item) => String(item?.countryId ?? "").trim() !== String(countryId ?? "").trim()
      ),
    }));
  };

  const validateEntryTypeSaveAllDraft = (draft) => {
    const allEntryType = resolvePickerOrCustomValue(draft?.allCountries?.picker, draft?.allCountries?.custom);
    if (!allEntryType) {
      showToast("Please set Entry for All Countries first.", "error");
      return false;
    }

    const singleCountryDraftId = String(draft?.singleCountryDraft?.countryId ?? "").trim();
    const singleCountryDraftEntryType = resolvePickerOrCustomValue(
      draft?.singleCountryDraft?.picker,
      draft?.singleCountryDraft?.custom
    );
    if (singleCountryDraftId || singleCountryDraftEntryType) {
      showToast("Add the single-country entry to the list, or clear the draft first.", "error");
      return false;
    }

    const singleCountryOverrides = Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [];
    for (const item of singleCountryOverrides) {
      const countryId = String(item?.countryId ?? "").trim();
      const entryType = resolvePickerOrCustomValue(item?.picker, item?.custom);
      if (!countryId || !entryType) {
        showToast("Each single-country entry needs both country and value.", "error");
        return false;
      }
    }

    const someCountryIds = normalizeCountrySelectorIds(draft?.someCountries?.countryIds);
    const someEntryType = resolvePickerOrCustomValue(draft?.someCountries?.picker, draft?.someCountries?.custom);
    const someHasAnyValue = Boolean(someCountryIds.length > 0 || someEntryType);
    if (someHasAnyValue) {
      if (someCountryIds.length === 0) {
        showToast("Select at least one country for Some Countries Entry.", "error");
        return false;
      }
      if (!someEntryType) {
        showToast("Pick or type an Entry for Some Countries.", "error");
        return false;
      }
    }

    return true;
  };

  const buildEntryTypeSaveAllPayload = (draft) => ({
    singleCountry: (() => {
      const firstOverride = (Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [])[0];
      return {
        countryId: String(firstOverride?.countryId ?? "").trim(),
        entryType: resolvePickerOrCustomValue(firstOverride?.picker, firstOverride?.custom),
      };
    })(),
    allCountries: {
      entryType: resolvePickerOrCustomValue(draft?.allCountries?.picker, draft?.allCountries?.custom),
    },
    singleCountryOverrides: (Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [])
      .map((item) => ({
        countryId: String(item?.countryId ?? "").trim(),
        entryType: resolvePickerOrCustomValue(item?.picker, item?.custom),
      }))
      .filter((item) => item.countryId && item.entryType),
    someCountries: {
      countryIds: normalizeCountrySelectorIds(draft?.someCountries?.countryIds),
      entryType: resolvePickerOrCustomValue(draft?.someCountries?.picker, draft?.someCountries?.custom),
    },
  });

  const addSingleCountryEntryTypeOverride = () => {
    const countryId = String(entryTypeSaveAllDraft?.singleCountryDraft?.countryId ?? "").trim();
    const entryType = resolvePickerOrCustomValue(
      entryTypeSaveAllDraft?.singleCountryDraft?.picker,
      entryTypeSaveAllDraft?.singleCountryDraft?.custom
    );
    if (!countryId) {
      showToast("Select one country before adding.", "error");
      return;
    }
    if (!entryType) {
      showToast("Pick or type an Entry before adding.", "error");
      return;
    }

    setEntryTypeSaveAllDraft((prev) => {
      const nextOverrides = Array.isArray(prev.singleCountryOverrides)
        ? prev.singleCountryOverrides.filter((item) => String(item?.countryId ?? "").trim() !== countryId)
        : [];
      nextOverrides.push({
        countryId,
        ...buildPickerCustomDraft(entryType, ENTRY_TYPE_SUGGESTIONS),
      });
      nextOverrides.sort((a, b) => String(a.countryId).localeCompare(String(b.countryId)));
      return {
        ...prev,
        singleCountryOverrides: nextOverrides,
        singleCountryDraft: {
          countryId: "",
          ...buildPickerCustomDraft("", ENTRY_TYPE_SUGGESTIONS),
        },
      };
    });
  };

  const removeSingleCountryEntryTypeOverride = (countryId) => {
    setEntryTypeSaveAllDraft((prev) => ({
      ...prev,
      singleCountryOverrides: (Array.isArray(prev.singleCountryOverrides) ? prev.singleCountryOverrides : []).filter(
        (item) => String(item?.countryId ?? "").trim() !== String(countryId ?? "").trim()
      ),
    }));
  };

  const validateValiditySaveAllDraft = (draft) => {
    const allValidity = resolvePickerOrCustomValue(draft?.allCountries?.picker, draft?.allCountries?.custom);
    if (!allValidity) {
      showToast("Please set Validity for All Countries first.", "error");
      return false;
    }

    const singleCountryDraftId = String(draft?.singleCountryDraft?.countryId ?? "").trim();
    const singleCountryDraftValidity = resolvePickerOrCustomValue(
      draft?.singleCountryDraft?.picker,
      draft?.singleCountryDraft?.custom
    );
    if (singleCountryDraftId || singleCountryDraftValidity) {
      showToast("Add the single-country validity to the list, or clear the draft first.", "error");
      return false;
    }

    const singleCountryOverrides = Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [];
    for (const item of singleCountryOverrides) {
      const countryId = String(item?.countryId ?? "").trim();
      const validity = resolvePickerOrCustomValue(item?.picker, item?.custom);
      if (!countryId || !validity) {
        showToast("Each single-country validity entry needs both country and value.", "error");
        return false;
      }
    }

    const someCountryIds = normalizeCountrySelectorIds(draft?.someCountries?.countryIds);
    const someValidity = resolvePickerOrCustomValue(draft?.someCountries?.picker, draft?.someCountries?.custom);
    const someHasAnyValue = Boolean(someCountryIds.length > 0 || someValidity);
    if (someHasAnyValue) {
      if (someCountryIds.length === 0) {
        showToast("Select at least one country for Some Countries Validity.", "error");
        return false;
      }
      if (!someValidity) {
        showToast("Pick or type a Validity for Some Countries.", "error");
        return false;
      }
    }

    return true;
  };

  const buildValiditySaveAllPayload = (draft) => ({
    singleCountry: (() => {
      const firstOverride = (Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [])[0];
      return {
        countryId: String(firstOverride?.countryId ?? "").trim(),
        validity: resolvePickerOrCustomValue(firstOverride?.picker, firstOverride?.custom),
      };
    })(),
    allCountries: {
      validity: resolvePickerOrCustomValue(draft?.allCountries?.picker, draft?.allCountries?.custom),
    },
    singleCountryOverrides: (Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [])
      .map((item) => ({
        countryId: String(item?.countryId ?? "").trim(),
        validity: resolvePickerOrCustomValue(item?.picker, item?.custom),
      }))
      .filter((item) => item.countryId && item.validity),
    someCountries: {
      countryIds: normalizeCountrySelectorIds(draft?.someCountries?.countryIds),
      validity: resolvePickerOrCustomValue(draft?.someCountries?.picker, draft?.someCountries?.custom),
    },
  });

  const addSingleCountryValidityOverride = () => {
    const countryId = String(validitySaveAllDraft?.singleCountryDraft?.countryId ?? "").trim();
    const validity = resolvePickerOrCustomValue(
      validitySaveAllDraft?.singleCountryDraft?.picker,
      validitySaveAllDraft?.singleCountryDraft?.custom
    );
    if (!countryId) {
      showToast("Select one country before adding.", "error");
      return;
    }
    if (!validity) {
      showToast("Pick or type a Validity before adding.", "error");
      return;
    }

    setValiditySaveAllDraft((prev) => {
      const nextOverrides = Array.isArray(prev.singleCountryOverrides)
        ? prev.singleCountryOverrides.filter((item) => String(item?.countryId ?? "").trim() !== countryId)
        : [];
      nextOverrides.push({
        countryId,
        ...buildPickerCustomDraft(validity, VALIDITY_SUGGESTIONS),
      });
      nextOverrides.sort((a, b) => String(a.countryId).localeCompare(String(b.countryId)));
      return {
        ...prev,
        singleCountryOverrides: nextOverrides,
        singleCountryDraft: {
          countryId: "",
          ...buildPickerCustomDraft("", VALIDITY_SUGGESTIONS),
        },
      };
    });
  };

  const removeSingleCountryValidityOverride = (countryId) => {
    setValiditySaveAllDraft((prev) => ({
      ...prev,
      singleCountryOverrides: (Array.isArray(prev.singleCountryOverrides) ? prev.singleCountryOverrides : []).filter(
        (item) => String(item?.countryId ?? "").trim() !== String(countryId ?? "").trim()
      ),
    }));
  };

  const validateProcessingDaysSaveAllDraft = (draft) => {
    const allProcessingDays = resolvePickerOrCustomValue(draft?.allCountries?.picker, draft?.allCountries?.custom);
    if (!allProcessingDays) {
      showToast("Please set Processing Days for All Countries first.", "error");
      return false;
    }

    const singleCountryDraftId = String(draft?.singleCountryDraft?.countryId ?? "").trim();
    const singleCountryDraftProcessingDays = resolvePickerOrCustomValue(
      draft?.singleCountryDraft?.picker,
      draft?.singleCountryDraft?.custom
    );
    if (singleCountryDraftId || singleCountryDraftProcessingDays) {
      showToast("Add the single-country processing days to the list, or clear the draft first.", "error");
      return false;
    }

    const singleCountryOverrides = Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [];
    for (const item of singleCountryOverrides) {
      const countryId = String(item?.countryId ?? "").trim();
      const processingDays = resolvePickerOrCustomValue(item?.picker, item?.custom);
      if (!countryId || !processingDays) {
        showToast("Each single-country processing days entry needs both country and value.", "error");
        return false;
      }
    }

    const someCountryIds = normalizeCountrySelectorIds(draft?.someCountries?.countryIds);
    const someProcessingDays = resolvePickerOrCustomValue(draft?.someCountries?.picker, draft?.someCountries?.custom);
    const someHasAnyValue = Boolean(someCountryIds.length > 0 || someProcessingDays);
    if (someHasAnyValue) {
      if (someCountryIds.length === 0) {
        showToast("Select at least one country for Some Countries Processing Days.", "error");
        return false;
      }
      if (!someProcessingDays) {
        showToast("Pick or type Processing Days for Some Countries.", "error");
        return false;
      }
    }

    return true;
  };

  const buildProcessingDaysSaveAllPayload = (draft) => ({
    singleCountry: (() => {
      const firstOverride = (Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [])[0];
      return {
        countryId: String(firstOverride?.countryId ?? "").trim(),
        processingDays: resolvePickerOrCustomValue(firstOverride?.picker, firstOverride?.custom),
      };
    })(),
    allCountries: {
      processingDays: resolvePickerOrCustomValue(draft?.allCountries?.picker, draft?.allCountries?.custom),
    },
    singleCountryOverrides: (Array.isArray(draft?.singleCountryOverrides) ? draft.singleCountryOverrides : [])
      .map((item) => ({
        countryId: String(item?.countryId ?? "").trim(),
        processingDays: resolvePickerOrCustomValue(item?.picker, item?.custom),
      }))
      .filter((item) => item.countryId && item.processingDays),
    someCountries: {
      countryIds: normalizeCountrySelectorIds(draft?.someCountries?.countryIds),
      processingDays: resolvePickerOrCustomValue(draft?.someCountries?.picker, draft?.someCountries?.custom),
    },
  });

  const addSingleCountryProcessingDaysOverride = () => {
    const countryId = String(processingDaysSaveAllDraft?.singleCountryDraft?.countryId ?? "").trim();
    const processingDays = resolvePickerOrCustomValue(
      processingDaysSaveAllDraft?.singleCountryDraft?.picker,
      processingDaysSaveAllDraft?.singleCountryDraft?.custom
    );
    if (!countryId) {
      showToast("Select one country before adding.", "error");
      return;
    }
    if (!processingDays) {
      showToast("Pick or type Processing Days before adding.", "error");
      return;
    }

    setProcessingDaysSaveAllDraft((prev) => {
      const nextOverrides = Array.isArray(prev.singleCountryOverrides)
        ? prev.singleCountryOverrides.filter((item) => String(item?.countryId ?? "").trim() !== countryId)
        : [];
      nextOverrides.push({
        countryId,
        ...buildPickerCustomDraft(processingDays, PROCESSING_DAYS_SUGGESTIONS),
      });
      nextOverrides.sort((a, b) => String(a.countryId).localeCompare(String(b.countryId)));
      return {
        ...prev,
        singleCountryOverrides: nextOverrides,
        singleCountryDraft: {
          countryId: "",
          ...buildPickerCustomDraft("", PROCESSING_DAYS_SUGGESTIONS),
        },
      };
    });
  };

  const removeSingleCountryProcessingDaysOverride = (countryId) => {
    setProcessingDaysSaveAllDraft((prev) => ({
      ...prev,
      singleCountryOverrides: (Array.isArray(prev.singleCountryOverrides) ? prev.singleCountryOverrides : []).filter(
        (item) => String(item?.countryId ?? "").trim() !== String(countryId ?? "").trim()
      ),
    }));
  };

  const runUpdateGlobalLengthOfStay = async () => {
    if (!lengthOfStayHasUnsavedChanges) {
      showToast("No unsaved length of stay changes.", "warning");
      return;
    }
    if (!validateLengthOfStaySaveAllDraft(lengthOfStaySaveAllDraft)) {
      return;
    }
    const draftSnapshot = cloneLengthOfStayDraftForSave(lengthOfStaySaveAllDraft);
    setSavingControlKey("length-of-stay");
    try {
      const { data } = await api.post("/admin/control/length-of-stay", buildLengthOfStaySaveAllPayload(draftSnapshot));
      if (data?.success) {
        showToast(data.message || "Length of stay changes saved successfully.", "success");
        await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
        keepSavedSingleCountryLengthOfStayRows(draftSnapshot);
      } else {
        showToast(data?.message || "Failed to save length of stay changes.", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      let toastMsg = serverMsg || error?.message || "Failed to save length of stay changes.";
      if (status === 404) {
        toastMsg =
          "Control endpoint not found - restart the API locally or redeploy the server so /api/admin/control/length-of-stay is available.";
      } else if (status) {
        toastMsg = `${toastMsg} (HTTP ${status})`;
      }
      console.error("Save global length of stay failed:", { status, serverMsg, error });
      showToast(toastMsg, "error");
    } finally {
      setSavingControlKey(null);
    }
  };

  const runUpdateGlobalEntryType = async () => {
    if (!entryTypeHasUnsavedChanges) {
      showToast("No unsaved entry changes.", "warning");
      return;
    }
    if (!validateEntryTypeSaveAllDraft(entryTypeSaveAllDraft)) {
      return;
    }
    const draftSnapshot = cloneEntryTypeDraftForSave(entryTypeSaveAllDraft);
    setSavingControlKey("entry-type");
    try {
      const { data } = await api.post("/admin/control/entry-type", buildEntryTypeSaveAllPayload(draftSnapshot));
      if (data?.success) {
        showToast(data.message || "Entry changes saved successfully.", "success");
        await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
        keepSavedSingleCountryEntryTypeRows(draftSnapshot);
      } else {
        showToast(data?.message || "Failed to save entry changes.", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      let toastMsg = serverMsg || error?.message || "Failed to save entry changes.";
      if (status === 404) {
        toastMsg =
          "Control endpoint not found - restart the API locally or redeploy the server so /api/admin/control/entry-type is available.";
      } else if (status) {
        toastMsg = `${toastMsg} (HTTP ${status})`;
      }
      console.error("Save entry type changes failed:", { status, serverMsg, error });
      showToast(toastMsg, "error");
    } finally {
      setSavingControlKey(null);
    }
  };

  /** Same as the other two but for the universal Processing Days control. */
  const runUpdateGlobalProcessingDays = async () => {
    if (!processingDaysHasUnsavedChanges) {
      showToast("No unsaved processing days changes.", "warning");
      return;
    }
    if (!validateProcessingDaysSaveAllDraft(processingDaysSaveAllDraft)) {
      return;
    }
    const draftSnapshot = cloneProcessingDaysDraftForSave(processingDaysSaveAllDraft);
    setSavingControlKey("processing-days");
    try {
      const { data } = await api.post("/admin/control/processing-days", buildProcessingDaysSaveAllPayload(draftSnapshot));
      if (data?.success) {
        showToast(data.message || "Processing days changes saved successfully.", "success");
        await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
        keepSavedSingleCountryProcessingDaysRows(draftSnapshot);
      } else {
        showToast(data?.message || "Failed to save processing days changes.", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      let toastMsg = serverMsg || error?.message || "Failed to save processing days changes.";
      if (status === 404) {
        toastMsg =
          "Control endpoint not found - restart the API locally or redeploy the server so /api/admin/control/processing-days is available.";
      } else if (status) {
        toastMsg = `${toastMsg} (HTTP ${status})`;
      }
      console.error("Save processing days changes failed:", { status, serverMsg, error });
      showToast(toastMsg, "error");
    } finally {
      setSavingControlKey(null);
    }
  };

  const runUpdateGlobalBasePrice = async () => {
    const parsedBasePrice = Number(basePriceCustom);
    if (!Number.isFinite(parsedBasePrice) || parsedBasePrice <= 0) {
      showToast("Enter a valid global service fee.", "error");
      return;
    }
    if (!validateFeeApplyScope(basePriceApplyScope)) {
      return;
    }
    if (!confirmFeeScopeUpdate("service fee", basePriceApplyScope)) {
      return;
    }
    setSavingControlKey("base-price");
    try {
      const { data } = await api.put("/admin/fees/bulk-update", {
        feeType: "serviceFee",
        scope: basePriceApplyScope.scope,
        countryIds: normalizeCountrySelectorIds(basePriceApplyScope.countryIds),
        amount: parsedBasePrice,
      });
      if (data?.success) {
        showToast(data?.message || "Service fee updated successfully", "success");
        await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
      } else {
        showToast(data?.message || "Failed to update fee", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      let toastMsg = serverMsg || error?.message || "Failed to update fee";
      if (status === 404) {
        toastMsg =
          "Control endpoint not found - restart the API locally or redeploy the server so /api/admin/fees/bulk-update is available.";
      } else if (status) {
        toastMsg = `${toastMsg} (HTTP ${status})`;
      }
      console.error("Update service fee failed:", { status, serverMsg, error });
      showToast(toastMsg, "error");
    } finally {
      setSavingControlKey(null);
    }
  };

  const runUpdateGlobalGovernmentFee = async () => {
    const parsedGovernmentFee = Number(governmentFeeCustom);
    if (!Number.isFinite(parsedGovernmentFee) || parsedGovernmentFee <= 0) {
      showToast("Enter a valid global government fee.", "error");
      return;
    }
    if (!validateFeeApplyScope(governmentFeeApplyScope)) {
      return;
    }
    if (!confirmFeeScopeUpdate("government fee", governmentFeeApplyScope)) {
      return;
    }
    setSavingControlKey("government-fee");
    try {
      const { data } = await api.put("/admin/fees/bulk-update", {
        feeType: "governmentFee",
        scope: governmentFeeApplyScope.scope,
        countryIds: normalizeCountrySelectorIds(governmentFeeApplyScope.countryIds),
        amount: parsedGovernmentFee,
      });
      if (data?.success) {
        showToast(data?.message || "Government fee updated successfully", "success");
        await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
      } else {
        showToast(data?.message || "Failed to update fee", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      let toastMsg = serverMsg || error?.message || "Failed to update fee";
      if (status === 404) {
        toastMsg =
          "Control endpoint not found - restart the API locally or redeploy the server so /api/admin/fees/bulk-update is available.";
      } else if (status) {
        toastMsg = `${toastMsg} (HTTP ${status})`;
      }
      console.error("Update government fee failed:", { status, serverMsg, error });
      showToast(toastMsg, "error");
    } finally {
      setSavingControlKey(null);
    }
  };

  const runSaveAllServiceFeeChanges = async () => {
    if (!serviceFeeHasUnsavedChanges) {
      showToast("No unsaved service fee changes.", "warning");
      return;
    }
    if (!validateFeeSaveAllDraft(serviceFeeSaveAllDraft, "service fee")) {
      return;
    }
    setSavingControlKey("base-price");
    try {
      const { data } = await api.put(
        "/admin/fees/save-all",
        buildFeeSaveAllPayload("serviceFee", serviceFeeSaveAllDraft)
      );
      if (data?.success) {
        showToast(data?.message || "All fee changes saved successfully", "success");
        await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
        closeFeeSaveModal();
      } else {
        showToast(data?.message || "Failed to update fee", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      let toastMsg = serverMsg || error?.message || "Failed to update fee";
      if (status === 404) {
        toastMsg =
          "Control endpoint not found - restart the API locally or redeploy the server so /api/admin/fees/save-all is available.";
      } else if (status) {
        toastMsg = `${toastMsg} (HTTP ${status})`;
      }
      console.error("Save all service fee changes failed:", { status, serverMsg, error });
      showToast(toastMsg, "error");
    } finally {
      setSavingControlKey(null);
    }
  };

  const runSaveAllGovernmentFeeChanges = async () => {
    if (!governmentFeeHasUnsavedChanges) {
      showToast("No unsaved government fee changes.", "warning");
      return;
    }
    if (!validateFeeSaveAllDraft(governmentFeeSaveAllDraft, "government fee")) {
      return;
    }
    setSavingControlKey("government-fee");
    try {
      const { data } = await api.put(
        "/admin/fees/save-all",
        buildFeeSaveAllPayload("governmentFee", governmentFeeSaveAllDraft)
      );
      if (data?.success) {
        showToast(data?.message || "All fee changes saved successfully", "success");
        await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
        closeFeeSaveModal();
      } else {
        showToast(data?.message || "Failed to update fee", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      let toastMsg = serverMsg || error?.message || "Failed to update fee";
      if (status === 404) {
        toastMsg =
          "Control endpoint not found - restart the API locally or redeploy the server so /api/admin/fees/save-all is available.";
      } else if (status) {
        toastMsg = `${toastMsg} (HTTP ${status})`;
      }
      console.error("Save all government fee changes failed:", { status, serverMsg, error });
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
    const entries = buildGlobalRequiredDocumentEntriesPayload();
    if (!validateCountryVisibilitySelection(entries, "Each global document", (item) => item?.selectedCountries)) {
      return;
    }
    setSavingControlKey("required-documents");
    try {
      const { data } = await api.post("/admin/control/required-documents", {
        requiredDocuments: entries,
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
          "Control endpoint not found - restart the API so /api/admin/control/required-documents is available.";
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

  const handleSiteLogoFileChange = (file) => {
    if (!file) return false;
    if (file.type !== "image/webp") {
      showToast("Only WEBP logo is allowed.", "error");
      return false;
    }
    if (file.size > 50 * 1024) {
      showToast("Logo size must be under 50 KB.", "error");
      return false;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSettingsForm((prev) => ({ ...prev, footerLogo: ev.target.result }));
    };
    reader.readAsDataURL(file);
    return true;
  };

  const runUpdateGlobalOptionalDocuments = async () => {
    const docs = Array.isArray(optionalDocsDraft) ? optionalDocsDraft.filter(Boolean) : [];
    const entries = buildGlobalOptionalDocumentEntriesPayload();
    if (!validateCountryVisibilitySelection(entries, "Each optional document", (item) => item?.selectedCountries)) {
      return;
    }
    setSavingControlKey("optional-documents");
    try {
      const { data } = await api.post("/admin/control/optional-documents", {
        optionalDocuments: entries,
      });
      if (data?.success) {
        showToast(
          data.message || `Optional Documents updated (${docs.length} item${docs.length === 1 ? "" : "s"}).`,
          "success"
        );
        await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
      } else {
        showToast(data?.message || "Failed to update optional documents.", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      let toastMsg = serverMsg || error?.message || "Failed to update optional documents.";
      if (status === 404) {
        toastMsg =
          "Control endpoint not found - restart the API so /api/admin/control/optional-documents is available.";
      } else if (status) {
        toastMsg = `${toastMsg} (HTTP ${status})`;
      }
      console.error("Update global optional documents failed:", { status, serverMsg, error });
      showToast(toastMsg, "error");
    } finally {
      setSavingControlKey(null);
    }
  };

  const runUpdateDocumentSectionCopy = async () => {
    const copy = globalDefaults.documentSectionCopy || {};
    setSavingControlKey("document-section-copy");
    try {
      const { data } = await api.post("/admin/control/document-section-copy", {
        requiredDocumentsHeading: copy.requiredHeading,
        requiredDocumentsDescription: copy.requiredDescription,
        optionalDocumentsHeading: copy.optionalHeading,
        optionalDocumentsDescription: copy.optionalDescription,
      });
      if (data?.success) {
        const nextCopy = data.documentSectionCopy || {};
        setGlobalDefaults((prev) => ({
          ...prev,
          documentSectionCopy: {
            requiredHeading: String(nextCopy.requiredHeading ?? copy.requiredHeading ?? "Documents Required").trim() || "Documents Required",
            requiredDescription:
              String(nextCopy.requiredDescription ?? copy.requiredDescription ?? "These are the country documents required for this application.").trim() ||
              "These are the country documents required for this application.",
            optionalHeading: String(nextCopy.optionalHeading ?? copy.optionalHeading ?? "Optional Documents").trim() || "Optional Documents",
            optionalDescription:
              String(nextCopy.optionalDescription ?? copy.optionalDescription ?? "You can also attach other documents in the same Drive link.").trim() ||
              "You can also attach other documents in the same Drive link.",
          },
        }));
        showToast(data.message || "Document section copy updated.", "success");
        await fetchCountries();
      } else {
        showToast(data?.message || "Failed to update document section copy.", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      showToast(error?.response?.data?.message || error?.message || "Failed to update document section copy.", "error");
    } finally {
      setSavingControlKey(null);
    }
  };

  const runUpdateCatalogVisibility = async () => {
    const activeKeys = Array.isArray(selectedCatalogDocs) ? selectedCatalogDocs.filter(Boolean) : [];
    setSavingControlKey("catalog-visibility");
    try {
      const { data } = await api.post("/admin/control/custom-documents", {
        action: "update-visibility",
        activeKeys,
      });
      if (data?.success) {
        showToast(
          data.message || `Catalog visibility updated successfully. Only ${activeKeys.length} selected document types will be active.`,
          "success"
        );
        // Update local catalog/selection from server response if provided so
        // we don't accidentally overwrite the admin's selection with a
        // derived default that marks everything visible.
        if (Array.isArray(data.documentCatalog)) {
          const catalog = data.documentCatalog
            .map((d) => ({
              key: String(d?.key ?? "").trim(),
              label: String(d?.label ?? "").trim(),
              description: String(d?.description ?? "").trim(),
              icon: String(d?.icon ?? "").trim(),
              builtIn: d?.builtIn !== false,
              deleted: !!d?.deleted,
            }))
            .filter((d) => d.key && d.label);
          setDocumentCatalog(catalog);
          setSelectedCatalogDocs(catalog.filter((d) => !d.deleted).map((d) => d.key));
        }
        await fetchCountries();
      } else {
        showToast(data?.message || "Failed to update catalog visibility.", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      showToast(error?.response?.data?.message || error?.message || "Failed to update catalog visibility.", "error");
    } finally {
      setSavingControlKey(null);
    }
  };

  /** POST a new admin-defined document type to the catalog. */
  const runAddCustomDocument = async () => {
    const label = String(newCustomDocLabel ?? "").trim();
    const description = String(newCustomDocDescription ?? "").trim();
    const icon = sanitizeRemixIconClass(newCustomDocIcon);
    if (!label) {
      showToast("Type a document label first.", "error");
      return;
    }
    if (newCustomDocIcon.trim() && !icon) {
      showToast('Use a valid Remix Icon class like "ri-passport-line".', "error");
      return;
    }
    setSavingCustomDoc(true);
    try {
      const { data } = await api.post("/admin/control/custom-documents", {
        action: "add",
        label,
        description,
        icon,
      });
      if (data?.success) {
        showToast(data.message || `"${label}" added.`, "success");
        setNewCustomDocLabel("");
        setNewCustomDocDescription("");
        setNewCustomDocIcon("");
        // Immediately update catalog from the response so the new doc is visible
        if (Array.isArray(data.documentCatalog)) {
          setDocumentCatalog(
            data.documentCatalog
              .map((d) => ({
                key: String(d?.key ?? "").trim(),
                label: String(d?.label ?? "").trim(),
                description: String(d?.description ?? "").trim(),
                icon: String(d?.icon ?? "").trim(),
                builtIn: d?.builtIn !== false,
                deleted: !!d?.deleted,
              }))
              .filter((d) => d.key && d.label)
          );
        }
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
          "Endpoint not found - restart the API so /api/admin/control/custom-documents is available.";
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

  const runSaveDocumentCatalogEntry = async (doc) => {
    const key = String(doc?.key ?? "").trim();
    const label = String(doc?.label ?? "").trim();
    const description = String(doc?.description ?? "").trim();
    const icon = sanitizeRemixIconClass(doc?.icon);
    if (!key) return;
    if (!label) {
      showToast("Document name is required.", "error");
      return;
    }
    if (String(doc?.icon ?? "").trim() && !icon) {
      showToast('Use a valid Remix Icon class like "ri-passport-line".', "error");
      return;
    }
    const requiredDocEntries = buildGlobalRequiredDocumentEntriesPayload();
    const optionalDocEntries = buildGlobalOptionalDocumentEntriesPayload();
    if (
      requiredDocEntries.some((item) => item.key === key) &&
      !validateCountryVisibilitySelection(
        requiredDocEntries.filter((item) => item.key === key),
        "This global document",
        (item) => item?.selectedCountries
      )
    ) {
      return;
    }
    if (
      optionalDocEntries.some((item) => item.key === key) &&
      !validateCountryVisibilitySelection(
        optionalDocEntries.filter((item) => item.key === key),
        "This optional document",
        (item) => item?.selectedCountries
      )
    ) {
      return;
    }
    setSavingDocumentMetaKey(key);
    try {
      const { data } = await api.post("/admin/control/custom-documents", {
        action: "save",
        key,
        label,
        description,
        icon,
      });
      if (data?.success) {
        if (requiredDocEntries.length) {
          const visibilityRes = await api.post("/admin/control/required-documents", {
            requiredDocuments: requiredDocEntries,
          });
          if (!visibilityRes?.data?.success) {
            showToast(visibilityRes?.data?.message || "Failed to save document visibility.", "error");
            return;
          }
        }
        if (optionalDocEntries.length) {
          const visibilityRes = await api.post("/admin/control/optional-documents", {
            optionalDocuments: optionalDocEntries,
          });
          if (!visibilityRes?.data?.success) {
            showToast(visibilityRes?.data?.message || "Failed to save optional document visibility.", "error");
            return;
          }
        }
        showToast(data.message || `"${label}" saved.`, "success");
        if (Array.isArray(data.documentCatalog)) {
          setDocumentCatalog(
            data.documentCatalog
              .map((d) => ({
                key: String(d?.key ?? "").trim(),
                label: String(d?.label ?? "").trim(),
                description: String(d?.description ?? "").trim(),
                icon: String(d?.icon ?? "").trim(),
                builtIn: d?.builtIn !== false,
                deleted: !!d?.deleted,
              }))
              .filter((d) => d.key && d.label)
          );
        }
        await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
        setEditingDocKey(key);
      } else {
        showToast(data?.message || "Failed to save document.", "error");
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        handleUnauthorized();
        return;
      }
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message;
      const toastMsg = serverMsg || error?.message || "Failed to save document.";
      // eslint-disable-next-line no-console
      console.error("Save document catalog entry failed:", { status, serverMsg, error, key });
      showToast(toastMsg, "error");
    } finally {
      setSavingDocumentMetaKey("");
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
        if (Array.isArray(data.documentCatalog)) {
          setDocumentCatalog(
            data.documentCatalog
              .map((d) => ({
                key: String(d?.key ?? "").trim(),
                label: String(d?.label ?? "").trim(),
                description: String(d?.description ?? "").trim(),
                icon: String(d?.icon ?? "").trim(),
                builtIn: d?.builtIn !== false,
                deleted: !!d?.deleted,
              }))
              .filter((d) => d.key && d.label)
          );
        }
        await Promise.all([loadGlobalCountryDefaults(), fetchCountries()]);
        // Drop the removed key from the local draft so the "Apply" payload
        // doesn't try to re-introduce a doc that no longer exists.
        setRequiredDocsDraft((prev) => prev.filter((k) => k !== key));
        setOptionalDocsDraft((prev) => prev.filter((k) => k !== key));
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
          showLengthOfStay: live.showLengthOfStay !== false,
          showEntryType: live.showEntryType !== false,
          showProcessingDays: live.showProcessingDays !== false,
          showRequiredDocuments: live.showRequiredDocuments !== false,
          showVisaRequirements: live.showVisaRequirements !== false,
          showHowItWorks: live.showHowItWorks !== false,
          showWhyBookNow: live.showWhyBookNow !== false,
          showDestinationDocuments: live.showDestinationDocuments !== false,
          showDestinationRequiredDocs: live.showDestinationRequiredDocs !== false,
          showDestinationOptionalDocs: live.showDestinationOptionalDocs !== false,
          showWhatsIncluded: live.showWhatsIncluded !== false,
          showFaqs: live.showFaqs !== false,
          maintenanceModeEnabled: live.maintenanceModeEnabled === true,
        });
        const labels = {
          showVisaType: "Visa Type",
          showValidity: "Validity",
          showLengthOfStay: "Length of Stay",
          showEntryType: "Entry",
          showProcessingDays: "Processing Days",
          showRequiredDocuments: "Required Documents",
          showVisaRequirements: "Visa Requirements",
          showHowItWorks: "How it works",
          showWhyBookNow: "Why book now",
          showDestinationDocuments: "Documents Required",
          showDestinationRequiredDocs: "Documents Required",
          showDestinationOptionalDocs: "Optional Document",
          showWhatsIncluded: "What's included",
          showFaqs: "FAQs",
          maintenanceModeEnabled: "Maintenance Mode",
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
          "Toggle endpoint not found - restart the API so /api/admin/control/display-toggles is available.";
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
  const runUnsplashImageFetch = async ({ onlyMissing = false, onlyTrending = false, onlyActive = false }) => {
    const keyFromForm = settingsForm.unsplashAccessKey?.trim();
    if (!keyFromForm && !isUnsplashConfigured) {
      showToast("Paste your Unsplash Access Key below (and save if you want it stored).", "error");
      return;
    }

    setUnsplashFetchRunning(true);
    let scopeLabel = "All countries";
    if (onlyTrending) scopeLabel = "Trending countries only";
    else if (onlyActive) scopeLabel = "Active countries only";
    else if (onlyMissing) scopeLabel = "Missing images only";
    setUnsplashFetchProgress(`Starting ${scopeLabel.toLowerCase()} - first batch may take ~10-20s (Unsplash rate limits)...`);
    let totalUpdated = 0;
    let totalFailed = 0;
    try {
      let skip = 0;
      const limit = 10;
      const maxBatches = 250;
      for (let b = 0; b < maxBatches; b++) {
        const body = { onlyMissing, onlyTrending, onlyActive, skip, limit };
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
    if (passwordForm.newPassword.length < 8) {
      return showToast("New password must be at least 8 characters", "error");
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

  // -- Requirements field helpers -----------------------------
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

  // -- Recalculate live analytics from current applications --
  const liveAnalytics = useMemo(() => {
    const statusCounts = {
      pending: 0,
      doc_pending: 0,
      review: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
      dash: 0,
    };

    for (const booking of bookings) {
      const progress = getApplicationProgress(booking, settingsForm);
      const resolvedStatus = resolveApplicationStatus(booking, progress);
      if (Object.prototype.hasOwnProperty.call(statusCounts, resolvedStatus)) {
        statusCounts[resolvedStatus] += 1;
      }
    }

    const total = bookings.length;
    const approved = statusCounts.approved;

    const isPaymentCompleted = (app) => {
      return (
        app.paymentStatus === "paid" ||
        app.paymentStatus === "success" ||
        app.paymentStatus === "completed" ||
        app.isPaid === true ||
        app.payment?.status === "paid" ||
        app.payment?.status === "success"
      );
    };

    const hasRequiredDocuments = (app) => {
      return (
        app.documentsUploaded === true ||
        app.requiredDocumentsUploaded === true ||
        app.uploadedDocuments?.length > 0 ||
        app.documents?.length > 0 ||
        app.passportFile ||
        app.passportUrl ||
        app.travelers?.some(traveler =>
          traveler.passportFile ||
          traveler.passportUrl ||
          traveler.documents?.length > 0 ||
          traveler.uploadedDocuments?.length > 0
        )
      );
    };

    const pendingReviewApplications = bookings.filter(app =>
      isPaymentCompleted(app) && !hasRequiredDocuments(app)
    );

    const pendingPaymentApplications = bookings.filter(app =>
      !isPaymentCompleted(app)
    );

    return {
      total,
      revenue: bookings.reduce((sum, booking) => {
        const isPaid = booking?.paymentStatus === "completed" || booking?.isPaid === true;
        return isPaid ? sum + Number(booking?.fee || 0) : sum;
      }, 0),
      pending: pendingPaymentApplications.length, // Keep existing 'pending' for backwards compat
      pendingReview: pendingReviewApplications.length,
      pendingPayment: pendingPaymentApplications.length,
      statusCounts,
      approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
    };
  }, [bookings, settingsForm]);

  return (
    <AdminLayout
      title="Admin Dashboard"
      description="Manage all applications, countries, and analytics."
      tabs={ADMIN_DASHBOARD_TABS.filter(t => !t.hidden)}
      activeTab={activeTab}
      onTabChange={(id) => {
        if (id === "analytics") {
          navigate("/");
        } else {
          navigate(`/${id}`);
        }
      }}
    >

          {/* ======================================
              TAB 3: COUNTRY MANAGER
              ====================================== */}
          {activeTab === "countries" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
                  <div>
                    <h2 className="font-semibold text-text-primary">Country Manager</h2>
                    <p className="text-xs text-text-muted">Edit pricing, visa type, documents, requirements, and display details for all 195 countries.</p>
                  </div>
                  <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[24rem]">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetAllPopularity}
                        disabled={resettingAllPopularity}
                        id="country-manager-reset-all-popularity"
                      >
                        {resettingAllPopularity ? "Resetting..." : "Reset All Popularity"}
                      </Button>
                      <Button
                        variant={showActiveCountriesFirst ? "primary" : "ghost"}
                        size="sm"
                        onClick={() => setShowActiveCountriesFirst((value) => !value)}
                        disabled={countries.length === 0}
                        id="country-manager-selected-countries"
                      >
                        {showActiveCountriesFirst
                          ? "Normal Order"
                          : `Selected Countries (${activeCountryCount})`}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => bulkSetCountryActive(true)}
                        disabled={bulkCountryToggleBusy}
                        id="country-manager-select-all"
                      >
                        {bulkCountryToggleBusy ? "Updating..." : "Select All"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => bulkSetCountryActive(false)}
                        disabled={bulkCountryToggleBusy}
                        id="country-manager-deselect-all"
                      >
                        {bulkCountryToggleBusy ? "Updating..." : "Deselect All"}
                      </Button>
                    </div>
                    <div className="relative w-full sm:w-80 sm:self-end">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        value={countrySearchQuery}
                        onChange={(e) => setCountrySearchQuery(e.target.value)}
                        placeholder="Search country, city, visa type, document, fee..."
                        className="w-full bg-surface-2 border border-border text-text-primary text-sm rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan placeholder-text-muted"
                        id="country-manager-search"
                      />
                    </div>
                    {showActiveCountriesFirst && (
                      <p className="text-right text-xs text-text-muted">
                        Showing countries with visibility on at the top.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label className="text-xs font-medium text-text-secondary">
                      Status
                      <select
                        value={countryStatusFilter}
                        onChange={(e) => setCountryStatusFilter(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary focus:border-cyan focus:outline-none focus:ring-2 focus:ring-cyan/20"
                      >
                        <option value="all">All countries</option>
                        <option value="active">Active only</option>
                        <option value="inactive">Inactive only</option>
                      </select>
                    </label>
                    <label className="text-xs font-medium text-text-secondary">
                      Visa type
                      <select
                        value={countryVisaTypeFilter}
                        onChange={(e) => setCountryVisaTypeFilter(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary focus:border-cyan focus:outline-none focus:ring-2 focus:ring-cyan/20"
                      >
                        <option value="all">All visa types</option>
                        {countryVisaTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-text-secondary">
                      Sort
                      <select
                        value={countrySortMode}
                        onChange={(e) => setCountrySortMode(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary focus:border-cyan focus:outline-none focus:ring-2 focus:ring-cyan/20"
                      >
                        <option value="default">Default order</option>
                        <option value="mostVisited">Most visited</option>
                        <option value="recentlyVisited">Recently visited</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-muted lg:justify-end">
                    <span>Selected Countries: <span className="font-semibold text-text-primary">{activeCountryCount}</span></span>
                    <label className="flex items-center gap-2">
                      Rows
                      <select
                        value={countryPageSize}
                        onChange={(e) => setCountryPageSize(Number(e.target.value))}
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs text-text-primary focus:border-cyan focus:outline-none"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-border bg-white">
                  <div className="overflow-x-auto">
                    <table className="min-w-[1120px] w-full text-left text-sm">
                      <thead className="border-b border-border bg-surface-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                        <tr>
                          <th className="w-12 px-4 py-3">Select</th>
                          <th className="px-4 py-3">Country</th>
                          <th className="px-4 py-3">Visa Type</th>
                          <th className="px-4 py-3">Documents</th>
                          <th className="px-4 py-3">Govt Visa Fee</th>
                          <th className="px-4 py-3">Processing Time</th>
                          <th className="px-4 py-3">Success Rate</th>
                          <th className="px-4 py-3">Visits</th>
                          <th className="px-4 py-3">Last Visit</th>
                          <th className="px-4 py-3 text-center">Active</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-text-secondary">
                        {countries.length === 0 && (
                          <tr>
                            <td colSpan={11} className="px-4 py-14 text-center text-text-muted">
                              <p className="font-medium">No countries loaded yet.</p>
                              <p className="mt-1 text-xs">The manager uses the 195 countries already present in MongoDB.</p>
                            </td>
                          </tr>
                        )}
                        {countries.length > 0 && countryManagerRows.length === 0 && (
                          <tr>
                            <td colSpan={11} className="px-4 py-14 text-center text-text-muted">
                              <Search size={28} className="mx-auto mb-3 opacity-40" />
                              <p className="font-medium">No country matches your search or filters.</p>
                            </td>
                          </tr>
                        )}
                        {countryPageRows.map((c) => {
                          const rowKey = String(c._id || c.id || c.slug || c.name);
                          const active = c.isActive !== false;
                          return (
                            <tr key={rowKey} className="transition-colors hover:bg-cyan/5">
                              <td className="px-4 py-3 align-middle">
                                <input
                                  type="checkbox"
                                  checked={active}
                                  disabled={togglingCountryKey === rowKey}
                                  onChange={() => toggleCountryActive(c)}
                                  className="h-4 w-4 rounded border-border text-cyan focus:ring-cyan/30"
                                  aria-label={`${active ? "Deselect" : "Select"} ${c.name}`}
                                />
                              </td>
                              <td className="px-4 py-3 align-middle">
                                <div className="min-w-[12rem]">
                                  <p className="font-semibold text-text-primary">{c.name}</p>
                                  {(c.city || c.region || c.subtitle || getCountrySearchHint(c, countrySearchQuery)) && (
                                    <p className="mt-0.5 text-xs text-text-muted">
                                      {c.city || c.region || c.subtitle || getCountrySearchHint(c, countrySearchQuery)}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 align-middle text-text-primary">{c.visaType || "Not set"}</td>
                              <td className="px-4 py-3 align-middle">{renderCountryDocuments(c)}</td>
                              <td className="px-4 py-3 align-middle whitespace-nowrap text-text-primary">
                                {formatPriceINR(c.governmentFee ?? c.basePrice)}
                              </td>
                              <td className="px-4 py-3 align-middle whitespace-nowrap">{c.processingDays || "Not set"}</td>
                              <td className="px-4 py-3 align-middle whitespace-nowrap">
                                <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-400">
                                  {Number.isFinite(Number(c.successRate)) ? `${c.successRate}%` : "Not set"}
                                </span>
                              </td>
                              <td className="px-4 py-3 align-middle whitespace-nowrap">{formatVisitCount(c.visitCount)}</td>
                              <td className="px-4 py-3 align-middle whitespace-nowrap text-xs">
                                {c.lastVisitedAt ? fmtDate(c.lastVisitedAt) : "No visits yet"}
                              </td>
                              <td className="px-4 py-3 align-middle">
                                <div className="flex justify-center">
                                  <CountryCardActiveToggle
                                    active={active}
                                    busy={togglingCountryKey === rowKey}
                                    onClick={() => toggleCountryActive(c)}
                                    countryName={c.name}
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-3 align-middle">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    id={`edit-country-${c._id || c.id}`}
                                    onClick={() => openEditCountry(c)}
                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-cyan/10 hover:text-cyan"
                                    aria-label={`Edit ${c.name}`}
                                  >
                                    <Edit3 size={14} />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => resetCountryPopularity(c)}
                                    disabled={Boolean(resettingPopularityKey && resettingPopularityKey !== rowKey)}
                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-cyan/10 hover:text-cyan disabled:opacity-50"
                                    aria-label={`Reset popularity for ${c.name}`}
                                    title="Reset popularity"
                                  >
                                    <RotateCcw size={14} className={resettingPopularityKey === rowKey ? "animate-spin" : ""} />
                                    Reset
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-col gap-3 border-t border-border bg-surface-2 px-4 py-3 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      Showing {countryVisibleStart}-{countryVisibleEnd} of {countryManagerRows.length} countries
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCountryPage((page) => Math.max(1, page - 1))}
                        disabled={countryPage <= 1}
                        className="rounded-lg border border-border bg-white px-3 py-1.5 font-medium text-text-secondary transition-colors hover:border-cyan/40 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Prev
                      </button>
                      <span className="rounded-lg bg-white px-3 py-1.5 text-text-primary">
                        Page {Math.min(countryPage, countryPageCount)} of {countryPageCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCountryPage((page) => Math.min(countryPageCount, page + 1))}
                        disabled={countryPage >= countryPageCount}
                        className="rounded-lg border border-border bg-white px-3 py-1.5 font-medium text-text-secondary transition-colors hover:border-cyan/40 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>              </Card>
            </motion.div>
          )}

          {/* ======================================
              TAB: SUPPORT CHAT
              ====================================== */}
          {activeTab === "support-chat" && <SupportChatWorkspace />}

          {/* ======================================
              TAB 4: CONTROLS
              ====================================== */}
          {isControlsTab && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="min-w-0 flex flex-col w-full">
                {/* Top Navigation Row */}
                <div className="mb-6 flex gap-4 border-b border-border pb-2">
                  {controlGroups.map((group) => {
                    const active = group.key === activeControlGroup.key;
                    const Icon = group.icon;
                    return (
                      <button
                        key={group.key}
                        onClick={() => selectControlGroup(group.key)}
                        className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition ${
                          active ? "border-cyan text-cyan" : "border-transparent text-text-secondary hover:border-border hover:text-text-primary"
                        }`}
                      >
                        {Icon && <Icon size={18} />}
                        {group.label}
                      </button>
                    );
                  })}
                </div>

                {/* Breadcrumb */}
                <div className="mb-6 flex flex-wrap items-center gap-1.5 pl-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
                  {["Controls", ...activeControlBreadcrumb].map((item, index, arr) => (
                    <span key={`${item}-${index}`} className="flex items-center gap-1.5">
                      <span className={index === arr.length - 1 ? "font-bold text-cyan" : ""}>
                        {item}
                      </span>
                      {index < arr.length - 1 && <ChevronRight size={13} className="text-text-muted/50" />}
                    </span>
                  ))}
                </div>

                {/* Groups rendering */}
                <div className="mb-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2 xl:grid-cols-3">
                  {activeControlGroup.sections.map((section) => {
                    const SectionIcon = section.icon || FileText;
                    
                    // Partition children into "leaf" nodes (pill buttons) and "branch" nodes (nested sub-headers)
                    // If a section child has NO children of its own, it's a leaf.
                    const leafs = section.children ? section.children.filter((child) => !child.children || child.children.length === 0) : [];
                    const branches = section.children ? section.children.filter((child) => child.children && child.children.length > 0) : [];

                    // If a section itself has no children (e.g. original Footer Controls), treat it as a standalone leaf action
                    const isDirectControl = !section.children || section.children.length === 0;

                    return (
                      <div key={section.key} className="flex flex-col rounded-2xl border border-border bg-white p-4 shadow-sm">
                        <div className="mb-4 flex items-center gap-2 text-sm font-bold text-text-primary">
                          <SectionIcon size={18} className="text-cyan" />
                          {section.label}
                        </div>

                        <div className="flex flex-col gap-5">
                          {isDirectControl && (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => selectControlNavNode(section)}
                                className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition ${
                                  activeControlSection === section.key
                                    ? "bg-cyan text-white shadow-cyan-glow"
                                    : "border border-border bg-surface-2 text-text-secondary hover:border-cyan/40 hover:text-text-primary"
                                }`}
                              >
                                {section.label}
                              </button>
                            </div>
                          )}

                          {leafs.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {leafs.map((child) => {
                                const active = activeControlSection === child.key;
                                return (
                                  <button
                                    key={child.key}
                                    onClick={() => selectControlNavNode(child)}
                                    className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition ${
                                      active
                                        ? "bg-cyan text-white shadow-cyan-glow"
                                        : "border border-border bg-surface-2 text-text-secondary hover:border-cyan/40 hover:text-text-primary"
                                    }`}
                                  >
                                    {child.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {branches.map((branch) => {
                            const isExpanded = expandedControlTabKeys[branch.key];
                            return (
                              <div key={branch.key} className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2/30 p-3">
                                <button
                                  onClick={() => selectControlNavNode(branch)}
                                  className="flex w-full items-center justify-between text-left text-[11px] font-bold uppercase tracking-wider text-text-muted hover:text-cyan transition-colors"
                                >
                                  {branch.label}
                                  <ChevronDown
                                    size={14}
                                    className={`transition-transform duration-200 ${
                                      isExpanded ? "rotate-180 text-cyan" : ""
                                    }`}
                                  />
                                </button>
                                <AnimatePresence initial={false}>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="flex flex-wrap gap-2 pt-2 border-t border-border mt-1">
                                        {branch.children.map((subChild) => {
                                          if (subChild.children && subChild.children.length > 0) {
                                            return (
                                              <div key={subChild.key} className="w-full flex flex-col gap-2 mt-2 pt-2 border-t border-border">
                                                <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider pl-1">
                                                  {subChild.label}
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                  {subChild.children.map(nestedChild => {
                                                    const active = activeControlSection === nestedChild.key;
                                                    return (
                                                      <button
                                                        key={nestedChild.key}
                                                        onClick={() => selectControlNavNode(nestedChild)}
                                                        className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition ${
                                                          active
                                                            ? "bg-cyan text-white shadow-cyan-glow"
                                                            : "border border-border bg-white text-text-secondary hover:border-cyan/40 hover:text-text-primary shadow-sm"
                                                        }`}
                                                      >
                                                        {nestedChild.label}
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            );
                                          }
                                          const active = activeControlSection === subChild.key;
                                          return (
                                            <button
                                              key={subChild.key}
                                              onClick={() => selectControlNavNode(subChild)}
                                              className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition ${
                                                active
                                                  ? "bg-cyan text-white shadow-cyan-glow"
                                                  : "border border-border bg-white text-text-secondary hover:border-cyan/40 hover:text-text-primary shadow-sm"
                                              }`}
                                            >
                                              {subChild.label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

                  <div className={isControlSectionVisible("register-page") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
                    <SettingsSectionCard
                      title="Authentication Controls"
                      description="Control which login and signup methods are visible on the public client."
                      saveLabel="Save Authentication Controls"
                      saveButtonId="save-auth-controls"
                      isSaving={savingSettingsKey === "auth-controls"}
                      onSave={() =>
                        saveOtpSettingsCard("auth-controls", "/admin/auth-settings/auth-controls", {
                          passwordEnabled: otpSettingsForm.authControls.passwordEnabled,
                          googleEnabled: otpSettingsForm.authControls.googleEnabled,
                          facebookEnabled: otpSettingsForm.authControls.facebookEnabled,
                          phoneOtpEnabled: otpSettingsForm.authControls.phoneOtpEnabled,
                          smsOtpEnabled: otpSettingsForm.authControls.smsOtpEnabled,
                          emailOtpEnabled: otpSettingsForm.authControls.emailOtpEnabled,
                        }, "Authentication controls saved.")
                      }
                    >
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <AuthControlToggle
                          title="Password Login"
                          description="Allow users to login/signup using email and password"
                          checked={otpSettingsForm.authControls.passwordEnabled}
                          onChange={(checked) =>
                            setOtpSettingsForm((p) => ({
                              ...p,
                              authControls: { ...p.authControls, passwordEnabled: checked },
                            }))
                          }
                        />
                        <AuthControlToggle
                          title="Google Login"
                          description="Allow users to continue with Google"
                          checked={otpSettingsForm.authControls.googleEnabled}
                          onChange={(checked) =>
                            setOtpSettingsForm((p) => ({
                              ...p,
                              authControls: { ...p.authControls, googleEnabled: checked },
                            }))
                          }
                        />
                        <AuthControlToggle
                          title="Facebook Login"
                          description="Allow users to continue with Facebook"
                          checked={otpSettingsForm.authControls.facebookEnabled}
                          onChange={(checked) =>
                            setOtpSettingsForm((p) => ({
                              ...p,
                              authControls: { ...p.authControls, facebookEnabled: checked },
                            }))
                          }
                        />
                        <AuthControlToggle
                          title="WhatsApp OTP"
                          description="Allow users to login/signup using WhatsApp OTP"
                          checked={otpSettingsForm.authControls.phoneOtpEnabled}
                          onChange={(checked) =>
                            setOtpSettingsForm((p) => ({
                              ...p,
                              authControls: { ...p.authControls, phoneOtpEnabled: checked },
                            }))
                          }
                        />
                        {/* <AuthControlToggle
                          title="SMS OTP"
                          description="Allow users to login/signup using SMS OTP"
                          checked={otpSettingsForm.authControls.smsOtpEnabled}
                          onChange={(checked) =>
                            setOtpSettingsForm((p) => ({
                              ...p,
                              authControls: { ...p.authControls, smsOtpEnabled: checked },
                            }))
                          }
                        /> */}
                        <AuthControlToggle
                          title="Email OTP"
                          description="Allow users to login/signup using email OTP"
                          checked={otpSettingsForm.authControls.emailOtpEnabled}
                          onChange={(checked) =>
                            setOtpSettingsForm((p) => ({
                              ...p,
                              authControls: { ...p.authControls, emailOtpEnabled: checked },
                            }))
                          }
                        />
                      </div>
                    </SettingsSectionCard>
                  </div>

                  <div className={isControlSectionVisible("register-page") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
                    <SettingsSectionCard
                      title="OTP Testing Only"
                      description="Use local test OTP without SMS, WhatsApp, or email provider setup. Turn this off before using real OTP providers."
                      saveLabel="Save Testing Settings"
                      saveButtonId="save-auth-settings-testing"
                      isSaving={savingSettingsKey === "otp-testing"}
                      onSave={() =>
                        saveOtpSettingsCard("otp-testing", "/admin/auth-settings/testing", {
                          enabled: otpSettingsForm.testing.enabled,
                          autofillEnabled: otpSettingsForm.testing.autofillEnabled,
                        }, "OTP testing settings saved.")
                      }
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-3 text-sm text-text-primary">
                          <input type="checkbox" checked={otpSettingsForm.testing.enabled} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, testing: { ...p.testing, enabled: e.target.checked } }))} />
                          Enable testing OTP
                        </label>
                        <label className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-3 text-sm text-text-primary">
                          <input type="checkbox" checked={otpSettingsForm.testing.autofillEnabled} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, testing: { ...p.testing, autofillEnabled: e.target.checked } }))} />
                          Autofill test OTP in popup
                        </label>
                      </div>
                      <p className="mt-3 text-xs text-text-muted">
                        When enabled, OTP is generated by the server and stored securely for verification, but no real provider is called.
                      </p>
                    </SettingsSectionCard>
                  </div>

                  <div className={isControlSectionVisible("register-page") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
                    <SettingsSectionCard
                      title="SMS OTP Settings"
                      description="Enable SMS OTP through MSG91/SMS91."
                      saveLabel="Save SMS Settings"
                      saveButtonId="save-auth-settings-sms"
                      isSaving={savingSettingsKey === "otp-sms"}
                      onSave={() =>
                        saveOtpSettingsCard("otp-sms", "/admin/auth-settings/sms", {
                          enabled: otpSettingsForm.sms.enabled,
                          provider: otpSettingsForm.sms.provider,
                          authKey: otpSettingsForm.sms.authKey,
                          templateId: otpSettingsForm.sms.templateId,
                          otpLength: otpSettingsForm.sms.otpLength,
                        }, "SMS OTP settings saved.")
                      }
                    >
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <label className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-3 text-sm text-text-primary">
                          <input type="checkbox" checked={otpSettingsForm.sms.enabled} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, sms: { ...p.sms, enabled: e.target.checked } }))} />
                          Enable SMS OTP
                        </label>
                        <Input label="Provider name" value={otpSettingsForm.sms.provider} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, sms: { ...p.sms, provider: e.target.value } }))} placeholder="MSG91 / SMS91" />
                        <Input label="Auth Key" type="password" value={otpSettingsForm.sms.authKey} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, sms: { ...p.sms, authKey: e.target.value } }))} helper="Paste provider auth key from MSG91 dashboard." />
                        <Input label="OTP Template ID" value={otpSettingsForm.sms.templateId} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, sms: { ...p.sms, templateId: e.target.value } }))} helper="Paste approved OTP template ID." />
                        <Select label="OTP Length" value={otpSettingsForm.sms.otpLength} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, sms: { ...p.sms, otpLength: e.target.value } }))} helper="Must match your approved template." options={[{ value: "4", label: "4 digits" }, { value: "6", label: "6 digits" }]} />
                      </div>
                    </SettingsSectionCard>
                  </div>

                  <div className={isControlSectionVisible("register-page") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
                    <SettingsSectionCard
                      title="WhatsApp OTP Settings"
                      description="Enable WhatsApp OTP through MSG91 WhatsApp templates."
                      saveLabel="Save WhatsApp Settings"
                      saveButtonId="save-auth-settings-whatsapp"
                      isSaving={savingSettingsKey === "otp-whatsapp"}
                      onSave={() =>
                        saveOtpSettingsCard("otp-whatsapp", "/admin/auth-settings/whatsapp", {
                          enabled: otpSettingsForm.whatsapp.enabled,
                          provider: otpSettingsForm.whatsapp.provider,
                          authKey: otpSettingsForm.whatsapp.authKey,
                          templateId: otpSettingsForm.whatsapp.templateId,
                          businessNumber: otpSettingsForm.whatsapp.businessNumber,
                          otpLength: otpSettingsForm.whatsapp.otpLength,
                        }, "WhatsApp OTP settings saved.")
                      }
                    >
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        <label className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-3 text-sm text-text-primary">
                          <input type="checkbox" checked={otpSettingsForm.whatsapp.enabled} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, whatsapp: { ...p.whatsapp, enabled: e.target.checked } }))} />
                          Enable WhatsApp OTP
                        </label>
                        <Input label="Provider" value={otpSettingsForm.whatsapp.provider} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, whatsapp: { ...p.whatsapp, provider: e.target.value } }))} placeholder="MSG91 WhatsApp" />
                        <Input label="Auth Key / API Key" type="password" value={otpSettingsForm.whatsapp.authKey} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, whatsapp: { ...p.whatsapp, authKey: e.target.value } }))} helper="Paste provider auth key from MSG91 dashboard." />
                        <Input label="WhatsApp Template ID" value={otpSettingsForm.whatsapp.templateId} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, whatsapp: { ...p.whatsapp, templateId: e.target.value } }))} helper="Paste approved OTP template ID." />
                        <Input label="WhatsApp Business Number" value={otpSettingsForm.whatsapp.businessNumber} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, whatsapp: { ...p.whatsapp, businessNumber: e.target.value } }))} helper="WhatsApp Business API number connected to MSG91." />
                        <Select label="OTP Length" value={otpSettingsForm.whatsapp.otpLength} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, whatsapp: { ...p.whatsapp, otpLength: e.target.value } }))} helper="Must match your approved template." options={[{ value: "4", label: "4 digits" }, { value: "6", label: "6 digits" }]} />
                      </div>
                    </SettingsSectionCard>
                  </div>

                  <div className={isControlSectionVisible("register-page") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
                    <SettingsSectionCard
                      title="Email OTP Settings"
                      description="Enable Email OTP using MSG91 Email, Brevo, AWS SES, or existing SMTP."
                      saveLabel="Save Email Settings"
                      saveButtonId="save-auth-settings-email"
                      isSaving={savingSettingsKey === "otp-email"}
                      onSave={() =>
                        saveOtpSettingsCard("otp-email", "/admin/auth-settings/email", {
                          enabled: otpSettingsForm.email.enabled,
                          provider: otpSettingsForm.email.provider,
                          apiKey: otpSettingsForm.email.apiKey,
                          senderEmail: otpSettingsForm.email.senderEmail,
                          senderName: otpSettingsForm.email.senderName,
                          templateId: otpSettingsForm.email.templateId,
                          otpLength: otpSettingsForm.email.otpLength,
                        }, "Email OTP settings saved.")
                      }
                    >
                      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                        <label className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-3 text-sm text-text-primary">
                          <input type="checkbox" checked={otpSettingsForm.email.enabled} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, email: { ...p.email, enabled: e.target.checked } }))} />
                          Enable Email OTP
                        </label>
                        <Select label="Provider" value={otpSettingsForm.email.provider} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, email: { ...p.email, provider: e.target.value } }))} options={["MSG91 Email", "Brevo", "AWS SES", "Custom SMTP"].map((value) => ({ value, label: value }))} />
                        <Input label="API Key" type="password" value={otpSettingsForm.email.apiKey} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, email: { ...p.email, apiKey: e.target.value } }))} helper="Paste provider auth key from MSG91 dashboard." />
                        <Input label="Sender Email" type="email" value={otpSettingsForm.email.senderEmail} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, email: { ...p.email, senderEmail: e.target.value } }))} helper="Verified sender email like support@visavo.in." />
                        <Input label="Sender Name" value={otpSettingsForm.email.senderName} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, email: { ...p.email, senderName: e.target.value } }))} />
                        <Input label="Email Template ID" value={otpSettingsForm.email.templateId} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, email: { ...p.email, templateId: e.target.value } }))} helper="Paste approved OTP template ID." />
                        <Select label="OTP Length" value={otpSettingsForm.email.otpLength} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, email: { ...p.email, otpLength: e.target.value } }))} helper="Must match your approved template." options={[{ value: "4", label: "4 digits" }, { value: "6", label: "6 digits" }]} />
                      </div>
                    </SettingsSectionCard>
                  </div>

                  <div className={isControlSectionVisible("register-page") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
                    <SettingsSectionCard
                      title="OTP Priority & Fallback Settings"
                      description="Choose which enabled OTP channel should be attempted first, then fallback order."
                      saveLabel="Save Priority Settings"
                      saveButtonId="save-auth-settings-priority"
                      isSaving={savingSettingsKey === "otp-priority"}
                      onSave={() => saveOtpSettingsCard("otp-priority", "/admin/auth-settings/priority", otpSettingsForm.priority, "OTP priority settings saved.")}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Select label="Primary OTP Channel" value={otpSettingsForm.priority.primary} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, priority: { ...p.priority, primary: e.target.value } }))} options={[{ value: "whatsapp", label: "WhatsApp" }, { value: "sms", label: "SMS" }, { value: "email", label: "Email" }]} />
                        <Select label="Fallback Channel 1" value={otpSettingsForm.priority.fallback1} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, priority: { ...p.priority, fallback1: e.target.value } }))} options={[{ value: "sms", label: "SMS" }, { value: "email", label: "Email" }, { value: "whatsapp", label: "WhatsApp" }, { value: "none", label: "None" }]} />
                        <Select label="Fallback Channel 2" value={otpSettingsForm.priority.fallback2} onChange={(e) => setOtpSettingsForm((p) => ({ ...p, priority: { ...p.priority, fallback2: e.target.value } }))} options={[{ value: "email", label: "Email" }, { value: "sms", label: "SMS" }, { value: "whatsapp", label: "WhatsApp" }, { value: "none", label: "None" }]} />
                      </div>
                    </SettingsSectionCard>
                  </div>

                  <div className={isControlSectionVisible("register-page") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
                    <SettingsSectionCard
                      title="Firebase - web app + server verification"
                      description="Paste the Firebase web app fields below for the client. The service account private key is not stored here - set FIREBASE_SERVICE_ACCOUNT_JSON on the server (e.g. server/.env) and restart the API."
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
                              ? "Server has Admin JSON in env - finish the web fields above and save."
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
                        <Input label="API Key - paste here" type="password" value={settingsForm.firebaseApiKey} onChange={(e) => setSettingsForm((p) => ({ ...p, firebaseApiKey: e.target.value }))} id="setting-firebase-api-key" />
                        <Input label="Auth Domain - paste here" value={settingsForm.firebaseAuthDomain} onChange={(e) => setSettingsForm((p) => ({ ...p, firebaseAuthDomain: e.target.value }))} id="setting-firebase-auth-domain" placeholder="your-project.firebaseapp.com" helper="Must be your-project-id.firebaseapp.com from Firebase → Project settings → Web app (never your Vercel/Render URL). Putting a deploy URL here breaks OAuth: Google sends you to that-host/__/auth/handler and you get 404. Authorized domains is separate - add Render hostname there." />
                        <Input label="Project ID - paste here" value={settingsForm.firebaseProjectId} onChange={(e) => setSettingsForm((p) => ({ ...p, firebaseProjectId: e.target.value }))} id="setting-firebase-project-id" />
                        <Input label="App ID - paste here" type="password" value={settingsForm.firebaseAppId} onChange={(e) => setSettingsForm((p) => ({ ...p, firebaseAppId: e.target.value }))} id="setting-firebase-app-id" />
                        <Input label="Storage bucket - paste here" value={settingsForm.firebaseStorageBucket} onChange={(e) => setSettingsForm((p) => ({ ...p, firebaseStorageBucket: e.target.value }))} id="setting-firebase-storage-bucket" />
                        <Input label="Messaging sender ID - paste here" value={settingsForm.firebaseMessagingSenderId} onChange={(e) => setSettingsForm((p) => ({ ...p, firebaseMessagingSenderId: e.target.value }))} id="setting-firebase-sender-id" />
                      </div>
                      <div className="mt-4 rounded-xl border border-border bg-surface-2/80 px-4 py-3 text-xs text-text-secondary leading-relaxed">
                        <p className="font-medium text-text-primary mb-1">Service account (server only)</p>
                        <p>
                          Set environment variable <code className="text-cyan">FIREBASE_SERVICE_ACCOUNT_JSON</code> on the machine that runs this API (see <code className="text-cyan">server/.env.example</code>). Value is the full JSON object as a string. After changing env, restart the server. Current API process:{" "}
                          <span className={settingsForm.firebaseAdminFromEnv ? "text-emerald-400 font-medium" : "text-amber-300 font-medium"}>
                            {settingsForm.firebaseAdminFromEnv ? "variable is set" : "variable not detected - Google / token login will fail until set"}
                          </span>
                          .
                        </p>
                      </div>
                    </SettingsSectionCard>
                  </div>

                  {/* Google OAuth Section Hidden 
                  <div className={isControlSectionVisible("register-page") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
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
                        <Input label="Client ID - paste here" value={settingsForm.googleClientId} onChange={(e) => setSettingsForm((p) => ({ ...p, googleClientId: e.target.value }))} id="setting-google-client-id" placeholder="....apps.googleusercontent.com" />
                        <Input label="Client secret - paste here" type="password" value={settingsForm.googleClientSecret} onChange={(e) => setSettingsForm((p) => ({ ...p, googleClientSecret: e.target.value }))} id="setting-google-client-secret" placeholder="GOCSPX-..." />
                      </div>
                    </SettingsSectionCard>
                  </div>
                  */}

                  {/* ======================================
              TAB: TRANSACTIONS
              ====================================== */}
          <div className={isControlSectionVisible("transactions") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>{true && <PaymentsPage transactions={transactions} />}</div>
          {false && activeTab === "transactions" && (
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
                              {fmtDate(tx.createdAt)}
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

          {/* ======================================
              TAB 1: ANALYTICS
              ====================================== */}
          <div className={isControlSectionVisible("analytics") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>{true && <AnalyticsPage bookings={bookings} activeChart={activeChart} setActiveChart={setActiveChart} liveAnalytics={liveAnalytics} />}</div>
          {false && activeTab === "analytics" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Bookings",  value: liveAnalytics.total,           icon: FileText,   color: "text-cyan",        bg: "bg-cyan/10",          suffix: "" },
                  { label: "Total Revenue",   value: `₹${liveAnalytics.revenue}`,   icon: IndianRupee, color: "text-gold",        bg: "bg-gold/10",          suffix: "" },
                  { label: "Pending Review", value: liveAnalytics.pendingReview,          icon: Clock,      color: "text-amber-400",   bg: "bg-amber-500/10",     suffix: "" },
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
                  { label: "Under Review",count: bookings.filter(b=>{
                      const progress = getApplicationProgress(b, settingsForm);
                      return resolveApplicationStatus(b, progress) === "review";
                    }).length, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
                  { label: "Pending Review", count: bookings.filter(b=>{
                      const progress = getApplicationProgress(b, settingsForm);
                      return resolveApplicationStatus(b, progress) === "doc_pending";
                    }).length, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
                  { label: "Pending", count: bookings.filter(b=>{
                      const progress = getApplicationProgress(b, settingsForm);
                      const status = resolveApplicationStatus(b, progress);
                      return status === "dash" || status === "pending";
                    }).length, color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
                  { label: "Rejected",    count: bookings.filter(b=>b.status==="rejected").length,  color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/20" },
                ].map(({ label, count, color, bg, border }) => (
                  <div key={label} className={`${bg} border ${border} rounded-xl p-4 text-center`}>
                    <div className={`text-3xl font-bold ${color}`}>{count}</div>
                    <div className="text-xs text-text-muted mt-1">{label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ======================================
              TAB 2: APPLICATIONS TABLE
              ====================================== */}
          <div className={isControlSectionVisible("applications") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>{true && (
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
                      <option value="dash">Not Paid</option>
                      <option value="doc_pending">Pending Review</option>
                      <option value="review">Under Review</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                {/* Table - horizontally scrollable on mobile */}
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
                      {filteredBookings.map((b) => {
                        const progress = getApplicationProgress(b, settingsForm);
                        const transactionId =
                          b.transactionId && b.transactionId !== "pending" ? b.transactionId : "";
                        return (
                          <tr key={b._id || b.id} className="hover:bg-surface-3/50 transition-colors group">
                          <td className="py-3 pr-6 font-mono text-xs text-text-muted whitespace-nowrap">
                            {b.applicationId || b._id || b.id}
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
                                {transactionId || "No transaction yet"}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 pr-6">
                            {(() => {
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
                            <StatusBadge status={resolveApplicationStatus(b, progress)} />
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
                      );
                    })}
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
                    <button className="px-3 py-1.5 text-xs rounded-lg bg-surface-3 text-text-muted hover:text-text-primary transition-colors" id="admin-prev-page">Prev</button>
                    <button className="px-3 py-1.5 text-xs rounded-lg bg-cyan text-background font-medium" id="admin-page-1">1</button>
                    <button className="px-3 py-1.5 text-xs rounded-lg bg-surface-3 text-text-muted hover:text-text-primary transition-colors" id="admin-next-page">Next</button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}</div>

<Card className={isControlSectionVisible("site-logo") ? "" : "hidden"}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="font-semibold text-text-primary flex items-center gap-2">
                            <ImageIcon size={18} className="text-cyan" />
                            Site Logo
                          </h2>
                        </div>
                        <p className="text-xs text-text-muted mt-1.5 max-w-2xl leading-relaxed">
                          Upload one shared brand logo for the public site, user dashboard, admin panel, and footer. Removing it restores the built-in default logo everywhere.
                        </p>
                        <p className="text-xs text-text-muted mt-3 leading-relaxed">
                          Format: <span className="text-text-primary font-medium">WEBP</span> ? File size: <span className="text-text-primary font-medium">under 50 KB</span> ? Recommended dimensions: <span className="text-text-primary font-medium">480 x 160 px</span> or <span className="text-text-primary font-medium">600 x 180 px</span> with tight crop and no extra transparent padding.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="rounded-2xl border border-border bg-surface-2/20 p-4">
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <input
                              type="file"
                              accept="image/webp"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                const ok = handleSiteLogoFileChange(file);
                                if (!ok) e.target.value = "";
                              }}
                              className="text-sm"
                            />
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={!String(settingsForm.footerLogo || "").trim()}
                              onClick={() => setSettingsForm((prev) => ({ ...prev, footerLogo: "" }))}
                            >
                              Remove Logo
                            </Button>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon={<Save size={15} />}
                              loading={savingSettingsKey === "site-logo"}
                              onClick={() =>
                                saveSettingsPartial(
                                  "site-logo",
                                  { footerLogo: settingsForm.footerLogo },
                                  "Site logo updated successfully."
                                )
                              }
                            >
                              Save Site Logo
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-background p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">
                          Preview
                        </p>
                        <div className="min-h-[120px] rounded-xl border border-border bg-white px-4 py-5 flex items-center">
                          <img
                            src={settingsForm.footerLogo || "/images/visa-voyage-logo.webp"}
                            alt="Site logo preview"
                            className="block h-16 w-auto object-contain"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card className={isControlSectionVisible("upload-methods") ? "" : "hidden"}>
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
                              showTravelerDetails: settingsForm.showTravelerDetails,
                              allowedFileFormats: settingsForm.allowedFileFormats,
                            },
                            "Document upload and traveler visibility options saved."
                          )
                        }
                      >
                        Save controls
                      </Button>
                    </div>

                    <div className="space-y-6">
                  <div className="bg-surface-2 border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-text-primary border-b border-border pb-3 mb-4 flex items-center gap-2">
                      <UploadCloud size={18} className="text-cyan" />
                      Document Upload Methods
                    </h3>
                    <p className="text-xs text-text-muted mb-6">
                      Turn on one or both options. With both on, applicants see file uploads and Google Drive on the same screen-they can use either method (all files or one Drive link per traveler). Turn both upload methods off to hide document uploads until you enable at least one. Use <span className="text-text-primary font-medium">Save upload options</span> at the top when you are done - only that section is saved.
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

                      <label className="hidden items-center justify-between bg-background p-4 rounded-xl border border-border cursor-pointer hover:border-cyan/30 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-text-primary">Traveler Details Section</p>
                          <p className="text-xs text-text-muted mt-0.5">Show or hide the My Travelers section in the user dashboard</p>
                        </div>
                        <div className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 ${settingsForm.showTravelerDetails ? 'bg-emerald-500' : 'bg-surface-3 border border-border'}`}>
                          <input 
                            type="checkbox" 
                            className="sr-only" 
                            checked={settingsForm.showTravelerDetails}
                            onChange={(e) => setSettingsForm((p) => ({ ...p, showTravelerDetails: e.target.checked }))}
                          />
                          <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${settingsForm.showTravelerDetails ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </label>

                      {/* Allowed File Formats */}
                      <div className="mt-6 border-t border-border pt-6">
                        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                          Allowed File Formats
                        </h4>
                        <p className="text-[11px] text-text-muted mb-4">
                          Select which file formats are allowed for document uploads. Checked formats will be allowed, unchecked formats will be hidden and blocked.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {["pdf", "jpg", "jpeg", "png"].map((format) => {
                            const isChecked = Array.isArray(settingsForm.allowedFileFormats) && settingsForm.allowedFileFormats.includes(format);
                            return (
                              <label
                                key={format}
                                htmlFor={`allowed-format-checkbox-${format}`}
                                className="flex items-center gap-3 bg-background p-3 rounded-xl border border-border cursor-pointer hover:border-cyan/30 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  id={`allowed-format-checkbox-${format}`}
                                  className="w-4 h-4 rounded border-border text-cyan focus:ring-cyan bg-surface-2 focus:ring-offset-background"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setSettingsForm((p) => {
                                      const current = Array.isArray(p.allowedFileFormats)
                                        ? p.allowedFileFormats
                                        : ["pdf", "jpg", "jpeg", "png"];
                                      const next = checked
                                        ? (current.includes(format) ? current : [...current, format])
                                        : current.filter((x) => x !== format);
                                      return { ...p, allowedFileFormats: next };
                                    });
                                  }}
                                />
                                <span className="text-sm font-medium text-text-primary uppercase">
                                  {format}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* ==========================================================
                  Universal Visa Type control - sets `Settings.globalVisaType`
                  and resets every country's `useGlobalVisaType=true`. Admins
                  can later override one country individually in Country Manager.
                  The toggle in the header hides the Visa Type tile on every
                  public card / details page when switched off.
                  ========================================================== */}
              {isControlSectionVisible("fee-update-manager") ? (
                <div className="w-full max-w-none flex-1">
                  <FeeUpdateManager
                    isActive={isControlSectionVisible("fee-update-manager")}
                    showToast={showToast}
                    onFeesUpdated={fetchCountries}
                  />
                </div>
              ) : null}

              <div className={isControlSectionVisible("country-images") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
              <SettingsSectionCard
                title="Country images - Unsplash"
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
                      ? "Access Key is on file - you can fetch images into MongoDB below or run node fetchCountryImages.js on the server."
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
                    label="Access Key - paste here"
                    type="password"
                    value={settingsForm.unsplashAccessKey}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, unsplashAccessKey: e.target.value }))}
                    id="setting-unsplash-access-key"
                    placeholder="Required - used by Fetch buttons and fetchCountryImages.js"
                  />
                  <Input
                    label="Secret Key (optional)"
                    type="password"
                    value={settingsForm.unsplashSecretKey}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, unsplashSecretKey: e.target.value }))}
                    id="setting-unsplash-secret-key"
                    placeholder="OAuth only - not used by image script"
                  />
                </div>

                <div className="rounded-xl border border-border bg-surface-2/60 p-4 mt-5 space-y-3">
                  <p className="text-xs text-text-muted leading-relaxed">
                    Calls the Unsplash Search API the way the site does: <span className="text-text-primary font-medium">country name first</span> ("France", "France travel", ...), then famous-place phrases for that slug, then a few landmark fallbacks. No forced orientation unless you set <code className="text-text-secondary">UNSPLASH_ORIENTATION</code> in <code className="text-text-secondary">server/.env</code>. Results save to <span className="text-text-primary font-medium">Country.imageUrl</span>.
                    Work runs in batches (10 countries per request, repeated until done) with delays to respect rate limits - keep this tab open until the success toast.
                    Watch the status line below while it runs. In DevTools → Network, each <code className="text-text-secondary">refresh-unsplash-images</code> request completes one batch.
                    <span className="text-text-primary font-medium">Featured / trending</span> countries (the ones marked "Show as trending" in Country Manager - same list as the landing page) can be refreshed alone with landmark searches. "Fetch all" processes those first, then every other country.
                    You can use the Access Key above without saving first; saving stores it for CLI scripts.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      leftIcon={<ImageIcon size={15} />}
                      loading={unsplashFetchRunning}
                      disabled={unsplashFetchRunning}
                      onClick={() => runUnsplashImageFetch({ onlyMissing: false, onlyTrending: false, onlyActive: true })}
                      id="btn-unsplash-fetch-active"
                    >
                      Fetch images for active countries
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      leftIcon={<ImageIcon size={15} />}
                      loading={unsplashFetchRunning}
                      disabled={unsplashFetchRunning}
                      onClick={() => runUnsplashImageFetch({ onlyMissing: false, onlyTrending: false, onlyActive: false })}
                      id="btn-unsplash-fetch-all"
                    >
                      Fetch images for all countries
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
              </div>

              <div className={isControlSectionVisible("payments-razorpay") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
              <SettingsSectionCard
                title="Payments - Razorpay"
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
                      gstEnabled: settingsForm.gstEnabled,
                      gstRate: Number.isFinite(Number(settingsForm.gstRate))
                        ? Number(settingsForm.gstRate)
                        : 0,
                    },
                    "Razorpay and GST settings saved.",
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
                    placeholder="rzp_live_... or rzp_test_..."
                  />
                  <Input
                    label="Paste Key Secret here"
                    type="password"
                    value={settingsForm.razorpayKeySecret}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, razorpayKeySecret: e.target.value }))}
                    id="setting-razorpay-secret"
                  />
                </div>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={settingsForm.gstEnabled}
                      onChange={(e) => setSettingsForm((p) => ({ ...p, gstEnabled: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-cyan focus:ring-cyan/40"
                    />
                    <span>Apply GST globally</span>
                  </label>
                  <Input
                    label="GST rate (%)"
                    type="number"
                    value={settingsForm.gstRate}
                    min={0}
                    max={100}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, gstRate: e.target.value }))}
                    id="setting-gst-rate"
                    helper="Set the percentage applied to the service fee for all applications."
                  />
                </div>
              </SettingsSectionCard>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              <div
                className={
                  isControlSectionVisible("searchbar")
                    ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch flex flex-col gap-6"
                    : "hidden"
                }
              >
                <Card>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="font-semibold text-text-primary">Searchbar Settings</h2>
                      <p className="text-xs text-text-muted">Manage searchbar configuration.</p>
                    </div>
                  </div>
                  <div className="bg-surface-2 border border-border rounded-xl p-8 text-center text-text-muted">
                    Searchbar settings coming soon!
                  </div>
                </Card>

                <Card>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="font-semibold text-text-primary">Filter Settings</h2>
                      <p className="text-xs text-text-muted">Manage search filter options.</p>
                    </div>
                  </div>
                  <div className="bg-surface-2 border border-border rounded-xl p-8 text-center text-text-muted">
                    Filter settings coming soon!
                  </div>
                </Card>
              </div>

              <div className={isControlSectionVisible("calendar-manager") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
                <Card>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="font-semibold text-text-primary">Calendar Manager</h2>
                      <p className="text-xs text-text-muted">Manage available dates and slots.</p>
                    </div>
                  </div>
                  <div className="bg-surface-2 border border-border rounded-xl p-8 text-center text-text-muted">
                    Calendar Manager coming soon!
                  </div>
                </Card>
              </div>

              <div className={isControlSectionVisible("traveler-form-manager") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
                <Card>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="font-semibold text-text-primary">Traveler Form Manager</h2>
                      <p className="text-xs text-text-muted">Manage traveler form fields and requirements.</p>
                    </div>
                  </div>
                  <div className="bg-surface-2 border border-border rounded-xl p-8 text-center text-text-muted">
                    Traveler Form Manager coming soon!
                  </div>
                </Card>
              </div>

              <div className={isControlSectionVisible("upload-methods") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
                <Card>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="font-semibold text-text-primary">Document Upload Methods</h2>
                      <p className="text-xs text-text-muted">Manage methods for document uploading.</p>
                    </div>
                  </div>
                  <div className="bg-surface-2 border border-border rounded-xl p-8 text-center text-text-muted">
                    Document Upload Methods coming soon!
                  </div>
                </Card>
              </div>

              <div className={isControlSectionVisible("application-documents") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
                <Card>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="font-semibold text-text-primary">Documents Required</h2>
                      <p className="text-xs text-text-muted">Manage required document types.</p>
                    </div>
                    <DisplayToggle
                      active={displayToggles.showDestinationRequiredDocs}
                      busy={togglingDisplayKey === "showDestinationRequiredDocs"}
                      onClick={() => runToggleDisplay("showDestinationRequiredDocs")}
                      labelOn="Visible"
                      labelOff="Hidden"
                    />
                  </div>
                  <div className="bg-surface-2 border border-border rounded-xl p-8 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveControlGroupKey("cards");
                        setActiveControlNavKey("visa-details-table");
                        setExpandedControlTabKeys({ "section-cards": true, "visa-details-and-fee-manager": true });
                        selectControlSection("visa-details-table");
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-cyan px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-cyan/90"
                    >
                      Edit Documents
                    </button>
                  </div>
                </Card>
              </div>

              <div className={isControlSectionVisible("application-documents") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
                <Card>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="font-semibold text-text-primary">Optional Document</h2>
                      <p className="text-xs text-text-muted">Manage optional document types.</p>
                    </div>
                    <DisplayToggle
                      active={displayToggles.showDestinationOptionalDocs}
                      busy={togglingDisplayKey === "showDestinationOptionalDocs"}
                      onClick={() => runToggleDisplay("showDestinationOptionalDocs")}
                      labelOn="Visible"
                      labelOff="Hidden"
                    />
                  </div>
                  <div className="bg-surface-2 border border-border rounded-xl p-8 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveControlGroupKey("cards");
                        setActiveControlNavKey("visa-details-table");
                        setExpandedControlTabKeys({ "section-cards": true, "visa-details-and-fee-manager": true });
                        selectControlSection("visa-details-table");
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-cyan px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-cyan/90"
                    >
                      Edit Documents
                    </button>
                  </div>
                </Card>
              </div>

              <div className={isControlSectionVisible("documents") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
                <Card>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="font-semibold text-text-primary">Documents Required</h2>
                      <p className="text-xs text-text-muted">Manage global document types.</p>
                    </div>
                    <DisplayToggle
                      active={displayToggles.showDestinationDocuments}
                      busy={togglingDisplayKey === "showDestinationDocuments"}
                      onClick={() => runToggleDisplay("showDestinationDocuments")}
                      labelOn="Visible"
                      labelOff="Hidden"
                    />
                  </div>
                  <div className="bg-surface-2 border border-border rounded-xl p-8 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveControlGroupKey("cards");
                        setActiveControlNavKey("visa-details-table");
                        setExpandedControlTabKeys({ "section-cards": true, "visa-details-and-fee-manager": true });
                        selectControlSection("visa-details-table");
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-cyan px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-cyan/90"
                    >
                      Edit Documents
                    </button>
                  </div>
                </Card>
              </div>

              <div className={isControlSectionVisible("testimonials") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
                <Card>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="font-semibold text-text-primary">Testimonials</h2>
                      <p className="text-xs text-text-muted">Manage customer testimonials and reviews.</p>
                    </div>
                  </div>
                  <div className="bg-surface-2 border border-border rounded-xl p-8 text-center text-text-muted">
                    Testimonials management coming soon!
                  </div>
                </Card>
              </div>

              <div
                className={
                  isControlSectionVisible("landing-highlights")
                    ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch"
                    : "hidden"
                }
              >
              <Card className="w-full max-w-none flex-1 self-stretch">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-semibold text-text-primary flex items-center gap-2">
                        <FileText size={18} className="text-cyan" />
                        Landing Page Highlights
                      </h2>
                    </div>
                    <p className="text-xs text-text-muted mt-1.5 max-w-2xl leading-relaxed">
                      Manage the highlight cards displayed below the search bar on the landing page.
                      The icon order stays the same on the client, while these
                      <span className="text-text-primary font-medium"> titles</span> and
                      <span className="text-text-primary font-medium"> descriptions</span> can be changed anytime from here.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="shrink-0"
                    leftIcon={<Save size={15} />}
                    loading={savingSettingsKey === "landing-highlights"}
                    onClick={() => {
                      const landingHeroHighlights = (settingsForm.landingHeroHighlights || []).map((item, index) => ({
                        icon: String(item?.icon ?? "").trim() || LANDING_HIGHLIGHT_ICONS[index],
                        title: String(item?.title ?? LANDING_HERO_HIGHLIGHTS_DEFAULT[index]?.title ?? "").trim(),
                        body: String(item?.body ?? LANDING_HERO_HIGHLIGHTS_DEFAULT[index]?.body ?? "").trim(),
                      }));
                      saveSettingsPartial("landing-highlights", { landingHeroHighlights }, "Landing page highlights updated successfully", "Failed to update landing page highlights");
                    }}
                  >
                    Save Landing Highlights
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-8">
                  {/* Left Side: Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-fit">
                    {(settingsForm.landingHeroHighlights || []).map((item, index) => (
                      <div key={`landing-highlight-${index}`} className="rounded-2xl border border-border bg-surface-2/60 p-4 space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                          Card {index + 1}
                        </p>
                        <Select
                          label="Icon"
                          value={item?.icon || LANDING_HIGHLIGHT_ICONS[index]}
                          onChange={(e) =>
                            setSettingsForm((p) => {
                              const next = [...(p.landingHeroHighlights || [])];
                              next[index] = { ...(next[index] || {}), icon: e.target.value };
                              return { ...p, landingHeroHighlights: next };
                            })
                          }
                          options={Object.keys(AVAILABLE_ICONS).map(k => ({ value: k, label: k }))}
                        />
                        <Input
                          label="Title"
                          value={item?.title ?? ""}
                          onChange={(e) =>
                            setSettingsForm((p) => {
                              const next = [...(p.landingHeroHighlights || [])];
                              next[index] = { ...(next[index] || {}), title: e.target.value };
                              return { ...p, landingHeroHighlights: next };
                            })
                          }
                          placeholder={LANDING_HERO_HIGHLIGHTS_DEFAULT[index]?.title || "Enter card title"}
                        />
                        <Textarea
                          label="Description"
                          rows={3}
                          value={item?.body ?? ""}
                          onChange={(e) =>
                            setSettingsForm((p) => {
                              const next = [...(p.landingHeroHighlights || [])];
                              next[index] = { ...(next[index] || {}), body: e.target.value };
                              return { ...p, landingHeroHighlights: next };
                            })
                          }
                          placeholder={LANDING_HERO_HIGHLIGHTS_DEFAULT[index]?.body || "Enter card description"}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Right Side: Live Preview */}
                  <div className="rounded-2xl border border-border bg-surface-2/30 p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-text-primary border-b border-border pb-3 flex items-center gap-2">
                      <ImageIcon size={16} className="text-cyan" />
                      Live Preview
                    </h3>
                    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                      <div className="grid gap-5 sm:grid-cols-2">
                        {(settingsForm.landingHeroHighlights || []).map((item, index) => {
                          const iconName = item?.icon || LANDING_HIGHLIGHT_ICONS[index] || "Zap";
                          const Icon = AVAILABLE_ICONS[iconName] || AVAILABLE_ICONS["Zap"];
                          const title = String(item?.title ?? "").trim() || LANDING_HERO_HIGHLIGHTS_DEFAULT[index]?.title;
                          const body = String(item?.body ?? "").trim() || LANDING_HERO_HIGHLIGHTS_DEFAULT[index]?.body;
                          return (
                            <div key={`preview-${index}`} className="flex items-start gap-3 px-1">
                              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-50 text-cyan">
                                <Icon size={18} />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[#16325f]">{title}</p>
                                <p className="mt-1 text-xs leading-5 text-[#7388a8]">{body}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
              </div>

              <div
                className={
                  isControlSectionVisible("blog-manager")
                    ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch"
                    : "hidden"
                }
              >
                <BlogAdminPanel />
              </div>

              <div
                className={
                  isControlSectionVisible("base-price")
                    ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch"
                    : "hidden"
                }
              >
              <Card className="w-full max-w-none flex-1 self-stretch">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-semibold text-text-primary flex items-center gap-2">
                        <IndianRupee size={18} className="text-cyan" />
                        Update Service Fee (universal)
                      </h2>
                      {serviceFeeHasUnsavedChanges && (
                        <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                          <span className="h-2 w-2 rounded-full bg-amber-300" />
                          Unsaved Changes
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-1.5 max-w-2xl leading-relaxed">
                      Sets one global <span className="text-text-primary font-medium">Service Fee</span> for every country.
                      Configure all three scopes first, then save them together in one final action.
                    </p>
                    <p className="text-[11px] text-text-muted mt-2">
                      Current global:{" "}
                      <span className="text-text-primary font-medium">
                        {formatPriceINR(globalDefaults.globalBasePrice)}
                      </span>
                      {globalDefaultStats.totalCountries > 0 && (
                        <>
                          {" "}· {globalDefaultStats.usingGlobalBasePrice}/{globalDefaultStats.totalCountries} countries use the global,{" "}
                          <span className="text-amber-400/90">{globalDefaultStats.overridingBasePrice}</span> override it.
                        </>
                        )}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="space-y-4">
                    <FeeScopeConfigSection
                      title="Single Country"
                      description="Pick one active country and define its service-fee override."
                      mode="single"
                      countries={allCountryOptions}
                      countryId={singleServiceFeeDraft.countryId}
                      onCountryIdChange={(countryId) =>
                        setSingleServiceFeeDraft((prev) => ({ ...prev, countryId }))
                      }
                      amount={singleServiceFeeDraft.amount}
                      onAmountChange={(value) =>
                        setSingleServiceFeeDraft((prev) => ({ ...prev, amount: value }))
                      }
                    />
                    <div className="rounded-2xl border border-border bg-surface/70 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-text-muted">
                          Save one country at a time here. Existing custom overrides stay independent and always win over the default all-countries fee.
                        </p>
                        <Button
                          variant="primary"
                          size="sm"
                          className="shrink-0"
                          leftIcon={<Save size={15} />}
                          loading={Boolean(
                            serviceFeeOverrideBusyId &&
                            serviceFeeOverrideBusyId === String(singleServiceFeeDraft.countryId || "").trim()
                          )}
                          disabled={serviceFeeOverridesLoading}
                          onClick={saveSingleServiceFeeOverride}
                        >
                          Save / Update
                        </Button>
                      </div>

                      <div className="mt-4 rounded-xl border border-border bg-background">
                        <div className="border-b border-border px-4 py-3">
                          <p className="text-sm font-medium text-text-primary">Selected Country Fee List</p>
                          <p className="mt-1 text-xs text-text-muted">
                            Removing an override makes that country use the default all-countries service fee again.
                          </p>
                        </div>
                        {serviceFeeOverridesLoading ? (
                          <div className="px-4 py-5 text-sm text-text-muted">Loading custom country fees...</div>
                        ) : serviceFeeCountryOverrides.length === 0 ? (
                          <div className="px-4 py-5 text-sm text-text-muted">No custom country service fees added yet.</div>
                        ) : (
                          <div className="divide-y divide-border">
                            {serviceFeeCountryOverrides.map((override) => {
                              const isBusy = serviceFeeOverrideBusyId === override.countryId;
                              return (
                                <div key={override.countryId} className="flex items-center justify-between gap-3 px-4 py-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-text-primary">{override.countryName}</p>
                                    <p className="mt-1 text-xs text-text-muted">{formatPriceINR(override.amount)}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={Boolean(serviceFeeOverrideBusyId && !isBusy)}
                                      onClick={() =>
                                        setSingleServiceFeeDraft({
                                          countryId: override.countryId,
                                          amount: String(override.amount),
                                        })
                                      }
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-rose-300 hover:text-rose-200"
                                      loading={isBusy}
                                      disabled={Boolean(serviceFeeOverrideBusyId && !isBusy)}
                                      onClick={() => removeSingleServiceFeeOverride(override.countryId)}
                                    >
                                      X Remove
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <FeeScopeConfigSection
                    title="Some Countries"
                    description="Choose multiple active countries that should share the same service fee."
                    mode="some"
                    countries={allCountryOptions}
                    countryIds={serviceFeeSaveAllDraft.someCountries.countryIds}
                    onCountryIdsChange={(countryIds) =>
                      setServiceFeeSaveAllDraft((prev) => ({
                        ...prev,
                        someCountries: { ...prev.someCountries, countryIds },
                      }))
                    }
                    amount={serviceFeeSaveAllDraft.someCountries.amount}
                    onAmountChange={(value) =>
                      setServiceFeeSaveAllDraft((prev) => ({
                        ...prev,
                        someCountries: { ...prev.someCountries, amount: value },
                      }))
                    }
                  />
                  <FeeScopeConfigSection
                    title="All Countries"
                    description="Set the shared service fee applied across all active countries."
                    mode="all"
                    countries={allCountryOptions}
                    amount={serviceFeeSaveAllDraft.allCountries.amount}
                    onAmountChange={(value) =>
                      setServiceFeeSaveAllDraft((prev) => ({
                        ...prev,
                        allCountries: { ...prev.allCountries, amount: value },
                      }))
                    }
                  />
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-text-muted">
                    Review the shared service-fee sections here, then save those changes together. Single-country custom overrides save instantly from the card above.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    className="shrink-0"
                    leftIcon={<Save size={15} />}
                    loading={savingControlKey === "base-price"}
                    disabled={!serviceFeeHasUnsavedChanges}
                    onClick={() => openFeeSaveModal("serviceFee")}
                  >
                    Save All Changes
                  </Button>
                </div>
              </Card>
              </div>

              <div
                className={
                  isControlSectionVisible("government-fee")
                    ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch"
                    : "hidden"
                }
              >
              <Card className="w-full max-w-none flex-1 self-stretch">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-semibold text-text-primary flex items-center gap-2">
                        <IndianRupee size={18} className="text-cyan" />
                        Update Government Fee (universal)
                      </h2>
                      {governmentFeeHasUnsavedChanges && (
                        <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                          <span className="h-2 w-2 rounded-full bg-amber-300" />
                          Unsaved Changes
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-1.5 max-w-2xl leading-relaxed">
                      Sets one global <span className="text-text-primary font-medium">Government Fee</span> for every country.
                      Configure all three scopes first, then save them together in one final action.
                    </p>
                    <p className="text-[11px] text-text-muted mt-2">
                      Current global:{" "}
                      <span className="text-text-primary font-medium">
                        {formatPriceINR(globalDefaults.globalGovernmentFee)}
                      </span>
                      {globalDefaultStats.totalCountries > 0 && (
                        <>
                          {" "}· {globalDefaultStats.usingGlobalGovernmentFee}/{globalDefaultStats.totalCountries} countries use the global,{" "}
                          <span className="text-amber-400/90">{globalDefaultStats.overridingGovernmentFee}</span> override it.
                        </>
                        )}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="space-y-4">
                    <FeeScopeConfigSection
                      title="Single Country"
                      description="Pick one active country and define its government-fee override."
                      mode="single"
                      countries={allCountryOptions}
                      countryId={singleGovernmentFeeDraft.countryId}
                      onCountryIdChange={(countryId) =>
                        setSingleGovernmentFeeDraft((prev) => ({ ...prev, countryId }))
                      }
                      amount={singleGovernmentFeeDraft.amount}
                      onAmountChange={(value) =>
                        setSingleGovernmentFeeDraft((prev) => ({ ...prev, amount: value }))
                      }
                    />
                    <div className="rounded-2xl border border-border bg-surface/70 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-text-muted">
                          Save one country at a time here. Existing custom overrides stay independent and always win over the default all-countries government fee.
                        </p>
                        <Button
                          variant="primary"
                          size="sm"
                          className="shrink-0"
                          leftIcon={<Save size={15} />}
                          loading={Boolean(
                            governmentFeeOverrideBusyId &&
                            governmentFeeOverrideBusyId === String(singleGovernmentFeeDraft.countryId || "").trim()
                          )}
                          disabled={governmentFeeOverridesLoading}
                          onClick={saveSingleGovernmentFeeOverride}
                        >
                          Save / Update
                        </Button>
                      </div>

                      <div className="mt-4 rounded-xl border border-border bg-background">
                        <div className="border-b border-border px-4 py-3">
                          <p className="text-sm font-medium text-text-primary">Selected Country Fee List</p>
                          <p className="mt-1 text-xs text-text-muted">
                            Removing an override makes that country use the default all-countries government fee again.
                          </p>
                        </div>
                        {governmentFeeOverridesLoading ? (
                          <div className="px-4 py-5 text-sm text-text-muted">Loading custom country fees...</div>
                        ) : governmentFeeCountryOverrides.length === 0 ? (
                          <div className="px-4 py-5 text-sm text-text-muted">No custom country government fees added yet.</div>
                        ) : (
                          <div className="divide-y divide-border">
                            {governmentFeeCountryOverrides.map((override) => {
                              const isBusy = governmentFeeOverrideBusyId === override.countryId;
                              return (
                                <div key={override.countryId} className="flex items-center justify-between gap-3 px-4 py-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-text-primary">{override.countryName}</p>
                                    <p className="mt-1 text-xs text-text-muted">{formatPriceINR(override.amount)}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={Boolean(governmentFeeOverrideBusyId && !isBusy)}
                                      onClick={() =>
                                        setSingleGovernmentFeeDraft({
                                          countryId: override.countryId,
                                          amount: String(override.amount),
                                        })
                                      }
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-rose-300 hover:text-rose-200"
                                      loading={isBusy}
                                      disabled={Boolean(governmentFeeOverrideBusyId && !isBusy)}
                                      onClick={() => removeSingleGovernmentFeeOverride(override.countryId)}
                                    >
                                      X Remove
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <FeeScopeConfigSection
                    title="Some Countries"
                    description="Choose multiple active countries that should share the same government fee."
                    mode="some"
                    countries={allCountryOptions}
                    countryIds={governmentFeeSaveAllDraft.someCountries.countryIds}
                    onCountryIdsChange={(countryIds) =>
                      setGovernmentFeeSaveAllDraft((prev) => ({
                        ...prev,
                        someCountries: { ...prev.someCountries, countryIds },
                      }))
                    }
                    amount={governmentFeeSaveAllDraft.someCountries.amount}
                    onAmountChange={(value) =>
                      setGovernmentFeeSaveAllDraft((prev) => ({
                        ...prev,
                        someCountries: { ...prev.someCountries, amount: value },
                      }))
                    }
                  />
                  <FeeScopeConfigSection
                    title="All Countries"
                    description="Set the shared government fee applied across all active countries."
                    mode="all"
                    countries={allCountryOptions}
                    amount={governmentFeeSaveAllDraft.allCountries.amount}
                    onAmountChange={(value) =>
                      setGovernmentFeeSaveAllDraft((prev) => ({
                        ...prev,
                        allCountries: { ...prev.allCountries, amount: value },
                      }))
                    }
                  />
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-text-muted">
                    Review all three government fee sections, then save everything together.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    className="shrink-0"
                    leftIcon={<Save size={15} />}
                    loading={savingControlKey === "government-fee"}
                    disabled={!governmentFeeHasUnsavedChanges}
                    onClick={() => openFeeSaveModal("governmentFee")}
                  >
                    Save All Changes
                  </Button>
                </div>
              </Card>
              </div>

              </div>
              {/* ==========================================================
                  Universal Required Documents control - admin picks the
                  catalog rows that apply to every country, can add custom
                  document types, and toggles the whole section on/off for
                  the public client.
                  ========================================================== */}
              <div className={isControlSectionVisible("required-docs") ? "" : "hidden"}>
              <ExpandableAdminControlCard {...getControlCardExpansionProps("required-docs")}>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-semibold text-text-primary flex items-center gap-2">
                        <FileText size={18} className="text-cyan" />
                        Documents Required (global)
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
                      <span className="text-text-primary font-medium">Update All Documents Required</span>{" "}
                      to apply it to every country. Per-country edits in{" "}
                      <span className="text-text-primary font-medium">Country Manager</span> are restored to the
                      global list. Need a new document type? Add it at the top - it appears in this checklist and on
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
                          {" "}? {globalDefaultStats.usingGlobalRequiredDocuments}/{globalDefaultStats.totalCountries} countries use the global,{" "}
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
                    Update All Documents Required
                  </Button>
                </div>

                <div className="mb-4 rounded-2xl border border-border bg-surface-2/40 p-4">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Required section copy</p>
                      <p className="mt-1 text-xs text-text-muted">Edits the main required-document heading and description on the public document section.</p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Save size={14} />}
                      loading={savingControlKey === "document-section-copy"}
                      onClick={runUpdateDocumentSectionCopy}
                    >
                      Save Copy
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      label="Heading"
                      value={globalDefaults.documentSectionCopy?.requiredHeading || ""}
                      onChange={(e) =>
                        setGlobalDefaults((prev) => ({
                          ...prev,
                          documentSectionCopy: {
                            ...prev.documentSectionCopy,
                            requiredHeading: e.target.value,
                          },
                        }))
                      }
                      placeholder="Documents Required"
                    />
                    <Textarea
                      label="Description"
                      rows={2}
                      value={globalDefaults.documentSectionCopy?.requiredDescription || ""}
                      onChange={(e) =>
                        setGlobalDefaults((prev) => ({
                          ...prev,
                          documentSectionCopy: {
                            ...prev.documentSectionCopy,
                            requiredDescription: e.target.value,
                          },
                        }))
                      }
                      placeholder="These are the country documents required for this application."
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const keys = documentCatalog.filter((d) => !d.deleted).map((d) => d.key);
                      setRequiredDocsDraft(keys);
                      setGlobalDefaults((prev) => {
                        const existing = Array.isArray(prev.globalRequiredDocumentEntries)
                          ? prev.globalRequiredDocumentEntries
                          : [];
                        const merged = [...existing];
                        keys.forEach((key) => {
                          if (!merged.some((entry) => entry.key === key)) {
                            merged.push(withCountryVisibilityMeta({ key }, activeCountryIds));
                          }
                        });
                        return { ...prev, globalRequiredDocumentEntries: merged };
                      });
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setRequiredDocsDraft([])}
                  >
                    Deselect All
                  </Button>
                </div>

                {/* Add custom document - admin types a label, server slugifies + prefixes. */}
                {/* Checkbox grid built from the merged catalog. */}
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {documentCatalog.filter((d) => !d.deleted).length === 0 && (
                    <p className="col-span-full text-sm text-text-muted">
                      No active documents available.
                    </p>
                  )}
                  {documentCatalog.filter((d) => !d.deleted).map((doc, index) => {
                    const { key, label, description, builtIn, icon } = doc;
                    const checked = requiredDocsDraft.includes(key);
                    const visibilityEntry =
                      (globalDefaults.globalRequiredDocumentEntries || []).find((item) => item.key === key) ||
                      withCountryVisibilityMeta({ key }, activeCountryIds);
                    const DocIcon = getDocumentIcon(key);
                    const isEditing = editingDocKey === key;
                    return (
                      <div
                        key={key}
                        className={`group relative rounded-2xl border p-4 transition-all duration-150 ${
                          checked
                            ? "border-cyan/60 bg-cyan/10"
                            : "border-border bg-surface-2 hover:border-cyan/30"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setRequiredDocsDraft((prev) => {
                              const exists = prev.includes(key);
                              if (!exists) {
                                setGlobalDefaults((current) => {
                                  const entries = Array.isArray(current.globalRequiredDocumentEntries)
                                    ? current.globalRequiredDocumentEntries
                                    : [];
                                  if (entries.some((entry) => entry.key === key)) return current;
                                  return {
                                    ...current,
                                    globalRequiredDocumentEntries: [
                                      ...entries,
                                      withCountryVisibilityMeta({ key }, activeCountryIds),
                                    ],
                                  };
                                });
                              }
                              return exists ? prev.filter((k) => k !== key) : [...prev, key];
                            })
                          }
                          className="flex w-full items-start gap-3 text-left pr-8"
                          id={`control-doc-toggle-${key}`}
                        >
                          <span
                            className={`mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                              checked ? "bg-cyan border-cyan" : "border-border"
                            }`}
                          >
                            {checked && <CheckCircle size={10} className="text-background" />}
                          </span>
                          <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${checked ? "bg-cyan/15 text-cyan" : "bg-background text-text-muted"}`}>
                            {icon ? (
                              <i className={`${icon} text-lg leading-none`} aria-hidden="true" />
                            ) : (
                              <DocIcon size={18} />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className={`truncate text-sm font-semibold ${checked ? "text-cyan" : "text-text-primary"}`} title={label}>
                                {label}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${builtIn ? "bg-background text-text-muted" : "bg-cyan/12 text-cyan"}`}>
                                {builtIn ? "built in" : "custom"}
                              </span>
                            </span>
                            <span className="mt-1 block text-xs leading-relaxed text-text-muted">
                              {description || "No helper description yet."}
                            </span>
                          </span>
                        </button>

                        {/* Absolutely positioned Edit Toggle button */}
                        <div className={`absolute right-3 top-3 flex items-center gap-1.5 transition-opacity duration-150 ${
                          isEditing ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
                        }`}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingDocKey((prev) => (prev === key ? null : key));
                            }}
                            className={`flex h-7 w-7 items-center justify-center rounded-full border bg-background transition-colors ${
                              isEditing
                                ? "border-cyan/40 text-cyan bg-cyan/5"
                                : "border-border text-text-muted hover:text-text-primary hover:bg-surface"
                            }`}
                            title={isEditing ? "Close Editor" : "Edit Metadata"}
                            aria-label="Edit Document Type"
                          >
                            {isEditing ? <X size={12} /> : <Edit3 size={12} />}
                          </button>
                        </div>

                        {/* Expandable Inline Editing Section */}
                        {isEditing && (
                          <div className="mt-4 pt-4 border-t border-border/40 grid gap-3" onClick={(e) => e.stopPropagation()}>
                            <Input
                              label="Document Title"
                              value={label}
                              onChange={(e) => {
                                const value = e.target.value;
                                setDocumentCatalog(prev => prev.map(d => d.key === key ? { ...d, label: value } : d));
                              }}
                              placeholder="Document name"
                            />
                            <Textarea
                              label="Description / Helper Text"
                              rows={2}
                              value={description}
                              onChange={(e) => {
                                const value = e.target.value;
                                setDocumentCatalog(prev => prev.map(d => d.key === key ? { ...d, description: value } : d));
                              }}
                              placeholder="Short document description shown to applicants"
                            />
                            {checked && (
                              <CountryVisibilitySelector
                                item={visibilityEntry}
                                activeCountries={activeCountryOptions}
                                itemLabel="this document"
                                onChange={(nextItem) =>
                                  setGlobalDefaults((prev) => {
                                    const nextEntries = Array.isArray(prev.globalRequiredDocumentEntries)
                                      ? [...prev.globalRequiredDocumentEntries]
                                      : [];
                                    const existingIndex = nextEntries.findIndex((entry) => entry.key === key);
                                    if (existingIndex >= 0) nextEntries[existingIndex] = nextItem;
                                    else nextEntries.push(nextItem);
                                    return { ...prev, globalRequiredDocumentEntries: nextEntries };
                                  })
                                }
                              />
                            )}
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                              <div className="w-full">
                                <Input
                                  label="Remix Icon Class"
                                  value={icon}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setDocumentCatalog(prev => prev.map(d => d.key === key ? { ...d, icon: value } : d));
                                  }}
                                  placeholder="ri-passport-line"
                                  list="custom-document-icon-suggestions"
                                />
                              </div>
                              <IconPickerPreviewButton
                                icon={icon}
                                fallbackIcon={DocIcon}
                                title={`Choose icon for ${label || "document type"}`}
                                onClick={() =>
                                  openIconPicker({
                                    type: "document-catalog",
                                    key,
                                  })
                                }
                              />
                              <div className="flex gap-2 shrink-0">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-[46px] px-4"
                                  loading={savingDocumentMetaKey === key}
                                  onClick={() => runSaveDocumentCatalogEntry(doc)}
                                  leftIcon={<Save size={14} />}
                                >
                                  Save
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  className="h-[46px] px-4"
                                  disabled={savingCustomDoc}
                                  onClick={() => runRemoveCustomDocument(key, label)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {requiredDocsDraft.length === 0 && (
                  <p className="text-xs text-amber-400 mt-3">
                    ?  With zero documents selected the public site will fall back to each country's stored override.
                  </p>
                )}

                {/* Add custom document - admin types a label, server slugifies + prefixes. */}
                <div className="mt-5 rounded-2xl border border-dashed border-border bg-surface-2/40 p-5 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Plus size={16} className="text-cyan" />
                      Add a custom document type
                    </h4>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      Custom document types will be added globally to the document library and can be assigned as a requirement for any country.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Document Label / Title"
                      placeholder='e.g. "Medical Insurance Certificate"'
                      value={newCustomDocLabel}
                      onChange={(e) => setNewCustomDocLabel(e.target.value)}
                      id="control-custom-doc-label"
                      className="w-full"
                    />
                    <Input
                      label="Description / Helper Text (Optional)"
                      placeholder="Optional short description shown to applicants"
                      value={newCustomDocDescription}
                      onChange={(e) => setNewCustomDocDescription(e.target.value)}
                      id="control-custom-doc-description"
                      className="w-full"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] items-end">
                    <div className="space-y-1.5 w-full">
                      <Input
                        label="Remix Icon Class (Optional)"
                        placeholder="ri-passport-line"
                        value={newCustomDocIcon}
                        onChange={(e) => setNewCustomDocIcon(e.target.value)}
                        id="control-custom-doc-icon"
                        list="custom-document-icon-suggestions"
                        className="w-full"
                      />
                      <datalist id="custom-document-icon-suggestions">
                        {REMIX_ICON_SUGGESTIONS.map((icon) => (
                          <option key={icon} value={icon} />
                        ))}
                      </datalist>
                    </div>

                    <IconPickerPreviewButton
                      icon={newCustomDocIcon}
                      fallbackIcon={FileText}
                      title="Choose icon for custom document"
                      onClick={() =>
                        openIconPicker({
                          type: "new-custom-document",
                        })
                      }
                    />

                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-[46px] px-6 shrink-0"
                      leftIcon={<Plus size={14} />}
                      loading={savingCustomDoc}
                      disabled={!newCustomDocLabel.trim()}
                      onClick={runAddCustomDocument}
                    >
                      Add to catalog
                    </Button>
                  </div>

                  <p className="text-[11px] text-text-muted leading-relaxed">
                    Custom types use a <span className="font-mono text-text-primary">custom_xxx</span> key under the hood. 
                    Removing a custom document type strips it from the catalog <span className="text-text-primary font-medium">and</span> every country referencing it.
                  </p>
                </div>
              </ExpandableAdminControlCard>
              </div>

              <div className={isControlSectionVisible("other-docs") ? "" : "hidden"}>
              <ExpandableAdminControlCard {...getControlCardExpansionProps("other-docs")}>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/40 pb-4 mb-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-semibold text-text-primary flex items-center gap-2">
                        <ScrollText size={18} className="text-cyan" />
                        Optional Documents (global)
                      </h2>
                    </div>
                    <p className="text-xs text-text-muted mt-1.5 max-w-2xl leading-relaxed">
                      Select optional supporting documents globally, then choose whether each one appears for all active countries or only selected countries. Catalog visibility still controls which document types are active anywhere.
                    </p>
                    <p className="text-[11px] text-text-muted mt-2">
                      Current optional:{" "}
                      <span className="text-text-primary font-medium">
                        {optionalDocsDraft.length
                          ? `${optionalDocsDraft.length} document${optionalDocsDraft.length === 1 ? "" : "s"}`
                          : "None selected"}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="shrink-0"
                      leftIcon={<Save size={15} />}
                      loading={savingControlKey === "catalog-visibility"}
                      onClick={runUpdateCatalogVisibility}
                    >
                      Save Catalog Visibility
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="shrink-0"
                      leftIcon={<Save size={15} />}
                      loading={savingControlKey === "optional-documents"}
                      onClick={runUpdateGlobalOptionalDocuments}
                    >
                      Update Optional Documents
                    </Button>
                  </div>
                </div>

                <div className="mb-4 rounded-2xl border border-border bg-surface-2/40 p-4">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Optional section copy</p>
                      <p className="mt-1 text-xs text-text-muted">Edits the main optional-document heading and description on the public document section.</p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Save size={14} />}
                      loading={savingControlKey === "document-section-copy"}
                      onClick={runUpdateDocumentSectionCopy}
                    >
                      Save Copy
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      label="Heading"
                      value={globalDefaults.documentSectionCopy?.optionalHeading || ""}
                      onChange={(e) =>
                        setGlobalDefaults((prev) => ({
                          ...prev,
                          documentSectionCopy: {
                            ...prev.documentSectionCopy,
                            optionalHeading: e.target.value,
                          },
                        }))
                      }
                      placeholder="Optional Documents"
                    />
                    <Textarea
                      label="Description"
                      rows={2}
                      value={globalDefaults.documentSectionCopy?.optionalDescription || ""}
                      onChange={(e) =>
                        setGlobalDefaults((prev) => ({
                          ...prev,
                          documentSectionCopy: {
                            ...prev.documentSectionCopy,
                            optionalDescription: e.target.value,
                          },
                        }))
                      }
                      placeholder="You can also attach other documents in the same Drive link."
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const keys = documentCatalog.filter((d) => !d.deleted).map((d) => d.key);
                      setOptionalDocsDraft(keys);
                      setGlobalDefaults((prev) => {
                        const existing = Array.isArray(prev.globalOptionalDocumentEntries)
                          ? prev.globalOptionalDocumentEntries
                          : [];
                        const merged = [...existing];
                        keys.forEach((key) => {
                          if (!merged.some((entry) => entry.key === key)) {
                            merged.push(withCountryVisibilityMeta({ key }, activeCountryIds));
                          }
                        });
                        return { ...prev, globalOptionalDocumentEntries: merged };
                      });
                    }}
                  >
                    Select All Optional
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setOptionalDocsDraft([])}
                  >
                    Deselect All Optional
                  </Button>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {documentCatalog.length === 0 && (
                    <p className="col-span-full text-sm text-text-muted">
                      Loading document catalog...
                    </p>
                  )}
                  {documentCatalog.map((doc, index) => {
                    const { key, label, description, builtIn, icon } = doc;
                    const catalogActive = selectedCatalogDocs.includes(key);
                    const checked = optionalDocsDraft.includes(key);
                    const visibilityEntry =
                      (globalDefaults.globalOptionalDocumentEntries || []).find((item) => item.key === key) ||
                      withCountryVisibilityMeta({ key }, activeCountryIds);
                    const DocIcon = getDocumentIcon(key);
                    const isEditing = editingCatalogDocKey === key;
                    return (
                      <div
                        key={key}
                        className={`group relative rounded-2xl border p-4 transition-all duration-150 ${
                          checked
                            ? "border-cyan/60 bg-cyan/10"
                            : "border-border bg-surface-2 hover:border-cyan/30"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOptionalDocsDraft((prev) => {
                              const exists = prev.includes(key);
                              if (!exists) {
                                setGlobalDefaults((current) => {
                                  const entries = Array.isArray(current.globalOptionalDocumentEntries)
                                    ? current.globalOptionalDocumentEntries
                                    : [];
                                  if (entries.some((entry) => entry.key === key)) return current;
                                  return {
                                    ...current,
                                    globalOptionalDocumentEntries: [
                                      ...entries,
                                      withCountryVisibilityMeta({ key }, activeCountryIds),
                                    ],
                                  };
                                });
                              }
                              return exists ? prev.filter((k) => k !== key) : [...prev, key];
                            });
                            setSelectedCatalogDocs((prev) => (prev.includes(key) ? prev : [...prev, key]));
                          }}
                          className="flex w-full items-start gap-3 text-left pr-8"
                          id={`control-catalog-doc-toggle-${key}`}
                        >
                          <span
                            className={`mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                              checked ? "bg-cyan border-cyan" : "border-border"
                            }`}
                          >
                            {checked && <CheckCircle size={10} className="text-background" />}
                          </span>
                          <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${checked ? "bg-cyan/15 text-cyan" : "bg-background text-text-muted"}`}>
                            {icon ? (
                              <i className={`${icon} text-lg leading-none`} aria-hidden="true" />
                            ) : (
                              <DocIcon size={18} />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className={`truncate text-sm font-semibold ${checked ? "text-cyan" : "text-text-primary"}`} title={label}>
                                {label}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${builtIn ? "bg-background text-text-muted" : "bg-cyan/12 text-cyan"}`}>
                                {builtIn ? "built in" : "custom"}
                              </span>
                              {!catalogActive && (
                                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-amber-300">
                                  hidden
                                </span>
                              )}
                            </span>
                            <span className="mt-1 block text-xs leading-relaxed text-text-muted">
                              {description || "No helper description yet."}
                            </span>
                          </span>
                        </button>

                        {/* Absolutely positioned Edit Toggle button */}
                        <div className={`absolute right-3 top-3 flex items-center gap-1.5 transition-opacity duration-150 ${
                          isEditing ? "opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
                        }`}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCatalogDocKey((prev) => (prev === key ? null : key));
                            }}
                            className={`flex h-7 w-7 items-center justify-center rounded-full border bg-background transition-colors ${
                              isEditing
                                ? "border-cyan/40 text-cyan bg-cyan/5"
                                : "border-border text-text-muted hover:text-text-primary hover:bg-surface"
                            }`}
                            title={isEditing ? "Close Editor" : "Edit Metadata"}
                            aria-label="Edit Document Type"
                          >
                            {isEditing ? <X size={12} /> : <Edit3 size={12} />}
                          </button>
                        </div>

                        {/* Expandable Inline Editing Section */}
                        {isEditing && (
                          <div className="mt-4 pt-4 border-t border-border/40 grid gap-3" onClick={(e) => e.stopPropagation()}>
                            <Input
                              label="Document Title"
                              value={label}
                              onChange={(e) => {
                                const value = e.target.value;
                                setDocumentCatalog(prev => prev.map(d => d.key === key ? { ...d, label: value } : d));
                              }}
                              placeholder="Document name"
                            />
                            <Textarea
                              label="Description / Helper Text"
                              rows={2}
                              value={description}
                              onChange={(e) => {
                                const value = e.target.value;
                                setDocumentCatalog(prev => prev.map(d => d.key === key ? { ...d, description: value } : d));
                              }}
                              placeholder="Short document description shown to applicants"
                            />
                            {checked && (
                              <CountryVisibilitySelector
                                item={visibilityEntry}
                                activeCountries={activeCountryOptions}
                                itemLabel="this optional document"
                                onChange={(nextItem) =>
                                  setGlobalDefaults((prev) => {
                                    const nextEntries = Array.isArray(prev.globalOptionalDocumentEntries)
                                      ? [...prev.globalOptionalDocumentEntries]
                                      : [];
                                    const existingIndex = nextEntries.findIndex((entry) => entry.key === key);
                                    if (existingIndex >= 0) nextEntries[existingIndex] = nextItem;
                                    else nextEntries.push(nextItem);
                                    return { ...prev, globalOptionalDocumentEntries: nextEntries };
                                  })
                                }
                              />
                            )}
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                              <div className="w-full">
                                <Input
                                  label="Remix Icon Class"
                                  value={icon}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setDocumentCatalog(prev => prev.map(d => d.key === key ? { ...d, icon: value } : d));
                                  }}
                                  placeholder="ri-passport-line"
                                  list="custom-document-icon-suggestions"
                                />
                              </div>
                              <IconPickerPreviewButton
                                icon={icon}
                                fallbackIcon={DocIcon}
                                title={`Choose icon for ${label || "document type"}`}
                                onClick={() =>
                                  openIconPicker({
                                    type: "document-catalog",
                                    key,
                                  })
                                }
                              />
                              <div className="flex gap-2 shrink-0">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-[46px] px-4"
                                  loading={savingDocumentMetaKey === key}
                                  onClick={() => runSaveDocumentCatalogEntry(doc)}
                                  leftIcon={<Save size={14} />}
                                >
                                  Save
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  className="h-[46px] px-4"
                                  disabled={savingCustomDoc}
                                  onClick={() => runRemoveCustomDocument(key, label)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ExpandableAdminControlCard>

              </div>

              <div className={isControlSectionVisible("static-pages") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
                <StaticPagesManager />
              </div>

              <div className={isControlSectionVisible("dynamic-page") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
                <Card>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="font-semibold text-text-primary">Dynamic Page</h2>
                      <p className="text-xs text-text-muted">Manage dynamic pages for the footer.</p>
                    </div>
                  </div>
                  <div className="bg-surface-2 border border-border rounded-xl p-8 text-center text-text-muted">
                    Dynamic Page management coming soon!
                  </div>
                </Card>
              </div>

              <div className={isControlSectionVisible("footer-description") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
              <Card>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-text-primary">Footer Description</h2>
                    <p className="text-xs text-text-muted mt-1.5">Edit the description text shown in the website footer.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-surface-2/20 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 min-w-0">
                      <Textarea
                        label="Footer Description"
                        rows={3}
                        value={settingsForm.footerDescription}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({ ...prev, footerDescription: e.target.value }))
                        }
                        placeholder="Your trusted partner for seamless visa applications worldwide. Fast, secure, and professionally managed."
                        helper="Leave blank to keep the current footer description."
                      />
                    </div>

                    <div className="w-full lg:w-[280px] rounded-2xl border border-border bg-background p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">
                        Preview
                      </p>
                      <div className="mb-3 flex items-center">
                        <img
                          src={settingsForm.footerLogo || "/images/visa-voyage-logo.webp"}
                          alt="Visa & Voyage"
                          className="block h-12 max-h-12 w-auto object-contain"
                        />
                      </div>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {String(settingsForm.footerDescription || "").trim() ||
                          "Your trusted partner for seamless visa applications worldwide. Fast, secure, and professionally managed."}
                      </p>
                      <Button
                        variant="primary"
                        size="sm"
                        className="mt-4 w-full"
                        leftIcon={<Save size={15} />}
                        loading={savingSettingsKey === "footer-content"}
                        onClick={() =>
                          saveSettingsPartial(
                            "footer-content",
                            {
                              footerDescription: settingsForm.footerDescription,
                            },
                            "Footer content updated successfully."
                          )
                        }
                      >
                        Save Footer Content
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
              </div>

              <div className={isControlSectionVisible("footer-social-icons") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
              <Card>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-text-primary">Footer Social Icons</h2>
                    <p className="text-xs text-text-muted mt-1">
                      Add, edit, delete, and enable or disable social icons without touching code.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="shrink-0"
                    leftIcon={<Plus size={15} />}
                    onClick={openCreateFooterSocialIconModal}
                  >
                    Add New Icon
                  </Button>
                </div>

                {footerSocialIconsLoading ? (
                  <div className="rounded-2xl border border-border bg-surface-2/40 px-4 py-10 text-center text-sm text-text-muted">
                    Loading footer social icons...
                  </div>
                ) : footerSocialIcons.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-surface-2/20 px-4 py-10 text-center">
                    <p className="text-sm font-medium text-text-primary">No footer social icons added yet.</p>
                    <p className="mt-1 text-xs text-text-muted">Create your first icon and it will appear automatically in the website footer when active.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {footerSocialIcons.map((icon) => {
                      const iconId = String(icon?._id || "");
                      const PreviewIcon = FOOTER_SOCIAL_ICON_COMPONENTS[normalizeFooterSocialIconType(icon?.type)] || LinkIcon;
                      const isBusy = footerSocialIconActionId === iconId;
                      return (
                        <div
                          key={iconId}
                          className="rounded-2xl border border-border bg-surface-2/20 p-4"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 text-cyan">
                                <PreviewIcon size={18} />
                              </div>
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-text-primary">{icon.label}</p>
                                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                    icon.isActive !== false
                                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                      : "bg-slate-500/10 text-text-muted border border-border"
                                  }`}>
                                    {icon.isActive !== false ? "Active" : "Inactive"}
                                  </span>
                                </div>
                                <p className="text-xs text-text-muted">
                                  {FOOTER_SOCIAL_ICON_TYPE_LABELS[normalizeFooterSocialIconType(icon.type)] || "Custom Link"}
                                </p>
                                <a
                                  href={icon.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex max-w-full items-center gap-1.5 text-xs text-cyan hover:text-cyan/80"
                                >
                                  <span className="truncate">
                                    {normalizeFooterSocialIconType(icon.type) === "email"
                                      ? normalizeFooterEmailValue(icon.url)
                                      : icon.url}
                                  </span>
                                  <ExternalLink size={12} className="shrink-0" />
                                </a>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                leftIcon={<Edit3 size={14} />}
                                onClick={() => openEditFooterSocialIconModal(icon)}
                                disabled={isBusy}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                leftIcon={isBusy ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
                                onClick={() => handleFooterSocialIconStatusToggle(icon)}
                                disabled={isBusy}
                              >
                                {icon.isActive !== false ? "Disable" : "Enable"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                leftIcon={isBusy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                onClick={() => deleteFooterSocialIconItem(icon)}
                                disabled={isBusy}
                                className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </Card>
              </div>

              <div className={isControlSectionVisible("password-update") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
                <Card>
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="font-semibold text-text-primary">Security</h2>
                  </div>
                  <p className="text-sm text-text-muted mb-6 leading-relaxed">
                    Change your admin login password. This is separate from API keys above - use <span className="text-text-primary font-medium">Change Password</span> only when updating credentials for this dashboard.
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
              </div>

              <div className={isControlSectionVisible("seo-manager") ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
                <Card>
                  <SeoManagerPanel
                    settings={settingsForm}
                    setSettings={setSettingsForm}
                    saveSettingsPartial={saveSettingsPartial}
                    savingSettingsKey={savingSettingsKey}
                    showToast={showToast}
                  />
                </Card>
              </div>

              <div className={isControlSectionVisible("maintenance-mode") ? "" : "hidden"}>
              <Card>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-semibold text-text-primary flex items-center gap-2">
                        <Settings size={18} className="text-cyan" />
                        Site maintenance mode
                      </h2>
                      <DisplayToggle
                        active={displayToggles.maintenanceModeEnabled}
                        busy={togglingDisplayKey === "maintenanceModeEnabled"}
                        onClick={() => runToggleDisplay("maintenanceModeEnabled")}
                        labelOn="Enabled on client"
                        labelOff="Disabled on client"
                      />
                    </div>
                    <p className="text-xs text-text-muted mt-1.5 max-w-2xl leading-relaxed">
                      Turn this on to temporarily replace the entire public client app with a maintenance screen.
                      The separate admin app stays available so you can switch the site back on after fixes.
                    </p>
                  </div>
                  <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                    displayToggles.maintenanceModeEnabled
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  }`}>
                    {displayToggles.maintenanceModeEnabled
                      ? "Public site currently shows the maintenance page."
                      : "Public site is live right now."}
                  </div>
                </div>
              </Card>
            </div>

              <div className={isControlSectionVisible("customer-support") ? "" : "hidden"}>
              <SettingsSectionCard
                title="Customer Support Widget"
                description="Redesign and manage the floating support widget. Set custom header titles, descriptions, and link the card directly to your active WhatsApp or custom helpdesk."
                saveLabel="Save Widget Settings"
                saveButtonId="save-customer-chat"
                isSaving={savingSettingsKey === "customer-chat"}
                onSave={() =>
                  saveSettingsPartial(
                    "customer-chat",
                    {
                      customerChatEnabled: settingsForm.customerChatEnabled,
                      customerChatMode: "external_link",
                      customerChatLink: settingsForm.customerChatLink,
                      customerChatTitle: settingsForm.customerChatTitle,
                      customerChatDescription: settingsForm.customerChatDescription,
                      customerChatHeaderTitle: settingsForm.customerChatHeaderTitle,
                      customerChatHeaderSubtitle: settingsForm.customerChatHeaderSubtitle,
                      whatsappTemplate: settingsForm.whatsappTemplate,
                    },
                    "Customer chat settings saved.",
                  )
                }
                statusSlot={(
                  <DisplayToggle
                    active={settingsForm.customerChatEnabled}
                    busy={savingSettingsKey === "customer-chat"}
                    onClick={() =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        customerChatEnabled: !prev.customerChatEnabled,
                      }))
                    }
                    labelOn="Widget active on client"
                    labelOff="Widget hidden on client"
                  />
                )}
              >
                <div className="space-y-6">
                  {/* Premium Link Input section */}
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md">
                        <MessageSquare className="h-5 w-5" />
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-text-primary">WhatsApp & Support Connection</h4>
                        <p className="text-xs text-text-muted">Users clicking the WhatsApp support button will be redirected to this link.</p>
                      </div>
                    </div>
                    <Input
                      id="customer-chat-link"
                      label="Paste WhatsApp Link Here"
                      placeholder="Paste your WhatsApp link (e.g. https://wa.me/91XXXXXXXXXX) or Support URL here..."
                      value={settingsForm.customerChatLink}
                      onChange={(e) => setSettingsForm((prev) => ({ ...prev, customerChatLink: e.target.value }))}
                      className="w-full focus:border-emerald-500 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Input
                      id="customer-chat-header-title"
                      label="Widget Header Title"
                      placeholder="Chat with us"
                      value={settingsForm.customerChatHeaderTitle}
                      onChange={(e) => setSettingsForm((prev) => ({ ...prev, customerChatHeaderTitle: e.target.value }))}
                    />
                    <Input
                      id="customer-chat-header-subtitle"
                      label="Widget Header Subtitle"
                      placeholder="We typically reply in a few minutes"
                      value={settingsForm.customerChatHeaderSubtitle}
                      onChange={(e) => setSettingsForm((prev) => ({ ...prev, customerChatHeaderSubtitle: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Input
                      id="customer-chat-title"
                      label="Default Button Title"
                      placeholder="Continue with Chat"
                      value={settingsForm.customerChatTitle}
                      onChange={(e) => setSettingsForm((prev) => ({ ...prev, customerChatTitle: e.target.value }))}
                    />
                    <Input
                      id="customer-chat-description"
                      label="CTA Description"
                      placeholder="Get instant support from our visa team"
                      value={settingsForm.customerChatDescription}
                      onChange={(e) => setSettingsForm((prev) => ({ ...prev, customerChatDescription: e.target.value }))}
                    />
                  </div>

                  <div className="w-full">
                    <Textarea
                      id="customer-chat-whatsapp-template"
                      label="WhatsApp Pre-filled Message Template"
                      placeholder="Hello Visa & Voyage..."
                      value={settingsForm.whatsappTemplate}
                      onChange={(e) => setSettingsForm((prev) => ({ ...prev, whatsappTemplate: e.target.value }))}
                      rows={6}
                      className="w-full font-mono text-sm leading-relaxed"
                    />
                    <div className="text-xs text-text-muted mt-2 space-y-1">
                      <p>You can use the following dynamic variables which will be replaced automatically based on the user's active context:</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <code className="px-1.5 py-0.5 rounded bg-surface-3 border border-border text-emerald-400 font-mono text-[10px] font-semibold">{"{{userName}}"}</code>
                        <code className="px-1.5 py-0.5 rounded bg-surface-3 border border-border text-emerald-400 font-mono text-[10px] font-semibold">{"{{country}}"}</code>
                        <code className="px-1.5 py-0.5 rounded bg-surface-3 border border-border text-emerald-400 font-mono text-[10px] font-semibold">{"{{visaType}}"}</code>
                        <code className="px-1.5 py-0.5 rounded bg-surface-3 border border-border text-emerald-400 font-mono text-[10px] font-semibold">{"{{travelDate}}"}</code>
                        <code className="px-1.5 py-0.5 rounded bg-surface-3 border border-border text-emerald-400 font-mono text-[10px] font-semibold">{"{{applicationId}}"}</code>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-xs text-text-muted leading-relaxed">
                  <span className="text-text-primary font-semibold">Support Center Tip: </span>
                  Connecting your active WhatsApp link enables instantaneous customer service with real-time feedback. You can customize the widget labels above at any time.
                </div>
              </SettingsSectionCard>
            </div>

            <div className={isControlSectionVisible("chat-support") ? "w-full max-w-none flex-1 self-stretch flex overflow-hidden" : "hidden"}>
                <SupportChatWorkspace />
              </div>

              <div className={(isControlSectionVisible("why-book-now") || isControlSectionVisible("whats-included") || isControlSectionVisible("how-it-works") || isControlSectionVisible("faqs") || isControlSectionVisible("visa-requirements")) ? "w-full max-w-none flex-1 xl:col-span-2 self-stretch" : "hidden"}>
              <Card className="w-full max-w-none flex-1 self-stretch">
                <div className="hidden flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-semibold text-text-primary flex items-center gap-2">
                        <BookOpen size={18} className="text-cyan" />
                        Destination pages (all countries)
                      </h2>
                      <DisplayToggle
                        active={displayToggles.showVisaRequirements}
                        busy={togglingDisplayKey === "showVisaRequirements"}
                        onClick={() => runToggleDisplay("showVisaRequirements")}
                        labelOn="Visible on client"
                        labelOff="Hidden on client"
                      />
                    </div>
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
                      if (
                        !validateCountryVisibilitySelection(settingsForm.destinationWhyBookNow, "Each 'Why book now' item", (item) => item?.selectedCountries) ||
                        !validateCountryVisibilitySelection(settingsForm.destinationIncludedItems, "Each included item", (item) => item?.selectedCountries) ||
                        !validateCountryVisibilitySelection(settingsForm.destinationFaqs, "Each FAQ", (item) => item?.selectedCountries) ||
                        !validateCountryVisibilitySelection(settingsForm.destinationHowItWorks, "Each 'How it works' step", (item) => item?.selectedCountries) ||
                        !validateCountryVisibilitySelection(settingsForm.destinationVisaRequirements, "Each visa requirement", (item) => item?.selectedCountries)
                      ) {
                        return;
                      }
                      const whyBookNow = settingsForm.destinationWhyBookNow
                        .map((s) => ({
                          text: String(s?.text ?? "").trim(),
                          showInAllActiveCountries: s?.showInAllActiveCountries !== false,
                          selectedCountries:
                            s?.showInAllActiveCountries !== false
                              ? [...activeCountryIds]
                              : normalizeCountrySelectorIds(s?.selectedCountries),
                        }))
                        .filter((s) => s.text);
                      const included = (settingsForm.destinationIncludedItems || [])
                        .map((x) => ({
                          title: String(x?.title ?? "").trim(),
                          description: String(x?.description ?? "").trim(),
                          icon: String(x?.icon ?? "").trim(),
                          color: String(x?.color ?? "blue").trim(),
                          showInAllActiveCountries: x?.showInAllActiveCountries !== false,
                          selectedCountries:
                            x?.showInAllActiveCountries !== false
                              ? [...activeCountryIds]
                              : normalizeCountrySelectorIds(x?.selectedCountries),
                        }))
                        .filter((x) => x.title);
                      const faqs = settingsForm.destinationFaqs
                        .map((f) => ({
                          question: String(f?.question ?? "").trim(),
                          answer: String(f?.answer ?? "").trim(),
                          showInAllActiveCountries: f?.showInAllActiveCountries !== false,
                          selectedCountries:
                            f?.showInAllActiveCountries !== false
                              ? [...activeCountryIds]
                              : normalizeCountrySelectorIds(f?.selectedCountries),
                        }))
                        .filter((f) => f.question && f.answer);
                      const howItWorks = settingsForm.destinationHowItWorks
                        .map((s) => ({
                          title: String(s?.title ?? "").trim(),
                          description: String(s?.description ?? "").trim(),
                          showInAllActiveCountries: s?.showInAllActiveCountries !== false,
                          selectedCountries:
                            s?.showInAllActiveCountries !== false
                              ? [...activeCountryIds]
                              : normalizeCountrySelectorIds(s?.selectedCountries),
                        }))
                        .filter((s) => s.title && s.description);
                      const visaRequirements = (settingsForm.destinationVisaRequirements || [])
                        .map((s) => ({
                          text: String(s?.text ?? "").trim(),
                          showInAllActiveCountries: s?.showInAllActiveCountries !== false,
                          selectedCountries:
                            s?.showInAllActiveCountries !== false
                              ? [...activeCountryIds]
                              : normalizeCountrySelectorIds(s?.selectedCountries),
                        }))
                        .filter((s) => s.text);
                      saveSettingsPartial(
                        "destination-content",
                        {
                          destinationWhyBookNow: whyBookNow,
                          destinationIncludedItems: included,
                          destinationFaqs: faqs,
                          destinationHowItWorks: howItWorks,
                          destinationVisaRequirements: visaRequirements,
                        },
                        "Destination copy saved - visible on all country pages.",
                      );
                    }}
                  >
                    Save destination copy
                  </Button>
                </div>


                <div className="min-w-0 w-full space-y-6">
                  <div className={isControlSectionVisible("why-book-now") ? "" : "hidden"}>
                  <ExpandableAdminControlCard previewHeight={360} {...getControlCardExpansionProps("destination-why-book-now")}>
                  <div className="bg-surface-2 border border-border rounded-xl p-5">
                    <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                        <BadgeCheck size={18} className="text-cyan" />
                        Why book now?
                      </h3>
                      <DisplayToggle
                        active={displayToggles.showWhyBookNow}
                        busy={togglingDisplayKey === "showWhyBookNow"}
                        onClick={() => runToggleDisplay("showWhyBookNow")}
                        labelOn="Visible"
                        labelOff="Hidden"
                      />
                    </div>
                    <p className="text-xs text-text-muted mb-4">
                      One reason per line. These appear on every destination page unless a specific country overrides them.
                    </p>
                    <div className="space-y-3 w-full max-w-none">
                      {(settingsForm.destinationWhyBookNow || []).map((item, idx) => (
                        <div key={`why-${idx}`} className="rounded-xl border border-border bg-background p-4 space-y-3">
                          <div className="flex gap-2 items-start">
                            <Input
                              className="flex-1"
                              value={item?.text ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setSettingsForm((p) => {
                                  const next = [...(p.destinationWhyBookNow || [])];
                                  next[idx] = { ...next[idx], text: v };
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
                          <CountryVisibilitySelector
                            item={item}
                            activeCountries={activeCountryOptions}
                            itemLabel="this reason"
                            onChange={(nextItem) =>
                              setSettingsForm((p) => {
                                const next = [...(p.destinationWhyBookNow || [])];
                                next[idx] = nextItem;
                                return { ...p, destinationWhyBookNow: next };
                              })
                            }
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
                            destinationWhyBookNow: [
                              ...(p.destinationWhyBookNow || []),
                              withCountryVisibilityMeta({ text: "" }, activeCountryIds),
                            ],
                          }))
                        }
                      >
                        Add reason
                      </Button>
                      <div className="pt-2">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          leftIcon={<Save size={14} />}
                          loading={savingSettingsKey === "destination-content"}
                          onClick={() =>
                            saveDestinationContentSection({
                              sectionKey: "why-book-now",
                              validationLabel: "Each 'Why book now' item",
                              payloadBuilder: buildDestinationWhyBookNowPayload,
                              payloadKey: "destinationWhyBookNow",
                              successMessage: "'Why book now' saved.",
                            })
                          }
                        >
                          Save This Section
                        </Button>
                      </div>
                    </div>
                  </div>
                  </ExpandableAdminControlCard>
                  </div>

                  <div className={isControlSectionVisible("whats-included") ? "" : "hidden"}>
                  <ExpandableAdminControlCard previewHeight={360} {...getControlCardExpansionProps("destination-whats-included")}>
                  <div className="bg-surface-2 border border-border rounded-xl p-5">
                    <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                        <CheckCircle size={18} className="text-cyan" />
                        What&apos;s included
                      </h3>
                      <DisplayToggle
                        active={displayToggles.showWhatsIncluded}
                        busy={togglingDisplayKey === "showWhatsIncluded"}
                        onClick={() => runToggleDisplay("showWhatsIncluded")}
                        labelOn="Visible"
                        labelOff="Hidden"
                      />
                    </div>
                    <p className="text-xs text-text-muted mb-4">
                      One bullet per line. Empty rows are ignored when you save.
                    </p>
                    <div className="space-y-6 w-full max-w-none">
                      {(settingsForm.destinationIncludedItems || []).map((item, idx) => (
                        <div key={`inc-${idx}`} className="rounded-xl border border-border bg-background p-4 space-y-4">
                           <div className="flex justify-between gap-2">
                            <p className="text-xs font-semibold text-text-muted">Item {idx + 1}</p>
                            <button
                              type="button"
                              className="text-xs text-red-400 hover:text-red-300"
                              onClick={() =>
                                setSettingsForm((p) => ({
                                  ...p,
                                  destinationIncludedItems: (p.destinationIncludedItems || []).filter((_, i) => i !== idx),
                                }))
                              }
                            >
                              Remove
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              label="Title"
                              value={item.title}
                              onChange={(e) => {
                                const v = e.target.value;
                                setSettingsForm((p) => {
                                  const next = [...(p.destinationIncludedItems || [])];
                                  next[idx] = { ...next[idx], title: v };
                                  return { ...p, destinationIncludedItems: next };
                                });
                              }}
                              placeholder="e.g. Dedicated visa specialist review"
                            />
                             <Select
                              label="Color"
                              value={item.color || 'blue'}
                              onChange={(e) => {
                                const v = e.target.value;
                                setSettingsForm((p) => {
                                  const next = [...(p.destinationIncludedItems || [])];
                                  next[idx] = { ...next[idx], color: v };
                                  return { ...p, destinationIncludedItems: next };
                                });
                              }}
                              options={[
                                { value: 'blue', label: 'Blue' },
                                { value: 'green', label: 'Green' },
                                { value: 'purple', label: 'Purple' },
                              ]}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              label="Icon Class (Remix Icon)"
                              value={item.icon}
                              onChange={(e) => {
                                const v = e.target.value;
                                setSettingsForm((p) => {
                                  const next = [...(p.destinationIncludedItems || [])];
                                  next[idx] = { ...next[idx], icon: v };
                                  return { ...p, destinationIncludedItems: next };
                                });
                              }}
                              placeholder="ri-shield-check-line"
                              list="remix-icon-suggestions"
                            />
                            <div className="flex items-end pb-1.5">
                              <IconPickerPreviewButton
                                icon={item.icon}
                                fallbackIcon={ShieldCheck}
                                className="min-w-0 w-10 h-10 rounded-lg bg-surface-2"
                                title={`Choose icon for ${item.title || "included item"}`}
                                onClick={() =>
                                  openIconPicker({
                                    type: "destination-included-item",
                                    index: idx,
                                  })
                                }
                              />
                            </div>
                          </div>

                          <Textarea
                            label="Description"
                            rows={2}
                            value={item.description}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSettingsForm((p) => {
                                const next = [...(p.destinationIncludedItems || [])];
                                next[idx] = { ...next[idx], description: v };
                                return { ...p, destinationIncludedItems: next };
                              });
                            }}
                            placeholder="Explain what's included..."
                          />
                          <CountryVisibilitySelector
                            item={item}
                            activeCountries={activeCountryOptions}
                            itemLabel="this item"
                            onChange={(nextItem) =>
                              setSettingsForm((p) => {
                                const next = [...(p.destinationIncludedItems || [])];
                                next[idx] = nextItem;
                                return { ...p, destinationIncludedItems: next };
                              })
                            }
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
                            destinationIncludedItems: [
                              ...(p.destinationIncludedItems || []),
                              withCountryVisibilityMeta({ title: "", description: "", icon: "", color: "blue" }, activeCountryIds),
                            ],
                          }))
                        }
                      >
                        Add item
                      </Button>
                      <div className="pt-2">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          leftIcon={<Save size={14} />}
                          loading={savingSettingsKey === "destination-content"}
                          onClick={() =>
                            saveDestinationContentSection({
                              sectionKey: "whats-included",
                              validationLabel: "Each included item",
                              payloadBuilder: buildDestinationIncludedPayload,
                              payloadKey: "destinationIncludedItems",
                              successMessage: "'What's included' saved.",
                            })
                          }
                        >
                          Save This Section
                        </Button>
                      </div>
                    </div>
                  </div>
                  </ExpandableAdminControlCard>
                  </div>

                  <div className={isControlSectionVisible("faqs") ? "" : "hidden"}>
                  <ExpandableAdminControlCard previewHeight={360} {...getControlCardExpansionProps("destination-faq")}>
                  <div className="bg-surface-2 border border-border rounded-xl p-5">
                    <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                        <HelpCircle size={18} className="text-cyan" />
                        FAQs
                      </h3>
                      <DisplayToggle
                        active={displayToggles.showFaqs}
                        busy={togglingDisplayKey === "showFaqs"}
                        onClick={() => runToggleDisplay("showFaqs")}
                        labelOn="Visible"
                        labelOff="Hidden"
                      />
                    </div>
                    <p className="text-xs text-text-muted mb-4">
                      Question and answer pairs. Incomplete pairs are skipped when you save.
                    </p>
                    <div className="space-y-6 w-full max-w-none">
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
                          <CountryVisibilitySelector
                            item={faq}
                            activeCountries={activeCountryOptions}
                            itemLabel="this FAQ"
                            onChange={(nextItem) =>
                              setSettingsForm((p) => {
                                const next = [...(p.destinationFaqs || [])];
                                next[idx] = nextItem;
                                return { ...p, destinationFaqs: next };
                              })
                            }
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
                            destinationFaqs: [
                              ...(p.destinationFaqs || []),
                              withCountryVisibilityMeta({ question: "", answer: "" }, activeCountryIds),
                            ],
                          }))
                        }
                      >
                        Add FAQ
                      </Button>
                      <div className="pt-2">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          leftIcon={<Save size={14} />}
                          loading={savingSettingsKey === "destination-content"}
                          onClick={() =>
                            saveDestinationContentSection({
                              sectionKey: "faq",
                              validationLabel: "Each FAQ",
                              payloadBuilder: buildDestinationFaqsPayload,
                              payloadKey: "destinationFaqs",
                              successMessage: "FAQs saved.",
                            })
                          }
                        >
                          Save This Section
                        </Button>
                      </div>
                    </div>
                  </div>
                  </ExpandableAdminControlCard>
                  </div>

                  <div className={isControlSectionVisible("how-it-works") ? "" : "hidden"}>
                  <ExpandableAdminControlCard previewHeight={360} {...getControlCardExpansionProps("destination-how-it-works")}>
                  <div className="bg-surface-2 border border-border rounded-xl p-5">
                    <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                        <ListChecks size={18} className="text-cyan" />
                        How it works
                      </h3>
                      <DisplayToggle
                        active={displayToggles.showHowItWorks}
                        busy={togglingDisplayKey === "showHowItWorks"}
                        onClick={() => runToggleDisplay("showHowItWorks")}
                        labelOn="Visible"
                        labelOff="Hidden"
                      />
                    </div>
                    <p className="text-xs text-text-muted mb-4">
                      Numbered steps shown above &quot;Document Requirements&quot; on every destination page. Step number is
                      auto-generated from order. Incomplete pairs are skipped when you save.
                    </p>
                    <div className="space-y-4 w-full max-w-none">
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
                            placeholder="e.g. Apply with VisaAndVoyage"
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
                          <CountryVisibilitySelector
                            item={step}
                            activeCountries={activeCountryOptions}
                            itemLabel="this step"
                            onChange={(nextItem) =>
                              setSettingsForm((p) => {
                                const next = [...(p.destinationHowItWorks || [])];
                                next[idx] = nextItem;
                                return { ...p, destinationHowItWorks: next };
                              })
                            }
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
                              withCountryVisibilityMeta({ title: "", description: "" }, activeCountryIds),
                            ],
                          }))
                        }
                      >
                        Add step
                      </Button>
                      <div className="pt-2">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          leftIcon={<Save size={14} />}
                          loading={savingSettingsKey === "destination-content"}
                          onClick={() =>
                            saveDestinationContentSection({
                              sectionKey: "how-it-works",
                              validationLabel: "Each 'How it works' step",
                              payloadBuilder: buildDestinationHowItWorksPayload,
                              payloadKey: "destinationHowItWorks",
                              successMessage: "'How it works' saved.",
                            })
                          }
                        >
                          Save This Section
                        </Button>
                      </div>
                    </div>
                  </div>
                  </ExpandableAdminControlCard>
                  </div>

                  <div className={isControlSectionVisible("visa-requirements") ? "" : "hidden"}>
                  <ExpandableAdminControlCard previewHeight={360} {...getControlCardExpansionProps("destination-visa-requirements")}>
                  <div className="bg-surface-2 border border-border rounded-xl p-5">
                    <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                        <ScrollText size={18} className="text-cyan" />
                        Visa Requirements
                      </h3>
                      <DisplayToggle
                        active={displayToggles.showVisaRequirements}
                        busy={togglingDisplayKey === "showVisaRequirements"}
                        onClick={() => runToggleDisplay("showVisaRequirements")}
                        labelOn="Visible"
                        labelOff="Hidden"
                      />
                    </div>
                    <p className="text-xs text-text-muted mb-4">
                      One requirement per line. These show on every destination page (below &quot;How it works&quot;). Per-country
                      extras you add inside Country Manager are appended below - duplicates are skipped.
                    </p>
                    <div className="space-y-3 w-full max-w-none">
                      {(settingsForm.destinationVisaRequirements || []).map((item, idx) => (
                        <div key={`visa-${idx}`} className="rounded-xl border border-border bg-background p-4 space-y-3">
                          <div className="flex gap-2 items-start">
                            <Textarea
                              rows={2}
                              value={item?.text ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setSettingsForm((p) => {
                                  const next = [...(p.destinationVisaRequirements || [])];
                                  next[idx] = { ...next[idx], text: v };
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
                          <CountryVisibilitySelector
                            item={item}
                            activeCountries={activeCountryOptions}
                            itemLabel="this requirement"
                            onChange={(nextItem) =>
                              setSettingsForm((p) => {
                                const next = [...(p.destinationVisaRequirements || [])];
                                next[idx] = nextItem;
                                return { ...p, destinationVisaRequirements: next };
                              })
                            }
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
                            destinationVisaRequirements: [
                              ...(p.destinationVisaRequirements || []),
                              withCountryVisibilityMeta({ text: "" }, activeCountryIds),
                            ],
                          }))
                        }
                      >
                        Add requirement
                      </Button>
                      <div className="pt-2">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          leftIcon={<Save size={14} />}
                          loading={savingSettingsKey === "destination-content"}
                          onClick={() =>
                            saveDestinationContentSection({
                              sectionKey: "visa-requirements",
                              validationLabel: "Each visa requirement",
                              payloadBuilder: buildDestinationVisaRequirementsPayload,
                              payloadKey: "destinationVisaRequirements",
                              successMessage: "Visa requirements saved.",
                            })
                          }
                        >
                          Save This Section
                        </Button>
                      </div>
                    </div>
                  </div>
                  </ExpandableAdminControlCard>
                  </div>
                  </div>
              </Card>
              </div>

              <div className={isControlSectionVisible("visa-details-table") ? "" : "hidden"}>
                <VisaDetailsTable />
              </div>
            </motion.div>
          )}

      {/* ======================================
          COUNTRIES WITH BANNER (UNSPLASH / UPLOADS)
          ====================================== */}
      <Modal
        isOpen={fetchedCountriesModalOpen}
        onClose={closeFetchedCountriesModal}
        title="Countries with banner images"
        size="full"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-text-muted">
              {countriesWithBanner.length} with a saved image URL ? {filteredFetchedCountries.length} shown
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
            Rows come from MongoDB <span className="text-text-primary font-medium">Country.imageUrl</span>. "Unsplash" means the URL points at images.unsplash.com; uploads use <span className="font-mono text-xs">/uploads/...</span>.
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} aria-hidden />
            <input
              type="search"
              value={fetchedCountriesSearch}
              onChange={(e) => setFetchedCountriesSearch(e.target.value)}
              placeholder="Filter by country name or slug..."
              className="w-full rounded-xl border border-border bg-surface-2 pl-10 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              id="fetched-countries-search"
            />
          </div>
          {filteredFetchedCountries.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface-2/60 px-4 py-8 text-center text-sm text-text-muted">
              {countriesWithBanner.length === 0
                ? "No countries have a banner URL yet. Run 'Fetch images' above or upload images from Country Manager."
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
                            {c.flagEmoji || "??"}
                          </span>
                          {c.name}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-text-secondary">{c.slug}</td>
                        <td className="px-3 py-2 text-text-secondary">{c.continent || "-"}</td>
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

      {/* ======================================
          COUNTRY MANAGER MODAL
          ====================================== */}
      <Modal
        isOpen={iconPickerOpen}
        onClose={closeIconPicker}
        title="Select Remix Icon"
        size="xl"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-text-muted">
              Pick visually here, or type any valid <span className="font-mono text-text-primary">ri-*</span> class manually in the input.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => applyPickedIcon("")}>
                Clear icon
              </Button>
              <Button variant="primary" size="sm" onClick={closeIconPicker}>
                Close
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface-2/50 p-4">
            <p className="text-sm font-medium text-text-primary">Choose an icon for the current field</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              Clicking any icon below inserts its class immediately into the form. Manual editing still works too.
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} aria-hidden />
            <input
              type="search"
              value={iconPickerSearch}
              onChange={(e) => setIconPickerSearch(e.target.value)}
              placeholder="Search icons by class name..."
              className="w-full rounded-xl border border-border bg-surface-2 pl-10 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </div>

          {filteredRemixIcons.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface-2/60 px-4 py-8 text-center text-sm text-text-muted">
              No icon matched your search. You can still type a custom Remix icon class in the field.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredRemixIcons.map((icon) => {
                const isActive =
                  sanitizeRemixIconClass(icon) === sanitizeRemixIconClass(getCurrentPickedIcon());

                return (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => applyPickedIcon(icon)}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                      isActive
                        ? "border-cyan bg-cyan/10"
                        : "border-border bg-surface-2/60 hover:border-cyan/40 hover:bg-surface-2"
                    }`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-2xl text-cyan">
                      <i className={icon} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-text-primary">{icon}</span>
                      <span className="block text-xs text-text-muted">Click to use</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={feeSaveModalState.open}
        onClose={savingControlKey ? undefined : closeFeeSaveModal}
        title="Save All Changes"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={closeFeeSaveModal} disabled={Boolean(savingControlKey)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              leftIcon={<Save size={15} />}
              loading={savingControlKey === "base-price" || savingControlKey === "government-fee"}
              onClick={() =>
                feeSaveModalState.feeType === "governmentFee"
                  ? runSaveAllGovernmentFeeChanges()
                  : runSaveAllServiceFeeChanges()
              }
            >
              Save Changes
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-text-secondary">
          You are about to save all fee updates. Continue?
        </p>
      </Modal>

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
          {/* ============================================================
              LEFT - country basics, cover image, fees, type, etc.
              Independent scrollbar on lg+ so left + right scroll separately.
              ============================================================ */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-5 lg:h-full lg:overflow-y-auto lg:pr-3 lg:pb-2">
            <div className="flex items-center gap-2">
              <BadgeCheck size={14} className="text-cyan" />
              <h3 className="text-xs font-semibold uppercase tracking-widest text-text-primary">Country basics</h3>
            </div>
          <div className="rounded-2xl border border-border bg-surface-2/70 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text-primary">Country visibility</p>
                <p className="mt-1 text-xs text-text-muted">
                  {countryForm.isActive !== false
                    ? "Shown on homepage, All Destinations, and search."
                    : "Hidden from public pages and search, but still available here in Admin."}
                </p>
              </div>
              <CountryCardActiveToggle
                active={countryForm.isActive !== false}
                busy={isSavingCountry}
                onClick={() =>
                  setCountryForm((p) => ({ ...p, isActive: p.isActive === false }))
                }
                countryName={countryForm.name || "country"}
              />
            </div>
            <p className="mt-2 text-[11px] text-text-muted">
              Changes here are saved when you click <span className="text-text-primary font-medium">Save Changes</span>.
            </p>
          </div>
          {/* Name + Flag emoji */}
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Flag Emoji"
              value={countryForm.flagEmoji}
              onChange={(e) => setCountryForm((p) => ({ ...p, flagEmoji: e.target.value }))}
              id="country-flag"
              placeholder="??"
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
                  automatically based on what the admin types - clear the field or
                  match the global value to revert to global. */}
              {selectedCountry?.useGlobalVisaType === false ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Custom override - clear or match the global ({globalDefaults.globalVisaType || "not set"}) to use global again.
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
                onChange={(e) => syncVisaInfoCoreField("validity", e.target.value)}
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
                  Custom override - clear or match the global ({globalDefaults.globalValidity || "not set"}) to use global again.
                </p>
              ) : (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Using global value{globalDefaults.globalValidity ? ` (${globalDefaults.globalValidity})` : ""}. Type something different to override.
                </p>
              )}
            </div>
            <div>
              <Input
                label="Length of Stay"
                value={countryForm.lengthOfStay}
                onChange={(e) => syncVisaInfoCoreField("lengthOfStay", e.target.value)}
                id="country-length-of-stay"
                placeholder="Pick or type length of stay"
                list="country-length-of-stay-options"
                helper="Shown in the Visa Information section on the destination page."
              />
              <datalist id="country-length-of-stay-options">
                {LENGTH_OF_STAY_SUGGESTIONS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              {selectedCountry?.useGlobalLengthOfStay === false ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Custom override - clear or match the global ({globalDefaults.globalLengthOfStay || "not set"}) to use global again.
                </p>
              ) : (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Using global value{globalDefaults.globalLengthOfStay ? ` (${globalDefaults.globalLengthOfStay})` : ""}. Type something different to override.
                </p>
              )}
            </div>
            <div>
              <Input
                label="Entry"
                value={countryForm.entryType}
                onChange={(e) => syncVisaInfoCoreField("entryType", e.target.value)}
                id="country-entry-type"
                placeholder="Pick or type entry"
                list="country-entry-type-options"
                helper="Shown in the Visa Information section on the destination page."
              />
              <datalist id="country-entry-type-options">
                {ENTRY_TYPE_SUGGESTIONS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              {selectedCountry?.useGlobalEntryType === false ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Custom override - clear or match the global ({globalDefaults.globalEntryType || "not set"}) to use global again.
                </p>
              ) : (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Using global value{globalDefaults.globalEntryType ? ` (${globalDefaults.globalEntryType})` : ""}. Type something different to override.
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
            <div>
              <Input
                label="Service Fee (₹)"
                type="number"
                value={countryForm.basePrice}
                onChange={(e) => setCountryForm((p) => ({ ...p, basePrice: e.target.value }))}
                id="country-price"
                placeholder="150"
              />
              {!selectedCountry ? null : selectedCountry?.useGlobalBasePrice === true ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Using global value
                  {Number.isFinite(Number(globalDefaults.globalBasePrice))
                    ? ` (${formatPriceINR(globalDefaults.globalBasePrice)})`
                    : ""}. Type a different amount to override.
                </p>
              ) : (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Custom override - match the global
                  {Number.isFinite(Number(globalDefaults.globalBasePrice))
                    ? ` (${formatPriceINR(globalDefaults.globalBasePrice)})`
                    : " price"} to use global again.
                </p>
              )}
            </div>
            <div>
              <Input
                label="Government Fee (INR)"
                type="number"
                value={countryForm.governmentFee}
                onChange={(e) => setCountryForm((p) => ({ ...p, governmentFee: e.target.value }))}
                id="country-government-fee"
                placeholder="2500"
              />
              {!selectedCountry ? null : selectedCountry?.useGlobalGovernmentFee !== false ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Using global value
                  {Number.isFinite(Number(globalDefaults.globalGovernmentFee))
                    ? ` (${formatPriceINR(globalDefaults.globalGovernmentFee)})`
                    : ""}. Type a different amount to override.
                </p>
              ) : (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Custom override - match the global
                  {Number.isFinite(Number(globalDefaults.globalGovernmentFee))
                    ? ` (${formatPriceINR(globalDefaults.globalGovernmentFee)})`
                    : " government fee"} to use global again.
                </p>
              )}
            </div>
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
              {/* Mirrors the Visa Type / Validity hints - flips automatically based
                  on whether this country is currently following the global default
                  (`useGlobalProcessingDays`) or has its own override. */}
              {selectedCountry?.useGlobalProcessingDays === false ? (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Custom override - clear or match the global ({globalDefaults.globalProcessingDays || "not set"}) to use global again.
                </p>
              ) : (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Using global value{globalDefaults.globalProcessingDays ? ` (${globalDefaults.globalProcessingDays})` : ""}. Type something different to override.
                </p>
              )}
            </div>
            <div className="col-span-3 grid gap-3">
              <label className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-text-primary">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border bg-surface-2 accent-cyan"
                  checked={countryForm.useGlobalGst}
                  onChange={(e) => setCountryForm((p) => ({ ...p, useGlobalGst: e.target.checked }))}
                />
                Use global GST settings
              </label>
              {!countryForm.useGlobalGst && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-text-primary">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border bg-surface-2 accent-cyan"
                      checked={countryForm.gstEnabled}
                      onChange={(e) => setCountryForm((p) => ({ ...p, gstEnabled: e.target.checked }))}
                    />
                    GST enabled for this country
                  </label>
                  <Input
                    label="GST Rate (%)"
                    type="number"
                    value={countryForm.gstRate}
                    onChange={(e) => setCountryForm((p) => ({ ...p, gstRate: Number(e.target.value) }))}
                    id="country-gst-rate"
                    placeholder="18"
                  />
                </div>
              )}
              <p className="text-[11px] text-text-muted">
                {countryForm.useGlobalGst
                  ? 'This country inherits the global GST toggle and rate from Admin Settings.'
                  : 'This country uses its own GST settings.'}
              </p>
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

          {/* Success rate */}
          <div className="grid grid-cols-1 gap-3">
            <Input
              label="Success Rate (%)"
              type="number"
              value={countryForm.successRate}
              onChange={(e) => setCountryForm((p) => ({ ...p, successRate: e.target.value }))}
              id="country-success-rate"
              placeholder="80"
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
                  <p className="text-sm text-text-muted">Uploading image...</p>
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

          {/* ============================================================
              RIGHT - required docs, free-text requirements, destination copy
              Independent scrollbar on lg+.
              ============================================================ */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6 lg:h-full lg:overflow-y-auto lg:pr-3 lg:pb-2">
          <div className="rounded-2xl border border-border bg-surface-2/50 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-text-primary">Visa Information section</h4>
                <p className="mt-1 text-xs leading-relaxed text-text-muted max-w-3xl">
                  This controls the premium visa summary cards on the country details page. The three values stay
                  synced with the base fields above so older data and public cards keep working.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-text-primary">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border bg-surface-2 accent-cyan"
                  checked={countryForm.visaInformation?.enabled !== false}
                  onChange={(e) => updateVisaInformationField("enabled", e.target.checked)}
                />
                Show section
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                label="Badge Text"
                value={countryForm.visaInformation?.badgeText ?? ""}
                onChange={(e) => updateVisaInformationField("badgeText", e.target.value)}
                id="country-visa-info-badge"
                placeholder="100% Online Process"
              />
              <Input
                label="Section Title"
                value={countryForm.visaInformation?.title ?? ""}
                onChange={(e) => updateVisaInformationField("title", e.target.value)}
                id="country-visa-info-title"
                placeholder="Visa Information"
              />
            </div>

            <Textarea
              label="Subtitle"
              rows={3}
              value={countryForm.visaInformation?.subtitle ?? ""}
              onChange={(e) => updateVisaInformationField("subtitle", e.target.value)}
              id="country-visa-info-subtitle"
              placeholder="A 100% online visa application process that is simple, secure and hassle-free."
            />

            <Textarea
              label="Important Note"
              rows={3}
              value={countryForm.visaInformation?.note ?? ""}
              onChange={(e) => updateVisaInformationField("note", e.target.value)}
              id="country-visa-info-note"
              placeholder="Visa rules and conditions may change. Please check the latest requirements before applying."
            />

            <div className="grid gap-4 xl:grid-cols-3">
              {(countryForm.visaInformation?.items || []).map((item, index) => (
                <div key={item.id || index} className="rounded-2xl border border-border bg-background p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{item.id || `Item ${index + 1}`}</p>
                      <p className="text-[11px] text-text-muted">
                        Icon: {item.icon || "default"} ? Accent: {item.color || "blue"}
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs text-text-primary">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border bg-surface-2 accent-cyan"
                        checked={item.enabled !== false}
                        onChange={(e) => updateVisaInformationItem(item.id, { enabled: e.target.checked })}
                      />
                      Show card
                    </label>
                  </div>

                  <Input
                    label="Card Label"
                    value={item.label ?? ""}
                    onChange={(e) => updateVisaInformationItem(item.id, { label: e.target.value })}
                    id={`country-visa-item-label-${item.id}`}
                    placeholder="Length of Stay"
                  />
                  <Input
                    label="Card Value"
                    value={item.value ?? ""}
                    onChange={(e) => updateVisaInformationItem(item.id, { value: e.target.value })}
                    id={`country-visa-item-value-${item.id}`}
                    placeholder="30 days"
                  />
                  <Textarea
                    label="Card Description"
                    rows={3}
                    value={item.description ?? ""}
                    onChange={(e) => updateVisaInformationItem(item.id, { description: e.target.value })}
                    id={`country-visa-item-description-${item.id}`}
                    placeholder="Short helper text shown under the visa value."
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Required Documents - universal control aware. The checklist now
              uses the merged catalog (built-in + admin's custom doc types) and
              shows a green/amber badge plus a "Reset to global" helper button
              that mirrors the same pattern as Visa Type / Validity. */}
          <div className="rounded-2xl border border-border bg-surface-2/40 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <label className="text-sm font-semibold text-text-primary">
                Documents Required
                <span className="ml-2 text-xs text-text-muted font-normal">Select which documents applicants must upload</span>
              </label>
              {/* Quick "use global" helper - sets the local list to the global
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
            {(() => {
              const rows = documentCatalog.length
                ? documentCatalog.filter((d) => !d.deleted)
                : DOC_OPTIONS.map((o) => ({ ...o, builtIn: true }));
              const rowByKey = new Map(rows.map((row) => [row.key, row]));
              const globalKeys = (globalDefaults.globalRequiredDocuments || []).filter(Boolean);
              const selectedKeys = Array.isArray(countryForm.requiredDocuments)
                ? countryForm.requiredDocuments.filter(Boolean)
                : [];
              const visibleGlobalKeys = globalKeys.filter((key) => selectedKeys.includes(key));
              const hiddenGlobalKeys = globalKeys.filter((key) => !selectedKeys.includes(key));
              const extraSelectedKeys = selectedKeys.filter((key) => !globalKeys.includes(key));
              const availableCatalogKeys = rows
                .map((row) => row.key)
                .filter((key) => !selectedKeys.includes(key));

              const renderDocChip = (key, actionLabel, actionIcon, onClick, tone = "default") => {
                const row = rowByKey.get(key) || { key, label: key, builtIn: true, icon: "" };
                const DocIcon = getDocumentIcon(key);
                const actionTone =
                  tone === "danger"
                    ? "hover:text-red-400 hover:bg-red-500/10"
                    : "hover:text-cyan hover:bg-cyan/5";

                return (
                  <div
                    key={key}
                    className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-cyan">
                      {row.icon ? <i className={`${row.icon} text-[15px] leading-none`} aria-hidden="true" /> : <DocIcon size={14} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate" title={row.label}>{row.label}</span>
                    {row.builtIn === false && (
                      <span className="text-[10px] uppercase tracking-wider text-cyan/70">custom</span>
                    )}
                    <button
                      type="button"
                      onClick={onClick}
                      className={`shrink-0 rounded-lg p-1.5 text-text-muted transition-colors ${actionTone}`}
                      aria-label={actionLabel}
                      title={actionLabel}
                    >
                      {actionIcon}
                    </button>
                  </div>
                );
              };

              return (
                <div className="space-y-4">
                  {globalKeys.length > 0 && (
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Global (every country)</p>
                      {visibleGlobalKeys.length === 0 ? (
                        <p className="rounded-xl border border-border bg-background/40 px-3 py-2 text-xs italic text-text-muted">
                          All global documents are hidden on this country. Restore them below.
                        </p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {visibleGlobalKeys.map((key) =>
                            renderDocChip(
                              key,
                              "Hide on this country",
                              <X size={14} />,
                              () => toggleRequiredDoc(key),
                              "danger"
                            )
                          )}
                        </div>
                      )}
                      {hiddenGlobalKeys.length > 0 && (
                        <div className="mt-3 rounded-xl border border-dashed border-border bg-background/40 p-3">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                            Hidden on this country ({hiddenGlobalKeys.length})
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {hiddenGlobalKeys.map((key) =>
                              renderDocChip(
                                key,
                                "Show on this country again",
                                <Plus size={14} />,
                                () => toggleRequiredDoc(key)
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Extra documents for this country</p>
                    {extraSelectedKeys.length === 0 ? (
                      <p className="rounded-xl border border-border bg-background/40 px-3 py-2 text-xs italic text-text-muted">
                        No extra country-only documents selected yet.
                      </p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {extraSelectedKeys.map((key) =>
                          renderDocChip(
                            key,
                            "Remove extra document",
                            <X size={14} />,
                            () => toggleRequiredDoc(key),
                            "danger"
                          )
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Add from document catalog</p>
                    {availableCatalogKeys.length === 0 ? (
                      <p className="rounded-xl border border-border bg-background/40 px-3 py-2 text-xs italic text-text-muted">
                        Every document in the catalog is already selected for this country.
                      </p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {availableCatalogKeys.map((key) =>
                          renderDocChip(
                            key,
                            "Add document to this country",
                            <Plus size={14} />,
                            () => toggleRequiredDoc(key)
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            {countryForm.requiredDocuments.length === 0 && (
              <p className="text-xs text-amber-400 mt-2">?  At least one document type should be selected.</p>
            )}
            {selectedCountry?.useGlobalRequiredDocuments === false ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Custom override - match the global selection (or click "Reset to global") to use the universal list again.
              </p>
            ) : (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Using global list{globalDefaults.globalRequiredDocuments.length ? ` (${globalDefaults.globalRequiredDocuments.length} document${globalDefaults.globalRequiredDocuments.length === 1 ? "" : "s"})` : ""}. Tick / untick anything to override on this country only.
              </p>
            )}
          </div>

          {/* --------------------------------------------------
              Destination-page copy for THIS country.
              Shows global lines (from Settings → Destinations) with X to
              hide them on this country, then per-country additions below.
              -------------------------------------------------- */}
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
              (list || []).filter((item) => {
                const k = typeof item === "string" ? item : item?.title;
                return !excluded.has(normDestKey(k));
              }).length;
            const visibleGlobalFaqCount = (list, excluded) =>
              (list || []).filter((f) => !excluded.has(normDestKey(f?.question))).length;

            return (
          <div className="rounded-2xl border border-border bg-surface-2/40 p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-text-primary">
                Destination page copy - {countryForm.name || "this country"}
              </h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                <span className="text-text-primary font-medium">Global items</span> from{" "}
                <span className="text-text-primary font-medium">Settings → Destinations</span> are shown first on every country.
                Click the <X size={11} className="inline -mt-0.5" /> next to a global item to hide it on{" "}
                {countryForm.name || "this country"} only - hidden items move to{" "}
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
                <div className="flex items-center gap-3">
                  <DisplayToggle
                    active={countryForm.useGlobalWhyBookNow}
                    onClick={() => setCountryForm(p => ({ ...p, useGlobalWhyBookNow: !p.useGlobalWhyBookNow }))}
                    labelOn="Merging global"
                    labelOff="Custom only"
                  />
                  <span className="text-[10px] text-text-muted">
                    {countryForm.useGlobalWhyBookNow ? visibleGlobalCount(countryModalGlobalDest.whyBookNow, excludedWhy) : 0} global +{" "}
                    {(countryForm.whyBookNow || []).filter((s) => String(s ?? "").trim()).length} extra
                  </span>
                </div>
              </div>

              {countryForm.useGlobalWhyBookNow && (
              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">Global (every country)</p>
                {countryModalGlobalDest.whyBookNow.length === 0 ? (
                  <p className="text-xs text-text-muted italic px-1">
                    No global items yet - add them in Settings → Destinations.
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
              )}



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
                <div className="flex items-center gap-3">
                  <DisplayToggle
                    active={countryForm.useGlobalIncludedItems}
                    onClick={() => setCountryForm(p => ({ ...p, useGlobalIncludedItems: !p.useGlobalIncludedItems }))}
                    labelOn="Merging global"
                    labelOff="Custom only"
                  />
                  <span className="text-[10px] text-text-muted">
                    {countryForm.useGlobalIncludedItems ? visibleGlobalCount(countryModalGlobalDest.includedItems, excludedInc) : 0} global +{" "}
                    {(countryForm.includedItems || []).filter((s) => String(s?.title ?? "").trim()).length} extra
                  </span>
                </div>
              </div>

              {countryForm.useGlobalIncludedItems && (
              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">Global (every country)</p>
                {countryModalGlobalDest.includedItems.length === 0 ? (
                  <p className="text-xs text-text-muted italic px-1">
                    No global items yet - add them in Settings → Destinations.
                  </p>
                ) : (
                  (() => {
                    const all = countryModalGlobalDest.includedItems || [];
                    const visible = all.filter((line) => !excludedInc.has(normDestKey(line?.title)));
                    const hidden = all.filter((line) => excludedInc.has(normDestKey(line?.title)));
                    return (
                      <>
                        {visible.length === 0 ? (
                          <p className="text-xs text-text-muted italic px-1">
                            All global bullets are hidden on this country. Restore any below.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {visible.map((item) => {
                              const key = normDestKey(item.title);
                              return (
                                <div
                                  key={`global-inc-${key}`}
                                  className="flex gap-3 items-start justify-between rounded-xl border border-border bg-background text-text-primary px-3 py-2.5"
                                >
                                  <div className="flex-1 min-w-0">
                                     <p className="text-sm font-semibold flex items-center gap-2">
                                       {item.icon && <i className={item.icon} />}
                                       {item.title}
                                     </p>
                                     <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{item.description}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => toggleExclude("excludeDestinationIncludedItems", key)}
                                    className="shrink-0 p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    aria-label={`Hide "${item.title}" on this country`}
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
                              {hidden.map((item) => {
                                const key = normDestKey(item.title);
                                return (
                                  <button
                                    type="button"
                                    key={`hidden-inc-${key}`}
                                    onClick={() => toggleExclude("excludeDestinationIncludedItems", key)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[11px] text-text-muted hover:text-cyan hover:border-cyan/40 hover:bg-cyan/5 transition-colors max-w-full"
                                    title="Show on this country again"
                                    aria-label={`Show "${item.title}" on this country again`}
                                  >
                                    <Plus size={12} className="shrink-0" />
                                    <span className="truncate">{item.title}</span>
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
              )}

              <div>
                <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">Extras for this country</p>
                <div className="space-y-4">
                  {(countryForm.includedItems || []).map((item, idx) => (
                    <div key={`country-inc-${idx}`} className="rounded-xl border border-border bg-background p-3 space-y-3">
                       <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] uppercase tracking-wide font-semibold text-text-muted">Extra Item {idx + 1}</p>
                        <button
                          type="button"
                          onClick={() =>
                            setCountryForm((p) => ({
                              ...p,
                              includedItems: (p.includedItems || []).filter((_, i) => i !== idx),
                            }))
                          }
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                          aria-label={`Remove extra item ${idx + 1}`}
                          title="Remove this item"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Title"
                          value={item.title}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCountryForm((p) => {
                              const next = [...(p.includedItems || [])];
                              next[idx] = { ...next[idx], title: v };
                              return { ...p, includedItems: next };
                            });
                          }}
                          placeholder="e.g. Free Insurance"
                        />
                         <Select
                          label="Color"
                          value={item.color || 'blue'}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCountryForm((p) => {
                              const next = [...(p.includedItems || [])];
                              next[idx] = { ...next[idx], color: v };
                              return { ...p, includedItems: next };
                            });
                          }}
                          options={[
                            { value: 'blue', label: 'Blue' },
                            { value: 'green', label: 'Green' },
                            { value: 'purple', label: 'Purple' },
                          ]}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Icon Class (Remix Icon)"
                          value={item.icon}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCountryForm((p) => {
                              const next = [...(p.includedItems || [])];
                              next[idx] = { ...next[idx], icon: v };
                              return { ...p, includedItems: next };
                            });
                          }}
                          placeholder="ri-shield-line"
                          list="remix-icon-suggestions"
                        />
                        <div className="flex items-end pb-1.5">
                          <IconPickerPreviewButton
                            icon={item.icon}
                            fallbackIcon={ShieldCheck}
                            className="min-w-0 w-10 h-10 rounded-lg bg-surface-2"
                            title={`Choose icon for ${item.title || "included item"}`}
                            onClick={() =>
                              openIconPicker({
                                type: "country-included-item",
                                index: idx,
                              })
                            }
                          />
                        </div>
                      </div>

                      <Textarea
                        label="Description"
                        rows={2}
                        value={item.description}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCountryForm((p) => {
                            const next = [...(p.includedItems || [])];
                            next[idx] = { ...next[idx], description: v };
                            return { ...p, includedItems: next };
                          });
                        }}
                        placeholder="Explain what's included..."
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
                        includedItems: [...(p.includedItems || []), { title: "", description: "", icon: "", color: "blue" }],
                      }))
                    }
                    id="add-country-inc-btn"
                  >
                    Add item for this country
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
                <div className="flex items-center gap-3">
                  <DisplayToggle
                    active={countryForm.useGlobalFaqs}
                    onClick={() => setCountryForm(p => ({ ...p, useGlobalFaqs: !p.useGlobalFaqs }))}
                    labelOn="Merging global"
                    labelOff="Custom only"
                  />
                  <span className="text-[10px] text-text-muted">
                    {countryForm.useGlobalFaqs ? visibleGlobalFaqCount(countryModalGlobalDest.faqs, excludedFaq) : 0} global +{" "}
                    {(countryForm.faqs || []).filter((f) => String(f?.question ?? "").trim() && String(f?.answer ?? "").trim()).length} extra
                  </span>
                </div>
              </div>

              {countryForm.useGlobalFaqs && (
              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">Global (every country)</p>
                {countryModalGlobalDest.faqs.length === 0 ? (
                  <p className="text-xs text-text-muted italic px-1">
                    No global FAQs yet - add them in Settings → Destinations.
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
              )}

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
                <div className="flex items-center gap-3">
                  <DisplayToggle
                    active={countryForm.useGlobalHowItWorks}
                    onClick={() => setCountryForm(p => ({ ...p, useGlobalHowItWorks: !p.useGlobalHowItWorks }))}
                    labelOn="Merging global"
                    labelOff="Custom only"
                  />
                  <span className="text-[10px] text-text-muted">
                    {countryForm.useGlobalHowItWorks ? (countryModalGlobalDest.howItWorks || []).filter((s) => !(new Set(countryForm.excludeDestinationHowItWorksTitles || [])).has(normDestKey(s?.title))).length : 0} global +{" "}
                    {(countryForm.howItWorks || []).filter((s) => String(s?.title ?? "").trim() && String(s?.description ?? "").trim()).length} extra
                  </span>
                </div>
              </div>

              {countryForm.useGlobalHowItWorks && (
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
                        No global steps yet - add them in Settings → Destinations.
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
              )}

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
                <div className="flex items-center gap-3">
                  <DisplayToggle
                    active={countryForm.useGlobalVisaRequirements}
                    onClick={() => setCountryForm(p => ({ ...p, useGlobalVisaRequirements: !p.useGlobalVisaRequirements }))}
                    labelOn="Merging global"
                    labelOff="Custom only"
                  />
                  <span className="text-[10px] text-text-muted">
                    {countryForm.useGlobalVisaRequirements ? visibleGlobalCount(countryModalGlobalDest.visaRequirements, excludedVisa) : 0} global +{" "}
                    {(countryForm.requirements || []).filter((s) => String(s ?? "").trim()).length} extra
                  </span>
                </div>
              </div>

              {countryForm.useGlobalVisaRequirements && (
              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-2">Global (every country)</p>
                {(countryModalGlobalDest.visaRequirements || []).length === 0 ? (
                  <p className="text-xs text-text-muted italic px-1">
                    No global requirements yet - add them in Settings → Destinations.
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
              )}

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
      <Modal
        isOpen={footerSocialIconModalOpen}
        onClose={savingFooterSocialIcon ? undefined : closeFooterSocialIconModal}
        title={footerSocialIconEditingId ? "Edit Footer Social Icon" : "Add Footer Social Icon"}
        size="lg"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Icon Name / Label"
              value={footerSocialIconForm.label}
              onChange={(e) => {
                setFooterSocialIconForm((prev) => ({ ...prev, label: e.target.value }));
                if (footerSocialIconErrors.label) {
                  setFooterSocialIconErrors((prev) => ({ ...prev, label: "" }));
                }
              }}
              placeholder="Instagram"
              error={footerSocialIconErrors.label}
            />
            <Select
              label="Icon Type"
              value={footerSocialIconForm.type}
              onChange={(e) => {
                const nextType = normalizeFooterSocialIconType(e.target.value) || "instagram";
                setFooterSocialIconForm((prev) => ({ ...prev, type: nextType }));
                setFooterSocialIconErrors((prev) => ({ ...prev, type: "", url: "" }));
              }}
              options={FOOTER_SOCIAL_ICON_TYPE_OPTIONS}
              error={footerSocialIconErrors.type}
            />
          </div>

          <Input
            label="Icon URL / Link"
            value={footerSocialIconForm.url}
            onChange={(e) => {
              setFooterSocialIconForm((prev) => ({ ...prev, url: e.target.value }));
              if (footerSocialIconErrors.url) {
                setFooterSocialIconErrors((prev) => ({ ...prev, url: "" }));
              }
            }}
            placeholder={getFooterSocialIconTypeHelper(footerSocialIconForm.type)}
            helper={getFooterSocialIconTypeHelper(footerSocialIconForm.type)}
            error={footerSocialIconErrors.url}
          />

          <div className="rounded-2xl border border-border bg-surface-2/30 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Status</p>
              <p className="text-xs text-text-muted mt-1">Inactive icons stay saved in MongoDB but stay hidden from the public footer.</p>
            </div>
            <button
              type="button"
              onClick={() =>
                setFooterSocialIconForm((prev) => ({ ...prev, isActive: prev.isActive === false }))
              }
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                footerSocialIconForm.isActive !== false
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                  : "border-border bg-background text-text-muted"
              }`}
            >
              {footerSocialIconForm.isActive !== false ? <CheckCircle size={14} /> : <X size={14} />}
              {footerSocialIconForm.isActive !== false ? "Active" : "Inactive"}
            </button>
          </div>

          <div className="rounded-2xl border border-border bg-surface-2/20 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">Preview</p>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 text-cyan">
                {(() => {
                  const PreviewIcon = FOOTER_SOCIAL_ICON_COMPONENTS[normalizeFooterSocialIconType(footerSocialIconForm.type)] || LinkIcon;
                  return <PreviewIcon size={18} />;
                })()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary">
                  {footerSocialIconForm.label.trim() || "Footer social icon"}
                </p>
                <p className="text-xs text-text-muted">
                  {FOOTER_SOCIAL_ICON_TYPE_LABELS[normalizeFooterSocialIconType(footerSocialIconForm.type)] || "Custom Link"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end pt-2">
            <Button
              variant="secondary"
              onClick={closeFooterSocialIconModal}
              disabled={savingFooterSocialIcon}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              leftIcon={<Save size={15} />}
              loading={savingFooterSocialIcon}
              onClick={submitFooterSocialIcon}
            >
              {footerSocialIconEditingId ? "Save Changes" : "Create Icon"}
            </Button>
          </div>
        </div>
      </Modal>
      <datalist id="remix-icon-suggestions">
        {REMIX_ICON_SUGGESTIONS.map((icon) => (
          <option key={icon} value={icon} />
        ))}
      </datalist>
    </AdminLayout>
  );
};

export default Dashboard;
