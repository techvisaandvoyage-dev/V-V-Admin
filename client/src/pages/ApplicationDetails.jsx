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
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Modal from "../components/ui/Modal";
import { StatusBadge } from "../components/ui/Badge";
import { api, SERVER_URL, useAuthStore } from "../store/authStore";
import { useDataStore } from "../store/dataStore";
import { useUIStore } from "../store/uiStore";
import { getApplicationProgress } from "../utils/applicationProgress";
import { optimizeUploadFile } from "../utils/optimizeUploadFile";
import { openRazorpayForApplication, validateRazorpayCheckoutReadiness } from "../utils/razorpayCheckout";

const MAX_DOCUMENT_SIZE_BYTES = 500 * 1024;
const FILE_SIZE_ERROR = "File must be below 8 MB before optimization.";
const OPTIMIZE_ERROR = "Could not prepare this file for upload.";
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

const resolveApplicationStatus = (booking, derivedApplicationProgress) => {
  if (!booking || typeof booking !== "object") return "pending";
  if (booking.status === "approved" || booking.status === "rejected" || booking.status === "cancelled") {
    return booking.status;
  }
  if (booking.status === "review") {
    return "review";
  }
  if (booking.paymentStatus === "completed") {
    return derivedApplicationProgress.allDocumentsUploaded ? "review" : "doc_pending";
  }
  return "pending";
};

const ApplicationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { bookings, updateBookingDetails, fetchUserApplications } = useDataStore();
  const { showToast } = useUIStore();

  const [uploadingStates, setUploadingStates] = useState({});
  const [selectedDocs, setSelectedDocs] = useState({});
  const [travelerNames, setTravelerNames] = useState({});
  const [travelerGdriveLinks, setTravelerGdriveLinks] = useState({});
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
  const [visibleDriveInputs, setVisibleDriveInputs] = useState({});
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
  const travelerGdriveLinksRef = useRef({});
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

  const clearAutoUploadTimer = (travelerNo) => {
    const key = String(travelerNo);
    const timer = autoUploadTimersRef.current[key];
    if (timer) {
      window.clearTimeout(timer);
      delete autoUploadTimersRef.current[key];
    }
  };

  const toggleDriveInput = (travelerNo, field = "main") => {
    const key = `${travelerNo}-${field}`;
    setVisibleDriveInputs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
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
  const travelerCount = Math.max(1, Number(booking?.travellerCount || 1));
  const progress = booking
    ? getApplicationProgress(booking, {
        ...uploadSettings,
        customRequiredDocs: docFields.map((f) => f.key)
      })
    : { allDocumentsUploaded: false, totalMissingDocuments: 0, missingByTraveler: [] };
  const derivedApplicationProgress = useMemo(() => {
    if (!booking) {
      return {
        allDocumentsUploaded: false,
        totalMissingDocuments: 0,
        hasDriveLink: false,
      };
    }

    const travellers = Array.isArray(booking?.travellerDocuments) ? booking.travellerDocuments : [];
    const hasDriveLink = travellers.some(
      (entry) => typeof entry?.gdriveLink === "string" && entry.gdriveLink.trim().length > 0
    );

    let totalMissingDocuments = 0;
    for (let travelerNo = 1; travelerNo <= travelerCount; travelerNo += 1) {
      const uploadedTraveler = travellers.find((entry) => Number(entry?.travelerNo) === travelerNo);
      const savedDocuments = uploadedTraveler?.documents;
      const missingCount = docFields.filter((field) => {
        const savedValue = getStoredDocumentValue(savedDocuments, field.key);
        const localSuccess = uploadedDocSuccesses[`${travelerNo}-${field.key}`];
        return !savedValue && !localSuccess;
      }).length;
      totalMissingDocuments += missingCount;
    }

    return {
      allDocumentsUploaded: totalMissingDocuments === 0,
      totalMissingDocuments,
      hasDriveLink,
    };
  }, [booking, travelerCount, docFields, uploadedDocSuccesses]);

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
    travelerGdriveLinksRef.current = travelerGdriveLinks;
  }, [travelerGdriveLinks]);

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
    navigate("/dashboard");
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

  const getSavedTravelerGdriveLink = (travelerNo) => {
    const travellers = Array.isArray(booking?.travellerDocuments) ? booking.travellerDocuments : [];
    const uploadedTraveler = travellers.find((x) => String(x.travelerNo) === String(travelerNo));
    if (uploadedTraveler?.gdriveLink) return uploadedTraveler.gdriveLink;
    const tc = Math.max(1, Number(booking?.travellerCount || 1));
    if (tc === 1 && Number(travelerNo) === 1 && String(booking?.gdriveLink || "").trim()) {
      return booking.gdriveLink;
    }
    return "";
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

    const gNow = String(travelerGdriveLinks[travelerNoStr] ?? getSavedTravelerGdriveLink(travelerNo)).trim();
    const gSaved = String(getSavedTravelerGdriveLink(travelerNo)).trim();
    if (gNow !== gSaved) return true;

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
      gdriveLink: uploadedTraveler?.gdriveLink || "",
      gdriveFurtherInfoLink: uploadedTraveler?.gdriveFurtherInfoLink || "",
      uploadedDocumentsCount,
      submittedDocFields,
      uploadedOtherDocumentsCount: Array.isArray(uploadedTraveler?.otherDocuments) ? uploadedTraveler.otherDocuments.length : 0,
      isComplete: done,
      missingLabels: done ? [] : (missingInfo?.missingLabels || []),
    };
  });

  const handleDocFieldChange = async (travelerNo, docKey, file) => {
    const inputKey = `${travelerNo}-${docKey}`;
    if (!file) {
      setDocErrors((prev) => ({ ...prev, [inputKey]: null }));
      setSelectedDocs((prev) => ({ ...prev, [inputKey]: null }));
      setUploadedDocSuccesses((prev) => {
        const next = { ...prev };
        delete next[inputKey];
        return next;
      });
      return;
    }
    const { file: optimizedFile, error, originalSize, compressedSize, wasCompressed } = await optimizeUploadFile(file);
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
      return;
    }
    if (optimizedFile.size > MAX_DOCUMENT_SIZE_BYTES) {
      showToast("File must be below 500 KB after optimization.", "error");
      setDocErrors((prev) => ({ ...prev, [inputKey]: "File must be below 500 KB after optimization." }));
      setSelectedDocs((prev) => ({ ...prev, [inputKey]: null }));
      setUploadedDocSuccesses((prev) => {
        const next = { ...prev };
        delete next[inputKey];
        return next;
      });
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
      void handleAutoUploadTraveler(travelerNo, "document");
    }, 250);
  };

  const handleOtherDocsChange = async (travelerNo, files) => {
    const travelerNoStr = String(travelerNo);
    const incoming = Array.from(files || []);
    const optimizedFiles = [];
    for (const rawFile of incoming) {
      const { file: optimizedFile, error, originalSize, compressedSize, wasCompressed } = await optimizeUploadFile(rawFile);
      if (error || !optimizedFile) {
        showToast(error || OPTIMIZE_ERROR, "error");
        return;
      }
      if (optimizedFile.size > MAX_DOCUMENT_SIZE_BYTES) {
        showToast("File must be below 500 KB after optimization.", "error");
        return;
      }
      optimizedFiles.push(attachCompressionMeta(optimizedFile, { originalSize, compressedSize, wasCompressed }));
    }
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
          <Button variant="primary" onClick={() => navigate("/dashboard")}>
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
    const gdriveLinkForTraveler = String(travelerGdriveLinks[travelerNoStr] ?? getSavedTravelerGdriveLink(travelerNo)).trim();
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
    const hasRequiredFileSelection =
      fileOn && docFields.some((field) => selectedDocs[`${travelerNoStr}-${field.key}`] instanceof File);

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
    } else if (!fileOn && gdOn) {
      if (!hasGdriveLink) {
        showToast(`Traveler ${travelerNo}: Please add a Google Drive link.`, "error");
        return;
      }
    } else if (fileOn && !gdOn) {
      for (const field of docFields) {
        const f = selectedDocs[`${travelerNoStr}-${field.key}`];
        if (!(f instanceof File)) {
          showToast(`Traveler ${travelerNo}: ${field.label} is required.`, "error");
          return;
        }
        if (f.size > MAX_DOCUMENT_SIZE_BYTES) {
          showToast(FILE_SIZE_ERROR, "error");
          return;
        }
        files.push({ field, file: f });
      }
      if (otherDocsOn) {
        for (const f of otherDocs) {
          files.push({ field: { key: "otherDocument", kind: "other" }, file: f });
        }
      }
    } else if (fileOn && gdOn) {
      for (const field of docFields) {
        const f = selectedDocs[`${travelerNoStr}-${field.key}`];
        if (f instanceof File) {
          if (f.size > MAX_DOCUMENT_SIZE_BYTES) {
            showToast(FILE_SIZE_ERROR, "error");
            return;
          }
          files.push({ field, file: f });
        } else if (!hasGdriveLink) {
          showToast(`Traveler ${travelerNo}: ${field.label} is required, or provide a Google Drive link.`, "error");
          return;
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
          await fetchUserApplications();
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
            delete next[`${travelerNoStr}-otherDocuments`];
            return next;
          });
          setUnlockedDocs((prev) => {
            const next = { ...prev };
            docFields.forEach((f) => { delete next[`${travelerNoStr}-${f.key}`]; });
            return next;
          });
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

  const handleSaveTravelerNameAndLink = async (travelerNo) => {
    const travelerNoStr = String(travelerNo);
    const travelerName = travelerNames[travelerNoStr] ?? getSavedTravelerName(travelerNo);
    const gdriveLink = travelerGdriveLinks[travelerNoStr] ?? getSavedTravelerGdriveLink(travelerNo);
    const appId = booking._id || booking.id;
    try {
      const { data } = await api.put(`/users/applications/${appId}`, {
        travelerUpdate: {
          travelerNo: travelerNoStr,
          travelerName,
          gdriveLink,
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
    const uploadStateKey = `traveler-drive-${travelerNo}-${field}`;

    const travelerNoStr = String(travelerNo);
    const travelerName =
      String(travelerNames[travelerNoStr] ?? getSavedTravelerName(travelerNo)).trim() ||
      `Traveler ${travelerNo}`;
    const gdriveLinkForTraveler = String(
      travelerGdriveLinks[travelerNoStr] ?? getSavedTravelerGdriveLink(travelerNo)
    ).trim();
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
    const travelerGdriveLinksSnapshot = travelerGdriveLinksRef.current;
    const travelerGdriveFurtherInfoLinksSnapshot = travelerGdriveFurtherInfoLinksRef.current;
    if (!bookingSnapshot) return null;

    const travelerNoStr = String(travelerNo);
    const travelerName =
      String(travelerNamesSnapshot[travelerNoStr] ?? getSavedTravelerName(travelerNo)).trim() ||
      `Traveler ${travelerNo}`;
    const gdriveLinkForTraveler = String(
      travelerGdriveLinksSnapshot[travelerNoStr] ?? getSavedTravelerGdriveLink(travelerNo)
    ).trim();
    const gdriveFurtherInfoLinkForTraveler = String(
      travelerGdriveFurtherInfoLinksSnapshot[travelerNoStr] ?? getSavedTravelerGdriveFurtherInfoLink(travelerNo)
    ).trim();
    const appId = bookingSnapshot._id || bookingSnapshot.id;

    const requiredFiles = uploadSettingsSnapshot.enableFileUpload
      ? docFieldsSnapshot
          .map((field) => ({
            field,
            file: selectedDocsSnapshot[`${travelerNoStr}-${field.key}`],
          }))
          .filter((entry) => entry.file instanceof File)
      : [];
    const otherFiles = uploadSettingsSnapshot.enableFileUpload
      ? (Array.isArray(selectedDocsSnapshot[`${travelerNoStr}-otherDocuments`])
          ? selectedDocsSnapshot[`${travelerNoStr}-otherDocuments`].filter((file) => file instanceof File)
          : [])
      : [];
    const hasFileSelections = requiredFiles.length > 0 || otherFiles.length > 0;
    const hasUnsavedTextChanges =
      String(travelerName).trim() !== String(getSavedTravelerName(travelerNo)).trim() ||
      gdriveLinkForTraveler !== String(getSavedTravelerGdriveLink(travelerNo)).trim() ||
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
          navigate(`/dashboard/application/${encodeURIComponent(appId)}`);
        },
        onDismiss: () => {
          setTermsModalOpen(false);
          showToast("Payment was not completed. Your application is saved in the dashboard.", "info");
          navigate(`/dashboard?payment=cancelled&applicationId=${encodeURIComponent(appId)}`);
        },
        onFailure: (message) => {
          setTermsModalOpen(false);
          showToast(message || "Payment could not be started.", "error");
          navigate(`/dashboard?payment=failed&applicationId=${encodeURIComponent(appId)}`);
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
              <StatusBadge status={resolveApplicationStatus(booking, derivedApplicationProgress)} />
              <StatusBadge status={booking.paymentStatus || "pending_payment"} />
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
                <p className="text-sm font-semibold text-text-primary">{new Date(booking.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="rounded-xl bg-surface-2 p-4">
                <p className="text-xs text-text-muted mb-1">Travel Date</p>
                <p className="text-sm font-semibold text-text-primary">{booking.travelDate ? new Date(booking.travelDate).toLocaleDateString() : "N/A"}</p>
              </div>
              <div className="rounded-xl bg-surface-2 p-4">
                <p className="text-xs text-text-muted mb-1">Return Date</p>
                <p className="text-sm font-semibold text-text-primary">{booking.returnDate ? new Date(booking.returnDate).toLocaleDateString() : "Not specified"}</p>
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
                <span className="font-semibold text-text-primary">₹{Number(booking.fee || 0).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Transaction ID</span>
                <span className="font-mono text-xs text-text-primary text-right">{booking.transactionId || "N/A"}</span>
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

        {/* Drive link detection */}
        {(() => {
          const hasDriveLink = derivedApplicationProgress.hasDriveLink;

          return (
            <div className={`rounded-2xl border p-4 ${derivedApplicationProgress.allDocumentsUploaded ? "border-emerald-500/30 bg-emerald-500/5" : hasDriveLink ? "border-cyan/30 bg-cyan/5" : "border-amber-500/30 bg-amber-500/5"}`}>
              <p className="text-xs text-text-muted">Application progress</p>
              <p className={`text-sm font-semibold mt-1 ${derivedApplicationProgress.allDocumentsUploaded ? "text-emerald-400" : hasDriveLink ? "text-cyan" : "text-amber-400"}`}>
                {derivedApplicationProgress.allDocumentsUploaded
                  ? "All required documents are uploaded."
                  : hasDriveLink
                  ? "Google Drive link is submitted."
                  : `${derivedApplicationProgress.totalMissingDocuments} required document${derivedApplicationProgress.totalMissingDocuments === 1 ? "" : "s"} still missing.`}
              </p>
            </div>
          );
        })()}
        <Card>
          <div className="flex items-center gap-2 mb-5">
            <Users size={18} className="text-cyan" />
            <h3 className="text-lg font-semibold text-text-primary">Traveler Details</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {travelers.map((traveler) => (
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
                  {traveler.isComplete || traveler.gdriveLink ? (
                    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${
                      traveler.isComplete
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-cyan/30 bg-cyan/10 text-cyan"
                    }`}>
                      {traveler.isComplete ? "Complete" : "Drive Link Submitted"}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-2 text-sm">
                  {uploadSettings.enableFileUpload && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-text-muted">Submitted documents</span>
                      <span className="font-medium text-text-primary">{traveler.uploadedDocumentsCount} / {docFields.length}</span>
                    </div>
                  )}
                  {uploadSettings.enableFileUpload && traveler.isComplete && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <p className="text-xs font-semibold text-emerald-400">All documents submitted</p>
                    </div>
                  )}
                  {uploadSettings.enableFileUpload && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-text-muted">Other documents</span>
                      <span className="font-medium text-text-primary">{traveler.uploadedOtherDocumentsCount}</span>
                    </div>
                  )}
                  {uploadSettings.enableGDriveUpload && (
                    <>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-text-muted">Drive link</span>
                          <span className="font-medium text-text-primary text-right break-all">
                            {traveler.gdriveLink ? (
                              <a
                                href={traveler.gdriveLink}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="text-cyan hover:underline break-all"
                              >
                                View
                              </a>
                            ) : (
                              "Not added"
                            )}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                  {canUploadDocuments && (
                    <div className="mt-4 space-y-4 border-t border-border pt-4">
                      {(!uploadSettings.enableFileUpload && !uploadSettings.enableGDriveUpload) ? (
                        <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-text-muted text-center">
                          Document uploads are currently disabled.
                        </div>
                      ) : (
                        <>
                          {(() => {
                            const travelerNo = traveler.travelerNo;
                            const travelerNoStr = String(travelerNo);
                            const serverComplete = travelerServerComplete(travelerNo);
                            const submissionLocked = travelerSubmissionLocked(travelerNo);
                            const isTravelerUploadLoading = isUploadingState(`traveler-upload-${travelerNo}`);
                            const dirty = travelerHasUnsavedChanges(travelerNo);
                            const saveDisabled = isTravelerUploadLoading || (serverComplete && !dirty);
                            const headerShowsComplete = serverComplete && !dirty;
                            const travelerProgress = progress.missingByTraveler.find((item) => item.travelerNo === travelerNo);
                            const otherList = selectedDocs[`${travelerNoStr}-otherDocuments`] || [];
                            const hasOtherPending = Array.isArray(otherList) && otherList.length > 0;
                            const showMainDriveInput = Boolean(
                              visibleDriveInputs[`${travelerNo}-main`] || getSavedTravelerGdriveLink(travelerNo)
                            );
                            const savedDocuments = getSavedTravelerDocuments(travelerNo);
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

                                {uploadSettings.enableGDriveUpload && (
                                  <div>
                                    <label className="text-xs text-text-muted mb-1.5 flex items-center gap-1.5">
                                      <span>Google Drive link</span>
                                      <span className="group relative inline-flex">
                                        <span
                                          className="inline-flex rounded-full p-0.5 text-text-muted transition-all duration-150 hover:bg-cyan/10 hover:text-cyan"
                                          aria-label="How to share your folder guide"
                                        >
                                          <Info size={12} />
                                        </span>
                                        <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-xl border border-border bg-surface px-3 py-2 text-[11px] font-normal leading-relaxed text-text-secondary shadow-lg group-hover:block">
                                          How to share your folder guide: open your Google Drive folder, click Share, change access to Anyone with the link, and paste that folder link here.
                                        </span>
                                      </span>
                                    </label>
                                    <input
                                      type="url"
                                      autoComplete="off"
                                      value={travelerGdriveLinks[travelerNoStr] ?? getSavedTravelerGdriveLink(travelerNo)}
                                      onChange={(e) =>
                                        setTravelerGdriveLinks((prev) => ({ ...prev, [travelerNoStr]: e.target.value }))
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") e.preventDefault();
                                      }}
                                      placeholder="https://drive.google.com/..."
                                      disabled={submissionLocked || Boolean(getSavedTravelerGdriveLink(travelerNo))}
                                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50 placeholder:text-text-muted disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                  </div>
                                )}

                                {uploadSettings.enableFileUpload && (
                                  <div className="flex flex-col gap-2">
                                    {docFields.map((field) => {
                                      const inputKey = `${travelerNoStr}-${field.key}`;
                                      const selectedFile = selectedDocs[inputKey];
                                      const savedDocUrl = unlockedDocs[inputKey]
                                        ? ""
                                        : getStoredDocumentValue(savedDocuments, field.key);
                                      const hasSuccessfulUpload = !selectedFile
                                        && (Boolean(savedDocUrl) || Boolean(uploadedDocSuccesses[inputKey]));
                                      const Icon = field.Icon;
                                      return (
                                        <div key={inputKey} className="space-y-1">
                                          <div
                                            className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors ${
                                              docErrors[inputKey]
                                                ? "border-red-500/45 bg-background"
                                                : hasSuccessfulUpload
                                                ? "border-emerald-500/25 bg-emerald-500/5"
                                                : "border-border bg-background"
                                            }`}
                                          >
                                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                                              hasSuccessfulUpload
                                                ? "bg-emerald-500/10 text-emerald-400"
                                                : "bg-cyan/10 text-cyan"
                                            }`}>
                                              <Icon size={14} strokeWidth={2} />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                              <p className="text-xs font-medium text-text-primary truncate">{field.label}</p>
                                              <p className="text-[10px] text-text-muted truncate">
                                                {selectedFile
                                                  ? `${selectedFile.name} · ${formatFileSize(selectedFile.size)}`
                                                  : hasSuccessfulUpload
                                                  ? "Document saved securely"
                                                  : "PDF, JPG, PNG · max 500 KB"}
                                              </p>
                                            </div>
                                            {hasSuccessfulUpload ? (
                                              <div className="flex items-center gap-2 shrink-0">
                                                <span className="flex items-center gap-1 shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[10px] font-semibold text-emerald-400">
                                                  <CheckCircle size={10} /> Successful
                                                </span>
                                                {!submissionLocked && (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setUnlockedDocs((prev) => ({ ...prev, [inputKey]: true }));
                                                      setUploadedDocSuccesses((prev) => {
                                                        const next = { ...prev };
                                                        delete next[inputKey];
                                                        return next;
                                                      });
                                                    }}
                                                    className="rounded-md bg-cyan/15 hover:bg-cyan/25 text-cyan px-2 py-1 text-[10px] font-semibold transition-colors"
                                                  >
                                                    Re-upload
                                                  </button>
                                                )}
                                              </div>
                                            ) : (
                                              <label
                                                htmlFor={`file-${inputKey}`}
                                                className="shrink-0 cursor-pointer rounded-md bg-cyan/15 px-2.5 py-1.5 text-[11px] font-semibold text-cyan hover:bg-cyan/25 transition-colors"
                                              >
                                                {selectedFile ? "Replace" : "Upload"}
                                              </label>
                                            )}
                                            <input
                                              id={`file-${inputKey}`}
                                              type="file"
                                              accept=".pdf,image/jpeg,image/png,image/webp"
                                              className="sr-only"
                                              disabled={isTravelerUploadLoading || submissionLocked || Boolean(savedDocUrl)}
                                              onChange={(e) => {
                                                handleDocFieldChange(travelerNo, field.key, e.target.files?.[0] ?? null);
                                                e.target.value = "";
                                              }}
                                            />
                                          </div>
                                          {docErrors[inputKey] && (
                                            <p className="text-xs text-red-500 font-medium flex items-center gap-1 px-0.5">
                                              <AlertCircle size={12} /> {docErrors[inputKey]}
                                            </p>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

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
                                      <label
                                        htmlFor={`further-other-docs-${travelerNoStr}`}
                                        className="shrink-0 cursor-pointer rounded-xl border border-cyan/20 bg-cyan/10 px-3 py-1.5 text-[11px] font-semibold text-cyan hover:bg-cyan/15 transition-colors"
                                      >
                                        Upload
                                      </label>
                                      <input
                                        id={`further-other-docs-${travelerNoStr}`}
                                        type="file"
                                        multiple
                                        accept=".pdf,image/jpeg,image/png,image/webp"
                                        disabled={
                                          isTravelerUploadLoading ||
                                          submissionLocked ||
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
                                      All documents submitted
                                    </p>
                                  ) : derivedMissingLabels.length > 0 && (
                                    <p className="text-xs text-amber-400 sm:min-w-0 sm:flex-1">
                                      Missing: {derivedMissingLabels.join(", ")}
                                    </p>
                                  )}
                                </div>

                              </>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
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
                      placeholder="Special requests, travel context, document explanations…"
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
                    {String(booking.applicantNotes || "").trim() || "—"}
                  </div>
                )}
              </div>
            )}

            {showLegacyUploadSections &&
              uploadSettings.enableGDriveUpload &&
              !uploadSettings.enableFileUpload && false && (
                <div className="space-y-4 mb-6">
                  <h4 className="text-sm font-semibold text-text-primary">
                    Further information — Google Drive (optional)
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
                            Google Drive — further information (optional)
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
                <h4 className="text-sm font-semibold text-text-primary">Other documents (per traveler)</h4>
                {Array.from({ length: travelerCount }).map((_, idx) => {
                  const travelerNo = idx + 1;
                  const travelerNoStr = String(travelerNo);
                  const serverComplete = travelerServerComplete(travelerNo);
                  const submissionLocked = travelerSubmissionLocked(travelerNo);
                  const dirty = travelerHasUnsavedChanges(travelerNo);
                  const saveDisabled = docUploading || (serverComplete && !dirty);
                  const headerShowsComplete = serverComplete && !dirty;
                  const travelerProgress = progress.missingByTraveler.find((item) => item.travelerNo === travelerNo);
                  const showMainDriveInput = Boolean(
                    visibleDriveInputs[`${travelerNo}-main`] || getSavedTravelerGdriveLink(travelerNo)
                  );
                  const otherList = selectedDocs[`${travelerNoStr}-otherDocuments`] || [];
                  const hasOtherPending = Array.isArray(otherList) && otherList.length > 0;
                  const savedOtherDocuments = getSavedTravelerOtherDocuments(travelerNo);
                  const totalOtherDocumentsCount = savedOtherDocuments.length + otherList.length;

                  return (
                    <div
                      key={`further-other-${travelerNo}`}
                      className="rounded-2xl border border-border bg-surface-2 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-text-primary">Traveler {travelerNo}</p>
                        {headerShowsComplete ? (
                          <span className="text-[11px] font-medium text-emerald-400">Required docs done</span>
                        ) : (
                          <span className="text-[11px] font-medium text-amber-400">Complete required docs above</span>
                        )}
                      </div>

                      {false && uploadSettings.enableGDriveUpload && (
                        <div className="space-y-1.5 pb-3 border-b border-border">
                          <label className="text-xs text-text-muted block">
                            Google Drive — further information (optional)
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
                            placeholder="Extra folder for references, samples…"
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
                        {cardShowsComplete ? (
                          <p className="text-xs text-emerald-400 sm:min-w-0 sm:flex-1 sm:text-right">
                            All documents submitted
                          </p>
                        ) : derivedMissingLabels.length > 0 && (
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
            <section id="document-upload-section" className="scroll-mt-28 space-y-3">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
                <p className="text-sm font-semibold text-emerald-400">
                  All required documents are uploaded.
                </p>
                <p className="text-xs text-text-muted mt-1">
                  You can still add optional supporting files in <span className="text-text-secondary font-medium">Further information & other documents</span> above.
                </p>
              </div>
            </section>
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
                  <p className="text-xs text-text-muted">Per traveler — use Upload for each item (max 500 KB per file).</p>
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

                  {/* GDrive link + explicit save (typing does not save until you click Save) */}
                  {uploadSettings.enableGDriveUpload && (
                    <div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full sm:w-auto mb-2"
                        leftIcon={<Upload size={14} />}
                        disabled={docUploading || submissionLocked}
                        onClick={() => toggleDriveInput(travelerNo, "main")}
                      >
                        {showMainDriveInput ? "Hide Google Drive Link" : "Upload Google Drive Link"}
                      </Button>
                      {showMainDriveInput && (
                        <>
                      <label className="text-xs text-slate-500 block mb-1.5">
                        Google Drive link
                        {uploadSettings.enableFileUpload
                          ? " (optional if you upload every file below)"
                          : " (required)"}
                      </label>
                      <div className="flex flex-row gap-2 items-stretch">
                        <input
                          type="text"
                          value={travelerGdriveLinks[travelerNoStr] ?? getSavedTravelerGdriveLink(travelerNo)}
                          onChange={(e) =>
                            setTravelerGdriveLinks((prev) => ({ ...prev, [travelerNoStr]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.preventDefault();
                          }}
                          placeholder="Paste link here — then click Save"
                          disabled={docUploading || submissionLocked}
                          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-cyan/40 focus:bg-white placeholder:text-slate-400"
                          autoComplete="off"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="shrink-0 min-w-[132px]"
                          leftIcon={<Upload size={14} />}
                          loading={docUploading}
                          disabled={docUploading || submissionLocked}
                          onClick={() => handleSaveTravelerDriveLink(travelerNo, "main")}
                        >
                          Upload Link
                        </Button>
                      </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Doc uploads — compact rows below traveler header */}
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
                                  ? `${selectedFile.name} · ${formatFileSize(selectedFile.size)}`
                                  : "PDF, JPG, PNG · max 500 KB"}
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
                    cardShowsComplete ? (
                      <p className="text-xs text-emerald-700">
                        All documents submitted
                      </p>
                    ) : derivedMissingLabels.length > 0 && (
                      <p className="text-xs text-amber-700">
                        Missing: {derivedMissingLabels.join(", ")}
                      </p>
                    )
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
                readOnly
                onClick={handleOpenPaymentTerms}
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
              disabled={summarySyncing || paying || docUploading}
              onClick={handleProceedToPaymentSummary}
            >
              {"Continue Payment"}
            </Button>
            {!allTravelersComplete && (
              <p className="text-xs text-text-muted text-center">
                You can still proceed to payment — documents can be uploaded later from your dashboard.
              </p>
            )}
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
