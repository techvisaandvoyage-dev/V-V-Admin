import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle,
  Upload,
  CreditCard,
  Loader2,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  Plane,
  Building2,
  Download,
  AlertCircle,
  Info,
  Users,
  Wallet,
  X,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Banknote,
  GraduationCap,
  Stethoscope,
  Stamp,
  Receipt,
  Home,
  Car,
  MapPin,
  ScrollText,
  HeartHandshake,
  MessageSquare,
} from "lucide-react";
import Navbar from "../components/layout/Navbar";
import PassportUploadRow from "../components/application/PassportUploadRow";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Modal from "../components/ui/Modal";
import { StatusBadge } from "../components/ui/Badge";
import { api, SERVER_URL, useAuthStore } from "../store/authStore";
import { formatOrdinalDate } from "../utils/dateUtils";
import { useDataStore } from "../store/dataStore";
import { useUIStore } from "../store/uiStore";
import { useCountries } from "../hooks/useCountries";
import {
  getApplicationProgress,
  getDerivedApplicationProgress,
  resolveApplicationStatus,
} from "../utils/applicationProgress";
import {
  optimizeUploadFile,
  FINAL_UPLOAD_TARGET_BYTES,
  getUploadLimitForDocType,
} from "../utils/optimizeUploadFile";
import { openRazorpayForApplication, validateRazorpayCheckoutReadiness } from "../utils/razorpayCheckout";
import SharedGoogleDriveLinkSection from "../components/application/SharedGoogleDriveLinkSection";

const MAX_DOCUMENT_SIZE_BYTES = FINAL_UPLOAD_TARGET_BYTES;
const FILE_SIZE_ERROR = "File must be below 8 MB before optimization.";
const OPTIMIZE_ERROR = "Could not prepare this file for upload.";
const ALLOWED_PASSPORT_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);
const INVALID_PASSPORT_TYPE_ERROR = "Only PDF, JPG, JPEG and PNG files are allowed.";
const PASSPORT_FILE_SIZE_ERROR = "File size exceeds 300KB limit. Please upload a smaller file.";
const PASSPORT_UPLOAD_ALWAYS_ENABLED = true;
const SERVICE_FEE_PER_TRAVELLER = 1500;
const GST_RATE = 0.18;
const TERMS_CMS_SLUG = "terms-and-conditions";

const DOCUMENT_META = {
  // Identity & personal
  passport: { label: "Passport Upload", Icon: FileText },
  oldPassport: { label: "Old Passport Upload", Icon: FileText },
  photo: { label: "Passport Photo Upload", Icon: ImageIcon },
  idCard: { label: "Aadhaar / ID Card Upload", Icon: CreditCard },
  panCard: { label: "PAN Card Upload", Icon: CreditCard },
  drivingLicense: { label: "Driving License Upload", Icon: Car },
  birthCertificate: { label: "Birth Certificate Upload", Icon: FileText },
  dobCertificate: { label: "DOB Certificate Upload", Icon: FileText },
  marriageCertificate: { label: "Marriage Certificate Upload", Icon: HeartHandshake },
  educationCertificate: { label: "Education / Academic Records Upload", Icon: GraduationCap },
  // Employment & finance
  employmentLetter: { label: "Employment Letter Upload", Icon: Briefcase },
  offerLetter: { label: "Offer Letter Upload", Icon: Briefcase },
  salarySlip: { label: "Salary Slip / Pay Stub Upload", Icon: Receipt },
  form16: { label: "Form 16 Upload", Icon: Receipt },
  taxReturn: { label: "ITR / Tax Return Upload", Icon: Receipt },
  bankStatement: { label: "Bank Statement Upload", Icon: Banknote },
  bankCertificate: { label: "Bank Solvency Certificate Upload", Icon: Banknote },
  propertyDocuments: { label: "Property Documents Upload", Icon: Home },
  // Travel
  travelInsurance: { label: "Travel Insurance Upload", Icon: ShieldCheck },
  healthInsurance: { label: "Health Insurance Upload", Icon: ShieldCheck },
  flightTicket: { label: "Flight Ticket Upload", Icon: Plane },
  hotelBooking: { label: "Hotel Booking Upload", Icon: Building2 },
  itinerary: { label: "Travel Itinerary Upload", Icon: MapPin },
  // Letters & supporting
  coverLetter: { label: "Cover Letter Upload", Icon: FileText },
  invitationLetter: { label: "Invitation Letter Upload", Icon: FileText },
  sponsorLetter: { label: "Sponsor / Affidavit Letter Upload", Icon: FileText },
  // Certificates & clearances
  policeClearance: { label: "Police Clearance Certificate Upload", Icon: ScrollText },
  noObjectionCertificate: { label: "No Objection Certificate Upload", Icon: ScrollText },
  yellowFever: { label: "Yellow Fever Certificate Upload", Icon: Stethoscope },
  covidVaccination: { label: "COVID Vaccination Certificate Upload", Icon: Stethoscope },
  // Forms & business
  visaApplicationForm: { label: "Visa Application Form Upload", Icon: Stamp },
  businessLicense: { label: "Business License Upload", Icon: Briefcase },
  companyRegistration: { label: "Company Registration Certificate Upload", Icon: Briefcase },
};

const buildDocFields = (documentKeys = ["passport"]) => {
  const keys = Array.isArray(documentKeys) && documentKeys.length ? documentKeys : ["passport"];
  const seen = new Set();

  const fields = keys.reduce((acc, key) => {
    if (!key || seen.has(key)) return acc;
    seen.add(key);
    acc.push({
      key,
      label: DOCUMENT_META[key]?.label || `${key.replace(/([A-Z])/g, " $1")} Upload`,
      Icon: DOCUMENT_META[key]?.Icon || FileText,
    });
    return acc;
  }, []);

  return fields.length
    ? fields
    : [{
      key: "passport",
      label: DOCUMENT_META.passport.label,
      Icon: DOCUMENT_META.passport.Icon,
    }];
};

const buildDisplayDocFields = (documentKeys = ["passport"], catalog = []) => {
  const catalogByKey = new Map(
    (Array.isArray(catalog) ? catalog : [])
      .map((item) => ({
        key: String(item?.key ?? "").trim(),
        label: String(item?.label ?? "").trim(),
        description: String(item?.description ?? "").trim(),
        iconClass: String(item?.icon ?? "").trim(),
      }))
      .filter((item) => item.key)
      .map((item) => [item.key, item])
  );

  return buildDocFields(documentKeys).map((field) => {
    const meta = catalogByKey.get(field.key);
    return {
      ...field,
      label: meta?.label || field.label,
      description: meta?.description || "",
      iconClass: meta?.iconClass || "",
    };
  });
};

const formatFileSize = (size = 0) => {
  if (!size) return "0 KB";
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const attachCompressionMeta = (file, meta = {}) => {
  if (!(file instanceof File)) return file;
  try {
    Object.defineProperty(file, "__compressionMeta", {
      value: meta,
      configurable: true,
      enumerable: false,
      writable: true,
    });
  } catch {
    file.__compressionMeta = meta;
  }
  return file;
};

const getApplicationDocSuccessStorageKey = (applicationId) =>
  applicationId ? `application-doc-successes:${applicationId}` : "";

const buildSuccessMapFromBooking = (booking) => {
  const map = {};
  const travellers = Array.isArray(booking?.travellerDocuments) ? booking.travellerDocuments : [];

  travellers.forEach((traveler) => {
    const travelerNo = String(traveler?.travelerNo || "");
    if (!travelerNo) return;

    const docs = traveler?.documents;
    if (docs instanceof Map) {
      docs.forEach((value, key) => {
        if (value) map[`${travelerNo}-${key}`] = true;
      });
      return;
    }

    if (docs && typeof docs === "object") {
      Object.entries(docs).forEach(([key, value]) => {
        if (value) map[`${travelerNo}-${key}`] = true;
      });
    }
  });

  return map;
};

const getStoredDocumentValue = (docs, key) => {
  if (!docs || !key) return "";
  if (docs instanceof Map) return String(docs.get(key) || "").trim();
  if (typeof docs.get === "function") return String(docs.get(key) || "").trim();
  if (typeof docs === "object") return String(docs[key] || "").trim();
  return "";
};

const getStoredFilename = (value, fallback = "Document") => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return fallback;
  const clean = trimmed.split("?")[0].split("#")[0];
  const parts = clean.split("/");
  return parts[parts.length - 1] || fallback;
};

const getDocumentDisplayName = (label = "") =>
  String(label || "").replace(/\s*Upload\s*$/i, "").trim();

const DOCUMENT_HELPER_COPY = {
  passport: "Mandatory",
  oldPassport: "If available",
  photo: "Recent white background",
  bankStatement: "Last 6 months",
  idCard: "Aadhaar Card",
  panCard: "Optional",
  taxReturn: "Last 1 year",
  itinerary: "Optional",
  salarySlip: "Optional",
  hotelBooking: "Optional",
  flightTicket: "Optional",
  marriageCertificate: "If applicable",
  birthCertificate: "Required for minors",
  employmentLetter: "Letter from employer",
  offerLetter: "If newly employed",
  bankCertificate: "Optional",
  propertyDocuments: "Optional",
  travelInsurance: "If applicable",
  healthInsurance: "Optional",
  coverLetter: "Optional",
  invitationLetter: "If invited",
  sponsorLetter: "If sponsored",
  noObjectionCertificate: "If employed",
  visaApplicationForm: "Signed copy",
  businessLicense: "If self employed",
  companyRegistration: "If business owner",
};

const OTHER_DOCUMENT_LIBRARY_KEYS = [
  "bankStatement",
  "idCard",
  "taxReturn",
  "itinerary",
  "salarySlip",
  "flightTicket",
  "hotelBooking",
  "panCard",
  "employmentLetter",
  "marriageCertificate",
  "birthCertificate",
  "travelInsurance",
];

const ApplicationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { bookings, updateBookingDetails, fetchUserApplications } = useDataStore();
  const { showToast } = useUIStore();
  const { documentCatalog } = useCountries();

  const [uploadingStates, setUploadingStates] = useState({});
  const [optimizingStates, setOptimizingStates] = useState({});
  const [selectedDocs, setSelectedDocs] = useState({});
  const [travelerNames, setTravelerNames] = useState({});
  const [sharedDriveLink, setSharedDriveLink] = useState("");
  const [travelerGdriveFurtherInfoLinks, setTravelerGdriveFurtherInfoLinks] = useState({});
  const [loading, setLoading] = useState(true);
  const [docFields, setDocFields] = useState(buildDocFields());
  const [uploadSettings, setUploadSettings] = useState({
    enableGDriveUpload: true,
    enableFileUpload: true,
  });
  const [docErrors, setDocErrors] = useState({});
  const [applicantNotesDraft, setApplicantNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [expandedTravelerNo, setExpandedTravelerNo] = useState(undefined);
  const [activeOtherDocsTravelerNo, setActiveOtherDocsTravelerNo] = useState(1);
  const [unlockedDocs, setUnlockedDocs] = useState({});
  const [uploadedDocSuccesses, setUploadedDocSuccesses] = useState({});
  const [liveBooking, setLiveBooking] = useState(null);
  const [bookingLoaded, setBookingLoaded] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [termsPage, setTermsPage] = useState(null);
  const [termsPageLoading, setTermsPageLoading] = useState(false);
  const [termsPageError, setTermsPageError] = useState("");
  const [paying, setPaying] = useState(false);
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [razorpayMessage, setRazorpayMessage] = useState("");
  const autoUploadTimersRef = useRef({});
  const bookingRef = useRef(null);
  const docFieldsRef = useRef([]);
  const uploadSettingsRef = useRef({ enableGDriveUpload: true, enableFileUpload: true });
  const selectedDocsRef = useRef({});
  const travelerNamesRef = useRef({});
  const sharedDriveLinkRef = useRef("");
  const travelerGdriveFurtherInfoLinksRef = useRef({});

  const setUploadingState = (key, value) => {
    setUploadingStates((prev) => {
      if (value) return { ...prev, [key]: true };
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const isUploadingState = (key) => Boolean(uploadingStates[key]);
  const docUploading = Object.keys(uploadingStates).length > 0;

  const setOptimizingState = (key, value) => {
    setOptimizingStates((prev) => {
      if (value) return { ...prev, [key]: true };
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };
  const isOptimizingState = (key) => Boolean(optimizingStates[key]);

  const clearAutoUploadTimer = (travelerNo) => {
    const key = String(travelerNo);
    const timer = autoUploadTimersRef.current[key];
    if (timer) {
      window.clearTimeout(timer);
      delete autoUploadTimersRef.current[key];
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/config/upload-settings");
        if (data?.success && data.config) {
          setUploadSettings(data.config);
        }
      } catch (err) {
        console.error("Failed to load upload settings:", err);
      }
      await fetchUserApplications();
      if (id) {
        try {
          const { data } = await api.get(`/users/applications/${id}`);
          setLiveBooking(data?.success ? data.application : null);
        } catch (err) {
          console.error("Failed to load current application:", err);
          setLiveBooking(null);
        } finally {
          setBookingLoaded(true);
        }
      } else {
        setBookingLoaded(true);
      }
      setLoading(false);
    };
    load();
  }, [fetchUserApplications, id]);

  useEffect(() => () => {
    Object.values(autoUploadTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    autoUploadTimersRef.current = {};
  }, []);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const result = await validateRazorpayCheckoutReadiness();
      if (!mounted) return;
      setRazorpayReady(Boolean(result.ok));
      setRazorpayMessage(result.ok ? "" : result.message || "Razorpay unavailable.");
    };
    check();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!termsModalOpen || termsPage) return;
    let cancelled = false;

    const loadTerms = async () => {
      setTermsPageLoading(true);
      setTermsPageError("");
      try {
        const { data } = await api.get(`/pages/${TERMS_CMS_SLUG}`);
        if (cancelled) return;
        if (data?.page) setTermsPage(data.page);
        else setTermsPageError(data?.message || "Terms page is not available.");
      } catch (err) {
        if (!cancelled) {
          setTermsPageError(err.response?.data?.message || "Could not load terms and conditions.");
        }
      } finally {
        if (!cancelled) setTermsPageLoading(false);
      }
    };

    loadTerms();
    return () => {
      cancelled = true;
    };
  }, [termsModalOpen, termsPage]);

  const storeBooking = bookings.find((b) => String(b._id || b.id) === String(id));
  const booking = bookingLoaded ? liveBooking : storeBooking;

  const getSharedDriveLink = () => {
    const root = String(booking?.gdriveLink || "").trim();
    if (root) return root;
    const travellers = Array.isArray(booking?.travellerDocuments) ? booking.travellerDocuments : [];
    const legacy = travellers.find((entry) => String(entry?.gdriveLink || "").trim());
    return String(legacy?.gdriveLink || "").trim();
  };

  const getSavedTravelerGdriveLink = () => getSharedDriveLink();

  const travelerCount = Math.max(1, Number(booking?.travellerCount || 1));
  const progress = booking
    ? getApplicationProgress(booking, {
        ...uploadSettings,
        customRequiredDocs: docFields.map((f) => f.key)
      })
    : { allDocumentsUploaded: false, totalMissingDocuments: 0, missingByTraveler: [] };
  const derivedApplicationProgress = useMemo(() => {
    const requiredDocumentKeys = docFields.map((field) => field.key);
    return getDerivedApplicationProgress(
      booking,
      requiredDocumentKeys,
      uploadSettings,
      uploadedDocSuccesses
    );
  }, [booking, docFields, uploadedDocSuccesses, uploadSettings]);
  const resolvedApplicationStatus = useMemo(
    () => resolveApplicationStatus(booking, derivedApplicationProgress),
    [booking, derivedApplicationProgress]
  );
  const visibleRequiredDocFields = useMemo(
    () => buildDisplayDocFields(docFields.map((field) => field.key), documentCatalog),
    [docFields, documentCatalog]
  );
  const visibleOtherDocFields = useMemo(() => {
    const requiredKeys = new Set(visibleRequiredDocFields.map((field) => field.key));
    const catalogKeys = Array.isArray(documentCatalog)
      ? documentCatalog
          .filter((d) => !d.deleted)
          .map((item) => String(item?.key ?? "").trim())
          .filter((key) => key && key !== "passport" && !requiredKeys.has(key))
      : [];
    const preferredKeys = (Array.isArray(documentCatalog) && documentCatalog.length > 0)
      ? catalogKeys
      : OTHER_DOCUMENT_LIBRARY_KEYS.filter((key) => !requiredKeys.has(key));
    return buildDisplayDocFields(preferredKeys, documentCatalog).filter((field) => field.key !== "passport");
  }, [documentCatalog, visibleRequiredDocFields]);
  const detailsHeaderStatus = useMemo(() => {
    if (["approved", "rejected", "cancelled", "review", "doc_pending", "drive_link_pending", "pending_payment"].includes(resolvedApplicationStatus)) {
      return resolvedApplicationStatus;
    }
    return "";
  }, [resolvedApplicationStatus]);

  useEffect(() => {
    bookingRef.current = booking;
  }, [booking]);

  useEffect(() => {
    const applicationId = String(booking?._id || booking?.id || "");
    if (!applicationId) return;

    const serverSuccesses = buildSuccessMapFromBooking(booking);
    let storedSuccesses = {};

    try {
      const raw = localStorage.getItem(getApplicationDocSuccessStorageKey(applicationId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") storedSuccesses = parsed;
      }
    } catch {
      storedSuccesses = {};
    }

    setUploadedDocSuccesses((prev) => ({
      ...storedSuccesses,
      ...serverSuccesses,
      ...prev,
    }));
  }, [booking?._id, booking?.id, booking?.travellerDocuments]);

  useEffect(() => {
    const applicationId = String(booking?._id || booking?.id || "");
    if (!applicationId) return;

    try {
      localStorage.setItem(
        getApplicationDocSuccessStorageKey(applicationId),
        JSON.stringify(uploadedDocSuccesses)
      );
    } catch {
      /* ignore storage errors */
    }
  }, [booking?._id, booking?.id, uploadedDocSuccesses]);

  useEffect(() => {
    docFieldsRef.current = docFields;
  }, [docFields]);

  useEffect(() => {
    uploadSettingsRef.current = uploadSettings;
  }, [uploadSettings]);

  useEffect(() => {
    selectedDocsRef.current = selectedDocs;
  }, [selectedDocs]);

  useEffect(() => {
    travelerNamesRef.current = travelerNames;
  }, [travelerNames]);

  useEffect(() => {
    sharedDriveLinkRef.current = sharedDriveLink;
  }, [sharedDriveLink]);

  useEffect(() => {
    if (!booking) return;
    setSharedDriveLink(getSharedDriveLink());
  }, [booking?._id, booking?.gdriveLink, booking?.travellerDocuments]);

  useEffect(() => {
    travelerGdriveFurtherInfoLinksRef.current = travelerGdriveFurtherInfoLinks;
  }, [travelerGdriveFurtherInfoLinks]);

  useEffect(() => {
    if (!booking?.countryId) return;

    const loadCountryDocuments = async () => {
      const bookingRequiredDocuments = Array.isArray(booking?.requiredDocuments) && booking.requiredDocuments.length
        ? booking.requiredDocuments
        : [];
      if (bookingRequiredDocuments.length) {
        setDocFields(buildDocFields(bookingRequiredDocuments));
        return;
      }

      try {
        const { data } = await api.get(`/countries/${booking.countryId}`);
        const keys = data?.country?.requiredDocuments;
        setDocFields(buildDocFields(keys));
      } catch {
        setDocFields(buildDocFields());
      }
    };

    loadCountryDocuments();
  }, [booking?.countryId, booking?.requiredDocuments]);

  useEffect(() => {
    setActiveOtherDocsTravelerNo((prev) => {
      const next = Number(prev) || 1;
      return Math.min(Math.max(next, 1), travelerCount);
    });
  }, [travelerCount]);

  const bookingApplicantNotes = String(booking?.applicantNotes ?? "");
  const activeApplicantNotes = applicantNotesDraft;
  const showLegacyUploadSections = false;
  const hashRequestedUploadSection = (location.hash || "").replace(/^#/, "") === "document-upload-section";
  const canUploadDocuments = booking?.status !== "approved" && booking?.status !== "rejected";
  const canSaveApplicantNotes =
    booking?.status === "pending" ||
    booking?.status === "review" ||
    booking?.detailsPending === true;
  const hashExpandedTravelerNo = hashRequestedUploadSection
    ? (progress.missingByTraveler.find((item) => !item.complete)?.travelerNo || 1)
    : null;
  const activeExpandedTravelerNo = expandedTravelerNo ?? hashExpandedTravelerNo;
  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate("/dashboard", { replace: true });
    }
  };
  const getSavedTravelerName = (travelerNo) => {
    const routeNames = Array.isArray(location.state?.travelerNames) ? location.state.travelerNames : [];
    if (routeNames[Number(travelerNo) - 1]) return routeNames[Number(travelerNo) - 1];

    const travellers = Array.isArray(booking?.travellerDocuments) ? booking.travellerDocuments : [];
    const uploadedTraveler = travellers.find((x) => String(x.travelerNo) === String(travelerNo));
    if (uploadedTraveler?.travelerName) return uploadedTraveler.travelerName;

    const names = Array.isArray(booking?.travelerNames) ? booking.travelerNames : [];
    return names[Number(travelerNo) - 1] || "";
  };

  const getSavedTravelerGdriveFurtherInfoLink = (travelerNo) => {
    const travellers = Array.isArray(booking?.travellerDocuments) ? booking.travellerDocuments : [];
    const uploadedTraveler = travellers.find((x) => String(x.travelerNo) === String(travelerNo));
    if (uploadedTraveler?.gdriveFurtherInfoLink) return uploadedTraveler.gdriveFurtherInfoLink;
    const tc = Math.max(1, Number(booking?.travellerCount || 1));
    if (tc === 1 && Number(travelerNo) === 1 && String(booking?.gdriveFurtherInfoLink || "").trim()) {
      return booking.gdriveFurtherInfoLink;
    }
    return "";
  };

  const getSavedTravelerDocuments = (travelerNo) => {
    const travellers = Array.isArray(booking?.travellerDocuments) ? booking.travellerDocuments : [];
    const uploadedTraveler = travellers.find((x) => String(x.travelerNo) === String(travelerNo));
    return uploadedTraveler?.documents && (
      uploadedTraveler.documents instanceof Map
      || typeof uploadedTraveler.documents?.get === "function"
      || typeof uploadedTraveler.documents === "object"
    )
      ? uploadedTraveler.documents
      : {};
  };

  const getSavedTravelerOtherDocuments = (travelerNo) => {
    const travellers = Array.isArray(booking?.travellerDocuments) ? booking.travellerDocuments : [];
    const uploadedTraveler = travellers.find((x) => String(x.travelerNo) === String(travelerNo));
    return Array.isArray(uploadedTraveler?.otherDocuments) ? uploadedTraveler.otherDocuments : [];
  };

  /** Saved-on-server completion only (never infer from unsaved text in the Drive link box). */
  const travelerServerComplete = (travelerNo) =>
    Boolean(
      progress.missingByTraveler.find((item) => Number(item.travelerNo) === Number(travelerNo))?.complete
    );

  const travelerSubmissionLocked = (travelerNo) => travelerServerComplete(travelerNo);

  const travelerHasUnsavedChanges = (travelerNo) => {
    const travelerNoStr = String(travelerNo);
    const nameNow = String(travelerNames[travelerNoStr] ?? getSavedTravelerName(travelerNo)).trim();
    const nameSaved = String(getSavedTravelerName(travelerNo)).trim();
    if (nameNow !== nameSaved) return true;

    const gFurtherNow = String(
      travelerGdriveFurtherInfoLinks[travelerNoStr] ?? getSavedTravelerGdriveFurtherInfoLink(travelerNo)
    ).trim();
    const gFurtherSaved = String(getSavedTravelerGdriveFurtherInfoLink(travelerNo)).trim();
    if (gFurtherNow !== gFurtherSaved) return true;

    for (const [key, val] of Object.entries(selectedDocs)) {
      if (!key.startsWith(`${travelerNoStr}-`)) continue;
      if (val instanceof File) return true;
      if (Array.isArray(val) && val.some(Boolean)) return true;
    }
    return false;
  };

  const travelers = Array.from({ length: travelerCount }, (_, idx) => {
    const travelerNo = idx + 1;
    const travelerNoStr = String(travelerNo);
    const uploadedTraveler = (Array.isArray(booking?.travellerDocuments) ? booking.travellerDocuments : []).find(
      (entry) => Number(entry?.travelerNo) === travelerNo
    );
    const savedDocuments = getSavedTravelerDocuments(travelerNo);
    const travelerName = getSavedTravelerName(travelerNo) || `Traveler ${travelerNo}`;
    const submittedDocFields = docFields.filter((field) => {
      const savedValue = getStoredDocumentValue(savedDocuments, field.key);
      const localSuccess = uploadedDocSuccesses[`${travelerNoStr}-${field.key}`];
      return Boolean(savedValue || localSuccess);
    });
    const uploadedDocumentsCount = submittedDocFields.length;
    const missingInfo = progress.missingByTraveler.find((item) => item.travelerNo === travelerNo);
    const done = travelerServerComplete(travelerNo);

    return {
      travelerNo,
      travelerName,
      gdriveLink: getSharedDriveLink(),
      gdriveFurtherInfoLink: uploadedTraveler?.gdriveFurtherInfoLink || "",
      uploadedDocumentsCount,
      submittedDocFields,
      uploadedOtherDocumentsCount: Array.isArray(uploadedTraveler?.otherDocuments) ? uploadedTraveler.otherDocuments.length : 0,
      isComplete: done,
      missingLabels: done ? [] : (missingInfo?.missingLabels || []),
    };
  });

  const resolvedActiveOtherDocsTravelerNo = Math.min(
    Math.max(Number(activeOtherDocsTravelerNo) || 1, 1),
    travelerCount
  );

  const handleDocFieldChange = async (travelerNo, docKey, file) => {
    const inputKey = `${travelerNo}-${docKey}`;
    const prepareStateKey = `traveler-prepare-${inputKey}`;
    if (!file) {
      setUploadingState(prepareStateKey, false);
      setDocErrors((prev) => ({ ...prev, [inputKey]: null }));
      setSelectedDocs((prev) => ({ ...prev, [inputKey]: null }));
      setUploadedDocSuccesses((prev) => {
        const next = { ...prev };
        delete next[inputKey];
        return next;
      });
      return;
    }
    setUploadingState(prepareStateKey, true);
    if (docKey === "passport" && !ALLOWED_PASSPORT_MIME_TYPES.has(String(file.type || "").toLowerCase())) {
      showToast(INVALID_PASSPORT_TYPE_ERROR, "error");
      setDocErrors((prev) => ({ ...prev, [inputKey]: INVALID_PASSPORT_TYPE_ERROR }));
      setSelectedDocs((prev) => ({ ...prev, [inputKey]: null }));
      setUploadedDocSuccesses((prev) => {
        const next = { ...prev };
        delete next[inputKey];
        return next;
      });
      setUploadingState(prepareStateKey, false);
      return;
    }
    const { maxBytes, label } = getUploadLimitForDocType(docKey);
    setOptimizingState(prepareStateKey, true);
    const { file: optimizedFile, error, originalSize, compressedSize, wasCompressed } = await optimizeUploadFile(file, {
      targetBytes: maxBytes,
    });
    setOptimizingState(prepareStateKey, false);
    if (error || !optimizedFile) {
      const message = error || OPTIMIZE_ERROR;
      showToast(message, "error");
      setDocErrors((prev) => ({ ...prev, [inputKey]: message }));
      setSelectedDocs((prev) => ({ ...prev, [inputKey]: null }));
      setUploadedDocSuccesses((prev) => {
        const next = { ...prev };
        delete next[inputKey];
        return next;
      });
      setUploadingState(prepareStateKey, false);
      return;
    }
    if (optimizedFile.size > maxBytes) {
      const message = "Document is too large. Please upload a smaller PDF or split the document.";
      showToast(message, "error");
      setDocErrors((prev) => ({ ...prev, [inputKey]: message }));
      setSelectedDocs((prev) => ({ ...prev, [inputKey]: null }));
      setUploadedDocSuccesses((prev) => {
        const next = { ...prev };
        delete next[inputKey];
        return next;
      });
      setUploadingState(prepareStateKey, false);
      return;
    }
    const preparedFile = attachCompressionMeta(optimizedFile, { originalSize, compressedSize, wasCompressed });
    setDocErrors((prev) => ({ ...prev, [inputKey]: null }));
    setSelectedDocs((prev) => ({ ...prev, [inputKey]: preparedFile }));
    setUploadedDocSuccesses((prev) => {
      const next = { ...prev };
      delete next[inputKey];
      return next;
    });
    clearAutoUploadTimer(travelerNo);
    autoUploadTimersRef.current[String(travelerNo)] = window.setTimeout(() => {
      void handleAutoUploadTraveler(travelerNo, "document").finally(() => {
        setUploadingState(prepareStateKey, false);
      });
    }, 250);
  };

  const handleOtherDocsChange = async (travelerNo, files) => {
    const travelerNoStr = String(travelerNo);
    const incoming = Array.from(files || []);
    const optimizedFiles = [];
    setOptimizingState(`traveler-prepare-other-${travelerNoStr}`, true);
    for (const rawFile of incoming) {
      const { file: optimizedFile, error, originalSize, compressedSize, wasCompressed } = await optimizeUploadFile(rawFile);
      if (error || !optimizedFile) {
        setOptimizingState(`traveler-prepare-other-${travelerNoStr}`, false);
        showToast(error || OPTIMIZE_ERROR, "error");
        return;
      }
      if (optimizedFile.size > MAX_DOCUMENT_SIZE_BYTES) {
        setOptimizingState(`traveler-prepare-other-${travelerNoStr}`, false);
        showToast("Document is too large. Please upload a smaller PDF or split the document.", "error");
        return;
      }
      optimizedFiles.push(attachCompressionMeta(optimizedFile, { originalSize, compressedSize, wasCompressed }));
    }
    setOptimizingState(`traveler-prepare-other-${travelerNoStr}`, false);
    const fileSig = (f) => `${f.name}|${f.size}|${f.lastModified}`;
    setSelectedDocs((prev) => {
      const key = `${travelerNoStr}-otherDocuments`;
      const existing = Array.isArray(prev[key]) ? [...prev[key]] : [];
      const merged = [...existing];
      for (const f of optimizedFiles) {
        if (!merged.some((x) => fileSig(x) === fileSig(f))) merged.push(f);
      }
      const capped = merged.slice(0, 10);
      return { ...prev, [key]: capped };
    });
    clearAutoUploadTimer(travelerNo);
    autoUploadTimersRef.current[String(travelerNo)] = window.setTimeout(() => {
      void handleAutoUploadTraveler(travelerNo, "document");
    }, 250);
  };

  const removeOtherDoc = (travelerNo, docIndex) => {
    const travelerNoStr = String(travelerNo);
    setSelectedDocs((prev) => {
      const list = Array.isArray(prev[`${travelerNoStr}-otherDocuments`])
        ? [...prev[`${travelerNoStr}-otherDocuments`]]
        : [];
      list.splice(docIndex, 1);
      return { ...prev, [`${travelerNoStr}-otherDocuments`]: list };
    });
  };

  const allTravelersComplete = progress.allDocumentsUploaded;
  const summarySyncing = isUploadingState("summary-sync");

  const toggleTravelerUploadSection = (travelerNo) => {
    setExpandedTravelerNo((prev) => {
      const current = prev ?? hashExpandedTravelerNo;
      return current === travelerNo ? 0 : travelerNo;
    });
  };

  useEffect(() => {
    if (loading || !booking || !hashExpandedTravelerNo) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`document-upload-section-${hashExpandedTravelerNo}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [loading, booking, hashExpandedTravelerNo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan animate-spin" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <h2 className="text-2xl font-bold text-text-primary mb-2">Application Not Found</h2>
          <p className="text-text-secondary mb-6">We couldn't find the requested application.</p>
          <Button variant="primary" onClick={handleBack}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const handleUploadTraveler = async (travelerNo) => {
    if (!canUploadDocuments) return;
    const uploadStateKey = `traveler-upload-${travelerNo}`;
    const travelerNoStr = String(travelerNo);
    const travelerName =
      String(travelerNames[travelerNoStr] ?? getSavedTravelerName(travelerNo)).trim() ||
      `Traveler ${travelerNo}`;
    const gdriveLinkForTraveler = String(sharedDriveLink || getSharedDriveLink()).trim();
    const gdriveFurtherInfoLinkForTraveler = String(
      travelerGdriveFurtherInfoLinks[travelerNoStr] ?? getSavedTravelerGdriveFurtherInfoLink(travelerNo)
    ).trim();

    const hasGdriveLink = Boolean(gdriveLinkForTraveler);
    const files = [];
    const fileOn = uploadSettings.enableFileUpload;
    const gdOn = uploadSettings.enableGDriveUpload;
    const otherDocsOn = fileOn;
    const selectedOtherDocs = selectedDocs[`${travelerNoStr}-otherDocuments`];
    const otherDocs = Array.isArray(selectedOtherDocs) ? selectedOtherDocs : [];

    const serverComplete = travelerServerComplete(travelerNo);
    const savedDocuments = getSavedTravelerDocuments(travelerNo);
    const passportInputKey = `${travelerNoStr}-passport`;
    const savedPassportUrl = getStoredDocumentValue(savedDocuments, "passport");
    const passportFile = selectedDocs[passportInputKey];
    const hasPassport = Boolean(savedPassportUrl || (passportFile instanceof File));

    const hasPassportSelection = passportFile instanceof File;
    const hasRequiredFileSelection =
      hasPassportSelection ||
      (
        fileOn &&
        docFields.some((field) => field.key !== "passport" && selectedDocs[`${travelerNoStr}-${field.key}`] instanceof File)
      );

    const onlyAdditionalOtherUpload =
      fileOn &&
      serverComplete &&
      otherDocs.length > 0 &&
      !hasRequiredFileSelection;

    if (onlyAdditionalOtherUpload) {
      for (const f of otherDocs) {
        if (!(f instanceof File)) continue;
        if (f.size > MAX_DOCUMENT_SIZE_BYTES) {
          showToast(FILE_SIZE_ERROR, "error");
          return;
        }
        files.push({ field: { key: "otherDocument", kind: "other" }, file: f });
      }
    } else {
      if (!hasPassport) {
        showToast(`Traveler ${travelerNo}: Passport is required.`, "error");
        return;
      }
      if (passportFile instanceof File) {
        const { maxBytes, label } = getUploadLimitForDocType("passport");
        if (passportFile.size > maxBytes) {
          showToast(`Passport file must be below ${label} after optimization.`, "error");
          return;
        }
        files.push({ field: { key: "passport", label: "Passport", kind: "required" }, file: passportFile });
      }

      if (fileOn && !gdOn) {
      for (const field of docFields) {
        if (field.key === "passport") continue;
        const f = selectedDocs[`${travelerNoStr}-${field.key}`];
        const savedUrl = unlockedDocs[`${travelerNoStr}-${field.key}`]
          ? ""
          : getStoredDocumentValue(savedDocuments, field.key);
        if (!(f instanceof File) && !savedUrl) {
          showToast(`Traveler ${travelerNo}: ${field.label} is required.`, "error");
          return;
        }
        if (f instanceof File) {
          const { maxBytes, label } = getUploadLimitForDocType(field.key);
          if (f.size > maxBytes) {
            showToast(`File must be below ${label} after optimization.`, "error");
            return;
          }
          files.push({ field, file: f });
        }
      }
      } else if (fileOn && gdOn) {
        for (const field of docFields) {
          if (field.key === "passport") continue;
          const f = selectedDocs[`${travelerNoStr}-${field.key}`];
          if (f instanceof File) {
            const { maxBytes, label } = getUploadLimitForDocType(field.key);
            if (f.size > maxBytes) {
              showToast(`File must be below ${label} after optimization.`, "error");
              return;
            }
            files.push({ field, file: f });
          } else if (!hasGdriveLink) {
            const savedUrl = unlockedDocs[`${travelerNoStr}-${field.key}`]
              ? ""
              : getStoredDocumentValue(savedDocuments, field.key);
            if (!savedUrl) {
              showToast(`Traveler ${travelerNo}: ${field.label} is required, or provide a Google Drive link.`, "error");
              return;
            }
          }
        }
      }

      if (otherDocsOn) {
        for (const f of otherDocs) {
          files.push({ field: { key: "otherDocument", kind: "other" }, file: f });
        }
      }
    }

    setUploadingState(uploadStateKey, true);
    try {
      const appId = booking._id || booking.id;
      
      if (files.length === 0) {
        // Only saving traveler name & GDrive link without files
        const { data } = await api.put(`/users/applications/${appId}`, {
          travelerUpdate: {
            travelerNo: travelerNoStr,
            travelerName: travelerName,
            gdriveLink: gdriveLinkForTraveler,
          }
        });
        
        if (data.success && data.application) {
          setLiveBooking(data.application);
          updateBookingDetails(appId, data.application);
          await fetchUserApplications();
          showToast(`Traveler ${travelerNo} details saved successfully!`, "success");
        }
      } else {
        // Uploading files and saving details
        const formData = new FormData();
        const documentsMeta = [];
        for (const { field, file } of files) {
          const ext = (file.name.split(".").pop() || "").toLowerCase();
          const safeExt = ext ? `.${ext}` : "";
          formData.append(
            "documents",
            new File([file], `traveler-${travelerNoStr}_${field.key}${safeExt}`, { type: file.type })
          );
          documentsMeta.push({
            docType: field.key,
            kind: field.kind || "required",
          });
        }
        formData.append("travelerNo", travelerNoStr);
        formData.append("travelerName", travelerName);
        formData.append("gdriveLink", gdriveLinkForTraveler);
        formData.append("documentsMeta", JSON.stringify(documentsMeta));

        const { data } = await api.post(`/users/applications/${appId}/documents`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (data.success && data.application) {
          setLiveBooking(data.application);
          updateBookingDetails(appId, data.application);
          setUploadedDocSuccesses((prev) => {
            const next = { ...prev };
            files.forEach(({ field }) => {
              if (field.key !== "otherDocument") {
                next[`${travelerNoStr}-${field.key}`] = true;
              }
            });
            return next;
          });
          setSelectedDocs((prev) => {
            const next = { ...prev };
            docFields.forEach((f) => { delete next[`${travelerNoStr}-${f.key}`]; });
            delete next[`${travelerNoStr}-passport`];
            delete next[`${travelerNoStr}-otherDocuments`];
            return next;
          });
          setUnlockedDocs((prev) => {
            const next = { ...prev };
            docFields.forEach((f) => { delete next[`${travelerNoStr}-${f.key}`]; });
            return next;
          });
          await fetchUserApplications();
          const successLabels = files.map(({ field, file }) => {
            if (field.key === "otherDocument") {
              return file.name || "Additional document";
            } else {
              return (field.label || "").replace(" Upload", "");
            }
          });

          if (successLabels.length === 1) {
            showToast(`${successLabels[0]} uploaded successfully!`, "success");
          } else if (successLabels.length > 1) {
            showToast(`Uploaded successfully: ${successLabels.join(", ")}!`, "success");
          }
        }
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Could not upload documents.", "error");
    } finally {
      setUploadingState(uploadStateKey, false);
    }
  };

  const handleSaveSharedDriveLink = async () => {
    const linkValue = String(sharedDriveLink || "").trim();
    if (!linkValue) {
      showToast("Please enter a Google Drive folder link.", "error");
      return;
    }

    const uploadStateKey = "shared-gdrive";
    setUploadingState(uploadStateKey, true);
    const appId = booking._id || booking.id;
    try {
      const { data } = await api.put(`/users/applications/${appId}`, {
        gdriveLink: linkValue,
      });

      if (data?.success && data.application) {
        setLiveBooking(data.application);
        updateBookingDetails(appId, data.application);
        await fetchUserApplications();
        setSharedDriveLink(linkValue);
        showToast("Google Drive link saved successfully!", "success");
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Could not save Google Drive link.", "error");
    } finally {
      setUploadingState(uploadStateKey, false);
    }
  };

  const handleDeleteSavedOtherDoc = async (travelerNo, docIndex) => {
    const travelerNoStr = String(travelerNo);
    const savedOtherDocs = getSavedTravelerOtherDocuments(travelerNo);
    const updatedOtherDocs = savedOtherDocs.filter((_, idx) => idx !== docIndex);

    const appId = booking._id || booking.id;
    const travelerName = getSavedTravelerName(travelerNo);
    const gdriveLink = getSavedTravelerGdriveLink(travelerNo);
    const gdriveFurtherInfoLink = getSavedTravelerGdriveFurtherInfoLink(travelerNo);

    setUploadingState(`traveler-upload-${travelerNo}`, true);
    try {
      const { data } = await api.put(`/users/applications/${appId}`, {
        travelerUpdate: {
          travelerNo: travelerNoStr,
          travelerName,
          gdriveLink,
          gdriveFurtherInfoLink,
          otherDocuments: updatedOtherDocs,
        }
      });
      if (data.success && data.application) {
        setLiveBooking(data.application);
        updateBookingDetails(appId, data.application);
        await fetchUserApplications();
        showToast("Additional document deleted successfully.", "success");
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Could not delete additional document.", "error");
    } finally {
      setUploadingState(`traveler-upload-${travelerNo}`, false);
    }
  };

  const handleSaveTravelerNameAndLink = async (travelerNo) => {
    const travelerNoStr = String(travelerNo);
    const travelerName = travelerNames[travelerNoStr] ?? getSavedTravelerName(travelerNo);
    const appId = booking._id || booking.id;
    try {
      const { data } = await api.put(`/users/applications/${appId}`, {
        travelerUpdate: {
          travelerNo: travelerNoStr,
          travelerName,
        }
      });
      if (data.success && data.application) {
        setLiveBooking(data.application);
        updateBookingDetails(appId, data.application);
        await fetchUserApplications();
        showToast(`Traveler ${travelerNo} details saved.`, "success");
      }
    } catch (err) {
      const serverMessage = err?.response?.data?.message || err?.response?.data?.error || (typeof err?.response?.data === "string" ? err.response.data : "");
      showToast(serverMessage || err?.message || "Could not save traveler details. Please try again.", "error");
    }
  };

  const handleSaveTravelerDriveLink = async (travelerNo, field = "main") => {
    if (!canUploadDocuments || !uploadSettings.enableGDriveUpload) return;
    if (field === "main") {
      await handleSaveSharedDriveLink();
      return;
    }
    const uploadStateKey = `traveler-drive-${travelerNo}-${field}`;

    const travelerNoStr = String(travelerNo);
    const travelerName =
      String(travelerNames[travelerNoStr] ?? getSavedTravelerName(travelerNo)).trim() ||
      `Traveler ${travelerNo}`;
    const gdriveLinkForTraveler = String(sharedDriveLink || getSharedDriveLink()).trim();
    const gdriveFurtherInfoLinkForTraveler = String(
      travelerGdriveFurtherInfoLinks[travelerNoStr] ?? getSavedTravelerGdriveFurtherInfoLink(travelerNo)
    ).trim();

    if (field === "main" && !gdriveLinkForTraveler) {
      showToast(`Traveler ${travelerNo}: Please paste a Google Drive link first.`, "error");
      return;
    }

    if (field === "further" && !gdriveFurtherInfoLinkForTraveler) {
      showToast(`Traveler ${travelerNo}: Please paste a further information link first.`, "error");
      return;
    }

    setUploadingState(uploadStateKey, true);
    try {
      const appId = booking._id || booking.id;
      const payload = {
        travelerNo: travelerNoStr,
        travelerName,
      };

      if (field === "main") {
        payload.gdriveLink = gdriveLinkForTraveler;
      } else {
        payload.gdriveFurtherInfoLink = gdriveFurtherInfoLinkForTraveler;
      }

      const { data } = await api.put(`/users/applications/${appId}`, {
        travelerUpdate: payload,
      });

      if (data?.success && data.application) {
        setLiveBooking(data.application);
        updateBookingDetails(appId, data.application);
        await fetchUserApplications();
        showToast(
          field === "main"
            ? `Traveler ${travelerNo} Google Drive link uploaded.`
            : `Traveler ${travelerNo} further information link uploaded.`,
          "success"
        );
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Could not upload Google Drive link.", "error");
    } finally {
      setUploadingState(uploadStateKey, false);
    }
  };

  const persistTravelerDraft = async (travelerNo, options = {}) => {
    const { silent = true } = options;
    if (!canUploadDocuments) return null;

    const bookingSnapshot = bookingRef.current;
    const docFieldsSnapshot = docFieldsRef.current;
    const uploadSettingsSnapshot = uploadSettingsRef.current;
    const selectedDocsSnapshot = selectedDocsRef.current;
    const travelerNamesSnapshot = travelerNamesRef.current;
    const sharedDriveLinkSnapshot = String(sharedDriveLinkRef.current || "").trim();
    const travelerGdriveFurtherInfoLinksSnapshot = travelerGdriveFurtherInfoLinksRef.current;
    if (!bookingSnapshot) return null;

    const travelerNoStr = String(travelerNo);
    const travelerName =
      String(travelerNamesSnapshot[travelerNoStr] ?? getSavedTravelerName(travelerNo)).trim() ||
      `Traveler ${travelerNo}`;
    const gdriveLinkForTraveler = sharedDriveLinkSnapshot;
    const gdriveFurtherInfoLinkForTraveler = String(
      travelerGdriveFurtherInfoLinksSnapshot[travelerNoStr] ?? getSavedTravelerGdriveFurtherInfoLink(travelerNo)
    ).trim();
    const appId = bookingSnapshot._id || bookingSnapshot.id;

    const requiredFiles = uploadSettingsSnapshot.enableFileUpload
      ? docFieldsSnapshot
          .filter((field) => field.key !== "passport")
          .map((field) => ({
            field,
            file: selectedDocsSnapshot[`${travelerNoStr}-${field.key}`],
          }))
          .filter((entry) => entry.file instanceof File)
      : [];

    const passportFile = selectedDocsSnapshot[`${travelerNoStr}-passport`];
    if (passportFile instanceof File) {
      requiredFiles.push({
        field: { key: "passport", kind: "required", label: "Passport" },
        file: passportFile,
      });
    }

    const otherFiles = uploadSettingsSnapshot.enableFileUpload
      ? (Array.isArray(selectedDocsSnapshot[`${travelerNoStr}-otherDocuments`])
          ? selectedDocsSnapshot[`${travelerNoStr}-otherDocuments`].filter((file) => file instanceof File)
          : [])
      : [];
    const hasFileSelections = requiredFiles.length > 0 || otherFiles.length > 0;
    const hasUnsavedTextChanges =
      String(travelerName).trim() !== String(getSavedTravelerName(travelerNo)).trim() ||
      gdriveFurtherInfoLinkForTraveler !== String(getSavedTravelerGdriveFurtherInfoLink(travelerNo)).trim();

    if (!hasFileSelections && !hasUnsavedTextChanges) {
      return null;
    }

    let nextApplication = null;

    if (hasFileSelections) {
      const formData = new FormData();
      const documentsMeta = [];

      requiredFiles.forEach(({ field, file }) => {
        const ext = (file.name.split(".").pop() || "").toLowerCase();
        const safeExt = ext ? `.${ext}` : "";
        formData.append(
          "documents",
          new File([file], `traveler-${travelerNoStr}_${field.key}${safeExt}`, { type: file.type })
        );
        documentsMeta.push({ docType: field.key, kind: "required" });
      });

      otherFiles.forEach((file) => {
        const ext = (file.name.split(".").pop() || "").toLowerCase();
        const safeExt = ext ? `.${ext}` : "";
        formData.append(
          "documents",
          new File([file], `traveler-${travelerNoStr}_otherDocument${safeExt}`, { type: file.type })
        );
        documentsMeta.push({ docType: "otherDocument", kind: "other" });
      });

      formData.append("travelerNo", travelerNoStr);
      formData.append("travelerName", travelerName);
      formData.append("gdriveLink", gdriveLinkForTraveler);
      formData.append("gdriveFurtherInfoLink", gdriveFurtherInfoLinkForTraveler);
      formData.append("documentsMeta", JSON.stringify(documentsMeta));

      const { data } = await api.post(`/users/applications/${appId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (data?.success && data.application) {
        nextApplication = data.application;
        setUploadedDocSuccesses((prev) => {
          const next = { ...prev };
          requiredFiles.forEach(({ field }) => {
            next[`${travelerNoStr}-${field.key}`] = true;
          });
          return next;
        });
        setSelectedDocs((prev) => {
          const next = { ...prev };
          docFieldsSnapshot.forEach((field) => {
            delete next[`${travelerNoStr}-${field.key}`];
          });
          delete next[`${travelerNoStr}-passport`];
          delete next[`${travelerNoStr}-otherDocuments`];
          return next;
        });
      }
    } else {
      const { data } = await api.put(`/users/applications/${appId}`, {
        travelerUpdate: {
          travelerNo: travelerNoStr,
          travelerName,
          gdriveLink: gdriveLinkForTraveler,
          gdriveFurtherInfoLink: gdriveFurtherInfoLinkForTraveler,
        },
      });

      if (data?.success && data.application) {
        nextApplication = data.application;
      }
    }

    if (nextApplication && !silent) {
      showToast(`Traveler ${travelerNo} details saved.`, "success");
    }

    return nextApplication;
  };

  const handleAutoUploadTraveler = async (travelerNo, reason = "document") => {
    const uploadStateKey = `traveler-auto-${travelerNo}`;
    clearAutoUploadTimer(travelerNo);
    setUploadingState(uploadStateKey, true);

    try {
      const updatedApplication = await persistTravelerDraft(travelerNo, { silent: true });
      if (!updatedApplication) return;

      const appId = booking._id || booking.id;
      setLiveBooking(updatedApplication);
      updateBookingDetails(appId, updatedApplication);
      await fetchUserApplications();
      showToast(
        reason === "document"
          ? `Traveler ${travelerNo} documents uploaded successfully.`
          : `Traveler ${travelerNo} details saved successfully.`,
        "success"
      );
    } catch (err) {
      const serverMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (typeof err?.response?.data === "string" ? err.response.data : "");
      showToast(serverMessage || err?.message || "Could not auto-upload traveler documents.", "error");
    } finally {
      setUploadingState(uploadStateKey, false);
    }
  };

  const resolvePayAmountRupees = (appDoc) => {
    const fromTotal = Number(appDoc?.totalAmount);
    if (Number.isFinite(fromTotal) && fromTotal > 0) return fromTotal;
    const count = Math.max(1, Number(appDoc?.travellerCount || 1));
    const service = SERVICE_FEE_PER_TRAVELLER * count;
    const gst = Math.round(service * GST_RATE);
    const fromServer = Number(appDoc?.fee);
    return Number.isFinite(fromServer) && fromServer > 0 ? fromServer : service + gst;
  };

  const handleOpenPaymentTerms = () => {
    setTermsModalOpen(true);
  };

  const handleProceedToPaymentSummary = async () => {
    if (!termsAccepted) {
      showToast("Please accept the terms and conditions.", "error");
      return;
    }
    if (!razorpayReady) {
      showToast(razorpayMessage || "Payment is not available right now.", "error");
      return;
    }

    const summarySyncKey = "summary-sync";
    setUploadingState(summarySyncKey, true);
    setPaying(true);

    try {
      const appId = booking._id || booking.id;
      let latestApplication = null;
      let savedSomething = false;

      for (const traveler of travelers) {
        const updatedApplication = await persistTravelerDraft(traveler.travelerNo, { silent: true });
        if (updatedApplication) {
          latestApplication = updatedApplication;
          savedSomething = true;
        }
      }

      if (savedSomething && latestApplication) {
        setLiveBooking(latestApplication);
        updateBookingDetails(appId, latestApplication);
        await fetchUserApplications();
        showToast("Latest traveler uploads were saved.", "success");
      }

      const applicationForPayment = latestApplication || booking;
      const amountRupees = resolvePayAmountRupees(applicationForPayment);

      await openRazorpayForApplication({
        applicationId: appId,
        amountRupees,
        description: `${applicationForPayment?.countryName || "Visa"} - service fee`,
        applicantName: user?.name || "Applicant",
        applicantEmail: user?.email || "",
        onSuccess: () => {
          setTermsModalOpen(false);
          showToast("Payment successful!", "success");
          navigate(`/dashboard/application/${encodeURIComponent(appId)}`, { replace: true });
        },
        onDismiss: () => {
          setTermsModalOpen(false);
          showToast("Payment was not completed. You can continue from this page anytime.", "info");
        },
        onFailure: (message) => {
          setTermsModalOpen(false);
          showToast(message || "Payment could not be started.", "error");
          navigate(`/dashboard?payment=failed&applicationId=${encodeURIComponent(appId)}`, { replace: true });
        },
      });
    } catch (err) {
      const serverMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (typeof err?.response?.data === "string" ? err.response.data : "");
      showToast(serverMessage || err?.message || "Could not start payment.", "error");
    } finally {
      setUploadingState(summarySyncKey, false);
      setPaying(false);
    }
  };

  const handleSaveApplicantNotes = async () => {
    if (!canSaveApplicantNotes) return;
    setNotesSaving(true);
    try {
      const appId = booking._id || booking.id;
      const { data } = await api.put(`/users/applications/${appId}`, { applicantNotes: activeApplicantNotes });
      if (data?.success && data.application) {
        setLiveBooking(data.application);
        updateBookingDetails(appId, data.application);
        setApplicantNotesDraft("");
        await fetchUserApplications();
        showToast("Further information saved.", "success");
      } else {
        showToast(data?.message || "Could not save.", "error");
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Could not save further information.", "error");
    } finally {
      setNotesSaving(false);
    }
  };

  const notesDirty =
    String(activeApplicantNotes).trim().length > 0 &&
    activeApplicantNotes !== bookingApplicantNotes;
  const showFurtherInfoCard =
    booking.status !== "rejected" &&
    (canSaveApplicantNotes ||
      String(booking.applicantNotes || "").trim().length > 0 ||
      (canUploadDocuments && uploadSettings.enableGDriveUpload) ||
      (canUploadDocuments && uploadSettings.enableFileUpload));

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.96); opacity: 0; }
          70% { transform: scale(1.02); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes checkPop {
          0% { transform: scale(0) rotate(-45deg); opacity: 0; }
          70% { transform: scale(1.3) rotate(15deg); }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        .animate-pop-in {
          animation: popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .animate-check-pop {
          animation: checkPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
      <Navbar />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Back */}
        <button
          onClick={handleBack}
          type="button"
          aria-label="Back"
          title="Back"
          className="group inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-surface text-text-muted shadow-sm transition-all duration-200 hover:-translate-x-0.5 hover:border-cyan/40 hover:bg-cyan/5 hover:text-cyan"
        >
          <ArrowLeft size={18} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
        </button>

        {/* Header */}
        <div className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-cyan font-semibold mb-2">
                {booking.flagEmoji} {booking.countryName}
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-text-primary">Application Details</h2>
              <p className="text-sm text-text-secondary mt-2 max-w-2xl">
                Review your full application, payment summary, and traveler-specific document status in one place.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {detailsHeaderStatus ? <StatusBadge status={detailsHeaderStatus} /> : null}
              {/* Payment status intentionally shown only in the Payment Summary card below. */}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-5">
              <Plane size={18} className="text-cyan" />
              <h3 className="text-lg font-semibold text-text-primary">Application Summary</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="rounded-xl bg-surface-2 p-4">
                <p className="text-xs text-text-muted mb-1">Destination</p>
                <p className="text-sm font-semibold text-text-primary">{booking.countryName}</p>
              </div>
              <div className="rounded-xl bg-surface-2 p-4">
                <p className="text-xs text-text-muted mb-1">Visa Type</p>
                <p className="text-sm font-semibold text-text-primary">{booking.visaType || "N/A"}</p>
              </div>
              <div className="rounded-xl bg-surface-2 p-4">
                <p className="text-xs text-text-muted mb-1">Application ID</p>
                <p className="text-sm font-semibold text-text-primary break-all">{booking.applicationId || booking._id || booking.id}</p>
              </div>
              <div className="rounded-xl bg-surface-2 p-4">
                <p className="text-xs text-text-muted mb-1">Applied On</p>
                <p className="text-sm font-semibold text-text-primary">{formatOrdinalDate(booking.createdAt)}</p>
              </div>
              <div className="rounded-xl bg-surface-2 p-4">
                <p className="text-xs text-text-muted mb-1">Travel Date</p>
                <p className="text-sm font-semibold text-text-primary">{booking.travelDate ? formatOrdinalDate(booking.travelDate) : "N/A"}</p>
              </div>
              <div className="rounded-xl bg-surface-2 p-4">
                <p className="text-xs text-text-muted mb-1">Return Date</p>
                <p className="text-sm font-semibold text-text-primary">{booking.returnDate ? formatOrdinalDate(booking.returnDate) : "Not specified"}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-5">
              <Wallet size={18} className="text-cyan" />
              <h3 className="text-lg font-semibold text-text-primary">Payment Summary</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Payment Status</span>
                <StatusBadge status={booking.paymentStatus || "pending_payment"} size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Amount</span>
                <div className="group relative inline-flex flex-col items-end">
                  <span className="font-semibold text-text-primary cursor-default">{"\u20B9"}{Number(booking.totalAmount ?? booking.fee ?? 0).toLocaleString("en-IN")}</span>
                  <div className="pointer-events-none invisible absolute right-0 top-full z-30 mt-2 w-64 translate-y-1 rounded-2xl border border-cyan/20 bg-surface px-3 py-3 text-left opacity-0 shadow-[0_18px_40px_-20px_rgba(0,212,255,0.28)] transition duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-3 text-text-secondary">
                        <span>
                          Government Fee
                          {Number(booking.travellerCount || 1) > 1 ? ` x${Number(booking.travellerCount || 1)}` : ""}
                        </span>
                        <span className="font-semibold text-text-primary">
                          {"\u20B9"}{Number(booking.governmentFeeTotal || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-text-secondary">
                        <span>
                          Our Service Fee
                          {Number(booking.travellerCount || 1) > 1 ? ` x${Number(booking.travellerCount || 1)}` : ""}
                        </span>
                        <span className="font-semibold text-text-primary">
                          {"\u20B9"}{Number(booking.serviceFeeTotal || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-text-secondary">
                        <span>GST</span>
                        <span className="font-semibold text-text-primary">
                          {"\u20B9"}{Number(booking.gstAmount || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="border-t border-border pt-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-text-primary">Total Amount</span>
                          <span className="font-bold text-cyan">
                            {"\u20B9"}{Number(booking.totalAmount ?? booking.fee ?? 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Transaction ID</span>
                <span className="font-medium text-text-primary text-right break-all">{booking.transactionId || "N/A"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Payment Method</span>
                <span className="font-medium text-text-primary">{booking.paymentMethod || "Razorpay"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Travellers</span>
                <span className="font-medium text-text-primary">{travelerCount}</span>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <div className="flex items-center gap-2 mb-5">
            <Users size={18} className="text-cyan" />
            <h3 className="text-lg font-semibold text-text-primary">Traveler Details</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {travelers.map((traveler) => {
              const travelerNo = traveler.travelerNo;
              const travelerNoStr = String(travelerNo);
              const savedDocuments = getSavedTravelerDocuments(travelerNo);
              const passportInputKey = `${travelerNoStr}-passport`;
              const savedPassportUrl = unlockedDocs[passportInputKey]
                ? ""
                : getStoredDocumentValue(savedDocuments, "passport");
              const localSuccess = uploadedDocSuccesses[passportInputKey];
              const selectedFile = selectedDocs[passportInputKey];
              const isPassportUploading =
                isUploadingState(`traveler-upload-${travelerNo}`)
                || isUploadingState(`traveler-auto-${travelerNo}`)
                || isUploadingState(`traveler-prepare-${travelerNoStr}-passport`);
              const isPassportOptimizing = isOptimizingState(`traveler-prepare-${travelerNoStr}-passport`);
              const passportError = docErrors[passportInputKey];
              const hasSuccessfulUpload = !selectedFile
                && (Boolean(savedPassportUrl) || Boolean(localSuccess));

              const resetPassportUploadState = () => {
                setUnlockedDocs((prev) => ({ ...prev, [passportInputKey]: true }));
                setUploadedDocSuccesses((prev) => {
                  const next = { ...prev };
                  delete next[passportInputKey];
                  return next;
                });
              };

              const renderPassportUpload = (disabled = isPassportUploading) => (
                <PassportUploadRow
                  inputId={`passport-reupload-${travelerNoStr}`}
                  label="Passport Upload"
                  file={selectedFile}
                  error={passportError}
                  uploading={isPassportUploading}
                  optimizing={isPassportOptimizing}
                  saved={hasSuccessfulUpload}
                  disabled={disabled}
                  helperText={
                    selectedFile
                      ? selectedFile.name
                      : `PDF, JPG, PNG - max ${getUploadLimitForDocType("passport").label}`
                  }
                  fileSizeText={selectedFile ? formatFileSize(selectedFile.size) : ""}
                  savedText="Passport uploaded"
                  onChange={(file) => handleDocFieldChange(travelerNo, "passport", file)}
                  onReupload={canUploadDocuments ? resetPassportUploadState : undefined}
                />
              );
              return (
                <div
                  key={`summary-traveler-${traveler.travelerNo}`}
                  id={`document-upload-section-${traveler.travelerNo}`}
                  className="rounded-2xl border border-border bg-surface-2 p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Traveler {traveler.travelerNo}</p>
                      <p className="text-sm text-text-secondary mt-1">{traveler.travelerName}</p>
                    </div>
                    {traveler.isComplete ? (
                      <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
                        Complete
                      </span>
                    ) : null}
                  </div>

                  {!canUploadDocuments && renderPassportUpload()}

                  <div className="space-y-2 text-sm">
                    {uploadSettings.enableFileUpload && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-text-muted">Other documents</span>
                        <span className="font-medium text-text-primary">{traveler.uploadedOtherDocumentsCount}</span>
                      </div>
                    )}
                  </div>

                  {canUploadDocuments && (
                    <div className="mt-4 space-y-4 border-t border-border pt-4">
                        <>
                          {(() => {
                            const travelerNo = traveler.travelerNo;
                            const travelerNoStr = String(travelerNo);
                            const serverComplete = travelerServerComplete(travelerNo);
                            const submissionLocked = travelerSubmissionLocked(travelerNo);
                            const isTravelerUploadLoading = isUploadingState(`traveler-upload-${travelerNo}`);
                            const isAnyFileUploading =
                              isTravelerUploadLoading
                              || isUploadingState(`traveler-auto-${travelerNo}`)
                              || isUploadingState(`traveler-prepare-${travelerNoStr}-passport`);
                            const isPassportOptimizing = isOptimizingState(`traveler-prepare-${travelerNoStr}-passport`);
                            const dirty = travelerHasUnsavedChanges(travelerNo);
                            const headerShowsComplete = serverComplete && !dirty;
                            const otherList = selectedDocs[`${travelerNoStr}-otherDocuments`] || [];
                            const hasOtherPending = Array.isArray(otherList) && otherList.length > 0;
                            const savedDocuments = getSavedTravelerDocuments(travelerNo);
                            const passportInputKey = `${travelerNoStr}-passport`;
                            const passportSelectedFile = selectedDocs[passportInputKey];
                            const passportSavedDocUrl = unlockedDocs[passportInputKey]
                              ? ""
                              : getStoredDocumentValue(savedDocuments, "passport");
                            const passportHasSuccessfulUpload = !passportSelectedFile
                              && (Boolean(passportSavedDocUrl) || Boolean(uploadedDocSuccesses[passportInputKey]));
                            const savedOtherDocuments = getSavedTravelerOtherDocuments(travelerNo);
                            const totalOtherDocumentsCount = savedOtherDocuments.length + otherList.length;
                            const submittedRequiredFields = docFields.filter((field) => {
                              const savedValue = getStoredDocumentValue(savedDocuments, field.key);
                              return Boolean(savedValue || uploadedDocSuccesses[`${travelerNoStr}-${field.key}`]);
                            });
                            const derivedMissingLabels = docFields
                              .filter((field) => !submittedRequiredFields.some((submitted) => submitted.key === field.key))
                              .map((field) => (field.label || field.key).replace(" Upload", ""));
                            const cardShowsComplete = uploadSettings.enableFileUpload
                              ? derivedMissingLabels.length === 0
                              : headerShowsComplete;

                            return (
                              <>
                                <div>
                                  <h4 className="text-sm font-semibold text-text-primary">Traveler details</h4>
                                  <p className="text-xs text-text-muted">
                                    {submissionLocked
                                      ? "This traveler has already submitted details and documents. Editing is locked."
                                      : "Enter details for this traveler."}
                                  </p>
                                </div>

                                <div>
                                  <label className="text-xs text-text-muted block mb-1.5">
                                    Full name (as on passport)
                                  </label>
                                  <input
                                    type="text"
                                    autoComplete="off"
                                    value={travelerNames[travelerNoStr] ?? getSavedTravelerName(travelerNo)}
                                    placeholder="Enter name"
                                    disabled={true}
                                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary outline-none focus:border-cyan/50 placeholder:text-text-muted disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                </div>

                                <PassportUploadRow
                                  inputId={`file-${passportInputKey}`}
                                  label="Passport Upload"
                                  file={passportSelectedFile}
                                  error={docErrors[passportInputKey]}
                                  uploading={isAnyFileUploading}
                                  optimizing={isPassportOptimizing}
                                  saved={passportHasSuccessfulUpload}
                                  disabled={isTravelerUploadLoading}
                                  helperText={
                                    passportSelectedFile
                                      ? passportSelectedFile.name
                                      : `PDF, JPG, PNG - max ${getUploadLimitForDocType("passport").label}`
                                  }
                                  fileSizeText={passportSelectedFile ? formatFileSize(passportSelectedFile.size) : ""}
                                  savedText="Passport uploaded"
                                  onChange={(file) => handleDocFieldChange(travelerNo, "passport", file)}
                                  onReupload={() => {
                                    setUnlockedDocs((prev) => ({ ...prev, [passportInputKey]: true }));
                                    setUploadedDocSuccesses((prev) => {
                                      const next = { ...prev };
                                      delete next[passportInputKey];
                                      return next;
                                    });
                                  }}
                                />
                                {uploadSettings.enableFileUpload && (
                                  <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
                                    <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-2">
                                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan/10 text-cyan">
                                        <FileText size={14} strokeWidth={2} />
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium text-text-primary">Additional documents</p>
                                        <p className="text-[10px] text-text-muted">
                                          {totalOtherDocumentsCount} {totalOtherDocumentsCount === 1 ? "file" : "files"} uploaded
                                        </p>
                                      </div>
                                      {otherList.length > 0 && isAnyFileUploading ? (
                                        <div className="text-[10px] text-cyan animate-pulse flex items-center gap-1.5 shrink-0 bg-cyan/5 px-2.5 py-1.5 rounded-xl border border-cyan/20">
                                          <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-ping" />
                                          Uploading...
                                        </div>
                                      ) : isOptimizingState(`traveler-prepare-other-${travelerNoStr}`) ? (
                                        <div className="text-[10px] text-cyan animate-pulse flex items-center gap-1.5 shrink-0 bg-cyan/5 px-2.5 py-1.5 rounded-xl border border-cyan/20">
                                          <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-ping" />
                                          Optimizing...
                                        </div>
                                      ) : (
                                        <label
                                          htmlFor={`further-other-docs-${travelerNoStr}`}
                                          className="shrink-0 cursor-pointer rounded-xl border border-cyan/20 bg-cyan/10 px-3 py-1.5 text-[11px] font-semibold text-cyan hover:bg-cyan/15 transition-colors"
                                        >
                                          Upload
                                        </label>
                                      )}
                                      <input
                                        id={`further-other-docs-${travelerNoStr}`}
                                        type="file"
                                        multiple
                                        accept=".pdf,image/jpeg,image/png,image/webp"
                                        disabled={
                                          isTravelerUploadLoading ||
                                          !canUploadDocuments
                                        }
                                        onChange={(e) => {
                                          handleOtherDocsChange(travelerNo, e.target.files || []);
                                          e.target.value = "";
                                        }}
                                        className="sr-only"
                                      />
                                    </div>
                                    {(savedOtherDocuments.length > 0 || hasOtherPending) && (
                                      <div className="space-y-2">
                                        {savedOtherDocuments.map((filePath, docIdx) => (
                                          <div
                                            key={`further-saved-other-${travelerNoStr}-${docIdx}`}
                                            className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2"
                                          >
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
                                              <CheckCircle size={13} />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                              <p className="text-xs font-medium text-text-primary truncate" title={getStoredFilename(filePath, `File ${docIdx + 1}`)}>
                                                {getStoredFilename(filePath, `File ${docIdx + 1}`)}
                                              </p>
                                              <p className="text-[10px] text-emerald-400">Successful</p>
                                            </div>
                                            <button
                                              type="button"
                                              disabled={isUploadingState(`traveler-upload-${travelerNo}`)}
                                              onClick={() => handleDeleteSavedOtherDoc(travelerNo, docIdx)}
                                              className="shrink-0 rounded-md bg-red-500/15 hover:bg-red-500/25 text-red-400 px-2 py-1 text-[10px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                              Delete
                                            </button>
                                          </div>
                                        ))}
                                        {otherList.map((file, docIdx) => (
                                          <div
                                            key={`further-selected-other-${travelerNoStr}-${docIdx}`}
                                            className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
                                          >
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan/10 text-cyan">
                                              <FileText size={13} />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                              <p className="text-xs text-text-primary truncate" title={file?.name || ""}>
                                                {file?.name || `File ${savedOtherDocuments.length + docIdx + 1}`}
                                              </p>
                                              <p className="text-[10px] text-text-muted">Ready to upload</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                  {cardShowsComplete ? (
                                    <p className="text-xs text-emerald-400 sm:min-w-0 sm:flex-1">
                                      All required documents are submitted
                                    </p>
                                  ) : uploadSettings.enableFileUpload && derivedMissingLabels.length > 0 && (
                                    <p className="text-xs text-amber-400 sm:min-w-0 sm:flex-1">
                                      Missing: {derivedMissingLabels.join(", ")}
                                    </p>
                                  )}
                                </div>

                              </>
                            );
                          })()}
                        </>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {uploadSettings.enableGDriveUpload && (
            <div className="mt-6">
              <SharedGoogleDriveLinkSection
                value={sharedDriveLink}
                onChange={setSharedDriveLink}
                onSave={canUploadDocuments ? handleSaveSharedDriveLink : undefined}
                savedLink={getSharedDriveLink()}
                loading={isUploadingState("shared-gdrive")}
                disabled={!canUploadDocuments || docUploading}
                showSkipHint={booking?.paymentStatus !== "completed"}
                className="mt-0"
              />
            </div>
          )}

          {visibleRequiredDocFields.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-[28px] border border-border bg-surface">
              <div className="flex items-start gap-4 border-b border-border px-5 py-5 sm:px-6">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan/10 text-cyan">
                  <ShieldCheck size={24} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold text-text-primary">Required Documents</h3>
                  <p className="text-sm text-text-muted">
                    These are the country documents required for this application.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 sm:px-6 sm:py-6 xl:grid-cols-3">
                {visibleRequiredDocFields.map((field) => {
                  const Icon = field.Icon;
                  const helperCopy =
                    field.description
                    || DOCUMENT_HELPER_COPY[field.key]
                    || `PDF, JPG, PNG - max ${getUploadLimitForDocType(field.key).label}`;

                  return (
                    <div
                      key={`required-doc-${field.key}`}
                      className="flex items-start gap-3 rounded-[18px] border border-border bg-background px-3.5 py-2.5"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan/10 text-cyan">
                        {field.iconClass ? (
                          <i className={`${field.iconClass} text-[19px] leading-none`} aria-hidden="true" />
                        ) : (
                          <Icon size={19} strokeWidth={2} />
                        )}
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5 leading-none">
                        <p className="line-clamp-2 text-[14px] font-semibold leading-5 text-text-primary">
                          {getDocumentDisplayName(field.label)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-text-muted">
                          {helperCopy}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {visibleOtherDocFields.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-[28px] border border-border bg-surface">
              <div className="flex items-start gap-4 border-b border-border px-5 py-5 sm:px-6">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan/10 text-cyan">
                  <FileText size={24} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold text-text-primary">Other Documents</h3>
                  <p className="text-sm text-text-muted">
                    You can also attach other documents in the same Drive link.
                  </p>
                </div>
              </div>

              <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleOtherDocFields.map((field) => {
                    const inputKey = `${resolvedActiveOtherDocsTravelerNo}-${field.key}`;
                    const hasError = Boolean(docErrors[inputKey]);
                    const Icon = field.Icon;
                    const helperCopy =
                      field.description
                      || DOCUMENT_HELPER_COPY[field.key]
                      || `PDF, JPG, PNG - max ${getUploadLimitForDocType(field.key).label}`;
                    return (
                      <div
                        key={`other-doc-option-${inputKey}`}
                        className={`flex w-full items-start gap-3 rounded-[18px] border px-3.5 py-2.5 ${
                          hasError
                            ? "border-red-500/35 bg-red-500/5"
                            : "border-border bg-background"
                        }`}
                      >
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          hasError ? "bg-red-500/10 text-red-400" : "bg-cyan/10 text-cyan"
                        }`}>
                          {field.iconClass ? (
                            <i className={`${field.iconClass} text-[19px] leading-none`} aria-hidden="true" />
                          ) : (
                            <Icon size={19} strokeWidth={2} />
                          )}
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5 leading-none">
                          <p className="line-clamp-2 text-[14px] font-semibold leading-5 text-text-primary">
                            {getDocumentDisplayName(field.label)}
                          </p>
                          <p className={`mt-1 line-clamp-2 text-[11px] leading-4 ${
                            hasError ? "text-red-500" : "text-text-muted"
                          }`}>
                            {hasError ? docErrors[inputKey] : helperCopy}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Card>



        {showFurtherInfoCard && (
          <Card>
            <div className="flex items-center gap-2 mb-5">
              <MessageSquare size={18} className="text-cyan shrink-0" />
              <h3 className="text-lg font-semibold text-text-primary">Further information</h3>
            </div>

            {(canSaveApplicantNotes || String(booking.applicantNotes || "").trim()) && (
              <div className="space-y-2 mb-6 pb-6 border-b border-border">
                <label htmlFor="applicant-notes" className="text-xs text-text-muted block">
                  Message for our team (optional)
                </label>
                {canSaveApplicantNotes ? (
                  <>
                    <textarea
                      id="applicant-notes"
                      value={activeApplicantNotes}
                      onChange={(e) => setApplicantNotesDraft(e.target.value)}
                      disabled={notesSaving}
                      rows={5}
                      maxLength={8000}
                      placeholder="Special requests, travel context, document explanations"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-cyan/50 min-h-[120px] resize-y"
                    />
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <p className="text-[10px] text-text-muted">{activeApplicantNotes.length} / 8000</p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        loading={notesSaving}
                        disabled={!notesDirty}
                        onClick={handleSaveApplicantNotes}
                      >
                        Save message
                      </Button>
                    </div>
                    {String(booking.applicantNotes || "").trim() && (
                      <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm text-text-secondary whitespace-pre-wrap">
                        {String(booking.applicantNotes || "").trim()}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm text-text-secondary whitespace-pre-wrap">
                    {String(booking.applicantNotes || "").trim() || "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â"}
                  </div>
                )}
              </div>
            )}

            {showLegacyUploadSections &&
              uploadSettings.enableGDriveUpload &&
              !uploadSettings.enableFileUpload && false && (
                <div className="space-y-4 mb-6">
                  <h4 className="text-sm font-semibold text-text-primary">
                    Further information ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Google Drive (optional)
                  </h4>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    Optional second folder per traveler (references, samples, etc.). Does not replace the main documents folder above.
                  </p>
                  {Array.from({ length: travelerCount }).map((_, idx) => {
                    const travelerNo = idx + 1;
                    const travelerNoStr = String(travelerNo);
                    const serverComplete = travelerServerComplete(travelerNo);
                    const submissionLocked = travelerSubmissionLocked(travelerNo);
                    const dirty = travelerHasUnsavedChanges(travelerNo);
                    const saveDisabled = docUploading || (serverComplete && !dirty);
                    const headerShowsComplete = serverComplete && !dirty;

                    return (
                      <div
                        key={`further-drive-only-${travelerNo}`}
                        className="rounded-2xl border border-border bg-surface-2 p-4 space-y-3"
                      >
                        <p className="text-sm font-semibold text-text-primary">Traveler {travelerNo}</p>
                        <div>
                          <label className="text-xs text-text-muted block mb-1.5">
                            Google Drive ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â further information (optional)
                          </label>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                            <input
                            type="text"
                            value={
                              travelerGdriveFurtherInfoLinks[travelerNoStr] ??
                              getSavedTravelerGdriveFurtherInfoLink(travelerNo)
                            }
                            onChange={(e) =>
                              setTravelerGdriveFurtherInfoLinks((prev) => ({
                                ...prev,
                                [travelerNoStr]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            placeholder="https://drive.google.com/..."
                            disabled={docUploading || submissionLocked}
                            className="min-w-0 flex-1 bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary outline-none focus:border-cyan/50 placeholder:text-text-muted"
                            autoComplete="off"
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="shrink-0 sm:min-w-[132px]"
                              leftIcon={<Upload size={14} />}
                              loading={docUploading}
                              disabled={docUploading || submissionLocked}
                              onClick={() => handleSaveTravelerDriveLink(travelerNo, "further")}
                            >
                              Upload Link
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            {showLegacyUploadSections && uploadSettings.enableFileUpload && (
              <div className="space-y-5">
                <h4 className="text-sm font-semibold text-text-primary">Other documents</h4>
                {Array.from({ length: travelerCount }).map((_, idx) => {
                  const travelerNo = idx + 1;
                  
                  const serverComplete = travelerServerComplete(travelerNo);
                  const submissionLocked = travelerSubmissionLocked(travelerNo);
                  const dirty = travelerHasUnsavedChanges(travelerNo);
                  const saveDisabled = docUploading || (serverComplete && !dirty);
                  const headerShowsComplete = serverComplete && !dirty;
                  const travelerProgress = progress.missingByTraveler.find((item) => item.travelerNo === travelerNo);
                  const otherList = selectedDocs[`${travelerNoStr}-otherDocuments`] || [];
                  const hasOtherPending = Array.isArray(otherList) && otherList.length > 0;
                  const savedOtherDocuments = getSavedTravelerOtherDocuments(travelerNo);
                  const totalOtherDocumentsCount = savedOtherDocuments.length + otherList.length;

                  return (
                    <div
                      key={`further-other-${travelerNo}`}
                      className="rounded-2xl border border-border bg-surface-2 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-end">
                        {headerShowsComplete ? (
                          <span className="text-[11px] font-medium text-emerald-400">Required docs done</span>
                        ) : (
                          <span className="text-[11px] font-medium text-amber-400">Complete required docs above</span>
                        )}
                      </div>

                      {false && uploadSettings.enableGDriveUpload && (
                        <div className="space-y-1.5 pb-3 border-b border-border">
                          <label className="text-xs text-text-muted block">
                            Google Drive ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â further information (optional)
                          </label>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                            <input
                            type="text"
                            value={
                              travelerGdriveFurtherInfoLinks[travelerNoStr] ??
                              getSavedTravelerGdriveFurtherInfoLink(travelerNo)
                            }
                            onChange={(e) =>
                              setTravelerGdriveFurtherInfoLinks((prev) => ({
                                ...prev,
                                [travelerNoStr]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            placeholder="Extra folder for references, samplesÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦"
                            disabled={docUploading || submissionLocked}
                            className="min-w-0 flex-1 bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary outline-none focus:border-cyan/50 placeholder:text-text-muted"
                            autoComplete="off"
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="shrink-0 sm:min-w-[132px]"
                              leftIcon={<Upload size={14} />}
                              loading={docUploading}
                              disabled={docUploading || submissionLocked}
                              onClick={() => handleSaveTravelerDriveLink(travelerNo, "further")}
                            >
                              Upload Link
                            </Button>
                          </div>
                          <p className="text-[10px] text-text-muted">
                            Saved together with other files when you use the button below.
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan/10 text-cyan">
                            <FileText size={14} strokeWidth={2} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-text-primary">Other documents</p>
                            <p className="text-[10px] text-text-muted">
                              {totalOtherDocumentsCount} {totalOtherDocumentsCount === 1 ? "file" : "files"} uploaded
                            </p>
                          </div>
                          <label
                            htmlFor={`further-other-docs-${travelerNoStr}`}
                            className="shrink-0 cursor-pointer rounded-md bg-cyan/15 px-2.5 py-1.5 text-[11px] font-semibold text-cyan hover:bg-cyan/25 transition-colors"
                          >
                            Upload
                          </label>
                          <input
                            id={`further-other-docs-${travelerNoStr}`}
                            type="file"
                            multiple
                            accept=".pdf,image/jpeg,image/png,image/webp"
                            disabled={docUploading || submissionLocked}
                            onChange={(e) => {
                              handleOtherDocsChange(travelerNo, e.target.files || []);
                              e.target.value = "";
                            }}
                            className="sr-only"
                          />
                        </div>
                        {(savedOtherDocuments.length > 0 || hasOtherPending) && (
                          <div className="space-y-2">
                            {savedOtherDocuments.map((filePath, docIdx) => (
                              <div
                                key={`further-saved-other-${travelerNoStr}-${docIdx}`}
                                className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2"
                              >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
                                  <CheckCircle size={13} />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium text-text-primary truncate" title={getStoredFilename(filePath, `File ${docIdx + 1}`)}>
                                    {getStoredFilename(filePath, `File ${docIdx + 1}`)}
                                  </p>
                                  <p className="text-[10px] text-emerald-400">Successful</p>
                                </div>
                              </div>
                            ))}
                            {otherList.map((file, docIdx) => (
                              <div
                                key={`further-selected-other-${travelerNoStr}-${docIdx}`}
                                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
                              >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan/10 text-cyan">
                                  <FileText size={13} />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs text-text-primary truncate" title={file?.name || ""}>
                                    {file?.name || `File ${savedOtherDocuments.length + docIdx + 1}`}
                                  </p>
                                  <p className="text-[10px] text-text-muted">Ready to upload</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 pt-1">
                        <Button
                          type="button"
                          variant={headerShowsComplete && !hasOtherPending ? "ghost" : "secondary"}
                          size="sm"
                          leftIcon={headerShowsComplete && !hasOtherPending ? <CheckCircle size={14} /> : <Upload size={14} />}
                          loading={docUploading}
                          disabled={saveDisabled || submissionLocked}
                          onClick={() => handleUploadTraveler(travelerNo)}
                          className="w-full shrink-0 sm:w-auto sm:min-w-[200px]"
                        >
                          {submissionLocked
                            ? "Submitted"
                            : headerShowsComplete && !hasOtherPending
                            ? "Nothing to upload"
                            : headerShowsComplete
                              ? "Upload additional documents"
                              : `Save traveler ${travelerNo} & files`}
                        </Button>
                        {!cardShowsComplete && derivedMissingLabels.length > 0 && (
                          <p className="text-xs text-amber-400 sm:min-w-0 sm:flex-1 sm:text-right">
                            Missing: {derivedMissingLabels.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {booking.visaFilePath && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-emerald-400 font-semibold mb-1">
                Visa Received
              </p>
              <h3 className="text-sm font-semibold text-text-primary">
                Your approved visa file is ready
              </h3>
              <p className="text-xs text-text-muted mt-1 break-all">
                {booking.visaFileName || booking.visaFilePath.split("/").pop()}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download size={14} />}
              onClick={() => window.open(`${SERVER_URL}${booking.visaFilePath}`, "_blank")}
            >
              Open Visa File
            </Button>
          </div>
        )}

        {/* Traveler cards */}

        {/* Upload Sections */}
        {showLegacyUploadSections ? (
          allTravelersComplete ? (
            null
          ) : (
          (!uploadSettings.enableFileUpload && !uploadSettings.enableGDriveUpload) ? (
            <section id="document-upload-section" className="scroll-mt-28">
              <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-muted text-center">
                Document uploads are currently disabled.
              </div>
            </section>
          ) : (
            <section id="document-upload-section" className="space-y-4 scroll-mt-28 mt-8 pt-8 border-t border-border">
              <div className="flex items-center gap-2 mb-2">
                <Upload size={18} className="text-cyan shrink-0" />
                <div>
                  <h3 className="text-base font-semibold text-text-primary">Upload documents</h3>
                  <p className="text-xs text-text-muted">Per traveler ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â all documents max 300 KB.</p>
                </div>
              </div>
              {(uploadSettings.enableFileUpload || uploadSettings.enableGDriveUpload) && (
                <div className="rounded-2xl border border-border bg-surface-2 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan mb-3">Required documents for this country</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                    {docFields.map((field) => {
                      const Icon = field.Icon;
                      return (
                        <div
                          key={`legacy-guide-${field.key}`}
                          className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan/10 text-cyan">
                            <Icon size={15} strokeWidth={2} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-text-primary truncate">{field.label}</p>
                            <p className="text-[10px] text-text-muted">Upload this document for each traveler</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {(uploadSettings.enableFileUpload || uploadSettings.enableGDriveUpload) && (
                <>
                {uploadSettings.enableGDriveUpload && (
                  <div
                    id="shared-drive-link-section"
                    className="mb-6 rounded-[2rem] border border-slate-200 bg-white p-5 space-y-4 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.22)]"
                  >
                    <div>
                      <h3 className="text-base font-semibold text-text-primary">Google Drive Link (For All Travelers)</h3>
                      <p className="text-xs text-slate-600 mt-1">Add a single Google Drive folder link containing all the required documents for all travelers.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                      <input
                        type="url"
                        value={sharedDriveLink}
                        onChange={(e) => setSharedDriveLink(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveSharedDriveLink();
                          }
                        }}
                        placeholder="https://drive.google.com/..."
                        className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-cyan/40 focus:bg-white placeholder:text-slate-400"
                        autoComplete="off"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="shrink-0"
                        leftIcon={<Upload size={14} />}
                        loading={isUploadingState("global-drive")}
                        onClick={handleSaveSharedDriveLink}
                      >
                        Save Drive Link
                      </Button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {Array.from({ length: travelerCount }).map((_, idx) => {
                  const travelerNo = idx + 1;
                  const travelerNoStr = String(travelerNo);
                  const serverComplete = travelerServerComplete(travelerNo);
                  const submissionLocked = travelerSubmissionLocked(travelerNo);
                  const dirty = travelerHasUnsavedChanges(travelerNo);
                  const saveDisabled = docUploading || (serverComplete && !dirty);
                  const headerShowsComplete = serverComplete && !dirty;
                  const travelerProgress = progress.missingByTraveler.find((item) => item.travelerNo === travelerNo);

                  return (
                    <div
                      key={travelerNo}
                      className="rounded-[2rem] border border-slate-200 bg-white p-5 space-y-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.22)]"
                    >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-cyan/20 bg-cyan/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan">
                        <span>Traveler {travelerNo}</span>
                      </div>
                      <p className="mt-3 text-sm text-slate-600">
                        Add traveler details and upload the required documents for this application.
                      </p>
                    </div>
                    {headerShowsComplete ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle size={14} /> Completed
                      </span>
                    ) : null}
                  </div>

                  {/* Name input */}
                  <div>
                    <label className="text-xs text-slate-500 block mb-1.5">
                      Full name (as on passport)
                    </label>
                    <input
                      type="text"
                      autoComplete="off"
                      value={travelerNames[travelerNoStr] ?? getSavedTravelerName(travelerNo)}
                      onChange={(e) =>
                        setTravelerNames((prev) => ({ ...prev, [travelerNoStr]: e.target.value }))
                      }
                      placeholder="Enter name"
                      disabled={docUploading || submissionLocked}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-cyan/40 focus:bg-white placeholder:text-slate-400"
                    />
                  </div>

                  {/* Global GDrive link moved outside traveler loop */}

                  {/* Doc uploads ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â compact rows below traveler header */}
                  {uploadSettings.enableFileUpload && (
                    <>
                    <div className="flex flex-col gap-2 mt-3">
                    {docFields.map((field) => {
                      const inputKey = `${travelerNoStr}-${field.key}`;
                      const selectedFile = selectedDocs[inputKey];
                      const compressionMeta = selectedFile?.__compressionMeta;
                      const Icon = field.Icon;
                      return (
                        <div key={inputKey} className="space-y-1">
                          <div
                            className={`flex items-center gap-2 rounded-2xl border bg-slate-50 px-2.5 py-2.5 transition-colors ${
                              docErrors[inputKey] ? "border-red-300" : "border-slate-200"
                            }`}
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan/10 text-cyan">
                              <Icon size={14} strokeWidth={2} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-900 truncate">{field.label}</p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {selectedFile
                                  ? `${selectedFile.name} Ãƒâ€šÃ‚Â· ${formatFileSize(selectedFile.size)}`
                                  : `PDF, JPG, PNG Ãƒâ€šÃ‚Â· max ${getUploadLimitForDocType(field.key).label}`}
                              </p>
                            </div>
                            <label
                              htmlFor={`file-${inputKey}`}
                              className="shrink-0 cursor-pointer rounded-md bg-cyan/15 px-2.5 py-1.5 text-[11px] font-semibold text-cyan hover:bg-cyan/25 transition-colors"
                            >
                              {selectedFile ? "Replace" : "Upload"}
                            </label>
                            <input
                              id={`file-${inputKey}`}
                              type="file"
                              accept=".pdf,image/jpeg,image/png,image/webp"
                              className="sr-only"
                              disabled={docUploading || submissionLocked || Boolean(getSavedTravelerDocuments(travelerNo)[field.key])}
                              onChange={(e) => {
                                handleDocFieldChange(travelerNo, field.key, e.target.files?.[0] ?? null);
                                e.target.value = "";
                              }}
                            />
                          </div>
                          {docErrors[inputKey] && (
                            <p className="text-xs text-red-600 font-medium flex items-center gap-1 px-0.5">
                              <AlertCircle size={12} /> {docErrors[inputKey]}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                    </>
                  )}

                  {!uploadSettings.enableFileUpload && uploadSettings.enableGDriveUpload && (
                    !cardShowsComplete && derivedMissingLabels.length > 0 ? (
                      <p className="text-xs text-amber-700">
                        Missing: {derivedMissingLabels.join(", ")}
                      </p>
                    ) : null
                  )}
                  <Button
                    type="button"
                    variant={headerShowsComplete ? "ghost" : "secondary"}
                    size="sm"
                    leftIcon={headerShowsComplete ? <CheckCircle size={14} /> : <Upload size={14} />}
                    loading={docUploading}
                    disabled={saveDisabled || submissionLocked}
                    onClick={() => handleUploadTraveler(travelerNo)}
                    className="w-full"
                  >
                    {submissionLocked
                      ? "Submitted"
                      : headerShowsComplete
                        ? "Saved"
                        : `Save traveler ${travelerNo} & files`}
                  </Button>
                  </div>
                );
              })}
                </div>
              </>
              )}

            </section>
          )
          )
        ) : null}

        {/* Bottom actions */}
        {booking.paymentStatus !== "completed" && (
          <div className="flex flex-col gap-3 pt-2">
            <label className="flex items-start gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-secondary">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <span>
                I agree to the{" "}
                <button
                  type="button"
                  onClick={handleOpenPaymentTerms}
                  className="font-medium text-cyan hover:underline"
                >
                  Terms & Conditions
                </button>
                {" "}and understand that the amount above covers service charges only.
              </span>
            </label>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              leftIcon={<CreditCard size={16} />}
              loading={summarySyncing || paying}
              disabled={summarySyncing || paying || docUploading || !termsAccepted}
              onClick={handleProceedToPaymentSummary}
            >
              {"Proceed to Payment"}
            </Button>
          </div>
        )}

      </main>
      <Modal
        isOpen={termsModalOpen}
        onClose={() => {
          if (paying || summarySyncing) return;
          setTermsModalOpen(false);
        }}
        title="Terms and Conditions"
        size="lg"
        footer={(
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setTermsAccepted(false);
                setTermsModalOpen(false);
              }}
              disabled={paying || summarySyncing}
            >
              Deny
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setTermsAccepted(true);
                setTermsModalOpen(false);
              }}
              disabled={paying || summarySyncing}
            >
              Accept
            </Button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface-2 p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-text-muted">Amount payable</span>
              <span className="font-semibold text-text-primary">
                Rs {Number(resolvePayAmountRupees(booking || {})).toLocaleString("en-IN")}
              </span>
            </div>
            <p className="mt-2 text-xs text-text-muted">
              Read the terms here, then choose Accept or Deny.
            </p>
          </div>

          {termsPageLoading ? (
            <div className="flex items-center justify-center py-10 text-text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : termsPageError ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
              {termsPageError}
            </div>
          ) : (
            <div className="prose prose-invert max-w-none text-sm text-text-secondary">
              <h3 className="text-base font-semibold text-text-primary">
                {termsPage?.title || "Terms and Conditions"}
              </h3>
              <div
                className="mt-3 space-y-3"
                dangerouslySetInnerHTML={{
                  __html: String(termsPage?.content || "<p>Terms and conditions are not available right now.</p>"),
                }}
              />
            </div>
          )}

          {!razorpayReady && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
              {razorpayMessage || "Payment is not available right now."}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ApplicationDetails;



