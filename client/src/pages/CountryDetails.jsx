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
  Users,
  Minus,
  Plus,
  X,
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
import {
  needsPhoneContactGate,
  needsEmailContactGate,
} from "../utils/contactVerificationGate";
import { loadTravelDraft, saveTravelDraft } from "../utils/travelDraftStorage";
import { getLocalDateYmd } from "../utils/dateInput";
import { matchesCountryRouteId } from "../utils/countryRouting";

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

const createTravelerState = () => ({
  name: "",
});

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

  // ── All hooks must be called before any conditional return (Rules of Hooks) ──
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [showTravelDetails, setShowTravelDetails] = useState(false);
  const [visaOption, setVisaOption] = useState("e-Visa");
  const [travelDateFrom, setTravelDateFrom] = useState("");
  const [travelDateTo, setTravelDateTo] = useState("");
  /** Open/closed state for the date-range calendar popup. */
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [travelers, setTravelers] = useState([createTravelerState()]);
  const [paymentSummaryOpen, setPaymentSummaryOpen] = useState(false);
  const [visaTermsAccepted, setVisaTermsAccepted] = useState(false);
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [razorpayCheckLoading, setRazorpayCheckLoading] = useState(false);
  const [razorpayReadyMessage, setRazorpayReadyMessage] = useState("");
  const [currentApplicationId, setCurrentApplicationId] = useState("");
  const [draftCreating, setDraftCreating] = useState(false);
  const [travelValidationAttempted, setTravelValidationAttempted] = useState(false);
  const travelerNameInputRefs = useRef({});
  const startApplicationCardRef = useRef(null);
  const startApplicationCardSeenRef = useRef(false);
  const [destinationPageContent, setDestinationPageContent] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactModalMode, setContactModalMode] = useState("phone");
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

  const SERVICE_FEE_PER_TRAVELLER = 1500;
  const GST_RATE = 0.18;
  const travellerCount = travelers.length;

  const { serviceAmount, gstAmount, payableToUs } = useMemo(() => {
    const service = SERVICE_FEE_PER_TRAVELLER * travellerCount;
    const gst = Math.round(service * GST_RATE);
    return { serviceAmount: service, gstAmount: gst, payableToUs: service + gst };
  }, [travellerCount]);

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

  const whyBookNow = useMemo(() => {
    const ex = new Set(country?.excludeDestinationWhyBookNow || []);
    const g = (destinationPageContent?.whyBookNow || []).filter((line) => !ex.has(normKey(line)));
    const merged = mergeStringLists(g, country?.whyBookNow);
    if (merged.length) return merged;
    return [
      "Fast document pre-check by visa specialists",
      "Transparent pricing and status updates",
      "Dedicated support throughout your application",
    ];
  }, [country, destinationPageContent]);

  const includedItems = useMemo(() => {
    const ex = new Set(country?.excludeDestinationIncludedItems || []);
    const g = (destinationPageContent?.included || []).filter((line) => !ex.has(normKey(line)));
    const merged = mergeStringLists(g, country?.includedItems ?? country?.included);
    if (merged.length) return merged;
    return [
      "Application form guidance",
      "Document checklist and validation",
      "End-to-end support till submission",
    ];
  }, [country, destinationPageContent]);

  const faqs = useMemo(() => {
    const ex = new Set(country?.excludeDestinationFaqQuestions || []);
    const g = (destinationPageContent?.faqs || []).filter((f) => !ex.has(normKey(f?.question)));
    const merged = mergeFaqLists(g, country?.faqs);
    if (merged.length) return merged;
    return [
      { question: "How long does processing take?", answer: `Typical processing is ${country?.processingDays ?? ""} based on current embassy timelines.` },
      { question: "Can I track my application?", answer: "Yes, you can track status updates from your user dashboard after applying." },
      { question: "Is this fee refundable?", answer: "Government and service fees depend on visa policy and review stage." },
    ];
  }, [country, destinationPageContent]);

  const howItWorks = useMemo(() => {
    const ex = new Set(country?.excludeDestinationHowItWorksTitles || []);
    const g = (destinationPageContent?.howItWorks || []).filter((s) => !ex.has(normKey(s?.title)));
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
    const ex = new Set(country?.excludeDestinationVisaRequirements || []);
    const g = (destinationPageContent?.visaRequirements || []).filter((line) => !ex.has(normKey(line)));
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
    if (Array.isArray(draft.travelers) && draft.travelers.length > 0) {
      setTravelers(draft.travelers.map((t) => ({ name: String(t?.name || "") })));
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
    Icon: getDocumentIcon(key),
  }));

  const handleBack = () => {
    if (showTravelDetails) {
      setShowTravelDetails(false);
      saveTravelDraft(country.id, {
        travelDateFrom,
        travelDateTo,
        visaOption,
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

  const removeLastTraveler = () => {
    setTravelers((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const updateTravelerName = (index, name) => {
    setTravelers((prev) =>
      prev.map((t, i) => (i === index ? { ...t, name } : t))
    );
  };

  const formatTravelRange = () => {
    if (!travelDateFrom && !travelDateTo) return "—";
    const opts = { day: "numeric", month: "short", year: "numeric" };
    try {
      const from = travelDateFrom
        ? new Date(`${travelDateFrom}T12:00:00`).toLocaleDateString("en-IN", opts)
        : "—";
      const to = travelDateTo
        ? new Date(`${travelDateTo}T12:00:00`).toLocaleDateString("en-IN", opts)
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

  const SUB_NAV = showTravelDetails
    ? [{ id: "travel-details", label: "Travel Details" }]
    : [
        { id: "how-it-works", label: "How it works" },
        { id: "visa-requirements", label: "Visa Requirements" },
        // Skip the Document Requirements nav entry when the universal toggle hides
        // the entire section — clicking it would scroll to nothing.
        ...(countryDisplay?.showRequiredDocuments !== false
          ? [{ id: "document-requirements", label: "Document Requirements" }]
          : []),
        { id: "why-book-now", label: "Why book now?" },
        { id: "whats-included", label: "What's Included" },
        { id: "faqs", label: "FAQs" },
      ];

  const scrollToSection = (sectionId) => {
    const node = document.getElementById(sectionId);
    if (!node) return;
    const stickyOffset = 150;
    const targetTop = window.scrollY + node.getBoundingClientRect().top - stickyOffset;
    window.scrollTo({ top: targetTop, behavior: "smooth" });
  };

  const clearContactGate = () => {
    pendingContactAction.current = null;
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
    saveTravelDraft(country.id, {
      travelDateFrom,
      travelDateTo,
      visaOption,
      travelers: travelers.map((t) => ({ name: String(t.name || "") })),
      showTravelDetails: true,
    });
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
        },
      });
    });
  };

  const handleUploadDocsLater = async () => {
    if (!validateTravelDetails("Upload documents later")) return;
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
      // Travel draft is already saved by `persistCurrentTravelDraft()` above —
      // just navigate forward.
      navigate(`/dashboard/application/${appId}/summary`, {
        state: {
          docsSkipped: true,
          summaryData: {
            applicationId: appId,
            countryId: country.id,
            countryName: country.name,
            flagEmoji: country.flagEmoji || "🛂",
            visaType: visaOption || country.visaType || "e-Visa",
            travellerCount,
            travelerNames,
            docsUploaded: false,
            travelDateFrom: travelDateFrom || null,
            travelDateTo: travelDateTo || null,
          },
          applicationPrev: {
            path: `/destination/${country.id}`,
            state: {},
          },
        },
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
        .filter((b) => (b?.countryId && b.countryId === country.id) || b?.countryName === country.name)
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
          navigate(`/dashboard/application/${encodeURIComponent(currentApplicationId)}`);
        },
        onDismiss: () => {
          showToast("Payment was not completed. Your application draft is waiting in the dashboard.", "info");
          navigate(`/dashboard?payment=cancelled&applicationId=${encodeURIComponent(currentApplicationId)}`);
        },
        onFailure: (message) => {
          showToast(message || "Payment could not be started. Check Razorpay keys in admin settings.", "error");
          navigate(`/dashboard?payment=failed&applicationId=${encodeURIComponent(currentApplicationId)}`);
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
      <motion.section id="how-it-works" initial="initial" animate="animate" variants={fadeUp} className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <ListChecks size={18} className="text-cyan" />
          <h2 className="text-xl font-bold text-text-primary">How it works</h2>
        </div>
        <ol className="space-y-4">
          {howItWorks.map((step, idx) => (
            <li key={`${step.title}-${idx}`} className="flex items-start gap-4">
              <span className="shrink-0 w-9 h-9 rounded-full bg-cyan/10 border border-cyan/30 text-cyan font-bold text-sm flex items-center justify-center">
                {idx + 1}
              </span>
              <div className="flex-1">
                <p className="font-semibold text-text-primary text-sm sm:text-base">{step.title}</p>
                <p className="text-sm text-text-secondary mt-1 leading-relaxed">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </motion.section>

      <motion.section id="visa-requirements" initial="initial" animate="animate" variants={fadeUp} className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <ScrollText size={18} className="text-cyan" />
          <h2 className="text-xl font-bold text-text-primary">Visa Requirements</h2>
        </div>
        <div className="space-y-3">
          {visaRequirements.map((item, idx) => (
            <div key={`${item}-${idx}`} className="flex items-start gap-3">
              <CircleCheck size={16} className="text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-sm text-text-secondary leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {countryDisplay?.showRequiredDocuments !== false && (
        <motion.section id="document-requirements" initial="initial" animate="animate" variants={fadeUp} className="bg-surface border border-border rounded-2xl p-6">
          <h2 className="text-xl font-bold text-text-primary mb-4">Document Requirements</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {requiredDocumentFields.length ? requiredDocumentFields.map((doc) => {
              const Icon = doc.Icon;
              return (
                <div
                  key={doc.key}
                  className="rounded-xl border border-border bg-surface-2 p-3 text-sm text-text-secondary flex items-center gap-3"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan/10 text-cyan">
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  <span className="flex-1 leading-snug">{doc.label}</span>
                  <CircleCheck size={16} className="text-emerald-500 shrink-0" />
                </div>
              );
            }) : (
              <p className="text-sm text-text-muted">No requirements configured yet.</p>
            )}
          </div>
        </motion.section>
      )}

      <motion.section id="why-book-now" initial="initial" animate="animate" variants={fadeUp} className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <BadgeCheck size={18} className="text-cyan" />
          <h2 className="text-xl font-bold text-text-primary">Why book now?</h2>
        </div>
        <div className="space-y-3">
          {whyBookNow.map((item, idx) => (
            <div key={`${item}-${idx}`} className="flex items-start gap-3">
              <CircleCheck size={16} className="text-emerald-500 mt-0.5" />
              <p className="text-sm text-text-secondary">{item}</p>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section id="whats-included" initial="initial" animate="animate" variants={fadeUp} className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={18} className="text-cyan" />
          <h2 className="text-xl font-bold text-text-primary">What's Included</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {includedItems.map((item, idx) => (
            <div key={`${item}-${idx}`} className="rounded-xl border border-border bg-surface-2 p-3 text-sm text-text-secondary">
              {item}
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section
        id="faqs"
        initial="initial"
        animate="animate"
        variants={fadeUp}
        className="bg-surface border border-border rounded-2xl p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle size={18} className="text-cyan" />
          <h2 className="text-xl font-bold text-text-primary">FAQs</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div key={`${faq.question}-${idx}`} className="rounded-xl border border-border bg-surface-2 p-4">
              <p className="font-semibold text-text-primary text-sm">{faq.question}</p>
              <p className="text-sm text-text-secondary mt-1">{faq.answer}</p>
            </div>
          ))}
        </div>
      </motion.section>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
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
        <motion.div initial="initial" animate="animate" variants={fadeUp} className="w-full">
          <div className="relative left-1/2 w-[calc(100vw-1.5rem)] -translate-x-1/2 overflow-hidden rounded-3xl border border-border sm:w-[calc(100vw-3rem)] lg:w-[calc(100vw-4rem)]">
            <ImageWithShimmer
              src={country.imageUrl}
              alt={country.name}
              className="w-full h-64 sm:h-72 md:h-[79vh] object-cover"
              priority
              width={1600}
              interactiveOverlay
            >
              <div className="absolute inset-0 bg-black/55" />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center sm:p-8">
                <p className="text-white/80 text-sm">{country.flagEmoji} {country.locatedIn ?? country.regionLabel ?? country.continent}</p>
                <h1 className="mt-3 text-4xl sm:text-6xl font-bold text-white leading-tight">{country.name} Visa</h1>

                <div className="mx-auto mt-8 grid w-full max-w-lg gap-3 sm:grid-cols-3">
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

      <div className="sticky top-0 z-40 bg-background/100 border-b border-border/50 shadow-sm hidden sm:block">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex min-h-18 items-center text-center justify-between gap-4">
            <ul className="flex min-w-0 flex-1 items-center justify-center gap-8 overflow-x-auto no-scrollbar">
              {SUB_NAV.map((tab) => (
                <li key={tab.id}>
                  <button
                    onClick={() => scrollToSection(tab.id)}
                    className="py-6  text-sm font-medium whitespace-nowrap border-b-2 border-transparent text-text-secondary hover:text-text-primary hover:border-cyan/40 transition-colors"
                  >
                    {tab.label}
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

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full">
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

        <div
          className={
            showTravelDetails
              ? "grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12"
              : "flex flex-col gap-8 lg:grid lg:grid-cols-12 lg:gap-12"
          }
        >
          <div
            className={
              showTravelDetails
                ? "lg:col-span-8 space-y-8"
                : "hidden"
            }
          >
            {false && (
              <motion.div initial="initial" animate="animate" variants={fadeUp} className="w-full">
                <div className="relative left-1/2 w-[calc(100vw-1.5rem)] -translate-x-1/2 overflow-hidden rounded-3xl border border-border sm:w-[calc(100vw-3rem)] lg:w-[calc(100vw-4rem)]">
                      <ImageWithShimmer
                        src={country.imageUrl}
                        alt={country.name}
                        className="w-full h-64 sm:h-72 md:h-[79vh] object-cover"
                        priority
                        width={1600}
                      >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
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
                className="bg-surface border border-border rounded-2xl p-6 space-y-6"
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
                    onOpenChange={setCalendarOpen}
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

                <div className="rounded-2xl border border-border bg-surface-2 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                      <Users size={16} className="text-cyan" />
                      No. of Traveler
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={removeLastTraveler}
                        className="w-8 h-8 rounded-full border border-border bg-background text-text-primary flex items-center justify-center hover:border-cyan/40 disabled:opacity-40"
                        disabled={travelers.length <= 1}
                        aria-label="Remove traveler"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-6 text-center font-semibold text-text-primary">{travelers.length}</span>
                      <button
                        type="button"
                        onClick={addTraveler}
                        className="w-8 h-8 rounded-full border border-border bg-background text-text-primary flex items-center justify-center hover:border-cyan/40"
                        aria-label="Add traveler"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {travelers.map((traveler, index) => (
                    <div
                      key={`traveler-${index}`}
                      className="rounded-2xl border border-border bg-surface-2 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-text-primary">
                          Traveler {index + 1}
                        </p>
                        <span className="text-xs text-text-muted">Name only</span>
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
                              e.currentTarget.blur();
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
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    className="sm:flex-1"
                    onClick={handleUploadDocsNow}
                  >
                    Upload documents now
                  </Button>
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    className="sm:flex-1"
                    onClick={handleUploadDocsLater}
                    loading={draftCreating}
                    disabled={draftCreating}
                  >
                    Upload documents later
                  </Button>
                </div>
                <p className="text-xs text-text-muted">
                  Required documents are uploaded on the next page after these traveler details are saved.
                </p>
              </motion.section>
            ) : null}

          </div>

          <div
            className={
              showTravelDetails
                ? "lg:col-span-4"
                : "order-2 w-full lg:col-span-12 lg:col-start-1"
            }
          >
            <motion.div
              ref={showTravelDetails ? undefined : startApplicationCardRef}
              className="bg-surface border border-border rounded-2xl p-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease } }}
            >
              {showTravelDetails ? (
                <>
                  <p className="text-xs uppercase tracking-wider text-cyan font-semibold mb-2">Start Your Visa Process</p>
                  <h3 className="text-2xl font-bold text-text-primary mb-5">Apply for {country.name}</h3>
                  <div className="space-y-3 mb-6">
                    <div className="flex items-start justify-between gap-3 text-sm">
                      <span className="text-text-muted shrink-0">Visa</span>
                      <span className="font-semibold text-text-primary text-right">{country.name} Visa</span>
                    </div>
                    <div className="flex items-start justify-between gap-3 text-sm">
                      <span className="text-text-muted shrink-0">Visa type</span>
                      <span className="font-semibold text-text-primary text-right">{visaOption}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3 text-sm">
                      <span className="text-text-muted shrink-0">Travel date</span>
                      <span className="font-semibold text-text-primary text-right">{formatTravelRange()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-muted">Travellers</span>
                      <span className="font-semibold text-text-primary">{travellerCount}</span>
                    </div>
                    <div className="border-t border-border pt-3 mt-2 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-muted">Service</span>
                      <span className="font-medium text-text-primary">₹{serviceAmount.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-muted">GST (18%)</span>
                      <span className="font-medium text-text-primary">₹{gstAmount.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                      <span className="font-semibold text-text-primary">Payable to us</span>
                      <span className="font-bold text-cyan">₹{payableToUs.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                  <p className="text-2xs text-text-muted pt-1">
                    Government / embassy fees (if any) are shown separately at payment.
                  </p>
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-cyan font-semibold mb-2">Start Your Visa Process</p>
                    <h3 className="text-2xl font-bold text-text-primary">Apply for {country.name}</h3>
                  </div>
                  <div className="text-center">
                    <p className="text-5xl font-bold tracking-tight text-text-primary">
                      ₹{payableToUs.toLocaleString("en-IN")}
                    </p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">
                      To be paid now
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    fullWidth
                    size="lg"
                    onClick={handleStartApplication}
                    id="country-details-start-application-btn"
                  >
                    Start Application
                  </Button>

                  <div className="space-y-4 border-t border-border pt-5">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium text-text-secondary">GST (18%)</span>
                      <span className="text-lg font-bold text-text-primary">₹{gstAmount.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
                      <span className="text-base font-semibold text-text-primary">Total Amount</span>
                      <span className="text-xl font-bold text-text-primary">₹{payableToUs.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {!showTravelDetails && (
            <div className="order-3 w-full lg:col-span-12">
              <div className="w-full space-y-8">
                {destinationInfoSections}
              </div>
            </div>
          )}
        </div>
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
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-surface shadow-modal p-6 sm:p-8">
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
                  <span className="text-text-muted">Service ({travellerCount} x ₹{SERVICE_FEE_PER_TRAVELLER})</span>
                  <span className="font-medium text-text-primary">
                    ₹{serviceAmount.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">GST (18%)</span>
                  <span className="font-medium text-text-primary">
                    ₹{gstAmount.toLocaleString("en-IN")}
                  </span>
                </div>
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
        onClose={clearContactGate}
        onCompleted={completeContactGate}
      />

      <Footer />
    </div>
  );
};

export default CountryDetails;
