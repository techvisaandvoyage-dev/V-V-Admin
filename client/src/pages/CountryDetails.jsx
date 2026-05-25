import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CircleCheck,
  ShieldCheck,
  HelpCircle,
  BadgeCheck,
  CalendarDays,
  Plus,
  X,
  Trash2,
  ListChecks,
  ScrollText,
  FileText,
  CreditCard,
  Image as ImageIcon,
  Plane,
  Building2,
  Briefcase,
  Banknote,
  GraduationCap,
  Stethoscope,
  Stamp,
  Receipt,
  Home,
  Car,
  MapPin,
  HeartHandshake,
  FileEdit,
  Headphones,
  Info,
  Link2,
} from "lucide-react";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import Button from "../components/ui/Button";
import ImageWithShimmer from "../components/ui/ImageWithShimmer";
import DateRangePicker from "../components/ui/DateRangePicker";
import { useDataStore } from "../store/dataStore";
import { useAuthStore, api } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import { useCountries, useMergedCountry } from "../hooks/useCountries";
import {
  openRazorpayForApplication,
  validateRazorpayCheckoutReadiness,
} from "../utils/razorpayCheckout";
import ContactVerificationModal from "../components/account/ContactVerificationModal";
import PassportUploadRow from "../components/application/PassportUploadRow";
import {
  optimizeUploadFile,
  PASSPORT_UPLOAD_MAX_BYTES,
  RAW_UPLOAD_LIMIT_BYTES,
} from "../utils/optimizeUploadFile";
import VisaInformationSection from "../components/country/VisaInformationSection";
import CountryFeeSummaryCard from "../components/country/CountryFeeSummaryCard";
import {
  needsPhoneContactGate,
  needsEmailContactGate,
} from "../utils/contactVerificationGate";
import { loadTravelDraft, saveTravelDraft } from "../utils/travelDraftStorage";
import { getLocalDateYmd } from "../utils/dateInput";
import { matchesCountryRouteId, getCountryRouteId } from "../utils/countryRouting";
import { formatOrdinalDate } from "../utils/dateUtils";

const ease = [0.16, 1, 0.3, 1];
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
};

const normalizeProcessingDays = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const matches = String(value || "").match(/\d+/g);
  if (!matches?.length) return 0;
  return Number(matches[matches.length - 1]);
};

const ALLOWED_PASSPORT_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);
const INVALID_PASSPORT_TYPE_ERROR = "Only PDF, JPG, JPEG and PNG files are allowed.";
const PASSPORT_FILE_SIZE_ERROR = "File size exceeds 300KB limit. Please upload a smaller file.";
const PAYMENT_CONFIG_CACHE_KEY = "vb_payment_config_v1";
const isReusableUnpaidApplication = (application) => {
  const paymentStatus = String(application?.paymentStatus || "").trim().toLowerCase();
  return ["pending_payment", "failed", "cancelled"].includes(paymentStatus);
};

const loadCachedPaymentConfig = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PAYMENT_CONFIG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      gstEnabled: typeof parsed.gstEnabled === "boolean" ? parsed.gstEnabled : null,
      gstRate: Number.isFinite(Number(parsed.gstRate)) ? Number(parsed.gstRate) : 18,
    };
  } catch {
    return null;
  }
};

const saveCachedPaymentConfig = (config) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PAYMENT_CONFIG_CACHE_KEY, JSON.stringify({
      gstEnabled: typeof config?.gstEnabled === "boolean" ? config.gstEnabled : null,
      gstRate: Number.isFinite(Number(config?.gstRate)) ? Number(config.gstRate) : 18,
    }));
  } catch {
    /* ignore storage issues */
  }
};

const formatFileSize = (size = 0) => {
  if (!size) return "0 KB";
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const getTravelerPassportDetail = (application, travelerNo) => {
  const traveler = Array.isArray(application?.travellerDocuments)
    ? application.travellerDocuments.find((entry) => Number(entry?.travelerNo) === Number(travelerNo))
    : null;
  if (!traveler) return null;

  const docs = traveler.documents;
  const url =
    docs instanceof Map
      ? docs.get("passport")
      : typeof docs?.get === "function"
        ? docs.get("passport")
        : docs?.passport;
  if (!url) return null;

  const details = traveler.documentDetails;
  const detail =
    details instanceof Map
      ? details.get("passport")
      : typeof details?.get === "function"
        ? details.get("passport")
        : details?.passport;
  return {
    url,
    fileName: detail?.fileName || String(url).split("/").pop() || "Passport",
    fileSize: Number(detail?.fileSize || 0),
    mimeType: detail?.mimeType || "",
  };
};

/**
 * Per-document icon mapping shared with the admin Controls panel + the upload
 * pages. Any unknown key (e.g. an admin-added custom document) falls back to
 * a generic `FileText` icon.
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

const getVisaRequirementRemixIcon = (title, description = "") => {
  const text = `${title} ${description}`.toLowerCase();

  if (text.includes("passport")) return "ri-passport-line";
  if (text.includes("photo") || text.includes("photograph")) return "ri-camera-lens-line";
  if (text.includes("application form") || text.includes("form")) return "ri-file-edit-line";
  if (text.includes("travel itinerary") || text.includes("itinerary")) return "ri-route-line";
  if (text.includes("flight")) return "ri-flight-takeoff-line";
  if (text.includes("hotel") || text.includes("accommodation")) return "ri-hotel-line";
  if (text.includes("insurance")) return "ri-shield-check-line";
  if (text.includes("bank") || text.includes("statement")) return "ri-bank-card-line";
  if (text.includes("employment") || text.includes("offer letter")) return "ri-briefcase-4-line";
  if (text.includes("invitation")) return "ri-mail-open-line";
  if (text.includes("identity") || text.includes("id card") || text.includes("aadhaar")) {
    return "ri-id-card-line";
  }
  if (text.includes("certificate")) return "ri-award-line";
  if (text.includes("ticket")) return "ri-ticket-2-line";
  return "ri-file-list-3-line";
};

// Built-in label fallbacks shown on the public destination page when the live
// catalog hasn't been fetched yet (and for any built-in key the server might
// emit). Custom admin docs are resolved via `documentCatalog` from useCountries.
const DOCUMENT_LABELS = {
  passport: "Passport",
  oldPassport: "Old / Previous Passport",
  photo: "Passport Photo",
  idCard: "Aadhaar / ID Card",
  panCard: "PAN Card",
  drivingLicense: "Driving License",
  birthCertificate: "Birth Certificate",
  dobCertificate: "DOB Certificate",
  marriageCertificate: "Marriage Certificate",
  educationCertificate: "Education / Academic Records",
  employmentLetter: "Employment Letter",
  offerLetter: "Offer Letter",
  salarySlip: "Salary Slip / Pay Stub",
  form16: "Form 16",
  taxReturn: "ITR / Tax Return",
  bankStatement: "Bank Statement",
  bankCertificate: "Bank Solvency Certificate",
  propertyDocuments: "Property Documents",
  travelInsurance: "Travel Insurance",
  healthInsurance: "Health Insurance",
  flightTicket: "Flight Ticket",
  hotelBooking: "Hotel Booking",
  itinerary: "Travel Itinerary",
  coverLetter: "Cover Letter",
  invitationLetter: "Invitation Letter",
  sponsorLetter: "Sponsor / Affidavit Letter",
  policeClearance: "Police Clearance Certificate",
  noObjectionCertificate: "No Objection Certificate (NOC)",
  yellowFever: "Yellow Fever Certificate",
  covidVaccination: "COVID Vaccination Certificate",
  visaApplicationForm: "Visa Application Form",
  businessLicense: "Business License",
  companyRegistration: "Company Registration Certificate",
};

const DOCUMENT_DESCRIPTIONS = {
  passport: "Valid passport with minimum 6 months validity.",
  oldPassport: "Previous passport copies for travel and visa history review.",
  photo: "Recent passport-size photo matching embassy specifications.",
  idCard: "Government-issued identity proof for applicant verification.",
  panCard: "PAN card copy for identity and financial record support.",
  drivingLicense: "Driving license copy when accepted as supporting ID proof.",
  birthCertificate: "Birth certificate copy for age and identity confirmation.",
  dobCertificate: "Proof of date of birth as required by the application.",
  marriageCertificate: "Marriage certificate for spouse-linked visa applications.",
  educationCertificate: "Educational documents and academic transcripts.",
  employmentLetter: "Employment confirmation letter from your current employer.",
  offerLetter: "Offer or admission letter supporting the purpose of travel.",
  salarySlip: "Recent salary slips to support employment and finances.",
  form16: "Form 16 or equivalent tax proof where applicable.",
  taxReturn: "Income tax return documents to support financial eligibility.",
  bankStatement: "Recent bank statements showing stable financial capacity.",
  bankCertificate: "Bank solvency or balance certificate from your bank.",
  propertyDocuments: "Property ownership proof to strengthen home-ties evidence.",
  travelInsurance: "Travel insurance covering your planned stay and duration.",
  healthInsurance: "Health insurance proof if the destination requires it.",
  flightTicket: "Confirmed flight itinerary or flight reservation.",
  hotelBooking: "Confirmed hotel reservation for your stay.",
  itinerary: "Planned day-wise itinerary covering major travel details.",
  coverLetter: "Cover letter explaining the purpose and plan of travel.",
  invitationLetter: "Invitation letter from host, company, or family member.",
  sponsorLetter: "Sponsor letter with relationship and funding confirmation.",
  policeClearance: "Police clearance certificate for background verification.",
  noObjectionCertificate: "NOC from employer or institution when required.",
  yellowFever: "Yellow fever vaccination certificate for eligible destinations.",
  covidVaccination: "COVID vaccination proof if the embassy asks for it.",
  visaApplicationForm: "Completed visa application form signed where needed.",
  businessLicense: "Business license copy for business or self-employed applicants.",
  companyRegistration: "Company registration proof for business documentation.",
};







let travelerStateCounter = 0;

const createTravelerState = () => ({
  id: `traveler-${Date.now()}-${travelerStateCounter += 1}`,
  name: "",
  passportFile: null,
});

const normalizeDriveLink = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const CountryDetails = () => {
  const { countryId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchUserApplications, bookings } = useDataStore();
  const { isAuthenticated, user, sessionAuthMethod } = useAuthStore();
  const { showToast } = useUIStore();
  const { countries: allCountries, display: countryDisplay, documentCatalog } = useCountries();
  const listCountry = allCountries.find((c) => matchesCountryRouteId(c, countryId));
  const country = useMergedCountry(countryId, listCountry);

  /**
   * Map document key → label using the universal catalog (built-in + admin's
   * custom additions). Falls back to the hardcoded built-in map and finally to
   * a humanised version of the key so an unknown doc never renders as garbage.
   */
  const getDocumentLabel = (key) => {
    const fromCatalog = documentCatalog?.find?.((d) => d.key === key)?.label;
    if (fromCatalog) return fromCatalog;
    if (DOCUMENT_LABELS[key]) return DOCUMENT_LABELS[key];
    return `${key.replace(/([A-Z])/g, " $1")} Upload`;
  };

  const getDocumentCatalogIcon = (key) => {
    const icon = documentCatalog?.find?.((d) => d.key === key)?.icon;
    return String(icon ?? "").trim();
  };

  const getDocumentDescription = (key) => {
    const fromCatalog = documentCatalog?.find?.((d) => d.key === key)?.description;
    if (String(fromCatalog ?? "").trim()) return String(fromCatalog).trim();
    return DOCUMENT_DESCRIPTIONS[key] || "Supporting document required for visa processing.";
  };

  // ── All hooks must be called before any conditional return (Rules of Hooks) ──
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [showTravelDetails, setShowTravelDetails] = useState(false);
  const [visaOption, setVisaOption] = useState("e-Visa");
  const [travelDateFrom, setTravelDateFrom] = useState("");
  const [travelDateTo, setTravelDateTo] = useState("");
  /** Open/closed state for the date-range calendar popup. */
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [travelers, setTravelers] = useState([createTravelerState()]);
  const [sharedDriveLink, setSharedDriveLink] = useState("");
  const [sharedDriveLinkVerified, setSharedDriveLinkVerified] = useState(false);
  const [paymentSummaryOpen, setPaymentSummaryOpen] = useState(false);
  const [visaTermsAccepted, setVisaTermsAccepted] = useState(false);
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [razorpayCheckLoading, setRazorpayCheckLoading] = useState(false);
  const [razorpayReadyMessage, setRazorpayReadyMessage] = useState("");
  const [currentApplicationId, setCurrentApplicationId] = useState("");
  const [draftCreating, setDraftCreating] = useState(false);
  const [travelValidationAttempted, setTravelValidationAttempted] = useState(false);
  const [passportUploading, setPassportUploading] = useState({});
  const [passportErrors, setPassportErrors] = useState({});
  const [passportSuccesses, setPassportSuccesses] = useState({});
  const [passportDetails, setPassportDetails] = useState({});
  const travelerNameInputRefs = useRef({});
  const sharedDriveLinkInputRef = useRef(null);
  const startApplicationCardRef = useRef(null);
  const driveLinkSaveTimerRef = useRef(null);
  const startApplicationCardSeenRef = useRef(false);
  const [destinationPageContent, setDestinationPageContent] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactModalMode, setContactModalMode] = useState("phone");
  const [contactGateDismissed, setContactGateDismissed] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [activeSubNav, setActiveSubNav] = useState("how-it-works");
  const pendingContactAction = useRef(null);
  const [showStickyStartCta, setShowStickyStartCta] = useState(false);
  /**
   * When a guest hits an action that requires authentication ("Upload docs
   * first" / "Upload docs later"), we attach a `?postLoginAction=<key>` to the
   * redirect URL. The value is captured synchronously via the lazy `useState`
   * initialiser so the splash overlay shows on the very first render — no
   * flash of the destination page between the login redirect and the target
   * route. A separate effect strips the param from the URL so a refresh
   * doesn't keep re-triggering the same flow.
   */
  const [pendingPostLoginAction, setPendingPostLoginAction] = useState(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("postLoginAction") || null;
  });
  /**
   * Stable map of "post-login action key → handler". Populated below in the
   * render body (after the handlers are declared) so the dispatch effect can
   * reach them despite the early-return Rules-of-Hooks dance.
   */
  const postLoginHandlersRef = useRef({});

  const travellerCount = travelers.length;
  const [gstEnabled, setGstEnabled] = useState(() => loadCachedPaymentConfig()?.gstEnabled ?? null);
  const [gstRate, setGstRate] = useState(() => loadCachedPaymentConfig()?.gstRate ?? 18);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get("/config/payment");
        if (!alive || !data?.success) return;
        setGstEnabled(data.gstEnabled !== false);
        const serverRate = Number(data.gstRate);
        setGstRate(Number.isFinite(serverRate) && serverRate >= 0 ? serverRate : 18);
        saveCachedPaymentConfig({
          gstEnabled: data.gstEnabled !== false,
          gstRate: Number.isFinite(serverRate) && serverRate >= 0 ? serverRate : 18,
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const usesCountrySpecificGst = country?.useGlobalGst === false && typeof country?.gstEnabled === "boolean";
  const isGstResolved = usesCountrySpecificGst || typeof gstEnabled === "boolean";
  const effectiveGstEnabled = usesCountrySpecificGst ? country.gstEnabled : Boolean(gstEnabled);
  const effectiveGstRate = usesCountrySpecificGst && Number.isFinite(Number(country?.gstRate))
    ? Number(country.gstRate)
    : gstRate;

  const { serviceAmount, gstAmount, payableToUs } = useMemo(() => {
    const perTravelerFee = Number.isFinite(Number(country?.basePrice)) ? Number(country.basePrice) : 0;
    const service = perTravelerFee * travellerCount;
    const gst = isGstResolved && effectiveGstEnabled ? Math.round(service * (effectiveGstRate / 100)) : 0;
    return { serviceAmount: service, gstAmount: gst, payableToUs: service + gst };
  }, [country?.basePrice, travellerCount, effectiveGstEnabled, effectiveGstRate, isGstResolved]);

  const governmentFeePerTraveler = useMemo(() => {
    const candidates = [
      country?.governmentFee,
      country?.governmentFees,
      country?.govtFee,
      country?.govFee,
      country?.embassyFee,
      country?.visaFee,
    ];
    const matched = candidates.find((value) => Number.isFinite(Number(value)));
    return Number.isFinite(Number(matched)) ? Number(matched) : 0;
  }, [country]);

  const feeCardGstRate = effectiveGstEnabled
    ? (Number.isFinite(Number(effectiveGstRate)) ? Number(effectiveGstRate) : 18)
    : 0;
  const serviceFeePerTraveler = Number.isFinite(Number(country?.basePrice)) ? Number(country.basePrice) : 0;
  const gstPerTraveler = effectiveGstEnabled ? Math.round(serviceFeePerTraveler * (feeCardGstRate / 100)) : 0;
  const totalServiceFeePerTraveler = serviceFeePerTraveler + gstPerTraveler;
  const governmentFeeTotal = governmentFeePerTraveler * travellerCount;
  const totalServiceFeeTotal = totalServiceFeePerTraveler * travellerCount;
  const finalTotal = (governmentFeePerTraveler + totalServiceFeePerTraveler) * travellerCount;

  /**
   * Destination-page copy:
   *   1. Global defaults from `/config/destination-content`, minus lines this country
   *      has opted out of (`excludeDestination*` arrays on the country document).
   *   2. Per-country additions (`whyBookNow` / `includedItems` / `faqs`) appended after.
   *   3. Hard-coded fallbacks only when the merged result would be empty.
   *
   * String lists are de-duplicated case-insensitively. FAQs de-dupe by question text.
   */
  const normKey = (s) => String(s ?? "").trim().toLowerCase();

  const mergeStringLists = (globalList, countryList) => {
    const seen = new Set();
    const out = [];
    const pushUnique = (raw) => {
      const text = String(raw ?? "").trim();
      if (!text) return;
      const key = normKey(text);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(text);
    };
    (Array.isArray(globalList) ? globalList : []).forEach(pushUnique);
    (Array.isArray(countryList) ? countryList : []).forEach(pushUnique);
    return out;
  };

  const mergeFaqLists = (globalList, countryList) => {
    const seen = new Set();
    const out = [];
    const pushUnique = (raw) => {
      const question = String(raw?.question ?? "").trim();
      const answer = String(raw?.answer ?? "").trim();
      if (!question || !answer) return;
      const key = normKey(question);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ question, answer });
    };
    (Array.isArray(globalList) ? globalList : []).forEach(pushUnique);
    (Array.isArray(countryList) ? countryList : []).forEach(pushUnique);
    return out;
  };

  const mergeHowItWorksLists = (globalList, countryList) => {
    const seen = new Set();
    const out = [];
    const pushUnique = (raw) => {
      const title = String(raw?.title ?? "").trim();
      const description = String(raw?.description ?? "").trim();
      if (!title || !description) return;
      const key = normKey(title);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ title, description });
    };
    (Array.isArray(globalList) ? globalList : []).forEach(pushUnique);
    (Array.isArray(countryList) ? countryList : []).forEach(pushUnique);
    return out;
  };

  const mergeIncludedItems = (globalList, countryList) => {
    const seen = new Set();
    const out = [];
    const pushUnique = (raw) => {
      let item;
      if (typeof raw === "string") {
        item = { title: raw.trim(), description: "", icon: "", color: "blue" };
      } else {
        item = {
          title: String(raw?.title ?? "").trim(),
          description: String(raw?.description ?? "").trim(),
          icon: String(raw?.icon ?? "").trim(),
          color: String(raw?.color ?? "blue").trim(),
        };
      }
      if (!item.title) return;
      const key = normKey(item.title);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(item);
    };
    (Array.isArray(globalList) ? globalList : []).forEach(pushUnique);
    (Array.isArray(countryList) ? countryList : []).forEach(pushUnique);
    return out;
  };

  const whyBookNow = useMemo(() => {
    const useGlobal = country?.useGlobalWhyBookNow !== false;
    const ex = new Set(country?.excludeDestinationWhyBookNow || []);
    const g = useGlobal ? (destinationPageContent?.whyBookNow || []).filter((line) => !ex.has(normKey(line))) : [];
    const merged = mergeStringLists(g, country?.whyBookNow);
    if (merged.length) return merged;
    return [
      "Fast document pre-check by visa specialists",
      "Transparent pricing and status updates",
      "Dedicated support throughout your application",
    ];
  }, [country, destinationPageContent]);

  const includedItems = useMemo(() => {
    const useGlobal = country?.useGlobalIncludedItems !== false;
    const ex = new Set(country?.excludeDestinationIncludedItems || []);
    const g = useGlobal 
      ? (destinationPageContent?.includedItems || destinationPageContent?.included || [])
          .filter((line) => !ex.has(normKey(line?.title || line)))
      : [];
    
    const merged = mergeIncludedItems(g, country?.includedItems ?? country?.included);

    const defaultData = [
      {
        title: "Application Form Guidance",
        description: "Step-by-step guidance to fill your visa application form accurately and confidently.",
        Icon: FileEdit,
        color: "blue",
      },
      {
        title: "Document Checklist & Validation",
        description: "We provide a complete checklist and verify your documents to ensure everything is in order.",
        Icon: ListChecks,
        color: "green",
      },
      {
        title: "End-to-end Support till Submission",
        description: "Our experts assist you at every step until your application is successfully submitted.",
        Icon: Headphones,
        color: "purple",
      },
    ];

    if (merged.length === 0) return defaultData;

    return merged.map((item, idx) => {
      const found = defaultData.find((d) => d.title.toLowerCase() === item.title.toLowerCase());
      
      // Fallback description/icon for legacy strings that were auto-converted to objects
      let desc = item.description;
      let icon = item.icon;
      let col = item.color;

      if (!desc && !icon) {
        // This was likely a legacy string like "Title: Description"
        const split = item.title.split(/[:\-]\s/);
        if (split.length > 1) {
          item.title = split[0];
          desc = split.slice(1).join(": ");
        } else {
          desc = "Professional assistance for your visa application process.";
        }
      }

      return {
        ...item,
        description: desc,
        Icon: found ? found.Icon : null,
        color: col || (idx === 0 ? "blue" : idx === 1 ? "green" : "purple"),
      };
    });
  }, [country, destinationPageContent]);

  const faqs = useMemo(() => {
    const useGlobal = country?.useGlobalFaqs !== false;
    const ex = new Set(country?.excludeDestinationFaqQuestions || []);
    const g = useGlobal ? (destinationPageContent?.faqs || []).filter((f) => !ex.has(normKey(f?.question))) : [];
    const merged = mergeFaqLists(g, country?.faqs);
    if (merged.length) return merged;
    return [
      { question: "How long does processing take?", answer: `Typical processing is ${country?.processingDays ?? ""} based on current embassy timelines.` },
      { question: "Can I track my application?", answer: "Yes, you can track status updates from your user dashboard after applying." },
      { question: "Is this fee refundable?", answer: "Government and service fees depend on visa policy and review stage." },
    ];
  }, [country, destinationPageContent]);

  const howItWorks = useMemo(() => {
    const useGlobal = country?.useGlobalHowItWorks !== false;
    const ex = new Set(country?.excludeDestinationHowItWorksTitles || []);
    const g = useGlobal ? (destinationPageContent?.howItWorks || []).filter((s) => !ex.has(normKey(s?.title))) : [];
    const merged = mergeHowItWorksLists(g, country?.howItWorks);
    if (merged.length) return merged;
    return [
      { title: "Apply with SprintVisa", description: "Upload your documents on SprintVisa or share over WhatsApp with our visa expert." },
      { title: "Experts review the documents", description: "Our visa experts will verify your documents." },
      { title: "Prepare the application", description: "Our visa expert will help you create the application for document submission." },
      { title: "Visit the Visa Application Center", description: "Traveller visits their nearest Visa Application Center for document submission." },
      { title: "Get your visa", description: "Traveller will collect their passport from VAC or via courier with a stamped visa." },
      { title: "Enjoy your vacation", description: "Thanks for choosing SprintVisa and we wish you an amazing journey." },
    ];
  }, [country, destinationPageContent]);

  /**
   * Visa requirements = global defaults (with country exclusions applied) + the country's
   * free-text `requirements` array appended as country-specific extras. Duplicates skipped.
   */
  const visaRequirements = useMemo(() => {
    const useGlobal = country?.useGlobalVisaRequirements !== false;
    const ex = new Set(country?.excludeDestinationVisaRequirements || []);
    const g = useGlobal ? (destinationPageContent?.visaRequirements || []).filter((line) => !ex.has(normKey(line))) : [];
    const merged = mergeStringLists(g, country?.requirements);
    if (merged.length) return merged;
    return [
      "Original passport valid for at least 6 months with two blank pages",
      "Recent passport-size photograph on white background",
      "Confirmed return flight tickets",
      "Hotel booking or proof of accommodation for the entire stay",
      "Bank statements showing sufficient funds for the trip",
    ];
  }, [country, destinationPageContent]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get("/config/destination-content");
        if (alive && data?.success && data.config) setDestinationPageContent(data.config);
      } catch {
        /* keep fallbacks below */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!paymentSummaryOpen) return;
    let active = true;
    const checkReadiness = async () => {
      setRazorpayCheckLoading(true);
      const result = await validateRazorpayCheckoutReadiness();
      if (!active) return;
      setRazorpayReady(!!result.ok);
      setRazorpayReadyMessage(result.ok ? "" : result.message || "");
      setRazorpayCheckLoading(false);
    };
    checkReadiness();
    return () => { active = false; };
  }, [paymentSummaryOpen]);

  /**
   * Auto-focus the first empty traveler name input whenever the travel-details
   * panel opens or a new traveler row is added. This gives the user the
   * "blinking cursor ready to type" experience without an extra click. We do
   * NOT steal focus on every render — only when the empty-slot count grows or
   * the panel transitions from closed → open.
   */
  useEffect(() => {
    if (!showTravelDetails) return;
    const focusFirstEmpty = () => {
      const firstEmptyIndex = travelers.findIndex(
        (traveler) => !String(traveler?.name || "").trim()
      );
      if (firstEmptyIndex < 0) return;
      const node = travelerNameInputRefs.current[firstEmptyIndex];
      if (!node) return;
      // Skip if the user is already typing somewhere else (e.g. date pickers).
      const active = document.activeElement;
      if (active && active !== document.body && active.tagName !== "BUTTON") return;
      try {
        node.focus({ preventScroll: true });
        // Place caret at the end if there's any existing text.
        const len = node.value?.length || 0;
        if (len) node.setSelectionRange(len, len);
      } catch {
        /* ignore */
      }
    };
    // Defer one frame so the panel's mount animation doesn't fight the focus.
    const raf = window.requestAnimationFrame(focusFirstEmpty);
    return () => window.cancelAnimationFrame(raf);
    // We intentionally key off the traveler count + panel state — re-running on
    // every keystroke would yank focus back from the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTravelDetails, travelers.length]);

  useEffect(() => {
    const handleGlobalTypingForTravelerName = (event) => {
      if (!showTravelDetails) return;

      const activeElement = document.activeElement;
      const tagName = activeElement?.tagName?.toLowerCase();
      const isTypingInFormField = (
        activeElement?.isContentEditable ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      );
      if (isTypingInFormField) return;

      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.length !== 1 && event.key !== "Backspace") return;

      const firstEmptyIndex = travelers.findIndex((traveler) => !String(traveler?.name || "").trim());
      const targetIndex = firstEmptyIndex >= 0 ? firstEmptyIndex : 0;
      const targetInput = travelerNameInputRefs.current[targetIndex];
      if (!targetInput) return;

      event.preventDefault();
      targetInput.focus();

      setTravelers((prev) =>
        prev.map((traveler, i) => {
          if (i !== targetIndex) return traveler;
          const currentName = String(traveler?.name || "");
          if (event.key === "Backspace") {
            return { ...traveler, name: currentName.slice(0, -1) };
          }
          return { ...traveler, name: `${currentName}${event.key}` };
        })
      );
    };

    window.addEventListener("keydown", handleGlobalTypingForTravelerName);
    return () => window.removeEventListener("keydown", handleGlobalTypingForTravelerName);
  }, [showTravelDetails, travelers]);

  useEffect(() => {
    const handleGlobalClickToFocusName = (event) => {
      if (!showTravelDetails) return;

      const target = event.target;
      if (!target) return;

      const isInteractive = (
        target.isContentEditable ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.tagName === "BUTTON" ||
        target.closest("button") ||
        target.closest("a") ||
        target.closest(".react-datepicker") ||
        target.closest(".date-picker-container")
      );

      if (isInteractive) return;

      const firstEmptyIndex = travelers.findIndex((traveler) => !String(traveler?.name || "").trim());
      const targetIndex = firstEmptyIndex >= 0 ? firstEmptyIndex : 0;
      const targetInput = travelerNameInputRefs.current[targetIndex];
      
      if (targetInput) {
        // Use a short timeout so we don't steal focus from an ongoing browser native action
        setTimeout(() => {
          if (document.activeElement?.tagName !== "INPUT") {
            targetInput.focus({ preventScroll: true });
          }
        }, 10);
      }
    };

    window.addEventListener("click", handleGlobalClickToFocusName);
    return () => window.removeEventListener("click", handleGlobalClickToFocusName);
  }, [showTravelDetails, travelers]);

  useEffect(() => {
    if (showTravelDetails) {
      setShowStickyStartCta(false);
      startApplicationCardSeenRef.current = false;
      return;
    }

    const node = startApplicationCardRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setShowStickyStartCta(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startApplicationCardSeenRef.current = true;
          setShowStickyStartCta(false);
          return;
        }

        setShowStickyStartCta(
          startApplicationCardSeenRef.current && entry.boundingClientRect.top < 0
        );
      },
      {
        threshold: 0.2,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [showTravelDetails]);

  /** Return date must stay on/after departure; both must be today or later. */
  useEffect(() => {
    if (!travelDateFrom || !travelDateTo) return;
    if (travelDateTo < travelDateFrom) {
      setTravelDateTo(travelDateFrom);
    }
  }, [travelDateFrom, travelDateTo]);

  useEffect(() => {
    if (!countryId) return;
    const draft = loadTravelDraft(countryId);
    if (!draft) return;
    const today = getLocalDateYmd();
    let from = draft.travelDateFrom != null && String(draft.travelDateFrom).length
      ? String(draft.travelDateFrom).trim()
      : "";
    let to = draft.travelDateTo != null && String(draft.travelDateTo).length
      ? String(draft.travelDateTo).trim()
      : "";
    if (from && from < today) from = "";
    if (to && to < today) to = "";
    if (!from) to = "";
    if (from && to && to < from) to = from;
    if (draft.travelDateFrom != null && String(draft.travelDateFrom).length) {
      setTravelDateFrom(from);
    }
    if (draft.travelDateTo != null && String(draft.travelDateTo).length) {
      setTravelDateTo(to);
    }
    if (draft.visaOption) setVisaOption(String(draft.visaOption));
    if (draft.sharedDriveLink != null) {
      const restoredLink = String(draft.sharedDriveLink || "").trim();
      setSharedDriveLink(restoredLink);
      setSharedDriveLinkVerified(Boolean(restoredLink));
    }
    if (Array.isArray(draft.travelers) && draft.travelers.length > 0) {
      setTravelers(draft.travelers.map((t) => ({ ...createTravelerState(), name: String(t?.name || "") })));
    }
    if (draft.applicationId) {
      setCurrentApplicationId(String(draft.applicationId));
    }
    if (draft.showTravelDetails) {
      setShowTravelDetails(true);
      window.setTimeout(() => {
        const node = document.getElementById("travel-details");
        if (!node) return;
        const stickyOffset = 150;
        const targetTop = window.scrollY + node.getBoundingClientRect().top - stickyOffset;
        window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      }, 180);
    }
  }, [countryId]);

  useEffect(() => {
    if (location.state?.restoreTravelDetails) {
      const restore = location.state.restoreTravelDetails;
      if (restore.travelDateFrom) setTravelDateFrom(restore.travelDateFrom);
      if (restore.travelDateTo) setTravelDateTo(restore.travelDateTo);
      if (restore.visaOption) setVisaOption(restore.visaOption);
      if (restore.sharedDriveLink != null) {
        const restoredLink = String(restore.sharedDriveLink || "").trim();
        setSharedDriveLink(restoredLink);
        setSharedDriveLinkVerified(Boolean(restoredLink));
      }
      if (Array.isArray(restore.travelers)) {
        setTravelers(restore.travelers.map((t) => ({ ...createTravelerState(), name: String(t.name || "") })));
      }
      if (location.state?.applicationDraftId || restore.applicationDraftId) {
        setCurrentApplicationId(String(location.state?.applicationDraftId || restore.applicationDraftId));
      }
      setShowTravelDetails(true);
      window.setTimeout(() => {
        const node = document.getElementById("travel-details");
        if (node) {
          const stickyOffset = 150;
          const targetTop = window.scrollY + node.getBoundingClientRect().top - stickyOffset;
          window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
        }
      }, 180);
    }
  }, [location.state]);

  useEffect(() => {
    if (!currentApplicationId || !localStorage.getItem("token")) return;
    let cancelled = false;

    const loadPassportState = async () => {
      try {
        const { data } = await api.get(`/users/applications/${currentApplicationId}`);
        if (cancelled || !data?.success || !data.application) return;

        const nextSuccesses = {};
        const nextDetails = {};
        const count = Math.max(1, Number(data.application?.travellerCount || travelers.length || 1));
        for (let index = 0; index < count; index += 1) {
          const travelerNo = index + 1;
          const detail = getTravelerPassportDetail(data.application, travelerNo);
          if (!detail) continue;
          nextSuccesses[travelerNo] = true;
          nextDetails[travelerNo] = detail;
        }

        setPassportSuccesses((prev) => ({ ...prev, ...nextSuccesses }));
        setPassportDetails((prev) => ({ ...prev, ...nextDetails }));
      } catch {
        /* Restoring upload status should not block the travel form. */
      }
    };

    loadPassportState();
    return () => {
      cancelled = true;
    };
  }, [currentApplicationId, travelers.length]);

  useEffect(() => {
    const raw = (location.hash || "").replace(/^#/, "");
    if (raw !== "travel-details") return;
    setShowTravelDetails(true);
    const timer = window.setTimeout(() => {
      const node = document.getElementById("travel-details");
      if (!node) return;
      const stickyOffset = 150;
      const targetTop = window.scrollY + node.getBoundingClientRect().top - stickyOffset;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [location.hash, location.pathname]);

  // Read `?postLoginAction=...` once on mount, then strip it from the URL so
  // a manual refresh doesn't keep re-triggering the resumed flow. The actual
  // dispatch happens in the next effect once everything is hydrated.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get("postLoginAction");
    if (!action) return;
    setPendingPostLoginAction(action);
    params.delete("postLoginAction");
    const cleaned = params.toString();
    navigate(`${location.pathname}${cleaned ? `?${cleaned}` : ""}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Freeze body scroll while the post-login resume splash is on top so the
  // user can't accidentally interact with the destination page underneath.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!pendingPostLoginAction) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [pendingPostLoginAction]);

  // Dispatch the saved action once the page has hydrated:
  //   1. countries fetched (country becomes truthy),
  //   2. user is authenticated,
  //   3. travel draft has been read into state (dates + every traveler name).
  // Looking everything up via the ref means we don't have to worry about the
  // handler definitions living below the early return.
  useEffect(() => {
    if (!pendingPostLoginAction) return;
    if (!country || !isAuthenticated) return;
    if (!travelDateFrom || !travelDateTo) return;
    if (!travelers.every((t) => String(t.name || "").trim())) return;
    const fn = postLoginHandlersRef.current[pendingPostLoginAction];
    if (typeof fn !== "function") return;
    setPendingPostLoginAction(null);
    const id = window.setTimeout(() => fn(), 60);
    return () => window.clearTimeout(id);
  }, [pendingPostLoginAction, country, isAuthenticated, travelDateFrom, travelDateTo, travelers]);

  // ── Safe to early-return after all hooks ──
  if (!country) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-text-primary">Destination not found</h1>
        <Button onClick={() => navigate("/")} className="mt-4">Return Home</Button>
      </div>
    );
  }

  const minDepartureYmd = getLocalDateYmd();

  const requiredDocumentKeys = Array.isArray(country.requiredDocuments) && country.requiredDocuments.length
    ? country.requiredDocuments
    : ["passport"];
  const requiredDocumentFields = requiredDocumentKeys.map((key) => ({
    key,
    label: getDocumentLabel(key),
    description: getDocumentDescription(key),
    iconClass: getDocumentCatalogIcon(key),
    Icon: getDocumentIcon(key),
    featured: false,
  }));

  const handleBack = () => {
    if (showTravelDetails) {
      setShowTravelDetails(false);
      saveTravelDraft(countryId, {
        applicationId: currentApplicationId,
        travelDateFrom,
        travelDateTo,
        visaOption,
        sharedDriveLink,
        travelers: travelers.map((t) => ({ name: String(t.name || "") })),
        showTravelDetails: false,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    navigate("/", { replace: false });
  };

  const addTraveler = () => {
    setTravelers((prev) => [...prev, createTravelerState()]);
  };

  const incrementTravelerCount = () => {
    addTraveler();
  };

  const removeTravelerAt = (indexToRemove) => {
    setTravelers((prev) => (prev.length > 1
      ? prev.filter((_, index) => index !== indexToRemove)
      : prev));
    setPassportUploading((prev) => {
      const next = { ...prev };
      delete next[indexToRemove + 1];
      return next;
    });
    setPassportErrors((prev) => {
      const next = { ...prev };
      delete next[indexToRemove + 1];
      return next;
    });
    setPassportSuccesses((prev) => {
      const next = { ...prev };
      delete next[indexToRemove + 1];
      return next;
    });
    setPassportDetails((prev) => {
      const next = { ...prev };
      delete next[indexToRemove + 1];
      return next;
    });
  };

  const decrementTravelerCount = () => {
    if (travelers.length <= 1) return;
    removeTravelerAt(travelers.length - 1);
  };

  const updateTravelerName = (index, name) => {
    setTravelers((prev) =>
      prev.map((t, i) => (i === index ? { ...t, name } : t))
    );
  };

  const updateTravelerPassportFile = (index, passportFile) => {
    setTravelers((prev) =>
      prev.map((t, i) => (i === index ? { ...t, passportFile: passportFile || null } : t))
    );
  };

  const handleTravelerPassportFile = async (index, rawFile) => {
    const travelerNo = index + 1;
    if (!rawFile) {
      updateTravelerPassportFile(index, null);
      setPassportErrors((prev) => {
        const next = { ...prev };
        delete next[travelerNo];
        return next;
      });
      return;
    }
    if (!ALLOWED_PASSPORT_MIME_TYPES.has(String(rawFile.type || "").toLowerCase())) {
      setPassportErrors((prev) => ({ ...prev, [travelerNo]: INVALID_PASSPORT_TYPE_ERROR }));
      showToast(INVALID_PASSPORT_TYPE_ERROR, "error");
      return;
    }
    if (rawFile.size > RAW_UPLOAD_LIMIT_BYTES) {
      const message = "File must be below 8 MB.";
      setPassportErrors((prev) => ({ ...prev, [travelerNo]: message }));
      showToast(message, "error");
      return;
    }
    const { file: optimizedFile, error } = await optimizeUploadFile(rawFile, {
      targetBytes: PASSPORT_UPLOAD_MAX_BYTES,
    });
    if (error || !optimizedFile) {
      const message = error || "Could not prepare passport file for upload.";
      setPassportErrors((prev) => ({ ...prev, [travelerNo]: message }));
      showToast(message, "error");
      return;
    }
    if (optimizedFile.size > PASSPORT_UPLOAD_MAX_BYTES) {
      setPassportErrors((prev) => ({ ...prev, [travelerNo]: PASSPORT_FILE_SIZE_ERROR }));
      showToast(PASSPORT_FILE_SIZE_ERROR, "error");
      return;
    }
    updateTravelerPassportFile(index, optimizedFile);
    setPassportErrors((prev) => {
      const next = { ...prev };
      delete next[travelerNo];
      return next;
    });
    setPassportUploading((prev) => ({ ...prev, [travelerNo]: true }));

    try {
      const appId = await createCheckoutDraftAndSetId();
      if (!appId) throw new Error("Could not create application draft.");

      const travelerName = String(travelers[index]?.name || "").trim() || `Traveler ${travelerNo}`;
      const formData = new FormData();
      const ext = (optimizedFile.name.split(".").pop() || "").toLowerCase();
      const safeExt = ext ? `.${ext}` : "";
      formData.append(
        "documents",
        new File([optimizedFile], `traveler-${travelerNo}_passport${safeExt}`, { type: optimizedFile.type })
      );
      formData.append("travelerNo", String(travelerNo));
      formData.append("travelerName", travelerName);
      if (String(sharedDriveLink || "").trim()) {
        formData.append("gdriveLink", String(sharedDriveLink || "").trim());
      }
      formData.append("documentsMeta", JSON.stringify([{ docType: "passport", kind: "required" }]));

      const { data } = await api.post(`/users/applications/${appId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (!data?.success || !data.application) {
        throw new Error(data?.message || "Could not upload passport.");
      }

      const detail = getTravelerPassportDetail(data.application, travelerNo) || {
        fileName: optimizedFile.name,
        fileSize: optimizedFile.size,
        mimeType: optimizedFile.type,
      };
      setPassportSuccesses((prev) => ({ ...prev, [travelerNo]: true }));
      setPassportDetails((prev) => ({ ...prev, [travelerNo]: detail }));
      updateTravelerPassportFile(index, null);
      saveTravelDraft(countryId, {
        applicationId: appId,
        travelDateFrom,
        travelDateTo,
        visaOption,
        sharedDriveLink,
        travelers: travelers.map((t) => ({ name: String(t.name || "") })),
        showTravelDetails: true,
      });
      await fetchUserApplications();
      showToast("Passport uploaded successfully.", "success");
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Could not upload passport.";
      setPassportErrors((prev) => ({ ...prev, [travelerNo]: message }));
      showToast(message, "error");
    } finally {
      setPassportUploading((prev) => {
        const next = { ...prev };
        delete next[travelerNo];
        return next;
      });
    }
  };

  const handleSharedDriveLinkChange = (value) => {
    setSharedDriveLink(value);
    setSharedDriveLinkVerified(false);

    if (driveLinkSaveTimerRef.current) {
      window.clearTimeout(driveLinkSaveTimerRef.current);
      driveLinkSaveTimerRef.current = null;
    }

    const trimmed = String(value || "").trim();
    if (!trimmed) return;

    driveLinkSaveTimerRef.current = window.setTimeout(() => {
      const normalized = normalizeDriveLink(trimmed);
      setSharedDriveLink(normalized);
      setSharedDriveLinkVerified(true);
      showToast("Google Drive link saved.", "success");
      driveLinkSaveTimerRef.current = null;
    }, 1000);
  };

  useEffect(() => () => {
    if (driveLinkSaveTimerRef.current) {
      window.clearTimeout(driveLinkSaveTimerRef.current);
    }
  }, []);

  const formatTravelRange = () => {
    if (!travelDateFrom && !travelDateTo) return "—";
    try {
      const from = travelDateFrom
        ? formatOrdinalDate(new Date(`${travelDateFrom}T12:00:00`))
        : "—";
      const to = travelDateTo
        ? formatOrdinalDate(new Date(`${travelDateTo}T12:00:00`))
        : "—";
      if (travelDateFrom && travelDateTo) return `${from} – ${to}`;
      return travelDateFrom ? `${from}` : to;
    } catch {
      return "—";
    }
  };

  /** Show the actual admin-set visa type on the country basics card (no 3-bucket collapse). */
  const getCardVisaTypeLabel = (visaTypeValue) => {
    const value = String(visaTypeValue || "").trim();
    return value || "Tourist Visa";
  };

  const parsedVisaRequirements = useMemo(() => {
    const splitRequirement = (raw) => {
      const text = String(raw || "").trim();
      if (!text) return null;
      if (/^note\s*:/i.test(text)) {
        return {
          type: "note",
          content: text.replace(/^note\s*:/i, "").trim(),
        };
      }

      const separators = ["::", " — ", " – ", " - ", ":"];
      for (const separator of separators) {
        const index = text.indexOf(separator);
        if (index > 0) {
          const title = text.slice(0, index).trim();
          const description = text.slice(index + separator.length).trim();
          if (title && description) {
            return { type: "item", title, description };
          }
        }
      }

      return {
        type: "item",
        title: text,
        description: "",
      };
    };

    const parsed = visaRequirements.map(splitRequirement).filter(Boolean);
    const items = parsed.filter((entry) => entry.type === "item");
    const note = parsed.find((entry) => entry.type === "note");

    return {
      items,
      note:
        note?.content ||
        "Additional documents may be required depending on your visa type, travel purpose, and embassy guidelines.",
    };
  }, [visaRequirements]);

  const SUB_NAV = useMemo(() => showTravelDetails
    ? [{ id: "travel-details", label: "Travel Details" }]
    : [
        { id: "info", label: "Info" },
        { id: "how-it-works", label: "How it works" },
        ...(destinationPageContent?.showVisaRequirements !== false
          ? [{ id: "visa-requirements", label: "Visa Requirements" }]
          : []),
        // Skip the Document Requirements nav entry when the universal toggle hides
        // the entire section — clicking it would scroll to nothing.
        ...(countryDisplay?.showRequiredDocuments !== false
          ? [{ id: "document-requirements", label: "Document Requirements" }]
          : []),
        { id: "why-book-now", label: "Why book now?" },
        { id: "whats-included", label: "What's Included" },
        { id: "faqs", label: "FAQs" },
      ], [showTravelDetails, countryDisplay?.showRequiredDocuments, destinationPageContent?.showVisaRequirements]);

  useEffect(() => {
    setActiveSubNav(SUB_NAV[0]?.id || "");
  }, [SUB_NAV]);

  useEffect(() => {
    if (typeof window === "undefined" || !SUB_NAV.length) return;

    const updateActiveSubNav = () => {
      const scrollAnchor = window.scrollY + 190;
      let nextActive = SUB_NAV[0]?.id || "";

      for (const tab of SUB_NAV) {
        const section = document.getElementById(tab.id);
        if (!section) continue;
        if (section.offsetTop <= scrollAnchor) {
          nextActive = tab.id;
        }
      }

      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8) {
        nextActive = SUB_NAV[SUB_NAV.length - 1]?.id || nextActive;
      }

      setActiveSubNav((prev) => (prev === nextActive ? prev : nextActive));
    };

    updateActiveSubNav();
    window.addEventListener("scroll", updateActiveSubNav, { passive: true });
    window.addEventListener("resize", updateActiveSubNav);

    return () => {
      window.removeEventListener("scroll", updateActiveSubNav);
      window.removeEventListener("resize", updateActiveSubNav);
    };
  }, [SUB_NAV]);

  const scrollToSection = (sectionId) => {
    const node = document.getElementById(sectionId);
    if (!node) return;
    setActiveSubNav(sectionId);
    const stickyOffset = 150;
    const targetTop = window.scrollY + node.getBoundingClientRect().top - stickyOffset;
    window.scrollTo({ top: targetTop, behavior: "smooth" });
  };

  const clearContactGate = () => {
    pendingContactAction.current = null;
    setContactGateDismissed(true);
    setContactModalOpen(false);
  };

  const openContactGate = (mode, after) => {
    pendingContactAction.current = after;
    setContactModalMode(mode);
    setContactModalOpen(true);
  };

  const completeContactGate = () => {
    const fn = pendingContactAction.current;
    pendingContactAction.current = null;
    setContactModalOpen(false);
    fn?.();
  };

  /** If a gate opens, runs `after` only after the user saves phone/email in the modal. */
  const gateContactOrRun = (after) => {
    const token = localStorage.getItem("token");
    if (!isAuthenticated || !token || !user) {
      after();
      return;
    }
    if (contactGateDismissed) {
      after();
      return;
    }
    const method = sessionAuthMethod ?? useAuthStore.getState().sessionAuthMethod;
    if (needsPhoneContactGate(method, user)) {
      openContactGate("phone", after);
      return;
    }
    if (needsEmailContactGate(method, user)) {
      openContactGate("email", after);
      return;
    }
    after();
  };

  const openTravelDetails = () => {
    setShowTravelDetails(true);
    setTimeout(() => scrollToSection("travel-details"), 100);
  };

  const handleStartApplication = () => {
    gateContactOrRun(() => openTravelDetails());
  };

  /**
   * Persist whatever the guest has typed into the travel-details panel so the
   * form is restored after they bounce through /login. Called from BOTH the
   * "Upload docs now" / "Upload docs later" entry points before any auth
   * redirect can swallow the state.
   */
  const persistCurrentTravelDraft = () => {
    saveTravelDraft(countryId, {
      applicationId: currentApplicationId,
      travelDateFrom,
      travelDateTo,
      visaOption,
      sharedDriveLink,
      travelers: travelers.map((t) => ({ name: String(t.name || "") })),
      showTravelDetails: true,
    });
    localStorage.setItem("lastActiveCountryId", countryId);
    if (country?.name) {
      localStorage.setItem("lastActiveCountryName", country.name);
    }
  };

  /** Build the `redirect=` value used when a guest needs to log in mid-flow. */
  const buildLoginRedirect = (postAction) => {
    const params = new URLSearchParams();
    if (postAction) params.set("postLoginAction", postAction);
    const qs = params.toString();
    return `${location.pathname}${qs ? `?${qs}` : ""}`;
  };

  const handleUploadDocsNow = () => {
    if (!validateTravelDetails("Upload documents now")) return;
    const token = localStorage.getItem("token");
    // Save the form ALWAYS — even when bouncing through login — so the user
    // returns to a fully-filled travel-details panel.
    persistCurrentTravelDraft();
    if (!isAuthenticated && !token) {
      const next = buildLoginRedirect("upload-now");
      navigate(`/login?redirect=${encodeURIComponent(next)}`);
      showToast("Please log in to continue with uploading documents.", "info");
      return;
    }
    gateContactOrRun(() => {
      navigate(`/apply/${country.id}`, {
        state: {
          travelerNames: getTravelerNames(),
          travellerCount,
          travelDateFrom,
          travelDateTo,
          visaOption,
          sharedDriveLink,
        },
        replace: true,
      });
    });
  };

  const handleUploadDocsLater = async () => {
    if (!validateTravelDetails("Proceed to Summary")) return;
    const travelerNames = getTravelerNames();

    const token = localStorage.getItem("token");
    persistCurrentTravelDraft();
    if (!isAuthenticated && !token) {
      const next = buildLoginRedirect("upload-later");
      navigate(`/login?redirect=${encodeURIComponent(next)}`);
      showToast("Please log in to continue with your application.", "info");
      return;
    }

    gateContactOrRun(async () => {
      const appId = await createCheckoutDraftAndSetId();
      if (!appId) {
        showToast("Could not create your application draft.", "error");
        return;
      }
      const routeId = getCountryRouteId(country);
      const sourceMeta = {
        from: "travel-details",
        backTo: `/destination/${routeId}`,
        applicationDraftId: appId,
        preserveForm: true,
      };
      try {
        sessionStorage.setItem("paymentSummarySource", JSON.stringify(sourceMeta));
      } catch {
        /* ignore storage errors */
      }
      // Travel draft is already saved by `persistCurrentTravelDraft()` above —
      // just navigate forward.
      navigate(`/destination/${routeId}/summary`, {
        state: {
          ...sourceMeta,
          docsSkipped: true,
          summaryData: {
            applicationId: appId,
            countryId: country.id,
            countryName: country.name,
            flagEmoji: country.flagEmoji || "🛂",
            visaType: visaOption || country.visaType || "e-Visa",
            travellerCount,
            fee: payableToUs,
            baseFee: serviceAmount,
            gstAmount,
            gstRate: effectiveGstRate,
            gstEnabled: effectiveGstEnabled,
            travelerNames,
            docsUploaded: false,
            travelDateFrom: travelDateFrom || null,
            travelDateTo: travelDateTo || null,
            sharedDriveLink: sharedDriveLink || "",
          },
          applicationPrev: {
            path: `/destination/${routeId}`,
            state: {
              restoreTravelDetails: {
                travelDateFrom: travelDateFrom || null,
                travelDateTo: travelDateTo || null,
                visaOption: visaOption || country.visaType || "e-Visa",
                sharedDriveLink: sharedDriveLink || "",
                travelers: travelers.map((t) => ({ name: String(t.name || "") })),
              },
            },
          },
        },
        replace: true,
      });
    });
  };

  // Bridge for the post-login resume effect (defined above the early return).
  // Updating the ref each render keeps the resumed handler closure fresh.
  postLoginHandlersRef.current = {
    "upload-now": handleUploadDocsNow,
    "upload-later": handleUploadDocsLater,
  };

  const closePaymentSummaryModal = () => {
    setPaymentSummaryOpen(false);
    setVisaTermsAccepted(false);
  };

  const getTravelerNames = () => travelers.map((t) => String(t.name || "").trim());

  const validateTravelDetails = (actionLabel) => {
    setTravelValidationAttempted(true);

    if (!travelDateFrom || !travelDateTo) {
      showToast(`Please select both travel dates before choosing ${actionLabel}.`, "error");
      return false;
    }

    const missingName = travelers.findIndex((t) => !String(t.name || "").trim());
    if (missingName >= 0) {
      showToast(`Please enter traveler ${missingName + 1} name before choosing ${actionLabel}.`, "error");
      return false;
    }
    return true;
  };

  const dateWarning = travelValidationAttempted && (!travelDateFrom || !travelDateTo);


  const createCheckoutDraftAndSetId = async () => {
    const token = localStorage.getItem("token");
    if (!isAuthenticated && !token) {
      // Pull the draft persistence + post-login resume forward here too — this
      // path is reached when the token silently expires mid-flow.
      persistCurrentTravelDraft();
      const next = buildLoginRedirect("upload-later");
      navigate(`/login?redirect=${encodeURIComponent(next)}`);
      showToast("Please log in to continue with your application.", "info");
      return null;
    }

    const travelerNames = travelers.map((t, i) => String(t.name || "").trim() || `Traveler ${i + 1}`);

    setDraftCreating(true);
    try {
      const { data } = await api.post("/users/application/checkout-draft", {
        applicationDraftId: String(currentApplicationId || "").trim() || undefined,
        countryId: country.id,
        countryName: country.name,
        flagEmoji: country.flagEmoji || "🛂",
        visaType: visaOption,
        travelDateFrom: travelDateFrom || null,
        travelDateTo: travelDateTo || null,
        travellerCount,
        travelerNames,
        processingDays: normalizeProcessingDays(country.processingDays),
      });

      if (!data?.success || !data.application?._id) {
        showToast(data?.message || "Could not start application.", "error");
        return null;
      }

      setCurrentApplicationId(data.application._id);
      return data.application._id;
    } catch (err) {
      // Frontend fallback: if draft API fails, reuse latest application for same country
      let candidateBookings = Array.isArray(bookings) ? bookings : [];
      try {
        const listRes = await api.get("/users/applications");
        if (listRes?.data?.success && Array.isArray(listRes.data.applications)) {
          candidateBookings = listRes.data.applications;
        }
      } catch {
        // Keep existing local bookings fallback
      }

      const fallback = candidateBookings
        .filter((b) => ((b?.countryId && b.countryId === country.id) || b?.countryName === country.name))
        .filter((b) => isReusableUnpaidApplication(b))
        .sort((a, b) => {
          const ta = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
          const tb = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
          return tb - ta;
        })[0];

      if (fallback?._id || fallback?.id) {
        const reuseId = fallback._id || fallback.id;
        setCurrentApplicationId(reuseId);
        showToast("Using your latest application draft.", "info");
        return reuseId;
      }

      if (err?.response?.status === 401) {
        localStorage.removeItem("token");
        persistCurrentTravelDraft();
        const next = buildLoginRedirect("upload-later");
        navigate(`/login?redirect=${encodeURIComponent(next)}`);
        showToast("Session expired. Please log in again.", "info");
        return null;
      }

      console.error("Draft creation failed:", err);
      showToast(err.response?.data?.message || err.message || "Could not create application draft.", "error");
      return null;
    } finally {
      setDraftCreating(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!visaTermsAccepted || paymentSubmitting) return;
    if (!razorpayReady) {
      showToast(
        razorpayReadyMessage || "Razorpay is not ready yet. Please try again.",
        "error"
      );
      return;
    }

    if (!currentApplicationId) {
      showToast("Application draft is missing. Reopen and try again.", "error");
      return;
    }

    setPaymentSubmitting(true);
    try {
      const fee = payableToUs;

      const result = await openRazorpayForApplication({
        applicationId: currentApplicationId,
        amountRupees: fee,
        description: `${country.name} visa — service fee`,
        applicantName: user.name || "Applicant",
        applicantEmail: user.email || "",
        onSuccess: async () => {
          await fetchUserApplications();
          closePaymentSummaryModal();
          showToast("Payment successful! Complete your application on the dashboard.", "success");
          navigate(`/dashboard/application/${encodeURIComponent(currentApplicationId)}`, { replace: true });
        },
        onDismiss: () => {
          showToast("Payment was not completed. Your application draft is still saved here.", "info");
        },
        onFailure: (message) => {
          showToast(message || "Payment could not be started. Check Razorpay keys in admin settings.", "error");
          navigate(`/dashboard?payment=failed&applicationId=${encodeURIComponent(currentApplicationId)}`, { replace: true });
        },
      });

      if (!result.success && !result.dismissed) {
        /* toasts handled in callbacks */
      }
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || err.message || "Something went wrong.", "error");
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const destinationInfoSections = (
    <>
      <motion.section
        id="how-it-works"
        initial="initial"
        animate="animate"
        variants={fadeUp}
        className="rounded-[2rem] bg-gradient-to-b from-transparent via-surface/40 to-transparent p-4 sm:p-8"
      >
        <div className="mb-6 flex items-center gap-2">
          <ListChecks size={18} className="text-cyan" />
          <h2 className="font-playfair text-2xl sm:text-4xl font-bold tracking-tight text-text-primary">How it works</h2>
        </div>
        <ol className="space-y-4">
          {howItWorks.map((step, idx) => (
            <motion.li
              key={`${step.title}-${idx}`}
              whileHover={{ scale: 1.012, y: -3 }}
              transition={{ type: "tween", duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="group flex items-start gap-4 rounded-[1.75rem] border border-white/8 bg-white/[0.03] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-md transition-all duration-300 ease-out hover:border-cyan/25 hover:bg-cyan/[0.04] hover:shadow-[0_24px_55px_rgba(34,211,238,0.10)]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan/20 bg-cyan/10 text-cyan font-bold text-sm transition-transform duration-300 ease-out group-hover:scale-105">
                {idx + 1}
              </span>
              <div className="flex-1">
                <p className="font-semibold text-text-primary text-sm sm:text-base transition-colors duration-300 ease-out group-hover:text-cyan">
                  {step.title}
                </p>
                <p className="text-sm text-text-secondary mt-1 leading-relaxed">{step.description}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </motion.section>

      {destinationPageContent?.showVisaRequirements !== false && (
        <motion.section
          id="visa-requirements"
          initial="initial"
          animate="animate"
          variants={fadeUp}
          className="overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] px-4 py-6 sm:px-8 sm:py-10"
        >
          <div className="w-full lg:mx-auto lg:max-w-6xl">
            <div className="text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-cyan/10 text-cyan">
                <ScrollText size={34} strokeWidth={2} />
              </div>
              <h2 className="mt-5 font-playfair text-2xl sm:text-4xl font-bold tracking-tight text-text-primary">
                Visa Requirements
              </h2>
              <div className="mx-auto mt-4 flex w-full max-w-xs items-center justify-center gap-4 text-cyan">
                <span className="h-px flex-1 bg-cyan/40" />
                <ShieldCheck size={18} />
                <span className="h-px flex-1 bg-cyan/40" />
              </div>
              <p className="mx-auto mt-5 max-w-3xl text-base sm:text-xl text-text-secondary">
                Please ensure you have the following documents ready for a smooth visa application process.
              </p>
            </div>

            <div className="mt-10 rounded-[1.75rem] bg-white/80 p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {parsedVisaRequirements.items.map((item, idx) => (
                  <motion.div
                    key={`${item.title}-${idx}`}
                    whileHover={{ y: -3, scale: 1.01 }}
                    transition={{ duration: 0.24, ease }}
                    className="flex items-start gap-4 rounded-[1.4rem] border border-cyan/15 bg-white/85 p-4 sm:p-5"
                  >
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-cyan/8 text-cyan sm:h-20 sm:w-20">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan text-background shadow-[0_14px_28px_rgba(34,211,238,0.22)] sm:h-12 sm:w-12">
                        <i
                          className={`${getVisaRequirementRemixIcon(item.title, item.description)} text-xl leading-none sm:text-2xl`}
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                    <div className="flex-1 border-l border-dashed border-cyan/35 pl-4">
                      <h3 className="text-sm sm:text-base font-semibold leading-tight text-text-primary">
                        {item.title}
                      </h3>
                      {item.description ? (
                        <p className="mt-2 text-xs sm:text-sm leading-6 text-text-secondary">
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 rounded-[1.35rem] bg-gradient-to-r from-cyan/10 via-amber-50 to-cyan/5 px-4 py-4 sm:px-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-400 text-white">
                    <span className="text-2xl font-semibold leading-none">i</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm sm:text-base font-semibold text-amber-700">Please Note</p>
                    <p className="mt-1 text-xs sm:text-sm leading-6 text-text-secondary">
                      {parsedVisaRequirements.note}
                    </p>
                  </div>
                  <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-amber-500">
                    <ShieldCheck size={24} strokeWidth={2} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {countryDisplay?.showRequiredDocuments !== false && (
        <motion.section
          id="document-requirements"
          initial="initial"
          animate="animate"
          variants={fadeUp}
          className="overflow-hidden rounded-[2rem] border border-cyan/10 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-4 py-6 shadow-[0_24px_60px_rgba(2,132,199,0.08)] sm:px-6 sm:py-10 lg:px-8"
        >
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-cyan/10 bg-[radial-gradient(circle_at_top,rgba(2,132,199,0.08),transparent_32%),linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)] px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-60"
              aria-hidden="true"
              style={{
                background:
                  "radial-gradient(circle at 15% 35%, rgba(2,132,199,0.12) 0, transparent 18%), radial-gradient(circle at 82% 18%, rgba(59,130,246,0.12) 0, transparent 22%)",
              }}
            />
            <div
              className="pointer-events-none absolute left-[-4%] top-20 hidden h-48 w-48 opacity-35 lg:block"
              aria-hidden="true"
              style={{
                backgroundImage: "radial-gradient(rgba(59,130,246,0.22) 1.2px, transparent 1.2px)",
                backgroundSize: "9px 9px",
                maskImage: "linear-gradient(90deg, black 60%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(90deg, black 60%, transparent 100%)",
              }}
            />
            <div className="pointer-events-none absolute right-6 top-24 hidden text-cyan/35 lg:block" aria-hidden="true">
              <Plane size={44} strokeWidth={2} />
            </div>

            <div className="relative mx-auto max-w-4xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan/15 bg-cyan/5 px-4 py-2 text-cyan shadow-[0_12px_30px_rgba(2,132,199,0.08)]">
                <ShieldCheck size={18} strokeWidth={2.2} />
                <span className="text-sm font-medium">Verified &amp; Secure</span>
              </div>
              <h2 className="mt-6 font-playfair text-2xl font-medium leading-tight text-text-primary sm:text-3xl lg:text-3xl">
                Documents Required
                <span className="block text-cyan">for {country.name} Visa</span>
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm text-text-secondary sm:text-base">
                To proceed with the application immediately
              </p>
            </div>

            <div className="relative mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {requiredDocumentFields.length ? requiredDocumentFields.map((doc) => {
              const Icon = doc.Icon;
              return (
                <motion.div
                  key={doc.key}
                  whileHover={{ y: -3, scale: 1.01 }}
                  transition={{ duration: 0.2, ease }}
                  className="group relative flex items-center gap-3 rounded-[1.5rem] border border-cyan/15 bg-white/90 px-3 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:px-4 sm:py-4"
                >

                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-cyan/8 text-cyan">
                    {doc.iconClass ? (
                      <i className={`${doc.iconClass} text-xl leading-none`} aria-hidden="true" />
                    ) : (
                      <Icon size={18} strokeWidth={2.1} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 text-left">
                    <h3 className="text-sm font-normal leading-tight text-text-primary sm:text-sm">
                      {doc.label}
                    </h3>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full bg-cyan/8 px-3 py-2 text-cyan text-xs font-normal">
                    <CircleCheck size={16} strokeWidth={2.4} />
                    <span>Required</span>
                  </div>
                </motion.div>
              );
            }) : (
              <p className="col-span-full text-sm text-text-muted text-center">
                No requirements configured yet.
              </p>
            )}
            </div>

          </div>
        </motion.section>
      )}

      <motion.section id="why-book-now" initial="initial" animate="animate" variants={fadeUp} className="mx-auto max-w-4xl rounded-[2rem] bg-white px-3 py-5 sm:px-6 sm:py-7 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex flex-col items-center gap-2 text-cyan mb-4">
            <BadgeCheck size={18} />
            <span className="text-xs font-semibold uppercase tracking-[0.24em]">Why book now</span>
          </div>
          <h2 className="font-playfair text-xl sm:text-3xl md:text-4xl font-bold tracking-tight text-text-primary">
            Visa application made simple and reliable
          </h2>
        </div>

          <div className="mt-6 overflow-hidden rounded-[1.5rem] bg-white">
            <div className="grid grid-cols-[minmax(0,1fr)_70px_70px] sm:grid-cols-[minmax(0,1.2fr)_120px_120px] md:grid-cols-[minmax(0,1.5fr)_190px_160px] items-end">
              <div className="px-2 sm:px-5 py-2 sm:py-3" />
              <div className="px-2 sm:px-5 py-2 sm:py-3 text-center">
                <span className="text-xs sm:text-sm md:text-xl font-bold tracking-tight text-cyan">We Provides</span>
              </div>
              <div className="px-2 sm:px-5 py-2 sm:py-3 text-center">
                <span className="text-xs sm:text-sm md:text-lg font-semibold text-text-muted">Others</span>
              </div>
            </div>

            <div className="divide-y divide-slate-200/80">
              {whyBookNow.map((item, idx) => (
                <div
                  key={`${item}-${idx}`}
                  className="grid items-center grid-cols-[minmax(0,1fr)_70px_70px] sm:grid-cols-[minmax(0,1.2fr)_120px_120px] md:grid-cols-[minmax(0,1.5fr)_190px_160px]"
                >
                  <div className="px-2 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm md:text-base font-medium text-text-primary">
                    {item}
                  </div>
                  <div className="px-2 sm:px-4 py-2 sm:py-3">
                    <div className="mx-auto flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-cyan text-background shadow-[0_10px_20px_rgba(34,211,238,0.18)]">
                      <CircleCheck size={14} strokeWidth={2.4} className="sm:hidden" />
                      <CircleCheck size={16} strokeWidth={2.4} className="hidden sm:block" />
                    </div>
                  </div>
                  <div className="px-2 sm:px-5 py-3 sm:py-4">
                    <div className="mx-auto flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-red-300/70 bg-red-100/70 text-red-400">
                      <X size={14} strokeWidth={2.2} className="sm:hidden" />
                      <X size={18} strokeWidth={2.2} className="hidden sm:block" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
      </motion.section>

      <motion.section
        id="whats-included"
        initial="initial"
        animate="animate"
        variants={fadeUp}
        className="relative overflow-hidden rounded-[2.5rem] border border-border bg-white px-4 py-10 sm:px-10 sm:py-16 shadow-[0_20px_50px_rgba(0,0,0,0.04)]"
      >
        <div className="flex flex-col md:flex-row md:items-center gap-6 mb-12 relative z-10">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-blue-50 text-blue-600 shadow-[0_10px_30px_rgba(37,99,235,0.1)] ring-1 ring-blue-100">
            <ShieldCheck size={40} strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="font-playfair text-3xl sm:text-5xl font-bold tracking-tight text-text-primary">
              What's Included
            </h2>
            <p className="text-text-secondary mt-2 text-base sm:text-lg max-w-xl">
              Everything you need for a smooth and hassle-free visa process.
            </p>
          </div>

          {/* Decorative background elements */}
          <div className="absolute -top-10 -right-10 opacity-[0.03] pointer-events-none">
             <Plane size={300} className="rotate-[-15deg]" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          {includedItems.map((item, idx) => {
            const Icon = item.Icon;
            const isSingleItemLastRow =
              includedItems.length > 1 &&
              includedItems.length % 3 === 1 &&
              idx === includedItems.length - 1;
            const colorClasses = {
              blue: {
                bg: "bg-blue-50",
                icon: "text-blue-600",
                ring: "ring-blue-100",
                shadow: "shadow-[0_15px_40px_rgba(37,99,235,0.12)]"
              },
              green: {
                bg: "bg-emerald-50",
                icon: "text-emerald-600",
                ring: "ring-emerald-100",
                shadow: "shadow-[0_15px_40px_rgba(16,185,129,0.12)]"
              },
              purple: {
                bg: "bg-purple-50",
                icon: "text-purple-600",
                ring: "ring-purple-100",
                shadow: "shadow-[0_15px_40px_rgba(147,51,234,0.12)]"
              }
            }[item.color] || {
              bg: "bg-gray-50",
              icon: "text-gray-600",
              ring: "ring-gray-100",
              shadow: "shadow-md"
            };

            return (
              <motion.div
                key={`${item.title}-${idx}`}
                whileHover={{ y: -8 }}
                className={`relative flex flex-col items-center text-center p-8 rounded-[2rem] border border-border bg-white shadow-[0_10px_30px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_20px_50px_rgba(0,0,0,0.06)] overflow-hidden ${
                  isSingleItemLastRow ? "md:col-start-2" : ""
                }`}
              >
                {/* Dots pattern overlay */}
                <div className="absolute bottom-0 right-0 w-24 h-24 opacity-[0.05] pointer-events-none">
                  <svg width="100" height="100" viewBox="0 0 100 100">
                    <defs>
                      <pattern id={`dots-${idx}`} x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="1.5" fill="currentColor" />
                      </pattern>
                    </defs>
                    <rect width="100" height="100" fill={`url(#dots-${idx})`} />
                  </svg>
                </div>

                <div className={`flex h-24 w-24 items-center justify-center rounded-full ${colorClasses.bg} ${colorClasses.icon} ${colorClasses.shadow} ring-1 ${colorClasses.ring} mb-8`}>
                  {item.Icon ? (
                    <item.Icon size={36} strokeWidth={1.5} />
                  ) : (
                    <i className={`${item.icon || 'ri-shield-check-line'} text-[42px]`} />
                  )}
                </div>

                <h3 className="font-playfair text-xl sm:text-2xl font-bold text-text-primary leading-tight mb-3">
                  {item.title}
                </h3>
                
                {/* Accent line */}
                <div className="w-10 h-1 bg-blue-500 rounded-full mb-6 mx-auto opacity-80" />

                <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      <motion.section
        id="faqs"
        initial="initial"
        animate="animate"
        variants={fadeUp}
        className="bg-surface border border-border rounded-2xl p-4 sm:p-6"
      >
        <div className="mb-6">
          <h2 className="font-playfair text-2xl sm:text-4xl font-bold tracking-tight text-text-primary">
            Frequently asked questions
          </h2>
        </div>
        <div className="divide-y divide-border/70">
          {faqs.map((faq, idx) => (
            <div key={`${faq.question}-${idx}`} className="py-5 sm:py-6">
              <button
                type="button"
                onClick={() => setOpenFaqIndex((prev) => (prev === idx ? -1 : idx))}
                className="flex w-full items-start justify-between gap-4 text-left"
                aria-expanded={openFaqIndex === idx}
              >
                <span className="pr-4 text-lg sm:text-[1.7rem] font-semibold leading-tight text-text-primary">
                  {faq.question}
                </span>
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-text-primary transition-colors">
                  {openFaqIndex === idx ? <X size={20} /> : <Plus size={22} />}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {openFaqIndex === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease }}
                    className="overflow-hidden"
                  >
                    <motion.p
                      initial={{ y: -8 }}
                      animate={{ y: 0 }}
                      exit={{ y: -8 }}
                      transition={{ duration: 0.22, ease }}
                      className="max-w-5xl pt-4 text-base leading-8 text-text-secondary"
                    >
                      {faq.answer}
                    </motion.p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </motion.section>
    </>
  );

  return (
    <div className="relative isolate min-h-screen bg-background flex flex-col font-sans">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.18]"
          style={{ backgroundImage: "url('/images/country-details-bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(248,252,255,0.88)_38%,rgba(244,249,255,0.96)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.10),transparent_42%)]" />
      </div>
      {/* Post-login resume splash — full-screen overlay shown when we're about
          to forward the user to /apply/:id or the summary page. Sits on top of
          everything (z-[100]) and matches the page background, so the user
          never visibly returns to the destination page between login and the
          target route. The dispatch effect (above) clears
          `pendingPostLoginAction` once navigation kicks off. */}
      {pendingPostLoginAction && (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center px-6">
          <div className="h-12 w-12 rounded-full border-2 border-cyan/30 border-t-cyan animate-spin mb-5" />
          <h2 className="text-lg font-semibold text-text-primary text-center">
            Resuming your {country.name} application
          </h2>
          <p className="mt-2 text-sm text-text-muted text-center max-w-md">
            {pendingPostLoginAction === "upload-now"
              ? "Taking you to the document upload page…"
              : "Preparing your application summary…"}
          </p>
        </div>
      )}

      <Navbar />

      {!showTravelDetails && (
        <motion.div id="info" initial="initial" animate="animate" variants={fadeUp} className="w-full">
          <div className="relative mx-auto w-full max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-3xl border border-border sm:max-w-[calc(100vw-3rem)] lg:max-w-[calc(100vw-4rem)]">
            <ImageWithShimmer
              src={country.imageUrl}
              alt={country.name}
              className="w-full h-[450px] sm:h-[520px] md:h-[79vh] object-cover"
              priority
              width={1600}
              interactiveOverlay
            >
              <div className="absolute inset-0 bg-black/55" />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center sm:p-8">
                <p className="text-white/80 text-sm">{country.flagEmoji} {country.locatedIn ?? country.regionLabel ?? country.continent}</p>
                <h1 className="mt-3 text-3xl sm:text-6xl font-bold text-white leading-tight">{country.name} Visa</h1>

                <div className="mx-auto mt-8 grid w-full max-w-lg grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-white/65 uppercase tracking-[0.18em] mb-2">Type</p>
                    <p className="text-base font-semibold text-white">{getCardVisaTypeLabel(country.visaType)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/65 uppercase tracking-[0.18em] mb-2">Validity</p>
                    <p className="text-sm font-semibold text-white">{country.validity || "â€”"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/65 uppercase tracking-[0.18em] mb-2">Processing</p>
                    <p className="text-base font-semibold text-white">
                      {country.processingDays
                        ? /^\d+(\s*-\s*\d+)?$/.test(String(country.processingDays).trim())
                          ? `${String(country.processingDays).trim()} days`
                          : String(country.processingDays).trim()
                        : "â€”"}
                    </p>
                  </div>
                </div>

                <div className="mx-auto mt-8 w-full max-w-lg">
                  <Button
                    variant="primary"
                    fullWidth
                    size="lg"
                    onClick={handleStartApplication}
                    className="bg-white text-black shadow-none hover:bg-white/90 hover:shadow-none"
                    id="country-details-hero-start-application-btn"
                  >
                    Start Application
                  </Button>
                </div>
              </div>
            </ImageWithShimmer>
          </div>
        </motion.div>
      )}

      {!showTravelDetails && (
        <div className="sticky top-0 z-40 bg-background/100 border-b border-border/50 shadow-sm hidden sm:block">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex min-h-18 items-center text-center justify-between gap-4">
            <ul className="flex min-w-0 flex-1 items-center justify-center gap-8 overflow-x-auto no-scrollbar">
              {SUB_NAV.map((tab) => (
                <li key={tab.id}>
                  <button
                    onClick={() => scrollToSection(tab.id)}
                    className={`relative py-6 text-sm font-medium whitespace-nowrap transition-colors ${
                      activeSubNav === tab.id
                        ? "text-text-primary"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {tab.label}
                    {activeSubNav === tab.id ? (
                      <motion.span
                        layoutId="country-details-subnav-underline"
                        className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-cyan"
                        transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
                      />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            <AnimatePresence initial={false}>
              {!showTravelDetails && showStickyStartCta && (
                <motion.div
                  key="sticky-start-application-cta"
                  className="shrink-0 py-4"
                  initial={{ opacity: 0, x: 28, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 28, scale: 0.96 }}
                  transition={{ duration: 0.28, ease }}
                >
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleStartApplication}
                    id="country-details-sticky-start-application-btn"
                  >
                    Start Application
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      )}

      <main className="flex-1 w-full px-3 sm:px-6 py-8 sm:py-12">
        {showTravelDetails && (
          <button
            type="button"
            onClick={handleBack}
            className="group flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-cyan transition-colors mb-10 w-fit"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back
          </button>
        )}

        <div className="mx-auto w-full max-w-[1400px]">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start lg:gap-1 xl:gap-2">
            {!showTravelDetails && (
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease } }}
                className="order-1 w-full lg:col-span-8 lg:pl-4 xl:pl-6"
              >
                <VisaInformationSection
                  visaInformation={country?.visaInformation}
                  display={countryDisplay}
                />
              </motion.section>
            )}

            <div
              className={
                showTravelDetails
                  ? "lg:col-span-8 space-y-8"
                  : "hidden"
              }
            >
            {false && (
              <motion.div initial="initial" animate="animate" variants={fadeUp} className="w-full">
                <div className="relative mx-auto w-full max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-3xl border border-border sm:max-w-[calc(100vw-3rem)] lg:max-w-[calc(100vw-4rem)]">
                      <ImageWithShimmer
                        src={country.imageUrl}
                        alt={country.name}
                        className="w-full h-64 sm:h-72 md:h-[79vh] object-cover"
                        priority
                        width={1600}
                      >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4 sm:p-8">
                      <p className="text-white/80 text-sm">{country.flagEmoji} {country.locatedIn ?? country.regionLabel ?? country.continent}</p>
                      <h1 className="text-3xl sm:text-5xl font-bold text-white leading-tight">{country.name} Visa</h1>

                      <div className="mt-6 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-3xl bg-black/40 border border-white/10 p-4 backdrop-blur-sm">
                          <p className="text-xs text-white/60 uppercase tracking-[0.18em] mb-2">Type</p>
                          <p className="text-sm font-semibold text-white">{getCardVisaTypeLabel(country.visaType)}</p>
                        </div>
                        <div className="rounded-3xl bg-black/40 border border-white/10 p-4 backdrop-blur-sm">
                          <p className="text-xs text-white/60 uppercase tracking-[0.18em] mb-2">Validity</p>
                          <p className="text-sm font-semibold text-white">{country.validity || "—"}</p>
                        </div>
                        <div className="rounded-3xl bg-black/40 border border-white/10 p-4 backdrop-blur-sm">
                          <p className="text-xs text-white/60 uppercase tracking-[0.18em] mb-2">Processing</p>
                          <p className="text-sm font-semibold text-white">
                            {country.processingDays
                              ? /^\d+(\s*-\s*\d+)?$/.test(String(country.processingDays).trim())
                                ? `${String(country.processingDays).trim()} days`
                                : String(country.processingDays).trim()
                              : "—"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 sm:max-w-md">
                        <Button
                          variant="primary"
                          fullWidth
                          size="lg"
                          onClick={handleStartApplication}
                        >
                          Start Application
                        </Button>
                      </div>
                    </div>
                  </ImageWithShimmer>
                </div>
              </motion.div>
            )}

            {showTravelDetails ? (
              <motion.section
                id="travel-details"
                initial="initial"
                animate="animate"
                variants={fadeUp}
                className="bg-surface border border-border rounded-2xl p-4 sm:p-6 space-y-6"
              >
                <div>
                  <p className="text-xs uppercase tracking-wider text-cyan font-semibold mb-2">Travel Details</p>
                  <h2 className="text-2xl font-bold text-text-primary">Start your application</h2>
                  <p className="text-sm text-text-secondary mt-1">
                    Fill travel details below to continue with your {country.name} visa process.
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-surface-2 p-4">
                  <label className="text-xs text-text-muted block mb-2">Type of Visa</label>
                  <select
                    value={visaOption}
                    onChange={(e) => setVisaOption(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
                  >
                    <option value="e-Visa">e-Visa</option>
                    <option value="Sticker Visa">Sticker Visa</option>
                  </select>
                </div>

                <div className="rounded-2xl border border-border bg-surface-2 p-4">
                  <div className="flex items-center gap-2 mb-3 text-sm font-medium text-text-primary">
                    <CalendarDays size={16} className="text-cyan" />
                    Select Travel Date
                  </div>
                  <DateRangePicker
                    startDate={travelDateFrom}
                    endDate={travelDateTo}
                    minDate={minDepartureYmd}
                    open={calendarOpen}
                    onOpenChange={(isOpen) => {
                      setCalendarOpen(isOpen);
                      if (!isOpen) {
                        setTimeout(() => {
                          const firstEmptyIndex = travelers.findIndex((t) => !String(t?.name || "").trim());
                          const targetIndex = firstEmptyIndex >= 0 ? firstEmptyIndex : 0;
                          const targetInput = travelerNameInputRefs.current[targetIndex];
                          if (targetInput) targetInput.focus({ preventScroll: true });
                        }, 50);
                      }
                    }}
                    invalid={dateWarning}
                    onChange={({ startDate, endDate }) => {
                      setTravelDateFrom(startDate);
                      setTravelDateTo(endDate);
                    }}
                  />
                  {dateWarning && (
                    <p className="text-xs text-red-400 mt-2">Select both travel dates to continue.</p>
                  )}
                </div>

                <div className="space-y-4">
                  {travelers.map((traveler, index) => (
                    <div
                      key={traveler.id}
                      className="rounded-2xl border border-border bg-surface-2 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-text-primary">
                          Traveler {index + 1}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-muted">Name only</span>
                          <button
                            type="button"
                            onClick={() => removeTravelerAt(index)}
                            disabled={travelers.length <= 1}
                            aria-label={`Remove traveler ${index + 1}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-text-muted transition-colors hover:border-red-500/40 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label htmlFor={`traveler-name-${index}`} className="text-xs text-text-muted block mb-1.5">
                          Full name (as on passport)
                        </label>
                        <input
                          id={`traveler-name-${index}`}
                          ref={(el) => {
                            travelerNameInputRefs.current[index] = el;
                          }}
                          type="text"
                          autoComplete="off"
                          // First input gets the browser-native blinking cursor
                          // on initial paint; subsequent inputs receive focus
                          // programmatically via the Enter handler below.
                          autoFocus={index === 0}
                          value={traveler.name}
                          onChange={(e) => updateTravelerName(index, e.target.value)}
                          onKeyDown={(e) => {
                            // Press Enter → jump to the next traveler row. On
                            // the last row Enter blurs the input so the user
                            // can immediately Tab to the Upload buttons.
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            const nextIndex = index + 1;
                            const nextNode = travelerNameInputRefs.current[nextIndex];
                            if (nextNode) {
                              try {
                                nextNode.focus({ preventScroll: true });
                                const len = nextNode.value?.length || 0;
                                if (len) nextNode.setSelectionRange(len, len);
                              } catch {
                                /* ignore */
                              }
                            } else {
                              // Last traveler — drop focus so the global typing
                              // capture stops, and let the user proceed.
                              sharedDriveLinkInputRef.current?.focus();
                            }
                          }}
                          placeholder="Enter name"
                          className={`w-full bg-background border rounded-xl px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted transition-colors ${
                            travelValidationAttempted && !String(traveler.name || "").trim()
                              ? "border-red-500 focus:border-red-400"
                              : "border-border focus:border-cyan/50"
                          }`}
                        />
                        {travelValidationAttempted && !String(traveler.name || "").trim() && (
                          <p className="text-xs text-red-400 mt-1.5">Traveler name is required.</p>
                        )}
                      </div>

                      <PassportUploadRow
                        inputId={`traveler-passport-${index}`}
                        label="Passport Upload"
                        file={traveler.passportFile}
                        error={passportErrors[index + 1]}
                        uploading={Boolean(passportUploading[index + 1])}
                        saved={Boolean(passportSuccesses[index + 1] && !traveler.passportFile)}
                        helperText={
                          traveler.passportFile
                            ? `${traveler.passportFile.name} - ${formatFileSize(traveler.passportFile.size)}`
                            : passportDetails[index + 1]?.fileName
                              ? `${passportDetails[index + 1].fileName} - ${formatFileSize(passportDetails[index + 1].fileSize)}`
                              : "PDF, JPG, PNG - max 300 KB"
                        }
                        savedText="Passport uploaded"
                        reuploadLabel="Replace File"
                        onChange={(file) => handleTravelerPassportFile(index, file)}
                        onReupload={() => {
                          updateTravelerPassportFile(index, null);
                          setPassportSuccesses((prev) => {
                            const next = { ...prev };
                            delete next[index + 1];
                            return next;
                          });
                          setPassportDetails((prev) => {
                            const next = { ...prev };
                            delete next[index + 1];
                            return next;
                          });
                          setPassportErrors((prev) => {
                            const next = { ...prev };
                            delete next[index + 1];
                            return next;
                          });
                        }}
                      />

                    </div>
                  ))}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={addTraveler}
                      className="inline-flex items-center gap-2 rounded-xl border border-cyan/30 bg-cyan/10 px-4 py-2.5 text-sm font-semibold text-cyan transition-colors hover:bg-cyan/15"
                    >
                      <Plus size={16} />
                      Add traveler
                    </button>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.45)]">
                  <div className="flex items-start gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-[#4285F4] shadow-inner">
                      <Link2 size={22} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-semibold text-slate-950">
                          Document Drive Link (for all travelers)
                        </h4>
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          Optional
                        </span>
                        <span className="group relative inline-flex align-middle">
                          <span
                            className="inline-flex rounded-full p-0.5 text-slate-400 transition-all duration-150 hover:bg-slate-100 hover:text-cyan"
                            aria-label="Optional Google Drive link info"
                          >
                            <Info size={14} />
                          </span>
                          <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-normal leading-relaxed text-slate-500 shadow-lg group-hover:block">
                            You can continue to payment now and share the Google Drive link later from your application dashboard.
                          </span>
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        Upload all documents to Google Drive and share the folder link here. This link will be applicable for all travelers.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <label className="text-sm font-medium text-slate-900">
                        Google Drive Link
                      </label>
                      <div className="group relative inline-flex items-center">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-0.5 transition-colors focus:outline-none"
                          aria-label="Google Drive sharing guide"
                        >
                          <Info size={15} />
                        </button>
                        <div className="pointer-events-none absolute left-0 bottom-full z-30 mb-2 hidden w-80 rounded-2xl border border-slate-200 bg-white p-4 text-xs font-normal leading-relaxed text-slate-600 shadow-xl group-hover:block transition-all duration-200">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-50 text-blue-600 font-semibold text-[10px]">GD</span>
                              <h5 className="font-bold text-slate-800 text-sm">How to Share Folder Link</h5>
                            </div>
                            <ol className="list-decimal pl-4 space-y-2 text-slate-600">
                              <li>Upload all required documents to your Google Drive folder.</li>
                              <li>Right-click the folder and select <span className="font-semibold text-slate-800">Share &gt; Share</span>.</li>
                              <li>Under <span className="font-semibold text-slate-800">General access</span>, change <span className="font-semibold text-slate-800">Restricted</span> to <span className="font-semibold text-slate-800">Anyone with the link</span>.</li>
                              <li>Make sure the role is set to <span className="font-semibold text-slate-800">Viewer</span>.</li>
                              <li>Click <span className="font-semibold text-slate-800">Copy link</span> and paste it in the field below.</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="relative min-w-0">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                        <Link2 size={18} />
                      </span>
                      <input
                        ref={sharedDriveLinkInputRef}
                        type="url"
                        autoComplete="off"
                        value={sharedDriveLink}
                        onChange={(e) => handleSharedDriveLinkChange(e.target.value)}
                        placeholder="https://drive.google.com/your-folder-link"
                        className={`w-full rounded-2xl border bg-white py-3 pl-12 pr-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 ${
                          sharedDriveLinkVerified
                            ? "border-emerald-300 focus:border-emerald-400"
                            : "border-slate-200 focus:border-cyan"
                        }`}
                      />
                    </div>

                  </div>

                  <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                        <ShieldCheck size={18} />
                      </span>
                      <div>
                        <p className="text-base font-semibold text-emerald-900">Secure &amp; Private</p>
                        <p className="mt-0.5 text-sm text-emerald-800/80">
                          Your documents are safe. We only access what&apos;s necessary to process your application.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={handleUploadDocsLater}
                  loading={draftCreating}
                  disabled={draftCreating}
                >
                  Proceed to Summary
                </Button>
              </motion.section>
            ) : null}

          </div>

          <div
              className={
                showTravelDetails
                ? "lg:col-span-4 lg:pr-4 xl:pr-6"
                : "order-2 w-full lg:col-span-4 lg:pr-4 xl:pr-6"
              }
          >
            <motion.div
              ref={showTravelDetails ? undefined : startApplicationCardRef}
              className="w-full bg-surface border border-border rounded-2xl p-4 sm:p-6 lg:sticky lg:top-24 lg:ml-auto lg:max-w-[32rem] xl:max-w-[34rem]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease } }}
            >
              {showTravelDetails ? (
                <>
                  <div className="mb-3">
                    <div className="max-w-xl">
                      <h3 className="text-3xl font-bold tracking-tight text-slate-950">Apply for {country.name}</h3>
                    </div>
                  </div>
                  <div className="mb-7 overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-[0_30px_80px_-36px_rgba(14,116,144,0.32)]">
                    <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0f3ecf_0%,#214cf2_38%,#3d7bff_100%)] px-5 pb-5 pt-5 text-white sm:px-6 sm:pb-6">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.26),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.18),transparent_30%)]" />
                      <div className="relative flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/16 ring-1 ring-white/18 backdrop-blur">
                            <FileText className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[0.95rem] font-semibold">Travel Summary</p>
                            <p className="text-[0.72rem] uppercase tracking-[0.3em] text-white/72">Traveller details</p>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-center backdrop-blur">
                          <p className="text-[0.62rem] uppercase tracking-[0.26em] text-white/70">Travellers</p>
                          <p className="mt-1 text-xl font-bold leading-none">{travellerCount}</p>
                        </div>
                      </div>
                      <div className="relative mt-5">
                        <p className="text-[0.7rem] uppercase tracking-[0.34em] text-white/72">Amount to be paid now</p>
                        <p className="mt-2 text-4xl font-extrabold tracking-tight sm:text-[2.8rem]">₹{finalTotal.toLocaleString("en-IN")}</p>
                      </div>
                    </div>

                    <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
                      <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/90 px-4 py-3.5">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sky-600 shadow-sm">
                            <Receipt className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div>
                              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Visa Type</p>
                              <p className="mt-1 text-[0.95rem] font-semibold text-slate-900">{visaOption || "Tourist Visa"}</p>
                            </div>
                            <div className="mt-3 border-t border-slate-200 pt-3">
                              <div className="flex items-center gap-2 text-slate-500">
                                <CalendarDays className="h-4 w-4 text-sky-600" />
                                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.24em]">Travel Dates</span>
                              </div>
                              <p className="mt-1.5 text-[0.88rem] font-semibold text-slate-900">{formatTravelRange()}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Traveler Names</p>
                            <p className="mt-1 text-sm text-slate-600">Added in your application form</p>
                          </div>
                          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                            {travellerCount} total
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {travelers.map((traveler, idx) => (
                            <span
                              key={`travel-summary-name-${idx}`}
                              className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                            >
                              {traveler.name?.trim() || `Traveler ${idx + 1}`}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/95 p-4">
                        <div className="space-y-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">Government Fee</p>
                              {travellerCount > 1 && (
                                <p className="text-xs text-slate-500">
                                  x{travellerCount}
                                </p>
                              )}
                            </div>
                            <span className="text-base font-bold text-slate-900">₹{governmentFeeTotal.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="group relative flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">Our Service Fee</p>
                              {travellerCount > 1 && (
                                <p className="text-xs text-slate-500">
                                  x{travellerCount}
                                </p>
                              )}
                            </div>
                            <span className="text-base font-bold text-slate-900">
                              ₹{(isGstResolved && effectiveGstEnabled ? payableToUs : serviceAmount).toLocaleString("en-IN")}
                            </span>
                            {isGstResolved && effectiveGstEnabled && (
                              <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 w-64 rounded-2xl border border-sky-100 bg-white p-3 opacity-0 shadow-[0_18px_40px_-24px_rgba(14,116,144,0.45)] transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                                <div className="space-y-2 text-xs">
                                  <div className="flex items-center justify-between gap-3 text-slate-600">
                                    <span>Our Service Fee</span>
                                    <span className="font-semibold text-slate-900">₹{serviceAmount.toLocaleString("en-IN")}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3 text-slate-600">
                                    <span>GST</span>
                                    <span className="font-semibold text-slate-900">₹{gstAmount.toLocaleString("en-IN")}</span>
                                  </div>
                                  <div className="border-t border-slate-200 pt-2">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="font-semibold text-slate-900">Total</span>
                                      <span className="font-bold text-sky-700">₹{payableToUs.toLocaleString("en-IN")}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 border-t border-slate-200 pt-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Total Amount</p>
                            <span className="text-2xl font-extrabold tracking-tight text-sky-700">₹{finalTotal.toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-[1.35rem] border border-sky-100 bg-sky-50 px-4 py-3.5 text-slate-700">
                        <ShieldCheck className="h-5 w-5 shrink-0 text-sky-600" />
                        <div className="text-sm leading-tight">
                          Secure & trusted payment. Your payment is 100% encrypted.
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="max-w-xl">
                      <h3 className="text-3xl font-bold tracking-tight text-slate-950">Apply for {country.name}</h3>
                    </div>
                  </div>
                  <CountryFeeSummaryCard
                    travelerCount={travellerCount}
                    onIncrementTraveler={incrementTravelerCount}
                    onDecrementTraveler={decrementTravelerCount}
                    governmentFeePerTraveler={governmentFeePerTraveler}
                    serviceFeePerTraveler={serviceFeePerTraveler}
                    gstEnabled={effectiveGstEnabled}
                    gstRate={feeCardGstRate}
                    governmentFeeTotal={governmentFeeTotal}
                    gstPerTraveler={gstPerTraveler}
                    totalServiceFeePerTraveler={totalServiceFeePerTraveler}
                    totalServiceFeeTotal={totalServiceFeeTotal}
                    finalTotal={finalTotal}
                    onStartApplication={handleStartApplication}
                    startButtonId="country-details-start-application-btn"
                  />
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
        { !showTravelDetails && (
          <div className="mt-10 w-full max-w-[calc(100vw-1.5rem)] xl:max-w-[1440px] mx-auto">
            <div className="w-full space-y-8">
              {destinationInfoSections}
            </div>
          </div>
        )}
      </main>

      {paymentSummaryOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="visa-payment-summary-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            aria-label="Close"
            onClick={closePaymentSummaryModal}
          />
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-surface shadow-modal p-4 sm:p-8">
            <button
              type="button"
              onClick={closePaymentSummaryModal}
              className="absolute top-4 right-4 p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>

            <p className="text-xs uppercase tracking-wider text-cyan font-semibold mb-1">
              Start Your Visa Process
            </p>
            <h2 id="visa-payment-summary-title" className="text-2xl font-bold text-text-primary mb-6 pr-8">
              Payment Summary
            </h2>

            <div className="space-y-3 mb-6 text-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="text-text-muted shrink-0">Visa</span>
                <span className="font-semibold text-text-primary text-right">{country.name} Visa</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-text-muted shrink-0">Visa type</span>
                <span className="font-semibold text-text-primary text-right">{visaOption}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-text-muted shrink-0">Travel date</span>
                <span className="font-semibold text-text-primary text-right">{formatTravelRange()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Travellers</span>
                <span className="font-semibold text-text-primary">{travellerCount}</span>
              </div>
              <div className="rounded-xl border border-border bg-surface-2 p-3">
                <p className="text-xs text-text-muted mb-2">Traveler names</p>
                <div className="space-y-1">
                  {travelers.map((t, idx) => (
                    <div key={`pay-name-${idx}`} className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">Traveler {idx + 1}</span>
                      <span className="text-text-primary font-medium">
                        {t.name?.trim() || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-border pt-3 mt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">
                    Service Fee {travellerCount > 1 ? `(${travellerCount} x ₹${Number(country?.basePrice || 0).toLocaleString("en-IN")})` : ""}
                  </span>
                  <span className="font-medium text-text-primary">
                    ₹{serviceAmount.toLocaleString("en-IN")}
                  </span>
                </div>
                {isGstResolved && effectiveGstEnabled && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">GST</span>
                    <span className="font-medium text-text-primary">
                      ₹{gstAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                  <span className="font-semibold text-text-primary">Payable to us</span>
                  <span className="font-bold text-cyan">₹{payableToUs.toLocaleString("en-IN")}</span>
                </div>
              </div>
              <p className="text-xs text-text-muted pt-1">
                Government / embassy fees (if any) are shown separately at payment.
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer group mb-6">
              <input
                type="checkbox"
                checked={visaTermsAccepted}
                onChange={(e) => setVisaTermsAccepted(e.target.checked)}
                className="mt-1 rounded border-border text-cyan focus:ring-cyan/30"
              />
              <span className="text-sm text-text-secondary leading-snug">
                I agree to the{" "}
                <Link
                  to="/terms"
                  target="_blank"
                  rel="noopener"
                  className="text-cyan hover:underline font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  terms and conditions
                </Link>{" "}
                and understand the fees above are service charges only.
              </span>
            </label>

            {!razorpayReady && (
              <p className="text-xs text-amber-400 mb-3">
                {razorpayCheckLoading
                  ? "Checking Razorpay setup..."
                  : razorpayReadyMessage || "Razorpay is not ready."}
              </p>
            )}

            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={!visaTermsAccepted || !razorpayReady || razorpayCheckLoading}
              loading={paymentSubmitting}
              onClick={handleProceedToPayment}
            >
              Proceed to payment
            </Button>
          </div>
        </div>
      )}

      <ContactVerificationModal
        isOpen={contactModalOpen}
        mode={contactModalMode}
        allowSkip
        skipLabel="Add it later"
        onSkip={clearContactGate}
        onClose={clearContactGate}
        onCompleted={completeContactGate}
      />

      <AnimatePresence>
        {!showTravelDetails && showStickyStartCta && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-0 left-0 right-0 z-50 sm:hidden border-t border-border bg-background/80 px-4 py-3 backdrop-blur-xl"
          >
            <Button
              variant="primary"
              fullWidth
              size="lg"
              onClick={handleStartApplication}
              className="shadow-xl shadow-cyan/20"
              id="country-details-sticky-bottom-start-application-btn"
            >
              Start Application
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
};

export default CountryDetails;
