import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle,
  CreditCard,
  FileText,
  Image as ImageIcon,
  Minus,
  Plane,
  Plus,
  X,
  ShieldCheck,
  Upload,
  AlertCircle,
  Info,
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
  BookmarkCheck,
  UserRoundPlus,
} from "lucide-react";
import Navbar from "../components/layout/Navbar";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { getCountryById, COUNTRIES } from "../data/countries";
import { api, useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import { useCountries, useMergedCountry } from "../hooks/useCountries";
import ContactVerificationModal from "../components/account/ContactVerificationModal";
import SharedGoogleDriveLinkSection from "../components/application/SharedGoogleDriveLinkSection";
import {
  needsPhoneContactGate,
  needsEmailContactGate,
} from "../utils/contactVerificationGate";
import { clearTravelDraft, loadTravelDraft, saveTravelDraft } from "../utils/travelDraftStorage";
import {
  optimizeUploadFile,
  FINAL_UPLOAD_TARGET_BYTES,
  getUploadLimitForDocType,
} from "../utils/optimizeUploadFile";

const MAX_DOCUMENT_SIZE_BYTES = FINAL_UPLOAD_TARGET_BYTES;
const FILE_SIZE_ERROR = "File must be below 8 MB before optimization.";
const OPTIMIZE_ERROR = "Could not prepare this file for upload.";

const getApplicationDocSuccessStorageKey = (applicationId) =>
  applicationId ? `application-doc-successes:${applicationId}` : "";

const buildDocSuccessMapFromApplication = (application) => {
  const map = {};
  const travelers = Array.isArray(application?.travellerDocuments)
    ? application.travellerDocuments
    : [];

  travelers.forEach((traveler) => {
    const travelerNo = Number(traveler?.travelerNo);
    if (!Number.isFinite(travelerNo) || travelerNo <= 0) return;

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

const buildDocDetailMapFromApplication = (application) => {
  const map = {};
  const travelers = Array.isArray(application?.travellerDocuments)
    ? application.travellerDocuments
    : [];

  travelers.forEach((traveler) => {
    const travelerNo = Number(traveler?.travelerNo);
    if (!Number.isFinite(travelerNo) || travelerNo <= 0) return;

    const details = traveler?.documentDetails;
    if (details instanceof Map) {
      details.forEach((value, key) => {
        if (value?.url) map[`${travelerNo}-${key}`] = value;
      });
      return;
    }

    if (details && typeof details === "object") {
      Object.entries(details).forEach(([key, value]) => {
        if (value?.url) map[`${travelerNo}-${key}`] = value;
      });
    }
  });

  return map;
};

const ALLOWED_PASSPORT_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);
const INVALID_PASSPORT_TYPE_ERROR = "Only PDF, JPG, JPEG and PNG files are allowed.";
const PASSPORT_FILE_SIZE_ERROR = "File size exceeds 300KB limit. Please upload a smaller file.";
const normalizeProcessingDays = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const matches = String(value || "").match(/\d+/g);
  if (!matches?.length) return 0;
  return Number(matches[matches.length - 1]);
};

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
  const normalizedKeys = ["passport", ...keys.filter((key) => key !== "passport")];

  const fields = normalizedKeys.reduce((acc, key, index) => {
    if (!key || seen.has(key)) return acc;
    seen.add(key);
    acc.push({
      key,
      label: DOCUMENT_META[key]?.label || `${key.replace(/([A-Z])/g, " $1")} Upload`,
      Icon: DOCUMENT_META[key]?.Icon || FileText,
      required: index === 0,
    });
    return acc;
  }, []);

  return fields.length
    ? fields
    : [{
      key: "passport",
      label: DOCUMENT_META.passport.label,
      Icon: DOCUMENT_META.passport.Icon,
      required: true,
    }];
};

const formatFileSize = (size = 0) => {
  if (!size) return "0 KB";
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const RELATIONSHIP_OPTIONS = ["Self", "Family member", "Friend/Other"];
const GENDER_OPTIONS = ["Male", "Female", "Other"];

const toDateInputValue = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const buildTravelerFormState = (traveler = {}) => ({
  savedTravelerId: traveler.savedTravelerId || traveler.travelerProfileId || "",
  savedTravelerLabel: traveler.savedTravelerLabel || "",
  name: traveler.name || traveler.fullName || "",
  fullName: traveler.fullName || traveler.name || "",
  dateOfBirth: toDateInputValue(traveler.dateOfBirth),
  gender: traveler.gender || "",
  passportNumber: traveler.passportNumber || "",
  passportExpiryDate: toDateInputValue(traveler.passportExpiryDate),
  nationality: traveler.nationality || "",
  mobileNumber: traveler.mobileNumber || "",
  email: traveler.email || "",
  relationship: traveler.relationship || "Self",
  updateSavedTraveler: false,
  documents: traveler.documents || {},
  otherDocuments: traveler.otherDocuments || [],
  gdriveLink: traveler.gdriveLink || "",
  gdriveFurtherInfoLink: traveler.gdriveFurtherInfoLink || "",
  gdriveLinkSaved: Boolean(traveler.gdriveLinkSaved),
  gdriveFurtherInfoLinkSaved: Boolean(traveler.gdriveFurtherInfoLinkSaved),
});

const createTraveler = () => ({
  ...buildTravelerFormState({}),
});

const ApplicationForm = () => {
  const { countryId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useUIStore();
  const { user, isAuthenticated, sessionAuthMethod } = useAuthStore();
  const { countries: allCountries } = useCountries();
  const prefillApplied = useRef(false);
  const travelerNameInputRefs = useRef({});

  const listCountry = allCountries.find((c) => c.id === countryId);
  const country =
    useMergedCountry(countryId, listCountry) || getCountryById(countryId) || COUNTRIES[0];
  const docFields = useMemo(
    () => buildDocFields(country?.requiredDocuments),
    [country?.requiredDocuments]
  );
  const optionalDocFields = useMemo(
    () => docFields.filter((field) => field.key !== "passport"),
    [docFields]
  );
  const [travelers, setTravelers] = useState([createTraveler()]);
  const [savedTravelers, setSavedTravelers] = useState([]);
  const [savedTravelersLoading, setSavedTravelersLoading] = useState(false);
  const [draggingKey, setDraggingKey] = useState("");
  const [docErrors, setDocErrors] = useState({});
  const [docUploading, setDocUploading] = useState({});
  const [uploadedDocSuccesses, setUploadedDocSuccesses] = useState({});
  const [uploadedDocDetails, setUploadedDocDetails] = useState({});
  const [applicationDraftId, setApplicationDraftId] = useState("");
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [uploadSettings, setUploadSettings] = useState({
    enableGDriveUpload: true,
    enableFileUpload: true,
  });
  const [checkoutStarting, setCheckoutStarting] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactModalMode, setContactModalMode] = useState("phone");
  const continueAfterContactRef = useRef(null);
  /**
   * Toggles the "Do you want to skip document upload?" confirmation modal.
   * Shown when the user hits Continue without uploading every required
   * document (or providing a Google Drive link). They can confirm to proceed
   * straight to payment summary â€” the missing docs become uploadable later
   * from their dashboard.
   */
  const [skipDocsConfirmOpen, setSkipDocsConfirmOpen] = useState(false);
  const [sharedDriveLink, setSharedDriveLink] = useState("");

  useEffect(() => {
    if (!isAuthenticated || !localStorage.getItem("token")) return;
    const method = sessionAuthMethod ?? useAuthStore.getState().sessionAuthMethod;
    if (needsPhoneContactGate(method, user)) {
      setContactModalMode("phone");
      setContactModalOpen(true);
    } else if (needsEmailContactGate(method, user)) {
      setContactModalMode("email");
      setContactModalOpen(true);
    }
  }, [isAuthenticated, user, sessionAuthMethod]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get("/config/upload-settings");
        if (alive && data?.success && data.config) setUploadSettings(data.config);
      } catch {
        /* keep defaults */
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;

    const loadSavedTravelers = async () => {
      if (!isAuthenticated) return;
      setSavedTravelersLoading(true);
      try {
        const { data } = await api.get("/travelers");
        if (alive) {
          setSavedTravelers(Array.isArray(data?.travelers) ? data.travelers : []);
        }
      } catch (error) {
        if (alive) {
          console.error("Failed to load saved travelers:", error);
          setSavedTravelers([]);
        }
      } finally {
        if (alive) setSavedTravelersLoading(false);
      }
    };

    loadSavedTravelers();
    return () => {
      alive = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (prefillApplied.current) return;
    const st = location.state;
    prefillApplied.current = true;
    if (st?.restoreTravelDetails && typeof st.restoreTravelDetails === "object") {
      const restore = st.restoreTravelDetails;
      if (Array.isArray(restore.travelers) && restore.travelers.length > 0) {
        setTravelers(
          restore.travelers.map((traveler) => ({
            ...createTraveler(),
            ...buildTravelerFormState(traveler),
          }))
        );
      }
      if (restore.sharedDriveLink != null) {
        setSharedDriveLink(String(restore.sharedDriveLink || "").trim());
      }
      if (st.applicationDraftId || restore.applicationDraftId) {
        setApplicationDraftId(String(st.applicationDraftId || restore.applicationDraftId));
      }
      setDraftHydrated(true);
      return;
    }
    if (st?.travelerNames && Array.isArray(st.travelerNames)) {
      const n = Math.max(1, Number(st.travellerCount) || st.travelerNames.length);
      setTravelers(
        Array.from({ length: n }, (_, i) => ({
          ...createTraveler(),
          ...buildTravelerFormState(st.travelers?.[i] || { name: String(st.travelerNames[i] || "").trim() }),
        }))
      );
      if (st.sharedDriveLink != null) {
        setSharedDriveLink(String(st.sharedDriveLink || "").trim());
      }
      if (st.applicationDraftId) {
        setApplicationDraftId(String(st.applicationDraftId));
      }
      setDraftHydrated(true);
      return;
    }

    const cid = country?.id || countryId;
    const draft = loadTravelDraft(cid);
    if (!draft) {
      setDraftHydrated(true);
      return;
    }

    if (Array.isArray(draft.travelers) && draft.travelers.length > 0) {
      setTravelers(
        draft.travelers.map((traveler) => ({
          ...createTraveler(),
          ...buildTravelerFormState(traveler),
        }))
      );
    }
    if (draft.sharedDriveLink != null) {
      setSharedDriveLink(String(draft.sharedDriveLink || "").trim());
    }
    if (draft.applicationId) {
      setApplicationDraftId(String(draft.applicationId));
    }
    setDraftHydrated(true);
  }, [country?.id, countryId, location.state]);

  const flowDateFrom = location.state?.travelDateFrom;
  const flowDateTo = location.state?.travelDateTo;
  const flowVisaOption = location.state?.visaOption;

  useEffect(() => {
    if (!draftHydrated) return;
    const cid = country?.id || countryId;
    if (!cid) return;
    const timer = window.setTimeout(() => {
      saveTravelDraft(cid, {
        applicationId: applicationDraftId,
        travelDateFrom: flowDateFrom ?? "",
        travelDateTo: flowDateTo ?? "",
        visaOption: flowVisaOption ?? country?.visaType ?? "e-Visa",
        sharedDriveLink,
        travelers: travelers.map((traveler) => ({
          ...traveler,
          name: String(traveler.name || traveler.fullName || ""),
        })),
        showTravelDetails: true,
      });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [
    travelers,
    country?.id,
    countryId,
    country?.visaType,
    flowDateFrom,
    flowDateTo,
    flowVisaOption,
    sharedDriveLink,
    applicationDraftId,
    draftHydrated,
  ]);

  useEffect(() => {
    if (!applicationDraftId) return;
    try {
      const raw = localStorage.getItem(getApplicationDocSuccessStorageKey(applicationDraftId));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setUploadedDocSuccesses((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* ignore storage errors */
    }
  }, [applicationDraftId]);

  useEffect(() => {
    if (!applicationDraftId || !localStorage.getItem("token")) return;
    let cancelled = false;

    const syncUploadedDocsFromApplication = async () => {
      try {
        const { data } = await api.get(`/users/applications/${applicationDraftId}`);
        if (cancelled || !data?.success || !data?.application) return;

        const serverSuccesses = buildDocSuccessMapFromApplication(data.application);
        const serverDetails = buildDocDetailMapFromApplication(data.application);
        if (!Object.keys(serverSuccesses).length) return;

        setUploadedDocSuccesses((prev) => {
          const next = { ...prev, ...serverSuccesses };
          try {
            localStorage.setItem(
              getApplicationDocSuccessStorageKey(applicationDraftId),
              JSON.stringify(next)
            );
          } catch {
            /* ignore storage errors */
          }
          return next;
        });
        if (Object.keys(serverDetails).length) {
          setUploadedDocDetails((prev) => ({ ...prev, ...serverDetails }));
        }
      } catch {
        /* ignore fetch errors on restore */
      }
    };

    syncUploadedDocsFromApplication();
    return () => {
      cancelled = true;
    };
  }, [applicationDraftId]);

  useEffect(() => {
    const raw = (location.hash || "").replace(/^#/, "");
    if (raw !== "document-upload-section") return;
    const timer = window.setTimeout(() => {
      document.getElementById("document-upload-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [location.hash, location.pathname, countryId, travelers.length]);

  useEffect(() => {
    const handleGlobalTypingForTravelerName = (event) => {
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
  }, [travelers]);

  const addTraveler = () => setTravelers((prev) => [...prev, createTraveler()]);
  const removeTraveler = () => setTravelers((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  const updateTravelerName = (index, value) => {
    setTravelers((prev) =>
      prev.map((t, i) => (i === index ? { ...t, name: value, fullName: value } : t))
    );
  };

  const updateTravelerField = (index, field, value) => {
    setTravelers((prev) =>
      prev.map((traveler, i) => {
        if (i !== index) return traveler;
        if (field === "fullName") {
          return { ...traveler, fullName: value, name: value };
        }
        if (field === "savedTravelerId") {
          return { ...traveler, savedTravelerId: value };
        }
        return { ...traveler, [field]: value };
      })
    );
  };

  const buildTravelerPayload = (travelersSnapshot = travelers) =>
    travelersSnapshot.map((traveler, index) => ({
      travelerNo: index + 1,
      travelerProfileId: traveler.savedTravelerId || null,
      fullName: traveler.fullName || traveler.name || `Traveler ${index + 1}`,
      dateOfBirth: traveler.dateOfBirth || null,
      gender: traveler.gender || "",
      passportNumber: traveler.passportNumber || "",
      passportExpiryDate: traveler.passportExpiryDate || null,
      nationality: traveler.nationality || "",
      mobileNumber: traveler.mobileNumber || "",
      email: traveler.email || "",
      relationship: traveler.relationship || "Self",
    }));

  const ensureApplicationDraftForUploads = async (travelersSnapshot = travelers) => {
    const existingDraftId = String(applicationDraftId || "").trim();
    if (existingDraftId) {
      try {
        const { data } = await api.get(`/users/applications/${existingDraftId}`);
        if (data?.success && data.application?._id) {
          return { appId: String(data.application._id), application: data.application };
        }
      } catch {
        /* fall through to draft creation */
      }
    }

    const flow = location.state;
    const visaForSummary = flow?.visaOption || country.visaType || "e-Visa";
    const travelDateFrom = flow?.travelDateFrom ?? null;
    const travelDateTo = flow?.travelDateTo ?? null;
    const travelerNames = travelersSnapshot.map((t, i) => String(t.name || "").trim() || `Traveler ${i + 1}`);
    const travelerPayload = buildTravelerPayload(travelersSnapshot);

    const { data } = await api.post("/users/application/checkout-draft", {
      applicationDraftId: existingDraftId || undefined,
      countryId: country.id,
      countryName: country.name,
      flagEmoji: country.flagEmoji || "Visa",
      visaType: visaForSummary,
      travelDateFrom,
      travelDateTo,
      travellerCount: travelersSnapshot.length,
      travelerNames,
      travelers: travelerPayload,
      processingDays: normalizeProcessingDays(country.processingDays),
    });

    if (!data?.success || !data.application?._id) {
      throw new Error(data?.message || "Could not start application.");
    }

    const appId = String(data.application._id);
    setApplicationDraftId(appId);
    return { appId, application: data.application };
  };

  const applySavedTraveler = (index, travelerId) => {
    const match = savedTravelers.find((traveler) => String(traveler._id) === String(travelerId));
    if (!match) return;

    setTravelers((prev) =>
      prev.map((traveler, i) =>
        i === index
          ? {
              ...traveler,
              ...buildTravelerFormState({
                ...traveler,
                ...match,
                savedTravelerId: match._id,
                savedTravelerLabel: match.fullName,
                documents: traveler.documents,
                otherDocuments: traveler.otherDocuments,
                gdriveLink: traveler.gdriveLink,
                gdriveFurtherInfoLink: traveler.gdriveFurtherInfoLink,
                gdriveLinkSaved: traveler.gdriveLinkSaved,
                gdriveFurtherInfoLinkSaved: traveler.gdriveFurtherInfoLinkSaved,
              }),
            }
          : traveler
      )
    );
    showToast("Saved traveler applied to this application.", "success");
  };

  const updateTravelerGdrive = (index, value) => {
    setTravelers((prev) => prev.map((t, i) => (i === index ? { ...t, gdriveLink: value } : t)));
  };

  const updateTravelerGdriveFurtherInfo = (index, value) => {
    setTravelers((prev) =>
      prev.map((t, i) => (i === index ? { ...t, gdriveFurtherInfoLink: value } : t))
    );
  };

  const handleSaveTravelerGdriveLink = (index, field = "main") => {
    const link = String(
      field === "main"
        ? travelers[index]?.gdriveLink
        : travelers[index]?.gdriveFurtherInfoLink
    ).trim();
    if (!link) {
      showToast(
        `Please paste a ${field === "main" ? "Google Drive" : "further information"} link for Traveler ${index + 1}.`,
        "error"
      );
      return;
    }
    setTravelers((prev) =>
      prev.map((t, i) =>
        i === index
          ? {
              ...t,
              [field === "main" ? "gdriveLinkSaved" : "gdriveFurtherInfoLinkSaved"]: true,
            }
          : t
      )
    );
    showToast(
      `Traveler ${index + 1} ${field === "main" ? "Google Drive link" : "further information link"} saved.`,
      "success"
    );
  };

    const [rejectedFiles, setRejectedFiles] = React.useState({});

    const updateTravelerDoc = async (index, key, file) => {
      const inputKey = `${index}-${key}`;
      const travelerNo = index + 1;
      const successKey = `${travelerNo}-${key}`;
      // Reset any previous rejected file for this zone
      setRejectedFiles(prev => {
        const copy = { ...prev };
        delete copy[inputKey];
        return copy;
      });
      if (!file) {
        setDocErrors(prev => ({ ...prev, [inputKey]: null }));
        setTravelers(prev =>
          prev.map((t, i) =>
            i === index
              ? { ...t, documents: { ...t.documents, [key]: null } }
              : t
          )
        );
        return;
      }
      if (key === "passport" && !ALLOWED_PASSPORT_MIME_TYPES.has(String(file.type || "").toLowerCase())) {
        showToast(INVALID_PASSPORT_TYPE_ERROR, "error");
        setDocErrors((prev) => ({ ...prev, [inputKey]: INVALID_PASSPORT_TYPE_ERROR }));
        return;
      }
      const { maxBytes, label } = getUploadLimitForDocType(key);
      // Reject files that are already too big before optimisation
      if (file.size > maxBytes) {
        const message = key === "passport"
          ? PASSPORT_FILE_SIZE_ERROR
          : `File must be below ${label} before optimization.`;
        showToast(message, "error");
        setDocErrors(prev => ({ ...prev, [inputKey]: message }));
        setRejectedFiles(prev => ({ ...prev, [inputKey]: { name: file.name, size: file.size } }));
        return;
      }
      const { file: optimizedFile, error } = await optimizeUploadFile(file, { targetBytes: maxBytes });
      if (error || !optimizedFile) {
        const message = error || OPTIMIZE_ERROR;
        showToast(message, "error");
        setDocErrors(prev => ({ ...prev, [inputKey]: message }));
        return;
      }
      if (optimizedFile.size > maxBytes) {
        const message = key === "passport"
          ? PASSPORT_FILE_SIZE_ERROR
          : `File must be below ${label} after optimization.`;
        showToast(message, "error");
        setDocErrors(prev => ({ ...prev, [inputKey]: message }));
        return;
      }
      setDocErrors(prev => ({ ...prev, [inputKey]: null }));
      setTravelers(prev =>
        prev.map((t, i) =>
          i === index
            ? { ...t, documents: { ...t.documents, [key]: optimizedFile } }
            : t
        )
      );

      setDocUploading((prev) => ({ ...prev, [inputKey]: true }));
      try {
        const travelersSnapshot = travelers.map((traveler, travelerIndex) => (
          travelerIndex === index
            ? { ...traveler, documents: { ...traveler.documents, [key]: optimizedFile } }
            : traveler
        ));
        const { appId } = await ensureApplicationDraftForUploads(travelersSnapshot);
        const travelerName = String(travelersSnapshot[index]?.name || "").trim() || `Traveler ${travelerNo}`;
        const gdriveFurtherInfoLink = String(travelersSnapshot[index]?.gdriveFurtherInfoLink || "").trim();
        const sharedLink = String(sharedDriveLink || "").trim();

        const formData = new FormData();
        const ext = (optimizedFile.name.split(".").pop() || "").toLowerCase();
        const safeExt = ext ? `.${ext}` : "";
        formData.append(
          "documents",
          new File([optimizedFile], `traveler-${travelerNo}_${key}${safeExt}`, { type: optimizedFile.type })
        );
        formData.append("travelerNo", String(travelerNo));
        formData.append("travelerName", travelerName);
        if (sharedLink) formData.append("gdriveLink", sharedLink);
        formData.append("gdriveFurtherInfoLink", gdriveFurtherInfoLink);
        formData.append("documentsMeta", JSON.stringify([{ docType: key, kind: "required" }]));

        await api.post(`/users/applications/${appId}/documents`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        setTravelers((prev) =>
          prev.map((t, i) =>
            i === index
              ? { ...t, documents: { ...t.documents, [key]: null } }
              : t
          )
        );
      setUploadedDocSuccesses((prev) => {
          const next = { ...prev, [successKey]: true };
          try {
            const raw = localStorage.getItem(getApplicationDocSuccessStorageKey(appId));
            const existing = raw ? JSON.parse(raw) : {};
            const merged = { ...existing, [successKey]: true };
            localStorage.setItem(
              getApplicationDocSuccessStorageKey(appId),
              JSON.stringify(merged)
            );
            const cid = country?.id || countryId;
            if (cid) {
              saveTravelDraft(cid, {
                applicationId: appId,
                travelDateFrom: flowDateFrom ?? "",
                travelDateTo: flowDateTo ?? "",
                visaOption: flowVisaOption ?? country?.visaType ?? "e-Visa",
                sharedDriveLink,
                travelers: travelersSnapshot.map((travelerItem, travelerIndex) => ({
                  ...travelerItem,
                  documents:
                    travelerIndex === index
                      ? { ...travelerItem.documents, [key]: null }
                      : travelerItem.documents,
                  name: String(travelerItem.name || travelerItem.fullName || ""),
                })),
                showTravelDetails: true,
              });
            }
          } catch {
            /* ignore storage errors */
          }
          return next;
        });
        setUploadedDocDetails((prev) => ({
          ...prev,
          [successKey]: {
            fileName: optimizedFile.name,
            fileSize: optimizedFile.size,
            mimeType: optimizedFile.type,
          },
        }));
        showToast(`${key === "passport" ? "Passport" : "Document"} uploaded successfully!`, "success");
      } catch (err) {
        const message =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Could not upload document right now.";
        setDocErrors((prev) => ({ ...prev, [inputKey]: message }));
      } finally {
        setDocUploading((prev) => {
          const next = { ...prev };
          delete next[inputKey];
          return next;
        });
      }
    };

  const updateTravelerOtherDocs = async (index, files) => {
    const incoming = Array.from(files || []);
    const optimizedFiles = [];
    for (const rawFile of incoming) {
      const { file: optimizedFile, error } = await optimizeUploadFile(rawFile);
      if (error || !optimizedFile) {
        showToast(error || OPTIMIZE_ERROR, "error");
        return;
      }
      if (optimizedFile.size > MAX_DOCUMENT_SIZE_BYTES) {
        showToast("File must be below 500 KB after optimization.", "error");
        return;
      }
      optimizedFiles.push(optimizedFile);
    }
    const fileSig = (f) => `${f.name}|${f.size}|${f.lastModified}`;
    setTravelers((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        const existing = Array.isArray(t.otherDocuments) ? [...t.otherDocuments] : [];
        const merged = [...existing];
        for (const f of optimizedFiles) {
          if (!merged.some((x) => fileSig(x) === fileSig(f))) merged.push(f);
        }
        const capped = merged.slice(0, 10);
        return { ...t, otherDocuments: capped };
      })
    );
  };

  const removeTravelerOtherDoc = (index, docIndex) => {
    setTravelers((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        const docs = Array.isArray(t.otherDocuments) ? [...t.otherDocuments] : [];
        docs.splice(docIndex, 1);
        return { ...t, otherDocuments: docs };
      })
    );
  };

  const handleDrop = async (event, travelerIndex, fieldKey) => {
    event.preventDefault();
    event.stopPropagation();
    setDraggingKey("");
    const file = event.dataTransfer?.files?.[0] || null;
    await updateTravelerDoc(travelerIndex, fieldKey, file);
  };

  const travelerComplete = useCallback(
    (traveler, index) => {
      if (!String(traveler.name || "").trim()) return false;
      return true;
    },
    []
  );

  const allComplete = useMemo(
    () => travelers.length > 0 && travelers.every((t, index) => travelerComplete(t, index)),
    [travelerComplete, travelers]
  );

  const persistTravelerUploads = async (appId) => {
    const sharedLink = String(sharedDriveLink || "").trim();

    for (let index = 0; index < travelers.length; index += 1) {
      const traveler = travelers[index];
      const travelerNo = index + 1;
      const travelerName = String(traveler.name || "").trim() || `Traveler ${travelerNo}`;
      const gdriveFurtherInfoLink = String(traveler.gdriveFurtherInfoLink || "").trim();

      const requiredFiles = docFields
        .map((field) => ({ field, file: traveler.documents?.[field.key] }))
        .filter((entry) => entry.file instanceof File);
      const otherFiles = Array.isArray(traveler.otherDocuments)
        ? traveler.otherDocuments.filter((file) => file instanceof File)
        : [];

      if (requiredFiles.length > 0 || otherFiles.length > 0) {
        const formData = new FormData();
        const documentsMeta = [];

        requiredFiles.forEach(({ field, file }) => {
          formData.append("documents", file);
          documentsMeta.push({ docType: field.key, kind: "required" });
        });
        otherFiles.forEach((file) => {
          formData.append("documents", file);
          documentsMeta.push({ docType: "otherDocument", kind: "other" });
        });

        formData.append("travelerNo", String(travelerNo));
        formData.append("travelerName", travelerName);
        if (sharedLink) formData.append("gdriveLink", sharedLink);
        formData.append("gdriveFurtherInfoLink", gdriveFurtherInfoLink);
        formData.append("documentsMeta", JSON.stringify(documentsMeta));

        await api.post(`/users/applications/${appId}/documents`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.put(`/users/applications/${appId}`, {
          travelerUpdate: {
            travelerNo: String(travelerNo),
            travelerName,
          },
        });
      }
    }

    if (sharedLink) {
      await api.put(`/users/applications/${appId}`, { gdriveLink: sharedLink });
    }
  };

  const syncSavedTravelerUpdates = async () => {
    const queuedTravelers = travelers.filter(
      (traveler) => traveler.updateSavedTraveler && String(traveler.savedTravelerId || "").trim()
    );

    for (const traveler of queuedTravelers) {
      await api.put(`/travelers/${traveler.savedTravelerId}`, {
        fullName: traveler.fullName || traveler.name,
        dateOfBirth: traveler.dateOfBirth,
        gender: traveler.gender,
        passportNumber: traveler.passportNumber,
        passportExpiryDate: traveler.passportExpiryDate,
        nationality: traveler.nationality,
        mobileNumber: traveler.mobileNumber,
        email: traveler.email,
        relationship: traveler.relationship || "Self",
      });
    }
  };

  /**
   * Submit the application draft and jump to the payment summary.
   *
   * @param {object} [opts]
   * @param {boolean} [opts.skipped] - true when the user explicitly chose to
   *   continue without finishing the document uploads (from the "Skip document
   *   upload?" confirmation). Forwarded to the summary page so the document
   *   status tile shows "Pending Upload" instead of "All documents uploaded".
   */
  const handleContinueSubmit = async (opts = {}) => {
    const skipped = Boolean(opts.skipped);
    const travelerNames = travelers.map((t, i) => String(t.name || "").trim() || `Traveler ${i + 1}`);
    const travelerGdriveLinks = travelers.map(() => String(sharedDriveLink || "").trim());
    const travelerPayload = travelers.map((traveler, index) => ({
      travelerNo: index + 1,
      travelerProfileId: traveler.savedTravelerId || null,
      fullName: traveler.fullName || traveler.name || `Traveler ${index + 1}`,
      dateOfBirth: traveler.dateOfBirth || null,
      gender: traveler.gender || "",
      passportNumber: traveler.passportNumber || "",
      passportExpiryDate: traveler.passportExpiryDate || null,
      nationality: traveler.nationality || "",
      mobileNumber: traveler.mobileNumber || "",
      email: traveler.email || "",
      relationship: traveler.relationship || "Self",
    }));
    const flow = location.state;
    const visaForSummary = flow?.visaOption || country.visaType || "e-Visa";
    const travelDateFrom = flow?.travelDateFrom ?? null;
    const travelDateTo = flow?.travelDateTo ?? null;

    setCheckoutStarting(true);
    try {
      const { data } = await api.post("/users/application/checkout-draft", {
        applicationDraftId: String(applicationDraftId || "").trim() || undefined,
        countryId: country.id,
        countryName: country.name,
        flagEmoji: country.flagEmoji || "ðŸ›‚",
        visaType: visaForSummary,
        travelDateFrom,
        travelDateTo,
        travellerCount: travelers.length,
        travelerNames,
        travelers: travelerPayload,
        processingDays: normalizeProcessingDays(country.processingDays),
      });

      if (!data?.success || !data.application?._id) {
        showToast(data?.message || "Could not start application. Please try again.", "error");
        return;
      }

      const appId = data.application._id;
      setApplicationDraftId(String(appId));
      await syncSavedTravelerUpdates();
      // Persist whatever travelers already uploaded â€” when skipped, this may
      // be partial / empty; that's fine. The summary tile and the dashboard
      // missing-docs indicator will reflect reality from the application
      // record, not from `docsUploaded` alone.
      await persistTravelerUploads(appId);
      try {
        const uploadedDocSuccessMap = { ...uploadedDocSuccesses };
        travelers.forEach((traveler, travelerIndex) => {
          docFields.forEach((field) => {
            if (traveler.documents?.[field.key] instanceof File) {
              uploadedDocSuccessMap[`${travelerIndex + 1}-${field.key}`] = true;
            }
          });
        });
        localStorage.setItem(
          getApplicationDocSuccessStorageKey(appId),
          JSON.stringify(uploadedDocSuccessMap)
        );
      } catch {
        /* ignore storage errors */
      }
      clearTravelDraft(country.id);
      // Use `allComplete` (not the hardcoded `true`) to compute the real
      // status. If the user clicked "Continue without docs" we additionally
      // force it to false so the summary tile always reads as Pending Upload.
      const everythingUploaded = !skipped && allComplete;
      showToast(
        everythingUploaded ? "Opening payment summary." : "Saved â€” you can upload remaining docs later.",
        "success"
      );
      const applyFlowState = {
        travelerNames,
        travelers: travelerPayload,
        travellerCount: travelers.length,
        travelDateFrom,
        travelDateTo,
        visaOption: visaForSummary,
      };
      const sourceMeta = {
        from: "application-form",
        backTo: `/apply/${country.id}`,
        applicationDraftId: appId,
        preserveForm: true,
      };
      try {
        sessionStorage.setItem("paymentSummarySource", JSON.stringify(sourceMeta));
      } catch {
        /* ignore storage errors */
      }
      navigate(`/destination/${country.id}/summary`, {
        state: {
          // `docsSkipped` is the same flag CountryDetails â†’ "Upload later"
          // sets, so the summary page surfaces the consistent "skipped" banner.
          ...sourceMeta,
          docsSkipped: !everythingUploaded,
          summaryData: {
            applicationId: appId,
            countryId: country.id,
            countryName: country.name,
            flagEmoji: country.flagEmoji || "ðŸ›‚",
            visaType: visaForSummary,
            travellerCount: travelers.length,
            fee: Number(data.application?.fee || 0),
            baseFee: Number(country?.basePrice || 0) * travelers.length,
            gstEnabled: country?.gstEnabled !== false,
            gstRate: Number.isFinite(Number(country?.gstRate)) ? Number(country.gstRate) : 18,
            travelerNames,
            travelers: travelerPayload,
            travelerGdriveLinks,
            uploadedDocSuccesses: travelers.reduce((acc, traveler, travelerIndex) => {
              docFields.forEach((field) => {
                if (
                  traveler.documents?.[field.key] instanceof File ||
                  uploadedDocSuccesses[`${travelerIndex + 1}-${field.key}`]
                ) {
                  acc[`${travelerIndex + 1}-${field.key}`] = true;
                }
              });
              return acc;
            }, { ...uploadedDocSuccesses }),
            sharedDriveLink: String(sharedDriveLink || "").trim(),
            travelDateFrom,
            travelDateTo,
            docsUploaded: everythingUploaded,
          },
          applicationPrev: {
            path: `/apply/${country.id}`,
            state: applyFlowState,
          },
        },
        replace: true,
      });
    } catch (err) {
      const serverMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (typeof err?.response?.data === "string" ? err.response.data : "");
      showToast(serverMessage || err?.message || "Could not save traveler documents. Please try again.", "error");
    } finally {
      setCheckoutStarting(false);
    }
  };

  /**
   * Run the contact-verification gate (phone/email) if it's still needed,
   * otherwise jump straight to the checkout-draft submission. Extracted so
   * both the "all docs uploaded" path and the "skip docs" confirmation share
   * the same gating logic without duplication.
   */
  const proceedAfterContactGate = async (opts = {}) => {
    const skipped = Boolean(opts.skipped);
    // Bind the chosen skip state so the post-contact-gate continuation
    // (run via continueAfterContactRef) preserves it, otherwise the user
    // would lose the "skipped" intent after verifying phone/email.
    const submit = () => handleContinueSubmit({ skipped });
    const token = localStorage.getItem("token");
    if (token && user) {
      const method = sessionAuthMethod ?? useAuthStore.getState().sessionAuthMethod;
      if (needsPhoneContactGate(method, user)) {
        continueAfterContactRef.current = submit;
        setContactModalMode("phone");
        setContactModalOpen(true);
        return;
      }
      if (needsEmailContactGate(method, user)) {
        continueAfterContactRef.current = submit;
        setContactModalMode("email");
        setContactModalOpen(true);
        return;
      }
    }
    await submit();
  };

  const handleContinue = async () => {
    // Names are mandatory regardless of skip choice â€” block & toast for them.
    const missingNameIndex = travelers.findIndex((t) => !String(t?.name || "").trim());
    if (missingNameIndex >= 0) {
      showToast(`Please enter Traveler ${missingNameIndex + 1}'s name to continue.`, "error");
      return;
    }
    // If documents are still missing, ask the user whether they want to
    // proceed without them (they can upload later from their dashboard).
    if (!allComplete) {
      setSkipDocsConfirmOpen(true);
      return;
    }
    await proceedAfterContactGate();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      <Navbar />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <button
          type="button"
          onClick={() => {
            const cid = country?.id || countryId;
            if (!cid) {
              navigate("/destinations");
              return;
            }
            const flow = location.state || {};
            saveTravelDraft(cid, {
              applicationId: applicationDraftId,
              travelDateFrom: flow.travelDateFrom ?? "",
              travelDateTo: flow.travelDateTo ?? "",
              visaOption: flow.visaOption ?? country?.visaType ?? "e-Visa",
              sharedDriveLink,
              travelers: travelers.map((traveler) => ({
                ...traveler,
                name: String(traveler.name || traveler.fullName || ""),
              })),
              showTravelDetails: true,
            });
            // Replace so history is not [â€¦, destination, apply, destination]; Back on country won't return to apply.
            navigate(`/destination/${cid}`, { replace: true });
          }}
          aria-label="Back"
          title="Back"
          className="group inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-surface text-text-muted shadow-sm transition-all duration-200 hover:-translate-x-0.5 hover:border-cyan/40 hover:bg-cyan/5 hover:text-cyan"
        >
          <ArrowLeft size={18} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
        </button>

        <div>
          <p className="text-xs uppercase tracking-wider text-cyan font-semibold mb-1">
            {country.flagEmoji} {country.name}
          </p>
          <h1 className="text-2xl font-bold text-text-primary">Traveler Document Upload</h1>
          <p className="text-sm text-text-secondary mt-1">
            {uploadSettings.enableFileUpload && uploadSettings.enableGDriveUpload
              ? "Add each traveler and optionally share one Google Drive folder for all."
              : uploadSettings.enableFileUpload
                ? "Add each traveler and continue with the application."
                : uploadSettings.enableGDriveUpload
                  ? "Add each traveler and share one Google Drive folder link for all travelers."
                  : "Add each traveler and continue with the application."}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 flex items-center justify-between">
          <p className="text-sm font-medium text-text-primary">No. of Travelers</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={removeTraveler}
              className="w-8 h-8 rounded-full border border-border bg-background text-text-primary flex items-center justify-center disabled:opacity-40"
              disabled={travelers.length <= 1}
            >
              <Minus size={14} />
            </button>
            <span className="w-6 text-center font-semibold text-text-primary">{travelers.length}</span>
            <button
              type="button"
              onClick={addTraveler}
              className="w-8 h-8 rounded-full border border-border bg-background text-text-primary flex items-center justify-center"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <section id="document-upload-section" className="space-y-4 scroll-mt-28">
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {travelers.map((traveler, index) => (
            <div key={`traveler-${index}`} className="rounded-2xl border border-border bg-surface p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-text-primary">Traveler {index + 1}</p>
                {travelerComplete(traveler, index) ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                    <CheckCircle size={14} /> Completed
                  </span>
                ) : (
                  <span className="text-xs text-amber-400">Pending</span>
                )}
              </div>

              <div className="rounded-2xl border border-cyan/15 bg-cyan/5 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-cyan">
                    <BookmarkCheck size={12} /> Use saved traveler
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                    <UserRoundPlus size={12} /> Add new traveler
                  </span>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <select
                    value={traveler.savedTravelerId || ""}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      if (!nextId) {
                        updateTravelerField(index, "savedTravelerId", "");
                        return;
                      }
                      applySavedTraveler(index, nextId);
                    }}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
                  >
                    <option value="">
                      {savedTravelersLoading ? "Loading saved travelers..." : "Select a saved traveler profile"}
                    </option>
                    {savedTravelers.map((savedTraveler) => (
                      <option key={savedTraveler._id} value={savedTraveler._id}>
                        {savedTraveler.fullName} Â· {savedTraveler.relationship}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] leading-relaxed text-text-muted">
                    Choose a saved profile to auto-fill this traveler, or type fresh details below for this application only.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs text-text-muted block mb-1.5">Full Name</label>
                  <input
                    ref={(el) => {
                      travelerNameInputRefs.current[index] = el;
                    }}
                    type="text"
                    autoComplete="off"
                    value={traveler.fullName || traveler.name}
                    onChange={(e) => updateTravelerName(index, e.target.value)}
                    placeholder="Enter full name"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
                  />
                </div>

                <div>
                  <label className="text-xs text-text-muted block mb-1.5">Date of Birth</label>
                  <input
                    type="date"
                    value={traveler.dateOfBirth || ""}
                    onChange={(e) => updateTravelerField(index, "dateOfBirth", e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
                  />
                </div>

                <div>
                  <label className="text-xs text-text-muted block mb-1.5">Gender</label>
                  <select
                    value={traveler.gender || ""}
                    onChange={(e) => updateTravelerField(index, "gender", e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
                  >
                    <option value="">Select gender</option>
                    {GENDER_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-text-muted block mb-1.5">Passport Number</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={traveler.passportNumber || ""}
                    onChange={(e) => updateTravelerField(index, "passportNumber", e.target.value.toUpperCase())}
                    placeholder="Enter passport number"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
                  />
                </div>

                <div>
                  <label className="text-xs text-text-muted block mb-1.5">Passport Expiry</label>
                  <input
                    type="date"
                    value={traveler.passportExpiryDate || ""}
                    onChange={(e) => updateTravelerField(index, "passportExpiryDate", e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
                  />
                </div>

                <div>
                  <label className="text-xs text-text-muted block mb-1.5">Nationality</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={traveler.nationality || ""}
                    onChange={(e) => updateTravelerField(index, "nationality", e.target.value)}
                    placeholder="Enter nationality"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
                  />
                </div>

                <div>
                  <label className="text-xs text-text-muted block mb-1.5">Relationship</label>
                  <select
                    value={traveler.relationship || "Self"}
                    onChange={(e) => updateTravelerField(index, "relationship", e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
                  >
                    {RELATIONSHIP_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-text-muted block mb-1.5">Mobile Number</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={traveler.mobileNumber || ""}
                    onChange={(e) => updateTravelerField(index, "mobileNumber", e.target.value)}
                    placeholder="Enter mobile number"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs text-text-muted block mb-1.5">Email</label>
                  <input
                    type="email"
                    autoComplete="off"
                    value={traveler.email || ""}
                    onChange={(e) => updateTravelerField(index, "email", e.target.value)}
                    placeholder="Enter traveler email"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
                  />
                </div>
              </div>

              {traveler.savedTravelerId && (
                <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={Boolean(traveler.updateSavedTraveler)}
                    onChange={(e) => updateTravelerField(index, "updateSavedTraveler", e.target.checked)}
                    className="h-4 w-4 rounded border-border text-cyan focus:ring-cyan/40"
                  />
                  Update this saved traveler profile with the edits above when I continue
                </label>
              )}

              <div>
                <label className="text-xs text-text-muted block mb-1.5">Traveler Name</label>
                <input
                  type="text"
                  autoComplete="off"
                  value={traveler.name}
                  onChange={(e) => updateTravelerName(index, e.target.value)}
                  placeholder="Used in document labels"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-text-primary outline-none focus:border-cyan/50"
                />
              </div>
{uploadSettings.enableFileUpload && optionalDocFields.length > 0 && (
              <div className="flex w-full flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                  Other Documents
                </p>
                {optionalDocFields.map((field) => {
                  const file = traveler.documents[field.key];
                  const zoneKey = `${index}-${field.key}`;
                  const isDragging = draggingKey === zoneKey;
                  const Icon = field.Icon;
                  return (
                    <div key={`${index}-${field.key}`} className="w-full space-y-1">
                      <div
                        role="presentation"
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDraggingKey(zoneKey);
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          setDraggingKey(zoneKey);
                        }}
                        onDragLeave={() => {
                          setDraggingKey((prev) => (prev === zoneKey ? "" : prev));
                        }}
                        onDrop={(e) => handleDrop(e, index, field.key)}
                        className={`flex w-full min-w-0 items-center gap-2 rounded-xl border bg-background px-2.5 py-2 transition-colors ${
                          docErrors[zoneKey]
                            ? "border-red-500/45"
                            : isDragging
                              ? "border-cyan bg-cyan/5 ring-1 ring-cyan/30"
                              : "border-border"
                        }`}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan/10 text-cyan">
                          <Icon size={14} strokeWidth={2} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-text-primary">
                            {field.label}{" "}
                            <span className="text-[10px] font-medium text-text-muted">
                              (optional)
                            </span>
                          </p>
                          <p className="truncate text-[10px] text-text-muted">
                            {file
                              ? `${file.name} Â· ${formatFileSize(file.size)}`
                              : rejectedFiles[zoneKey]
                                ? `${rejectedFiles[zoneKey].name} Â· ${formatFileSize(rejectedFiles[zoneKey].size)}`
                                : "PDF, JPG, PNG Â· max 500 KB"}
                          </p>
                        </div>
                        <label
                          htmlFor={`traveler-${index}-${field.key}`}
                          className="shrink-0 cursor-pointer rounded-md bg-cyan/15 px-2.5 py-1.5 text-[11px] font-semibold text-cyan hover:bg-cyan/25"
                        >
                          {file ? "Replace" : "Upload"}
                        </label>
                        <input
                          id={`traveler-${index}-${field.key}`}
                          type="file"
                          accept=".pdf,image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={(e) => {
                            updateTravelerDoc(index, field.key, e.target.files?.[0] || null);
                            e.target.value = "";
                          }}
                        />
                      </div>
                      {docErrors[zoneKey] && (
                        <p className="flex items-center gap-1 px-0.5 text-xs font-medium text-red-500">
                          <AlertCircle size={12} /> {docErrors[zoneKey]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              )}

              {uploadSettings.enableFileUpload && (
                <div className="w-full space-y-2">
                  <div className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan/10 text-cyan">
                      <FileText size={14} strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-text-primary">Other documents</p>
                      <p className="text-[10px] text-text-muted">
                        {traveler.otherDocuments?.length || 0}{" "}
                        {(traveler.otherDocuments?.length || 0) === 1 ? "file" : "files"} selected Â· max 500 KB each
                      </p>
                    </div>
                    <label
                      htmlFor={`traveler-${index}-other-docs`}
                      className="shrink-0 cursor-pointer rounded-md bg-cyan/15 px-2.5 py-1.5 text-[11px] font-semibold text-cyan hover:bg-cyan/25"
                    >
                      Upload
                    </label>
                    <input
                      id={`traveler-${index}-other-docs`}
                      type="file"
                      multiple
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        updateTravelerOtherDocs(index, e.target.files || []);
                        e.target.value = "";
                      }}
                      className="sr-only"
                    />
                  </div>
                  {Array.isArray(traveler.otherDocuments) && traveler.otherDocuments.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {traveler.otherDocuments.map((file, docIdx) => (
                        <div
                          key={`traveler-${index}-other-doc-${docIdx}`}
                          className="relative rounded-lg border border-border bg-surface px-3 py-2"
                        >
                          <button
                            type="button"
                            onClick={() => removeTravelerOtherDoc(index, docIdx)}
                            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                            aria-label={`Remove ${file?.name || `file ${docIdx + 1}`}`}
                          >
                            <X size={12} />
                          </button>
                          <p className="text-xs text-text-primary truncate pr-3" title={file?.name || ""}>
                            {file?.name || `File ${docIdx + 1}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
            </div>

            {uploadSettings.enableGDriveUpload && (
              <SharedGoogleDriveLinkSection
                value={sharedDriveLink}
                onChange={setSharedDriveLink}
                className="mt-4"
              />
            )}
          </>
        </section>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={checkoutStarting}
          disabled={checkoutStarting}
          onClick={handleContinue}
        >
          Continue
        </Button>
      </main>

      <ContactVerificationModal
        isOpen={contactModalOpen}
        mode={contactModalMode}
        onClose={() => {
          continueAfterContactRef.current = null;
          setContactModalOpen(false);
        }}
        onCompleted={() => {
          const fn = continueAfterContactRef.current;
          continueAfterContactRef.current = null;
          setContactModalOpen(false);
          if (fn) void fn();
        }}
      />

      {/* â”€â”€ Skip-documents confirmation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          Shown when the user clicks "Continue" without finishing every
          required upload. Lets them deliberately proceed (docs become
          uploadable later from the dashboard) instead of being blocked by
          an error toast. */}
      <Modal
        isOpen={skipDocsConfirmOpen}
        onClose={() => setSkipDocsConfirmOpen(false)}
        title="Skip document upload?"
        size="md"
        footer={
          // Grid + fullWidth so both buttons render at the exact same width on
          // every viewport (the labels are different lengths, so without the
          // grid the buttons auto-size and look uneven).
          <div className="grid grid-cols-2 gap-2 w-full">
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => setSkipDocsConfirmOpen(false)}
              disabled={checkoutStarting}
            >
              Keep uploading
            </Button>
            <Button
              variant="primary"
              size="md"
              fullWidth
              loading={checkoutStarting}
              onClick={async () => {
                setSkipDocsConfirmOpen(false);
                await proceedAfterContactGate({ skipped: true });
              }}
            >
              Continue without docs
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <AlertCircle size={20} />
          </span>
          <div className="space-y-1.5">
            <p className="text-sm text-text-primary font-medium">
              You haven't uploaded all required documents yet.
            </p>
            <p className="text-sm text-text-muted leading-relaxed">
              You can still continue to the payment summary now and add the missing documents later from
              your <span className="text-text-primary font-medium">Dashboard â†’ Application details</span>.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ApplicationForm;
