import { useEffect, useState } from "react";
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
import GoogleDriveLinkHint from "../components/application/GoogleDriveLinkHint";
import { StatusBadge } from "../components/ui/Badge";
import { api, SERVER_URL } from "../store/authStore";
import { useDataStore } from "../store/dataStore";
import { useUIStore } from "../store/uiStore";
import { getApplicationProgress } from "../utils/applicationProgress";
import { optimizeUploadFile } from "../utils/optimizeUploadFile";

const MAX_DOCUMENT_SIZE_BYTES = 500 * 1024;
const FILE_SIZE_ERROR = "File must be below 8 MB before optimization.";
const OPTIMIZE_ERROR = "Could not prepare this file for upload.";

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

const ApplicationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
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
  const [applicantNotesDraft, setApplicantNotesDraft] = useState(undefined);
  const [notesSaving, setNotesSaving] = useState(false);
  const [expandedTravelerNo, setExpandedTravelerNo] = useState(undefined);
  const [visibleDriveInputs, setVisibleDriveInputs] = useState({});

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
      setLoading(false);
    };
    load();
  }, [fetchUserApplications]);

  const booking = bookings.find((b) => String(b._id || b.id) === String(id));
  const progress = booking
    ? getApplicationProgress(booking, uploadSettings)
    : { allDocumentsUploaded: false, totalMissingDocuments: 0, missingByTraveler: [] };

  useEffect(() => {
    if (!booking?.countryId) return;

    const loadCountryDocuments = async () => {
      try {
        const { data } = await api.get(`/countries/${booking.countryId}`);
        const keys = data?.country?.requiredDocuments;
        setDocFields(buildDocFields(keys));
      } catch {
        setDocFields(buildDocFields());
      }
    };

    loadCountryDocuments();
  }, [booking?.countryId]);

  const bookingApplicantNotes = String(booking?.applicantNotes ?? "");
  const activeApplicantNotes =
    String(id) === String(booking?._id || booking?.id)
      ? (applicantNotesDraft ?? bookingApplicantNotes)
      : bookingApplicantNotes;
  const showLegacyUploadSections = false;
  const hashRequestedUploadSection = (location.hash || "").replace(/^#/, "") === "document-upload-section";
  const canUploadDocuments = booking?.status !== "approved" && booking?.status !== "rejected";
  const canSaveApplicantNotes =
    booking?.status === "pending" ||
    booking?.status === "review" ||
    booking?.detailsPending === true;
  const travelerCount = Math.max(1, Number(booking?.travellerCount || 1));
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
    return uploadedTraveler?.documents && typeof uploadedTraveler.documents === "object"
      ? uploadedTraveler.documents
      : {};
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
    const uploadedTraveler = (Array.isArray(booking?.travellerDocuments) ? booking.travellerDocuments : []).find(
      (entry) => Number(entry?.travelerNo) === travelerNo
    );
    const travelerName = getSavedTravelerName(travelerNo) || `Traveler ${travelerNo}`;
    const uploadedDocumentsCount = Object.values(uploadedTraveler?.documents || {}).filter(Boolean).length;
    const missingInfo = progress.missingByTraveler.find((item) => item.travelerNo === travelerNo);
    const done = travelerServerComplete(travelerNo);

    return {
      travelerNo,
      travelerName,
      gdriveLink: uploadedTraveler?.gdriveLink || "",
      gdriveFurtherInfoLink: uploadedTraveler?.gdriveFurtherInfoLink || "",
      uploadedDocumentsCount,
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
      return;
    }
    const { file: optimizedFile, error, originalSize, compressedSize, wasCompressed } = await optimizeUploadFile(file);
    if (error || !optimizedFile) {
      const message = error || OPTIMIZE_ERROR;
      showToast(message, "error");
      setDocErrors((prev) => ({ ...prev, [inputKey]: message }));
      setSelectedDocs((prev) => ({ ...prev, [inputKey]: null }));
      return;
    }
    if (optimizedFile.size > MAX_DOCUMENT_SIZE_BYTES) {
      showToast("File must be below 500 KB after optimization.", "error");
      setDocErrors((prev) => ({ ...prev, [inputKey]: "File must be below 500 KB after optimization." }));
      setSelectedDocs((prev) => ({ ...prev, [inputKey]: null }));
      return;
    }
    const preparedFile = attachCompressionMeta(optimizedFile, { originalSize, compressedSize, wasCompressed });
    setDocErrors((prev) => ({ ...prev, [inputKey]: null }));
    setSelectedDocs((prev) => ({ ...prev, [inputKey]: preparedFile }));
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
          updateBookingDetails(appId, data.application);
          await fetchUserApplications();
          showToast(`Traveler ${travelerNo} details saved.`, "success");
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
          updateBookingDetails(appId, data.application);
          await fetchUserApplications();
          setSelectedDocs((prev) => {
            const next = { ...prev };
            docFields.forEach((f) => { delete next[`${travelerNoStr}-${f.key}`]; });
            delete next[`${travelerNoStr}-otherDocuments`];
            return next;
          });
          showToast(`Traveler ${travelerNo} documents uploaded.`, "success");
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

  const handleSaveApplicantNotes = async () => {
    if (!canSaveApplicantNotes) return;
    setNotesSaving(true);
    try {
      const appId = booking._id || booking.id;
      const { data } = await api.put(`/users/applications/${appId}`, { applicantNotes: activeApplicantNotes });
      if (data?.success && data.application) {
        updateBookingDetails(appId, data.application);
        setApplicantNotesDraft(undefined);
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

  const notesDirty = activeApplicantNotes !== bookingApplicantNotes;
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
          className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={16} /> Back to Dashboard
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
              <StatusBadge status={booking.status || "pending"} />
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
                <p className="text-sm font-semibold text-text-primary break-all">{booking._id || booking.id}</p>
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
          const hasDriveLink = (Array.isArray(booking?.travellerDocuments) ? booking.travellerDocuments : [])
            .some(entry => typeof entry.gdriveLink === "string" && entry.gdriveLink.trim().length > 0);

          return (
            <div className={`rounded-2xl border p-4 ${progress.allDocumentsUploaded ? "border-emerald-500/30 bg-emerald-500/5" : hasDriveLink ? "border-cyan/30 bg-cyan/5" : "border-amber-500/30 bg-amber-500/5"}`}>
              <p className="text-xs text-text-muted">Application progress</p>
              <p className={`text-sm font-semibold mt-1 ${progress.allDocumentsUploaded ? "text-emerald-400" : hasDriveLink ? "text-cyan" : "text-amber-400"}`}>
                {progress.allDocumentsUploaded
                  ? "All required documents are uploaded."
                  : hasDriveLink
                  ? "Google Drive link is submitted."
                  : `${progress.totalMissingDocuments} required document${progress.totalMissingDocuments === 1 ? "" : "s"} still missing.`}
              </p>
            </div>
          );
        })()}

        {/* Progress steps */}
        <div className="grid grid-cols-3 gap-2 text-[11px] font-medium">
          <div className="rounded-lg bg-cyan/10 border border-cyan/30 p-2 text-cyan text-center">Application</div>
          <div className="rounded-lg bg-cyan/10 border border-cyan/30 p-2 text-cyan text-center">Documents</div>
          <div className={`rounded-lg p-2 text-center border ${booking.paymentStatus === 'completed' ? 'bg-cyan/10 border-cyan/30 text-cyan' : 'bg-surface-2 border-border text-text-muted'}`}>Payment</div>
        </div>

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
                  <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${
                    traveler.isComplete
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : traveler.gdriveLink
                      ? "border-cyan/30 bg-cyan/10 text-cyan"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  }`}>
                    {traveler.isComplete ? "Complete" : traveler.gdriveLink ? "Drive Link Submitted" : "Pending"}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  {uploadSettings.enableFileUpload && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-text-muted">Uploaded documents</span>
                      <span className="font-medium text-text-primary">{traveler.uploadedDocumentsCount} / {docFields.length}</span>
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
                        {traveler.gdriveFurtherInfoLink ? (
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-text-muted">Extra info link</span>
                            <a
                              href={traveler.gdriveFurtherInfoLink}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-cyan hover:underline break-all font-medium"
                            >
                              View
                            </a>
                          </div>
                        ) : null}
                      </div>
                    </>
                  )}
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-text-muted mb-1">Missing items</p>
                    <p className={`text-sm ${traveler.missingLabels.length ? "text-amber-400" : "text-emerald-400"}`}>
                      {traveler.missingLabels.length ? traveler.missingLabels.join(", ") : "All required documents submitted"}
                    </p>
                  </div>
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
                                    <label className="text-xs text-text-muted block mb-1.5">
                                      Google Drive link
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
                                      const savedDocUrl = String(savedDocuments[field.key] || "").trim();
                                      const Icon = field.Icon;
                                      return (
                                        <div key={inputKey} className="space-y-1">
                                          <div
                                            className={`flex items-center gap-2 rounded-xl border bg-background px-2.5 py-2 transition-colors ${
                                              docErrors[inputKey] ? "border-red-500/45" : "border-border"
                                            }`}
                                          >
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan/10 text-cyan">
                                              <Icon size={14} strokeWidth={2} />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                              <p className="text-xs font-medium text-text-primary truncate">{field.label}</p>
                                              <p className="text-[10px] text-text-muted truncate">
                                                {selectedFile
                                                  ? `${selectedFile.name} · ${formatFileSize(selectedFile.size)}`
                                                  : "PDF, JPG, PNG · max 500 KB"}
                                              </p>
                                            </div>
                                            {savedDocUrl && !selectedFile ? (
                                              <span className="shrink-0 rounded-full bg-emerald-500/12 px-2 py-1 text-[10px] font-semibold text-emerald-400">
                                                Successful
                                              </span>
                                            ) : null}
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

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                  <Button
                                    type="button"
                                    variant={headerShowsComplete && !hasOtherPending ? "ghost" : "secondary"}
                                    size="sm"
                                    leftIcon={headerShowsComplete && !hasOtherPending ? <CheckCircle size={14} /> : <Upload size={14} />}
                                    loading={isTravelerUploadLoading}
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
                                  {!headerShowsComplete && travelerProgress?.missingLabels?.length > 0 && (
                                    <p className="text-xs text-amber-400 sm:min-w-0 sm:flex-1 sm:text-right">
                                      Missing: {travelerProgress.missingLabels.join(", ")}
                                    </p>
                                  )}
                                </div>

                                {uploadSettings.enableGDriveUpload && (
                                  <div className="rounded-2xl border border-border bg-surface p-4">
                                    <GoogleDriveLinkHint variant="shared" />
                                  </div>
                                )}
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

        {!canUploadDocuments && (
          <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-muted">
            Document uploads are not available for this application status ({booking.status}).
          </div>
        )}

        {showFurtherInfoCard && (
          <Card>
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare size={18} className="text-cyan shrink-0" />
              <h3 className="text-lg font-semibold text-text-primary">Further information</h3>
            </div>
            <p className="text-xs text-text-muted mb-5 max-w-3xl leading-relaxed">
              Leave a message for our team when that is available, and use the cards below for optional extras: a{" "}
              <span className="text-text-secondary font-medium">second Google Drive folder</span> per traveler (when Drive upload is on), and optional{" "}
              <span className="text-text-secondary font-medium">other document</span> files when file upload is on. Your{" "}
              <span className="text-text-secondary font-medium">main</span> Drive folder for required documents is set in{" "}
              <span className="text-text-secondary font-medium">Upload documents</span>. Save each traveler’s changes with the button in their card.
            </p>

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
                  </>
                ) : (
                  <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm text-text-secondary whitespace-pre-wrap">
                    {String(booking.applicantNotes || "").trim() || "—"}
                  </div>
                )}
              </div>
            )}

            {canUploadDocuments && (uploadSettings.enableGDriveUpload || uploadSettings.enableFileUpload) && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-text-primary">
                  Traveler further information
                </h4>
                {travelers.map((traveler) => {
                  const travelerNo = traveler.travelerNo;
                  const travelerNoStr = String(travelerNo);
                  const serverComplete = travelerServerComplete(travelerNo);
                  const submissionLocked = travelerSubmissionLocked(travelerNo);
                  const isTravelerUploadLoading = isUploadingState(`traveler-upload-${travelerNo}`);
                  const isFurtherLinkUploading = isUploadingState(`traveler-drive-${travelerNo}-further`);
                  const dirty = travelerHasUnsavedChanges(travelerNo);
                  const saveDisabled = isTravelerUploadLoading || (serverComplete && !dirty);
                  const headerShowsComplete = serverComplete && !dirty;
                  const otherList = selectedDocs[`${travelerNoStr}-otherDocuments`] || [];
                  const hasOtherPending = Array.isArray(otherList) && otherList.length > 0;

                  return (
                    <div
                      key={`further-info-traveler-${travelerNo}`}
                      className="rounded-2xl border border-border bg-surface-2 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-text-primary">Traveler {travelerNo}</p>
                        {headerShowsComplete && (
                          <span className="text-[11px] font-medium text-emerald-400">Saved</span>
                        )}
                      </div>
                      {uploadSettings.enableGDriveUpload && (
                        <div className="space-y-1.5">
                          <label className="text-xs text-text-muted block">
                            Google Drive - further information (optional)
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
                              disabled={isFurtherLinkUploading || !canUploadDocuments || Boolean(getSavedTravelerGdriveFurtherInfoLink(travelerNo))}
                              className="min-w-0 flex-1 bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary outline-none focus:border-cyan/50 placeholder:text-text-muted"
                              autoComplete="off"
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="shrink-0 sm:min-w-[132px]"
                              leftIcon={<Upload size={14} />}
                              loading={isFurtherLinkUploading}
                              disabled={isFurtherLinkUploading || !canUploadDocuments || !travelerGdriveFurtherInfoLinks[travelerNoStr] || Boolean(getSavedTravelerGdriveFurtherInfoLink(travelerNo))}
                              onClick={() => handleSaveTravelerDriveLink(travelerNo, "further")}
                            >
                              Upload Link
                            </Button>
                          </div>
                        </div>
                      )}

                      {uploadSettings.enableFileUpload && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-2">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan/10 text-cyan">
                              <FileText size={14} strokeWidth={2} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-text-primary">Other documents</p>
                              <p className="text-[10px] text-text-muted">
                                {otherList.length} {otherList.length === 1 ? "file" : "files"} selected
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
                              disabled={isTravelerUploadLoading || !canUploadDocuments || traveler.uploadedOtherDocumentsCount > 0}
                              onChange={(e) => {
                                handleOtherDocsChange(travelerNo, e.target.files || []);
                                e.target.value = "";
                              }}
                              className="sr-only"
                            />
                          </div>
                          {hasOtherPending && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {otherList.map((file, docIdx) => (
                                <div
                                  key={`further-selected-other-${travelerNoStr}-${docIdx}`}
                                  className="relative rounded-lg border border-border bg-surface px-3 py-2"
                                >
                                  <button
                                    type="button"
                                    onClick={() => removeOtherDoc(travelerNo, docIdx)}
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

                      <Button
                        type="button"
                        variant={headerShowsComplete && !hasOtherPending ? "ghost" : "secondary"}
                        size="sm"
                        leftIcon={headerShowsComplete && !hasOtherPending ? <CheckCircle size={14} /> : <Upload size={14} />}
                        loading={isTravelerUploadLoading}
                        disabled={saveDisabled || !canUploadDocuments || (Boolean(getSavedTravelerGdriveFurtherInfoLink(travelerNo)) && traveler.uploadedOtherDocumentsCount > 0 && !travelerHasUnsavedChanges(travelerNo))}
                        onClick={() => handleUploadTraveler(travelerNo)}
                        className="w-full sm:w-auto"
                      >
                        {submissionLocked
                          ? "Submitted"
                          : headerShowsComplete && !hasOtherPending
                          ? "Saved"
                          : headerShowsComplete
                            ? "Upload additional documents"
                            : `Save traveler ${travelerNo}`}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {showLegacyUploadSections &&
              uploadSettings.enableGDriveUpload &&
              !uploadSettings.enableFileUpload && (
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

                      {uploadSettings.enableGDriveUpload && (
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
                              {otherList.length} {otherList.length === 1 ? "file" : "files"} selected
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
                        {hasOtherPending && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {otherList.map((file, docIdx) => (
                              <div
                                key={`further-selected-other-${travelerNoStr}-${docIdx}`}
                                className="relative rounded-lg border border-border bg-surface px-3 py-2"
                              >
                                <button
                                  type="button"
                                  onClick={() => removeOtherDoc(travelerNo, docIdx)}
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
                        {!headerShowsComplete && travelerProgress?.missingLabels?.length > 0 && (
                          <p className="text-xs text-amber-400 sm:min-w-0 sm:flex-1 sm:text-right">
                            Missing: {travelerProgress.missingLabels.join(", ")}
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
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                        Pending
                      </span>
                    )}
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

                  {!uploadSettings.enableFileUpload && uploadSettings.enableGDriveUpload && !headerShowsComplete && travelerProgress?.missingLabels?.length > 0 && (
                    <p className="text-xs text-amber-700">
                      Missing: {travelerProgress.missingLabels.join(", ")}
                    </p>
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
                {uploadSettings.enableGDriveUpload && (
                  <div className="rounded-2xl border border-border bg-surface-2 p-4 mt-4">
                    <GoogleDriveLinkHint variant="shared" />
                  </div>
                )}
                </>
              )}

            </section>
          )
          )
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-muted">
            Document uploads are not available for this application status ({booking.status}).
          </div>
        )}

        {/* Bottom actions */}
        {booking.paymentStatus !== "completed" && (
          <div className="flex flex-col gap-3 pt-2">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              leftIcon={<CreditCard size={16} />}
              onClick={() => {
                const appKey = booking._id || booking.id;
                navigate(`/dashboard/application/${encodeURIComponent(appKey)}/summary`, {
                  state: {
                    applicationPrev: {
                      path: `/dashboard/application/${encodeURIComponent(appKey)}`,
                    },
                  },
                });
              }}
            >
              {allTravelersComplete ? "Proceed to Payment Summary" : "Skip to Payment Summary"}
            </Button>
            {!allTravelersComplete && (
              <p className="text-xs text-text-muted text-center">
                You can still proceed to payment — documents can be uploaded later from your dashboard.
              </p>
            )}
          </div>
        )}

      </main>
    </div>
  );
};

export default ApplicationDetails;
