import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle, CreditCard, Loader2, ShieldCheck, Info } from "lucide-react";
import SharedGoogleDriveLinkSection from "../components/application/SharedGoogleDriveLinkSection";
import PassportUploadRow from "../components/application/PassportUploadRow";
import Navbar from "../components/layout/Navbar";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { api, useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import { openRazorpayForApplication, validateRazorpayCheckoutReadiness } from "../utils/razorpayCheckout";
import { slugifyCountryRoute } from "../utils/countryRouting";
import { getLocalDateYmd } from "../utils/dateInput";
import { useCountries, useMergedCountry } from "../hooks/useCountries";
import { optimizeUploadFile } from "../utils/optimizeUploadFile";
import { formatOrdinalDate } from "../utils/dateUtils";
import { saveTravelDraft } from "../utils/travelDraftStorage";

const SUMMARY_UPLOAD_MAX_BYTES = 300 * 1024;
const ALLOWED_PASSPORT_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);
const INVALID_PASSPORT_TYPE_ERROR = "Only PDF, JPG, JPEG and PNG files are allowed.";
const PASSPORT_FILE_SIZE_ERROR = "File size exceeds 300KB limit. Please upload a smaller file.";

const normalizeProcessingDays = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const matches = String(value || "").match(/\d+/g);
  if (!matches?.length) return 0;
  return Number(matches[matches.length - 1]);
};

/** Same slug as `/terms` and the CMS seed — public GET `/api/pages/:slug`. */
const TERMS_CMS_SLUG = "terms-and-conditions";

const formatTravelerDateForInput = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const formatSummaryDate = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return formatOrdinalDate(parsed);
};

const hasUploadedPassport = (entry) => {
  const docs = entry?.documents;
  if (!docs) return false;
  if (docs instanceof Map) return Boolean(docs.get("passport"));
  if (typeof docs?.get === "function") return Boolean(docs.get("passport"));
  if (typeof docs === "object") return Boolean(docs.passport);
  return false;
};

const buildTravelerPassportSuccessMap = ({ application, summaryData, uploadSuccesses, travelerCount }) => {
  const applicationSuccesses = buildSuccessMapFromApplication(application);
  const summarySuccesses =
    summaryData?.uploadedDocSuccesses && typeof summaryData.uploadedDocSuccesses === "object"
      ? summaryData.uploadedDocSuccesses
      : {};
  const merged = {
    ...summarySuccesses,
    ...uploadSuccesses,
    ...applicationSuccesses,
  };

  Array.from({ length: travelerCount }).forEach((_, index) => {
    const travelerNo = index + 1;
    if (merged[`${travelerNo}-passport`]) return;
    const travelerEntry = Array.isArray(application?.travellerDocuments)
      ? application.travellerDocuments.find((entry) => Number(entry?.travelerNo) === travelerNo)
      : null;
    if (hasUploadedPassport(travelerEntry)) {
      merged[`${travelerNo}-passport`] = true;
    }
  });

  return merged;
};

const getApplicationDocSuccessStorageKey = (applicationId) =>
  applicationId ? `application-doc-successes:${applicationId}` : "";

const buildSuccessMapFromApplication = (application) => {
  const map = {};
  const travelers = Array.isArray(application?.travellerDocuments)
    ? application.travellerDocuments
    : [];

  travelers.forEach((traveler) => {
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

const getStoredApplicationDocSuccesses = (applicationId) => {
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

const setStoredApplicationDocSuccesses = (applicationId, successes) => {
  if (!applicationId) return;
  try {
    localStorage.setItem(
      getApplicationDocSuccessStorageKey(applicationId),
      JSON.stringify(successes && typeof successes === "object" ? successes : {})
    );
  } catch {
    /* ignore storage errors */
  }
};

const buildFallbackApplication = (applicationId, summaryData) => {
  if (!summaryData) return null;
  return {
    _id: applicationId || null,
    applicationId: summaryData.applicationId || applicationId || null,
    countryId: summaryData.countryId || "",
    countryName: summaryData.countryName || "Visa",
    flagEmoji: summaryData.flagEmoji || "",
    visaType: summaryData.visaType || "e-Visa",
    travellerCount: summaryData.travellerCount || 1,
    travelerNames: Array.isArray(summaryData.travelerNames) ? summaryData.travelerNames : [],
    fee: Number(summaryData.fee || 0),
    gdriveLink: summaryData.sharedDriveLink || "",
    travellerDocuments: [],
  };
};

const ApplicationSummaryPage = () => {
  const { id: paramId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const persistedSummarySource = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("paymentSummarySource");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);
  const summaryData = location.state?.summaryData || persistedSummarySource?.summaryData || null;
  const docsSkipped = Boolean(location.state?.docsSkipped ?? persistedSummarySource?.docsSkipped);
  const isDashboardSummaryRoute = location.pathname.startsWith("/dashboard/application/");
  const id = isDashboardSummaryRoute
    ? (
        paramId ||
        location.state?.applicationDraftId ||
        summaryData?.applicationId ||
        persistedSummarySource?.applicationDraftId ||
        null
      )
    : (
        location.state?.applicationDraftId ||
        summaryData?.applicationId ||
        persistedSummarySource?.applicationDraftId ||
        paramId ||
        null
      );
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [termsPage, setTermsPage] = useState(null);
  const [termsPageLoading, setTermsPageLoading] = useState(false);
  const [termsPageError, setTermsPageError] = useState("");
  const [paying, setPaying] = useState(false);
  const [uploadDocumentsModalOpen, setUploadDocumentsModalOpen] = useState(false);
  const [uploadModalTravelers, setUploadModalTravelers] = useState([]);
  const [uploadModalDriveLink, setUploadModalDriveLink] = useState("");
  const [uploadModalErrors, setUploadModalErrors] = useState({});
  const [uploadModalUploading, setUploadModalUploading] = useState({});
  const [uploadSuccesses, setUploadSuccesses] = useState({});
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [razorpayMessage, setRazorpayMessage] = useState("");
  const countryIdForPricing = summaryData?.countryId || application?.countryId || "";
  const { countries: allCountries } = useCountries();
  const listCountry = allCountries.find((c) => c.id === countryIdForPricing);
  const country = useMergedCountry(countryIdForPricing, listCountry);
  const fallbackApplication = useMemo(
    () => buildFallbackApplication(id, summaryData),
    [id, summaryData]
  );
  const applicationIdForUploads = String(
    application?._id || application?.applicationId || id || summaryData?.applicationId || ""
  );

  useEffect(() => {
    if (!summaryData && typeof location.state?.docsSkipped === "undefined") return;
    try {
      sessionStorage.setItem(
        "paymentSummarySource",
        JSON.stringify({
          ...(persistedSummarySource && typeof persistedSummarySource === "object"
            ? persistedSummarySource
            : {}),
          applicationDraftId: id || persistedSummarySource?.applicationDraftId || null,
          docsSkipped,
          summaryData: summaryData || persistedSummarySource?.summaryData || null,
        })
      );
    } catch {
      /* ignore storage errors */
    }
  }, [docsSkipped, id, location.state?.docsSkipped, persistedSummarySource, summaryData]);

  useEffect(() => {
    setUploadSuccesses(getStoredApplicationDocSuccesses(applicationIdForUploads));
  }, [applicationIdForUploads]);

  useEffect(() => {
    if (!applicationIdForUploads) return;
    const serverSuccesses = buildSuccessMapFromApplication(application);
    if (!Object.keys(serverSuccesses).length) return;
    const merged = {
      ...getStoredApplicationDocSuccesses(applicationIdForUploads),
      ...serverSuccesses,
    };
    setStoredApplicationDocSuccesses(applicationIdForUploads, merged);
    setUploadSuccesses((prev) => ({ ...prev, ...merged }));
  }, [application, applicationIdForUploads]);

  useEffect(() => {
    if (!id && fallbackApplication) {
      setApplication(fallbackApplication);
      setLoading(false);
      return;
    }
    if (!id) {
      if (summaryData) {
        setApplication({
          _id: null,
          countryName: summaryData.countryName || "Visa",
          flagEmoji: summaryData.flagEmoji || "🛂",
          visaType: summaryData.visaType || "e-Visa",
          travellerCount: summaryData.travellerCount || 1,
          travelerNames: summaryData.travelerNames || [],
          fee: Number(summaryData.fee || 0),
          travellerDocuments: summaryData.docsUploaded ? [{}] : [],
        });
      }
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/users/applications/${id}`);
        if (data?.success) setApplication(data.application);
        else showToast(data?.message || "Could not load application.", "error");
      } catch (err) {
        if (fallbackApplication) {
          setApplication(fallbackApplication);
        }
        if (err?.response?.status === 401 && fallbackApplication) {
          showToast("Session expired. Showing your saved summary. Please log in again to sync the latest uploads.", "info");
        } else {
          showToast(err.response?.data?.message || "Could not load application summary.", "error");
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fallbackApplication, id, summaryData, showToast]);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const result = await validateRazorpayCheckoutReadiness();
      if (!mounted) return;
      setRazorpayReady(!!result.ok);
      setRazorpayMessage(result.ok ? "" : result.message || "Razorpay unavailable.");
    };
    check();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!termsModalOpen) return;
    if (termsPage) return;
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
    return () => { cancelled = true; };
  }, [termsModalOpen, termsPage]);

  const travelerCount = Math.max(1, Number(application?.travellerCount || 1));
  const summaryVisaType = summaryData?.visaType || application?.visaType || "e-Visa";
  const summaryTravelDateFrom = summaryData?.travelDateFrom ?? application?.travelDate ?? null;
  const summaryTravelDateTo = summaryData?.travelDateTo ?? application?.returnDate ?? null;
  const summaryTravelRange = summaryTravelDateFrom || summaryTravelDateTo
    ? `${formatSummaryDate(summaryTravelDateFrom)} - ${formatSummaryDate(summaryTravelDateTo)}`
    : "—";

  const travelerNames = useMemo(() => {
    const names = Array.isArray(application?.travelerNames) ? application.travelerNames : [];
    return Array.from({ length: travelerCount }).map((_, i) => names[i] || `Traveler ${i + 1}`);
  }, [application?.travelerNames, travelerCount]);

  const effectiveGstEnabled =
    typeof summaryData?.gstEnabled === "boolean"
      ? summaryData.gstEnabled
      : country?.gstEnabled !== false;
  const effectiveGstRate = Number.isFinite(Number(summaryData?.gstRate))
    ? Number(summaryData.gstRate)
    : Number.isFinite(Number(country?.gstRate))
      ? Number(country.gstRate)
      : 18;

  const { serviceFee, taxes, totalAmount } = useMemo(() => {
    const service = Number.isFinite(Number(summaryData?.baseFee))
      ? Number(summaryData.baseFee)
      : Number.isFinite(Number(country?.basePrice))
        ? Number(country.basePrice) * travelerCount
        : 0;
    const gst = Number.isFinite(Number(summaryData?.gstAmount))
      ? Number(summaryData.gstAmount)
      : effectiveGstEnabled
        ? Math.round(service * (effectiveGstRate / 100))
        : 0;
    const fromServer = Number(application?.fee);
    const fromState = Number(summaryData?.fee);
    return {
      serviceFee: service,
      taxes: gst,
      totalAmount:
        Number.isFinite(fromServer) && fromServer > 0
          ? fromServer
          : Number.isFinite(fromState) && fromState > 0
            ? fromState
            : service + gst,
    };
  }, [application?.fee, summaryData?.fee, summaryData?.baseFee, summaryData?.gstAmount, country?.basePrice, travelerCount, effectiveGstEnabled, effectiveGstRate]);

  /**
   * Compute the "documents uploaded" status for the status tile + step pill.
   *
   * IMPORTANT: `application.travellerDocuments` is created with one entry per
   * traveler by the upload flow even when the user uploads no files (the form
   * still calls `PUT /users/applications/:id` to save the traveler name /
   * gdriveLink). So `travellerDocuments.length >= travelerCount` is NOT a
   * reliable signal — we have to look at whether each entry actually contains
   * a non-empty `documents` map (or any `otherDocuments` / `gdriveLink`).
   *
   * Priority:
   *   1. If the caller explicitly told us via `location.state.docsSkipped`
   *      that the user chose to skip the upload step → docsUploaded = false.
   *   2. If `summaryData.docsUploaded` is an explicit boolean → trust it.
   *   3. Otherwise inspect each traveler entry on the server record.
   */
  const docsUploaded = useMemo(() => {
    if (docsSkipped) return false;
    if (summaryData && typeof summaryData.docsUploaded === "boolean") {
      return summaryData.docsUploaded;
    }
    const allPassportUploadsStored = Array.from({ length: travelerCount }).every((_, index) =>
      Boolean(uploadSuccesses[`${index + 1}-passport`])
    );
    if (allPassportUploadsStored) return true;
    const entries = Array.isArray(application?.travellerDocuments)
      ? application.travellerDocuments
      : [];
    if (entries.length < travelerCount) return false;
    const entryHasUpload = (entry) => {
      if (!entry || typeof entry !== "object") return false;
      const docs = entry.documents;
      if (docs) {
        if (docs instanceof Map && docs.size > 0) return true;
        if (typeof docs === "object" && Object.keys(docs).length > 0) return true;
      }
      if (Array.isArray(entry.otherDocuments) && entry.otherDocuments.length > 0) return true;
      return false;
    };
    return entries.slice(0, travelerCount).every(entryHasUpload);
  }, [docsSkipped, summaryData, uploadSuccesses, application?.travellerDocuments, travelerCount]);

  const travelerPassportSuccesses = useMemo(
    () => buildTravelerPassportSuccessMap({
      application,
      summaryData,
      uploadSuccesses,
      travelerCount,
    }),
    [application, summaryData, uploadSuccesses, travelerCount]
  );

  useEffect(() => {
    if (!applicationIdForUploads || !Object.keys(travelerPassportSuccesses).length) return;
    setStoredApplicationDocSuccesses(applicationIdForUploads, travelerPassportSuccesses);
    setUploadSuccesses((prev) => {
      const missingEntries = Object.entries(travelerPassportSuccesses).filter(
        ([key, value]) => value && !prev[key]
      );
      if (!missingEntries.length) return prev;
      return { ...prev, ...travelerPassportSuccesses };
    });
  }, [applicationIdForUploads, travelerPassportSuccesses]);

  const ensureApplicationDraft = async () => {
    let app = application;
    let appId = app?._id;

    if (!appId && id) {
      try {
        const { data } = await api.get(`/users/applications/${id}`);
        if (data?.success && data.application?._id) {
          app = data.application;
          appId = data.application._id;
          setApplication(data.application);
        }
      } catch {
        /* fall through to draft creation */
      }
    }

    if (!appId && summaryData?.countryId) {
      const { data } = await api.post("/users/application/checkout-draft", {
        applicationDraftId: String(id || summaryData?.applicationId || "").trim() || undefined,
        countryId: summaryData.countryId,
        countryName: summaryData.countryName,
        flagEmoji: summaryData.flagEmoji || "🛂",
        visaType: summaryData.visaType || "e-Visa",
        travelDateFrom: summaryData.travelDateFrom ?? null,
        travelDateTo: summaryData.travelDateTo ?? null,
        travellerCount: summaryData.travellerCount || 1,
        travelerNames: Array.isArray(summaryData.travelerNames) ? summaryData.travelerNames : [],
        travelers: Array.isArray(summaryData.travelers) ? summaryData.travelers : [],
        processingDays: normalizeProcessingDays(summaryData.processingDays),
      });
      if (!data?.success || !data.application?._id) {
        throw new Error(data?.message || "Could not start application.");
      }
      app = data.application;
      appId = data.application._id;
      setApplication(data.application);
    }

    if (!appId) {
      throw new Error("Application not found. Go back and continue from the document step.");
    }

    return { app, appId };
  };

  const openUploadDocumentsModal = () => {
    const uploadedEntries = Array.isArray(application?.travellerDocuments)
      ? application.travellerDocuments
      : [];
    const firstDriveLink = uploadedEntries.find((entry) => String(entry?.gdriveLink || "").trim())?.gdriveLink || "";
    setUploadModalTravelers(
      Array.from({ length: travelerCount }).map((_, index) => ({
        id: index + 1,
        name: travelerNames[index] || `Traveler ${index + 1}`,
        passportFile: null,
        passportUploaded:
          Boolean(travelerPassportSuccesses[`${index + 1}-passport`]),
      }))
    );
    setUploadModalDriveLink(
      String(summaryData?.sharedDriveLink || application?.gdriveLink || firstDriveLink || "").trim()
    );
    setUploadModalErrors({});
    setUploadModalUploading({});
    setUploadDocumentsModalOpen(true);
  };

  const handleUploadModalPassportChange = async (index, file) => {
    if (!file) return;
    if (!ALLOWED_PASSPORT_MIME_TYPES.has(String(file.type || "").toLowerCase())) {
      setUploadModalErrors((prev) => ({
        ...prev,
        [index]: INVALID_PASSPORT_TYPE_ERROR,
      }));
      showToast(INVALID_PASSPORT_TYPE_ERROR, "error");
      return;
    }
    if (file.size > SUMMARY_UPLOAD_MAX_BYTES) {
      setUploadModalErrors((prev) => ({
        ...prev,
        [index]: PASSPORT_FILE_SIZE_ERROR,
      }));
      showToast(PASSPORT_FILE_SIZE_ERROR, "error");
      return;
    }
    const { file: optimizedFile, error } = await optimizeUploadFile(file, {
      targetBytes: SUMMARY_UPLOAD_MAX_BYTES,
    });
    if (error || !optimizedFile) {
      setUploadModalErrors((prev) => ({
        ...prev,
        [index]: error || "Could not prepare this passport file for upload.",
      }));
      showToast(error || "Could not prepare this passport file for upload.", "error");
      return;
    }
    if (optimizedFile.size > SUMMARY_UPLOAD_MAX_BYTES) {
      setUploadModalErrors((prev) => ({
        ...prev,
        [index]: PASSPORT_FILE_SIZE_ERROR,
      }));
      showToast(PASSPORT_FILE_SIZE_ERROR, "error");
      return;
    }
    setUploadModalErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setUploadModalUploading((prev) => ({ ...prev, [index]: true }));
    try {
      const { appId } = await ensureApplicationDraft();
      const travelerNo = index + 1;
      const travelerName = travelerNames[index] || `Traveler ${travelerNo}`;
      const formData = new FormData();
      const ext = (optimizedFile.name.split(".").pop() || "").toLowerCase();
      const safeExt = ext ? `.${ext}` : "";
      formData.append(
        "documents",
        new File([optimizedFile], `traveler-${travelerNo}_passport${safeExt}`, { type: optimizedFile.type })
      );
      formData.append("travelerNo", String(travelerNo));
      formData.append("travelerName", travelerName);
      formData.append("documentsMeta", JSON.stringify([{ docType: "passport", kind: "required" }]));

      const { data } = await api.post(`/users/applications/${appId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (!data?.success || !data?.application) {
        throw new Error(data?.message || "Could not upload passport.");
      }

      setApplication(data.application);
      setUploadSuccesses((prev) => {
        const next = { ...prev, [`${travelerNo}-passport`]: true };
        setStoredApplicationDocSuccesses(appId, next);
        return next;
      });
      setUploadModalTravelers((prev) =>
        prev.map((traveler, travelerIndex) => (
          travelerIndex === index
            ? {
                ...traveler,
                passportFile: null,
                passportUploaded: true,
              }
            : traveler
        ))
      );
      showToast("Passport uploaded successfully.", "success");
    } catch (err) {
      setUploadModalErrors((prev) => ({
        ...prev,
        [index]: err?.response?.data?.message || err?.message || "Could not upload passport.",
      }));
      showToast(err?.response?.data?.message || err?.message || "Could not upload passport.", "error");
    } finally {
      setUploadModalUploading((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const handleSaveUploadDocuments = async () => {
    const sharedLink = String(uploadModalDriveLink || "").trim();
    try {
      const { appId } = await ensureApplicationDraft();
      if (sharedLink) {
        const { data } = await api.put(`/users/applications/${appId}`, { gdriveLink: sharedLink });
        if (data?.success && data.application) {
          setApplication(data.application);
        }
      }
      setUploadDocumentsModalOpen(false);
      showToast("Upload details saved.", "success");
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || "Could not save upload details.", "error");
    }
  };

  const handleDriveLinkBlurSave = async () => {
    const sharedLink = String(uploadModalDriveLink || "").trim();
    if (!sharedLink) return;
    try {
      const { appId } = await ensureApplicationDraft();
      const { data } = await api.put(`/users/applications/${appId}`, { gdriveLink: sharedLink });
      if (data?.success && data.application) {
        setApplication(data.application);
        showToast("Google Drive link saved.", "success");
      }
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || "Could not save Drive link.", "error");
    }
  };

  const handleBack = () => {
    const formatDateToYmd = (val) => {
      if (!val) return null;
      const str = String(val);
      if (str.includes("T")) return str.slice(0, 10);
      return str;
    };

    const restoreTravelDetails = {
      travelDateFrom: formatDateToYmd(summaryData?.travelDateFrom ?? application?.travelDate),
      travelDateTo: formatDateToYmd(summaryData?.travelDateTo ?? application?.returnDate),
      visaOption: summaryData?.visaType || application?.visaType,
      sharedDriveLink: String(summaryData?.sharedDriveLink || application?.gdriveLink || "").trim(),
      applicationDraftId: id || applicationIdForUploads || null,
      travelers: Array.isArray(summaryData?.travelers) && summaryData.travelers.length
        ? summaryData.travelers.map((traveler) => ({
            ...traveler,
            name: traveler?.name ?? traveler?.fullName ?? "",
          }))
        : (Array.isArray(application?.travelerSelections) && application.travelerSelections.length
            ? application.travelerSelections.map((entry, index) => ({
                travelerProfileId: entry?.travelerProfileId || entry?.travelerSnapshot?.travelerProfileId || "",
                fullName: entry?.travelerSnapshot?.fullName || application?.travelerNames?.[index] || "",
                name: entry?.travelerSnapshot?.fullName || application?.travelerNames?.[index] || "",
                dateOfBirth: formatTravelerDateForInput(entry?.travelerSnapshot?.dateOfBirth),
                gender: entry?.travelerSnapshot?.gender || "",
                passportNumber: entry?.travelerSnapshot?.passportNumber || "",
                passportExpiryDate: formatTravelerDateForInput(entry?.travelerSnapshot?.passportExpiryDate),
                nationality: entry?.travelerSnapshot?.nationality || "",
                mobileNumber: entry?.travelerSnapshot?.mobileNumber || "",
                email: entry?.travelerSnapshot?.email || "",
                relationship: entry?.travelerSnapshot?.relationship || "Self",
              }))
            : (summaryData?.travelerNames || application?.travelerNames || []).map((name) => ({
                name: String(name || ""),
                fullName: String(name || ""),
              }))),
    };

    const savedCountryId = localStorage.getItem("lastActiveCountryId");
    const savedCountryName = localStorage.getItem("lastActiveCountryName");

    let exactBackPath = location.state?.backTo || location.state?.applicationPrev?.path;
    if (!exactBackPath) {
      try {
        const rawSource = sessionStorage.getItem("paymentSummarySource");
        if (rawSource) {
          const source = JSON.parse(rawSource);
          if (source?.backTo) exactBackPath = source.backTo;
        }
      } catch (e) {
        /* ignore */
      }
    }

    const countryRoute = slugifyCountryRoute(
      summaryData?.countryName ||
      application?.countryName ||
      savedCountryName ||
      ""
    );

    if (exactBackPath || countryRoute) {
      const draftCountryKey = exactBackPath ? exactBackPath.split('/').pop() : countryRoute;
      try {
        const hasNewData =
          restoreTravelDetails.travelers &&
          restoreTravelDetails.travelers.length > 0 &&
          restoreTravelDetails.travelers.some((t) => String(t.name || "").trim().length > 0);

        if (hasNewData) {
          saveTravelDraft(draftCountryKey, {
            applicationId: restoreTravelDetails.applicationDraftId,
            travelDateFrom: restoreTravelDetails.travelDateFrom,
            travelDateTo: restoreTravelDetails.travelDateTo,
            visaOption: restoreTravelDetails.visaOption,
            sharedDriveLink: restoreTravelDetails.sharedDriveLink,
            travelers: restoreTravelDetails.travelers,
            showTravelDetails: true,
          });
        }
      } catch (err) {
        console.error("Failed to write fallback travel draft", err);
      }

      navigate(exactBackPath || `/destination/${encodeURIComponent(countryRoute)}`, {
        state: {
          restoreTravelDetails,
          applicationDraftId: restoreTravelDetails.applicationDraftId,
        },
        replace: true,
      });
      return;
    }

    const countryId =
      summaryData?.countryId ||
      application?.countryId ||
      savedCountryId;

    if (countryId) {
      try {
        const hasNewData =
          restoreTravelDetails.travelers &&
          restoreTravelDetails.travelers.length > 0 &&
          restoreTravelDetails.travelers.some((t) => String(t.name || "").trim().length > 0);

        if (hasNewData) {
          saveTravelDraft(countryId, {
            applicationId: restoreTravelDetails.applicationDraftId,
            travelDateFrom: restoreTravelDetails.travelDateFrom,
            travelDateTo: restoreTravelDetails.travelDateTo,
            visaOption: restoreTravelDetails.visaOption,
            sharedDriveLink: restoreTravelDetails.sharedDriveLink,
            travelers: restoreTravelDetails.travelers,
            showTravelDetails: true,
          });
        }
      } catch (err) {
        console.error("Failed to write fallback travel draft", err);
      }

      navigate(`/destination/${encodeURIComponent(countryId)}`, {
        state: {
          restoreTravelDetails,
          applicationDraftId: restoreTravelDetails.applicationDraftId,
        },
        replace: true,
      });
      return;
    }

    // Default ultimate fallback - home page instead of dashboard
    navigate("/", { replace: true });
  };

  const resolvePayAmountRupees = (appDoc) => {
    const fromServer = Number(appDoc?.fee);
    if (Number.isFinite(fromServer) && fromServer > 0) return fromServer;
    const fromState = Number(summaryData?.fee);
    if (Number.isFinite(fromState) && fromState > 0) return fromState;
    return totalAmount;
  };

  const handlePay = async () => {
    if (!termsAccepted) {
      showToast("Please accept the terms and conditions.", "error");
      return;
    }
    if (!razorpayReady) {
      showToast(razorpayMessage || "Payment is not available right now.", "error");
      return;
    }

    setPaying(true);
    try {
      const { app, appId } = await ensureApplicationDraft();

      const amountRupees = resolvePayAmountRupees(app);

      await openRazorpayForApplication({
        applicationId: appId,
        amountRupees,
        description: `${app.countryName || "Visa"} — service fee`,
        applicantName: user?.name || "Applicant",
        applicantEmail: user?.email || "",
        onSuccess: () => {
          try {
            localStorage.removeItem("exitIntentPendingContext");
          } catch {}
          showToast("Payment successful!", "success");
          navigate(`/dashboard/application/${encodeURIComponent(appId)}`, { replace: true });
        },
        onDismiss: () => {
          showToast("Payment was not completed. You can continue from this summary page anytime.", "info");
        },
        onFailure: (m) => {
          showToast(m || "Payment could not be started.", "error");
          navigate(`/dashboard?payment=failed&applicationId=${encodeURIComponent(appId)}`, { replace: true });
        },
      });
    } catch (err) {
      showToast(err.response?.data?.message || "Could not start payment.", "error");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan animate-spin" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-text-primary font-semibold">Application not found.</p>
          <Button variant="secondary" onClick={handleBack}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      <Navbar />
      <main className="flex-1 px-4 sm:px-6 py-8">

        {/* Back */}
        <button
          type="button"
          onClick={handleBack}
          className="group flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-cyan transition-colors mb-6 w-fit"
        >
          <ArrowLeft size={16} className="pointer-events-none group-hover:-translate-x-1 transition-transform" />
          Back
        </button>

        <div className="max-w-lg w-full mx-auto space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs uppercase tracking-wider text-cyan font-semibold mb-1">
            {application.flagEmoji} {application.countryName}
          </p>
          <h1 className="text-2xl font-bold text-text-primary">Payment Summary</h1>
          <p className="text-sm text-text-secondary mt-1">{application.visaType}</p>
          <p className="text-xs font-mono text-text-muted mt-2">
            Application ID: {application.applicationId || application._id || "Will be assigned on application creation"}
          </p>
        </div>

        {/* Travel Details */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-2">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Travel Details</h3>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Visa type</span>
            <span className="font-medium text-text-primary">{summaryVisaType}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Travel dates</span>
            <span className="font-medium text-text-primary text-right">{summaryTravelRange}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Travelers</span>
            <span className="font-medium text-text-primary">{travelerCount}</span>
          </div>
          <div className="border-t border-border pt-3 mt-3">
            <h4 className="text-sm font-semibold text-text-primary mb-3">Traveler Details</h4>
          {travelerNames.map((name, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Traveler {idx + 1}</span>
              <span className="font-medium text-text-primary">{name}</span>
            </div>
          ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={openUploadDocumentsModal}
          >
            Upload your documents now
          </Button>
        </div>

        {(!docsUploaded || docsSkipped) && (
          <div className="rounded-2xl border border-cyan/30 bg-cyan/5 p-4">
            <div className="flex items-start gap-3">
              <Info size={18} className="text-cyan mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  No worries — you can upload documents later!
                </p>
                <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                  Complete your payment first. After that, go to <span className="text-text-primary font-medium">My Dashboard → click your application → upload documents</span> for each traveler at any time.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Billing */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary mb-1">Billing</h3>

          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">
              Service Fee {travelerCount > 1 ? `(${travelerCount} x ₹${Number(country?.basePrice || 0).toLocaleString("en-IN")})` : ""}
            </span>
            <span className="text-text-primary">₹{serviceFee.toLocaleString("en-IN")}</span>
          </div>
          {effectiveGstEnabled && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">GST ({effectiveGstRate}%)</span>
              <span className="text-text-primary">₹{taxes.toLocaleString("en-IN")}</span>
            </div>
          )}
          <div className="border-t border-border pt-3 flex justify-between text-base font-semibold">
            <span className="text-text-primary">Total</span>
            <span className="text-cyan">₹{totalAmount.toLocaleString("en-IN")}</span>
          </div>
          <p className="text-xs text-text-muted">
            Government / embassy fees (if any) are shown separately at payment.
          </p>
        </div>

        {/* T&C + Pay */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-border text-cyan accent-cyan"
            />
            <span className="text-sm text-text-secondary leading-snug">
              I agree to the{" "}
              <button
                type="button"
                className="text-cyan hover:underline font-medium bg-transparent border-0 p-0 cursor-pointer inline align-baseline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTermsModalOpen(true);
                }}
              >
                terms and conditions
              </button>{" "}
              and understand that the amount above covers service charges only.
            </span>
          </label>

          {!razorpayReady && (
            <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-xl px-3 py-2">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" />
              {razorpayMessage || "Payment gateway is not configured. Contact support."}
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            leftIcon={<CreditCard size={18} />}
            loading={paying}
            disabled={!termsAccepted || !razorpayReady || paying}
            onClick={handlePay}
          >
            Proceed to Payment
          </Button>

          <p className="text-xs text-text-muted text-center">
            Secured by Razorpay · Your payment info is never stored
          </p>
        </div>
        </div>

      </main>

      <Modal
        isOpen={uploadDocumentsModalOpen}
        onClose={() => { handleSaveUploadDocuments(); }}
        title="Upload Documents"
        size="xl"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button variant="secondary" size="md" onClick={() => { handleSaveUploadDocuments(); }}>
              Skip, I'll upload later
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="rounded-2xl border border-cyan/20 bg-cyan/5 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <ShieldCheck size={16} className="text-cyan shrink-0" />
              <span>Your documents are safe and secure with us.</span>
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-bold text-text-primary">Travelers ({travelerCount})</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Add a single Google Drive link for all travelers if needed.
            </p>
          </div>

          <div className="space-y-4">
            {uploadModalTravelers.map((traveler, index) => (
              <div
                key={`summary-upload-${traveler.id}`}
                className="rounded-2xl border border-border bg-surface p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan/10 text-cyan font-bold">
                    {String(traveler.id).padStart(2, "0")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-semibold text-text-primary">Traveler {traveler.id}</h4>
                      {traveler.passportUploaded ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle size={12} />
                          Passport uploaded
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">
                      {traveler.name || `Traveler ${traveler.id}`} (Name as on passport)
                    </p>

                    <div className="mt-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-text-primary">Passport Upload</p>
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                          Optional
                        </span>
                        <span className="group relative inline-flex align-middle">
                          <span
                            className="inline-flex rounded-full p-0.5 text-text-muted transition-all duration-150 hover:bg-cyan/10 hover:text-cyan"
                            aria-label="Optional passport upload info"
                          >
                            <Info size={12} />
                          </span>
                          <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-xl border border-border bg-surface px-3 py-2 text-[11px] font-normal leading-relaxed text-text-secondary shadow-lg group-hover:block">
                            You can continue without uploading a passport here and add it later if needed.
                          </span>
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-text-secondary">Upload clear copy of passport</p>

                      <PassportUploadRow
                        className="mt-4"
                        inputId={`summary-passport-upload-${traveler.id}`}
                        label="Passport Upload"
                        file={traveler.passportFile}
                        error={uploadModalErrors[index]}
                        uploading={Boolean(uploadModalUploading[index])}
                        saved={Boolean(traveler.passportUploaded && !traveler.passportFile)}
                        helperText={
                          traveler.passportFile
                            ? traveler.passportFile.name
                            : "PDF, JPG, PNG - max 300 KB"
                        }
                        savedText="Document saved securely"
                        reuploadLabel="Replace File"
                        onChange={(file) => handleUploadModalPassportChange(index, file)}
                        onReupload={() => {
                          setUploadModalTravelers((prev) =>
                            prev.map((item, itemIndex) => (
                              itemIndex === index
                                ? { ...item, passportFile: null, passportUploaded: false }
                                : item
                            ))
                          );
                          setUploadModalErrors((prev) => {
                            const next = { ...prev };
                            delete next[index];
                            return next;
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <SharedGoogleDriveLinkSection
            value={uploadModalDriveLink}
            onChange={setUploadModalDriveLink}
            onSave={handleDriveLinkBlurSave}
            showSkipHint={application?.paymentStatus !== "completed"}
          />
        </div>
      </Modal>

      <Modal
        isOpen={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        title={termsPage?.title || "Terms and Conditions"}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="md" onClick={() => setTermsModalOpen(false)}>
              Deny
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setTermsAccepted(true);
                setTermsModalOpen(false);
              }}
            >
              Accept
            </Button>
          </div>
        }
      >
        <div className="max-h-[min(52vh,400px)] overflow-y-auto overscroll-contain pr-0.5 -mr-0.5">
          {termsPageLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-cyan animate-spin" />
            </div>
          )}
          {!termsPageLoading && termsPageError && (
            <p className="text-sm text-amber-400 text-center py-6">{termsPageError}</p>
          )}
          {!termsPageLoading && !termsPageError && termsPage?.content && (
            <article
              className="prose prose-sm prose-neutral max-w-none text-text-primary prose-headings:text-text-primary prose-p:text-text-secondary prose-li:text-text-secondary prose-strong:text-text-primary prose-a:text-cyan [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:bg-surface-2 [&_th]:p-2 [&_ul]:pl-4"
              dangerouslySetInnerHTML={{ __html: termsPage.content }}
            />
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ApplicationSummaryPage;
