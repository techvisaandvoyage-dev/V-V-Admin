import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Download, CheckCircle, Clock, MapPin, User, Mail, Calendar, Plane, CreditCard, Link, Upload, UploadCloud, Phone, MessageSquare } from "lucide-react";
import { useUIStore } from "../store/uiStore";
import { useDataStore } from "../store/dataStore";
import Navbar from "../components/layout/Navbar";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { Select } from "../components/ui/Input";
import { StatusBadge } from "../components/ui/Badge";
import { useAuthStore, api, SERVER_URL } from "../store/authStore";
import { getApplicationProgress, resolveApplicationStatus } from "../utils/applicationProgress";

const getTravelerNoFromDocumentPath = (path) => {
  const fileName = String(path || "").split("/").pop() || "";
  const match = fileName.match(/^traveler-(\d+)_/i);
  return match ? Number(match[1]) : null;
};

const getTravelerDocumentEntries = (documents) => {
  if (!documents) return [];
  if (documents instanceof Map) {
    return Array.from(documents.entries()).filter(([, value]) => Boolean(value));
  }
  if (typeof documents.entries === "function" && typeof documents.get === "function") {
    return Array.from(documents.entries()).filter(([, value]) => Boolean(value));
  }
  return Object.entries(documents).filter(([, value]) => Boolean(value));
};

const DOCUMENT_LABELS = {
  passport: "Passport",
  oldPassport: "Old Passport",
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
  noObjectionCertificate: "No Objection Certificate",
  yellowFever: "Yellow Fever Certificate",
  covidVaccination: "COVID Vaccination Certificate",
  visaApplicationForm: "Visa Application Form",
  businessLicense: "Business License",
  companyRegistration: "Company Registration Certificate",
};

const formatDocumentKeyLabel = (key) => {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return "Document";
  if (DOCUMENT_LABELS[normalizedKey]) return DOCUMENT_LABELS[normalizedKey];

  return normalizedKey
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
};

const getDocumentLabelFromPath = (path, fallback = "Document") => {
  const fileName = String(path || "").split("/").pop() || "";
  const travelerMatch = fileName.match(/^traveler-\d+_([^._]+)/i);
  const legacyMatch = fileName.match(/^([^._]+)/);
  const docKey = travelerMatch?.[1] || legacyMatch?.[1] || "";
  return docKey ? formatDocumentKeyLabel(docKey) : fallback;
};

const Details = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const bookings = useDataStore((state) => state.bookings);
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visaFileUploading, setVisaFileUploading] = useState(false);
  const visaFileInputRef = useRef(null);
  const [expandedTravelerDocs, setExpandedTravelerDocs] = useState({});
  const [uploadSettings, setUploadSettings] = useState({
    enableGDriveUpload: true,
    enableFileUpload: true,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get("/config/upload-settings");
        if (data?.success && data.config) {
          setUploadSettings(data.config);
        }
      } catch (err) {
        console.error("Failed to fetch upload settings:", err);
      }
    };
    fetchSettings();
  }, []);

  const toggleTravelerDocuments = (travelerNo) => {
    setExpandedTravelerDocs((prev) => ({
      ...prev,
      [travelerNo]: !prev[travelerNo],
    }));
  };

  useEffect(() => {
    const fetchApplication = async () => {
      // Fallback for mock data
      if (id.startsWith("bk-")) {
        const mockBooking = bookings.find(b => (b.id === id || b._id === id));
        if (mockBooking) {
          setApplication({
            ...mockBooking,
            _id: mockBooking.id,
            firstName: mockBooking.userName.split(" ")[0],
            lastName: mockBooking.userName.split(" ").slice(1).join(" "),
            email: mockBooking.userEmail,
            user: {
              name: mockBooking.userName || "",
              email: mockBooking.userEmail || "",
              phone: mockBooking.userPhone || "",
              age: mockBooking.age ?? "",
              gender: mockBooking.gender || "",
            },
            dob: mockBooking.dob || "1990-01-01T00:00:00.000Z",
          });
        }
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get(`/admin/applications/${id}`);
        if (data.success) {
          setApplication(data.application);
          return;
        }
      } catch (error) {
        console.error("Failed to fetch application:", error);
        const localApplication = bookings.find((b) => (b._id === id || b.id === id));
        if (localApplication) {
          setApplication(localApplication);
          return;
        }
        showToast(error?.response?.data?.message || "Failed to load applicant data", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchApplication();
  }, [id, showToast]);

  /** Paths already shown under per-traveler cards (server also mirrors them on application.documents). */
  const applicationDocPathsInTravellers = useMemo(() => {
    const s = new Set();
    const travellers = application?.travellerDocuments;
    if (!Array.isArray(travellers)) return s;
    for (const t of travellers) {
      getTravelerDocumentEntries(t.documents).forEach(([, p]) => {
        if (p) s.add(p);
      });
      (t.otherDocuments || []).forEach((p) => {
        if (p) s.add(p);
      });
    }
    return s;
  }, [application]);

  const legacyDocumentsFiltered = useMemo(() => {
    if (!application || !Array.isArray(application.documents)) return [];
    return application.documents.filter((p) => p && !applicationDocPathsInTravellers.has(p) && !getTravelerNoFromDocumentPath(p));
  }, [application, applicationDocPathsInTravellers]);

  const legacyDocumentLabelsByPath = useMemo(() => {
    const labels = new Map();
    if (!application || !Array.isArray(legacyDocumentsFiltered) || !legacyDocumentsFiltered.length) {
      return labels;
    }

    const requiredDocuments = Array.isArray(application.requiredDocuments) && application.requiredDocuments.length
      ? application.requiredDocuments
      : ["passport"];

    legacyDocumentsFiltered.forEach((path, index) => {
      const keyFromOrder = requiredDocuments[index];
      if (keyFromOrder) {
        labels.set(path, formatDocumentKeyLabel(keyFromOrder));
        return;
      }

      labels.set(path, getDocumentLabelFromPath(path, `Document ${index + 1}`));
    });

    return labels;
  }, [application, legacyDocumentsFiltered]);

  const rootDocumentsByTraveler = useMemo(() => {
    const groups = new Map();
    if (!application || !Array.isArray(application.documents)) return groups;

    for (const path of application.documents) {
      if (!path || applicationDocPathsInTravellers.has(path)) continue;
      const travelerNo = getTravelerNoFromDocumentPath(path);
      if (!travelerNo) continue;
      const list = groups.get(travelerNo) || [];
      list.push(path);
      groups.set(travelerNo, list);
    }

    return groups;
  }, [application, applicationDocPathsInTravellers]);

  const travelerDocumentCards = useMemo(() => {
    if (!application) return [];
    const existing = Array.isArray(application.travellerDocuments) ? application.travellerDocuments : [];
    const count = Math.max(1, Number(application.travellerCount || existing.length || 1));
    const byTravelerNo = new Map(existing.map((entry, index) => [Number(entry?.travelerNo || index + 1), entry]));

    return Array.from({ length: count }, (_, index) => {
      const travelerNo = index + 1;
      return byTravelerNo.get(travelerNo) || {
        travelerNo,
        travelerName: Array.isArray(application.travelerNames) ? application.travelerNames[index] : "",
        documents: {},
        otherDocuments: [],
      };
    });
  }, [application]);

  const hasTravelerUploadedFiles = useMemo(() => {
    if (!application?.travellerDocuments) return false;
    return application.travellerDocuments.some(
      (t) =>
        getTravelerDocumentEntries(t.documents).length > 0 ||
        (Array.isArray(t.otherDocuments) && t.otherDocuments.some(Boolean))
    );
  }, [application]);

  const hasTravelerGdrive = useMemo(
    () => (application?.travellerDocuments || []).some((t) => Boolean(t?.gdriveLink)),
    [application]
  );

  const hasAnyUploadedDocs =
    Boolean(application?.gdriveLink) ||
    hasTravelerGdrive ||
    hasTravelerUploadedFiles ||
    rootDocumentsByTraveler.size > 0 ||
    legacyDocumentsFiltered.length > 0;

  const handleDownload = async (docUrl) => {
    try {
      const fullUrl = `${SERVER_URL}${docUrl}`;
      const response = await fetch(fullUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = docUrl.split("/").pop(); // Extract filename
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      showToast("Failed to download file", "error");
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    try {
      if (id.startsWith("bk-")) {
        // Fallback for mock data
        useDataStore.getState().updateBookingStatus(id, newStatus);
        setApplication(prev => ({ ...prev, status: newStatus }));
        showToast(`Application updated to ${newStatus}`, "success");
        return;
      }

      const { data } = await api.put(`/admin/applications/${id}/status`, 
        { status: newStatus }
      );
      
      if (data.success) {
        setApplication(data.application);
        showToast(`Application updated to ${newStatus}`, "success");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      showToast("Failed to update status", "error");
    }
  };

  const compressImageFile = async (file) => {
    const MAX_BYTES = 500 * 1024;
    if (file.size <= MAX_BYTES) return file;
    if (!file.type.startsWith("image/")) return file;

    const isPng = file.type === "image/png";
    const targetType = isPng ? "image/webp" : file.type;
    const url = URL.createObjectURL(file);

    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
      });
      URL.revokeObjectURL(url);

      const maxDimension = Math.max(img.width, img.height);
      const scale = maxDimension > 2000 ? 2000 / maxDimension : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      let quality = 0.85;
      let blob = await new Promise((resolve) => canvas.toBlob(resolve, targetType, quality));
      if (!blob) return file;

      while (blob.size > MAX_BYTES && quality > 0.35) {
        quality -= 0.15;
        blob = await new Promise((resolve) => canvas.toBlob(resolve, targetType, quality));
        if (!blob) return file;
      }

      if (blob.size >= file.size) {
        return file;
      }

      const extension = targetType === file.type
        ? file.name.substring(file.name.lastIndexOf("."))
        : targetType === "image/webp"
          ? ".webp"
          : ".jpg";
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      return new File([blob], `${baseName}${extension}`, { type: targetType });
    } catch (uploadError) {
      URL.revokeObjectURL(url);
      return file;
    }
  };

  const handleVisaFileUpload = async (file) => {
    if (!file) return;
    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      showToast("Only PDF, PNG, JPG, JPEG, and WEBP files are allowed.", "error");
      return;
    }

    setVisaFileUploading(true);
    try {
      const uploadFile = await compressImageFile(file);
      if (uploadFile !== file) {
        showToast("Large image compressed automatically before upload.", "info");
      }
      if (id.startsWith("bk-")) {
        // Fallback for mock data
        showToast("Cannot upload visa file for mock applications.", "info");
        setVisaFileUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append("visaFile", uploadFile);
      const { data } = await api.post(`/admin/applications/${id}/visa-file`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (data.success && data.application) {
        setApplication(data.application);
        showToast("Visa file uploaded successfully.", "success");
      }
    } catch (error) {
      console.error("Error uploading visa file:", error);
      showToast(error?.response?.data?.message || "Failed to upload visa file", "error");
    } finally {
      setVisaFileUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan"></div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <h2 className="text-2xl font-bold text-text-primary mb-4">Applicant Not Found</h2>
          <Button variant="primary" onClick={() => navigate("/")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const progress = getApplicationProgress(application, uploadSettings);
  const applicantName = application.user?.name || [application.firstName, application.lastName].filter(Boolean).join(" ") || "N/A";
  const applicantEmail = application.user?.email || application.email || "N/A";
  const applicantPhone = application.user?.phone || "";
  const applicantAge = application.user?.age ?? "";
  const applicantGender = application.user?.gender || "";
  const applicantDob = application.dob ? new Date(application.dob).toLocaleDateString() : "N/A";

  return (
    <div className="min-h-screen bg-background pb-30 ">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-8">
          <div>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors mb-4"
            >
              <ArrowLeft size={16} /> Back to Dashboard
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary flex items-center gap-3">
              Application Details
              <StatusBadge status={resolveApplicationStatus(application, progress)} />
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              Application ID: {application.applicationId || application._id} • Submitted on {new Date(application.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Main content: applicant, travel, documents */}
          <div className="space-y-6">
            <Card>
              <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-4 mb-6 flex items-center gap-2">
                <User size={18} className="text-cyan" />
                Personal Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                <div>
                  <p className="text-sm text-text-muted mb-1">Full Name</p>
                  <p className="font-medium text-text-primary">{applicantName}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Email Address</p>
                  <p className="font-medium text-text-primary flex items-center gap-2">
                    {applicantEmail}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1 flex items-center gap-1">
                    <Phone size={12} className="opacity-70" /> Mobile
                  </p>
                  <p className="font-medium text-text-primary">
                    {applicantPhone
                      ? String(applicantPhone).replace(/\D/g, "").length === 10
                        ? `+91 ${String(applicantPhone).replace(/\D/g, "").slice(0, 5)} ${String(applicantPhone).replace(/\D/g, "").slice(5)}`
                        : applicantPhone
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Age</p>
                  <p className="font-medium text-text-primary">{applicantAge || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Gender</p>
                  <p className="font-medium text-text-primary">{applicantGender || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Date of Birth</p>
                  <p className="font-medium text-text-primary">{applicantDob}</p>
                </div>
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-4 mb-6 flex items-center gap-2">
                <Plane size={18} className="text-cyan" />
                Travel Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                <div>
                  <p className="text-sm text-text-muted mb-1">Destination</p>
                  <p className="font-medium text-text-primary text-lg flex items-center gap-2">
                    {application.flagEmoji} {application.countryName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Visa Type</p>
                  <p className="font-medium text-text-primary">{application.visaType}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Intended Arrival</p>
                  <p className="font-medium text-text-primary">{new Date(application.travelDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Intended Return</p>
                  <p className="font-medium text-text-primary">
                    {application.returnDate ? new Date(application.returnDate).toLocaleDateString() : "Not Specified"}
                  </p>
                </div>
              </div>
            </Card>

            {String(application.applicantNotes || "").trim() && (
              <Card>
                <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-4 mb-4 flex items-center gap-2">
                  <MessageSquare size={18} className="text-cyan" />
                  Further information
                </h2>
                <div className="rounded-xl border border-border bg-surface-2 p-4">
                  <p className="whitespace-pre-wrap text-sm text-text-primary">
                    {application.applicantNotes}
                  </p>
                </div>
              </Card>
            )}

            <Card>
              <div className={`rounded-xl border p-4 mb-5 ${progress.allDocumentsUploaded ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
                <p className="text-xs text-text-muted">Document completion</p>
                <p className={`text-sm font-semibold mt-1 ${progress.allDocumentsUploaded ? "text-emerald-400" : "text-amber-400"}`}>
                  {progress.allDocumentsUploaded
                    ? "All required documents uploaded."
                    : `${progress.totalMissingDocuments} required document${progress.totalMissingDocuments === 1 ? "" : "s"} still missing.`}
                </p>
              </div>
              <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-4 mb-4 flex items-center gap-2">
                <FileText size={18} className="text-emerald-400" />
                Uploaded Documents
              </h2>

              {travelerDocumentCards.length > 0 && (
                <div className="grid grid-cols-1 gap-3 mb-5 items-start">
                  {travelerDocumentCards.map((traveler, idx) => {
                    const travelerNo = Number(traveler.travelerNo || idx + 1);
                    const isSingleTravelerApplication = travelerDocumentCards.length === 1;
                    const rootDocs = rootDocumentsByTraveler.get(travelerNo) || [];
                    const effectiveRootDocs =
                      travelerNo === 1
                        ? [...rootDocs, ...legacyDocumentsFiltered]
                        : rootDocs;
                    const effectiveGdriveLink =
                      traveler.gdriveLink ||
                      (travelerNo === 1 && isSingleTravelerApplication ? application.gdriveLink || "" : "");
                    const effectiveFurtherInfoLink =
                      traveler.gdriveFurtherInfoLink ||
                      (travelerNo === 1 && isSingleTravelerApplication ? application.gdriveFurtherInfoLink || "" : "");
                    const documentEntries = getTravelerDocumentEntries(traveler.documents);
                    const otherDocs = Array.isArray(traveler.otherDocuments)
                      ? traveler.otherDocuments.filter(Boolean)
                      : [];
                    const hasTravelerDocs =
                      documentEntries.length > 0 ||
                      otherDocs.length > 0 ||
                      effectiveRootDocs.length > 0 ||
                      Boolean(effectiveGdriveLink) ||
                      Boolean(effectiveFurtherInfoLink);
                    const isExpanded = Boolean(expandedTravelerDocs[travelerNo]);

                    return (
                    <div key={`traveler-docs-${idx}`} className="rounded-xl border border-border bg-surface-2 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">
                            Traveler {travelerNo}
                            {traveler.travelerName ? ` - ${traveler.travelerName}` : ""}
                          </p>
                          <p className="text-[11px] text-text-muted">
                            {hasTravelerDocs ? "Uploaded documents available" : "Documents aren't uploaded"}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => toggleTravelerDocuments(travelerNo)}
                        >
                          {isExpanded ? "Hide Documents" : "View Documents"}
                        </Button>
                      </div>
                      {isExpanded && (
                        <div className="mt-3 border-t border-border/60 pt-3">
                          {!hasTravelerDocs ? (
                            <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
                              Documents aren't uploaded for this traveler.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {documentEntries.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                  {documentEntries.map(([labelKey, path]) => {
                                    const fileName = String(path).split("/").pop();
                                    const documentLabel = formatDocumentKeyLabel(labelKey);
                                    return (
                                      <div
                                        key={`${traveler.travelerNo}-${labelKey}`}
                                        className="flex items-start justify-between gap-2 rounded-lg border border-border bg-background/40 px-2 py-2 text-[11px] text-text-secondary"
                                      >
                                        <div className="flex min-w-0 items-start gap-2">
                                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-cyan">
                                            <FileText size={14} />
                                          </span>
                                          <div className="min-w-0">
                                            <span className="font-medium text-text-primary block truncate mb-0.5">{documentLabel}</span>
                                            <span className="truncate block">{fileName}</span>
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleDownload(path)}
                                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-text-primary hover:border-cyan/40 hover:text-cyan"
                                          title={`Download ${documentLabel}`}
                                          aria-label={`Download ${documentLabel}`}
                                        >
                                          <Download size={14} />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                      {otherDocs.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[11px] text-text-muted mb-1.5">Other Documents ({otherDocs.length})</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                            {otherDocs.map((path, docIdx) => {
                              const fileName = String(path).split("/").pop();
                              return (
                                <div
                                  key={`other-doc-${traveler.travelerNo || idx}-${docIdx}`}
                                  className="flex items-start justify-between gap-2 rounded-lg border border-border bg-background/40 px-2 py-2 text-[11px] text-text-secondary"
                                >
                                  <div className="flex min-w-0 items-start gap-2">
                                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-cyan">
                                      <FileText size={14} />
                                    </span>
                                    <div className="min-w-0">
                                      <span className="font-medium text-text-primary block truncate mb-0.5">Other Document {docIdx + 1}</span>
                                      <span className="truncate block">{fileName}</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDownload(path)}
                                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-text-primary hover:border-cyan/40 hover:text-cyan"
                                    title={`Download other document ${docIdx + 1}`}
                                    aria-label={`Download other document ${docIdx + 1}`}
                                  >
                                    <Download size={14} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {effectiveRootDocs.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[11px] text-text-muted mb-1.5">Uploaded Documents ({effectiveRootDocs.length})</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                            {effectiveRootDocs.map((path, docIdx) => {
                              const fileName = String(path).split("/").pop();
                              const documentLabel =
                                legacyDocumentLabelsByPath.get(path) ||
                                getDocumentLabelFromPath(path, `Document ${docIdx + 1}`);
                              return (
                                <div
                                  key={`root-doc-${travelerNo}-${docIdx}`}
                                  className="flex items-start justify-between gap-2 rounded-lg border border-border bg-background/40 px-2 py-2 text-[11px] text-text-secondary"
                                >
                                  <div className="flex min-w-0 items-start gap-2">
                                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-cyan">
                                      <FileText size={14} />
                                    </span>
                                    <div className="min-w-0">
                                      <span className="font-medium text-text-primary block truncate mb-0.5">{documentLabel}</span>
                                      <span className="truncate block">{fileName}</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDownload(path)}
                                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-text-primary hover:border-cyan/40 hover:text-cyan"
                                    title={`Download ${documentLabel}`}
                                    aria-label={`Download ${documentLabel}`}
                                  >
                                    <Download size={14} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {effectiveGdriveLink && (
                        <div className="mt-2 p-2 bg-cyan/10 border border-cyan/30 rounded-lg flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Link size={16} className="text-cyan" />
                            <div className="text-[11px] text-text-primary font-medium truncate">
                              {effectiveGdriveLink}
                            </div>
                          </div>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="h-7 text-[10px] px-2"
                            onClick={() => window.open(effectiveGdriveLink, "_blank")}
                          >
                            Open
                          </Button>
                        </div>
                      )}
                      {effectiveFurtherInfoLink && (
                        <div className="mt-2 p-2 bg-surface-3 border border-border rounded-lg flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Link size={16} className="text-text-secondary shrink-0" />
                            <div className="text-[11px] text-text-primary font-medium truncate">
                              Further info: {effectiveFurtherInfoLink}
                            </div>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 text-[10px] px-2 shrink-0"
                            onClick={() => window.open(effectiveFurtherInfoLink, "_blank")}
                          >
                            Open
                          </Button>
                        </div>
                      )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}

              {!hasAnyUploadedDocs && travelerDocumentCards.length === 0 && (
                <p className="text-sm text-text-muted text-center py-6">No documents were uploaded.</p>
              )}
            </Card>
          </div>

          {/* Financial + Visa side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="flex min-h-[280px] flex-col">
              <h3 className="mb-4 shrink-0 border-b border-border pb-3 font-semibold text-text-primary">
                Financial Overview
              </h3>
              <ul className="min-h-0 flex-1 space-y-3 text-sm">
                <li className="flex justify-between">
                  <span className="text-text-secondary">Fee Paid</span>
                  <span className="font-medium text-text-primary">₹{application.fee}.00</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-text-secondary">Application ID</span>
                  <span className="font-mono text-xs bg-surface-3 px-2 py-1 rounded text-text-primary">
                    {application.applicationId || application._id}
                  </span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-text-secondary">Transaction ID</span>
                  <span className="font-mono text-xs bg-surface-3 px-2 py-1 rounded text-text-primary">
                    {application.transactionId || application.paymentIntentId || "N/A"}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-text-secondary">Payment Method</span>
                  <span className="font-medium text-text-primary flex items-center gap-1.5">
                    <CreditCard size={14} className="text-cyan" />
                    {application.paymentMethod || "Card (Default)"}
                  </span>
                </li>
                <li className="flex justify-between items-start gap-2">
                  <span className="text-text-secondary shrink-0">Payment</span>
                  <span className={`font-medium text-right flex items-center gap-1 justify-end ${
                    application.paymentStatus === "completed" ? "text-emerald-400" :
                    application.paymentStatus === "pending_payment" ? "text-amber-400" :
                    application.paymentStatus === "cancelled" ? "text-red-400" :
                    application.paymentStatus === "failed" ? "text-red-400" : "text-text-secondary"
                  }`}>
                    <CheckCircle size={14} className="shrink-0" />
                    {application.paymentStatus === "completed" ? "Paid" :
                      application.paymentStatus === "pending_payment" ? "Pending payment" :
                      application.paymentStatus === "cancelled" ? "Cancelled" :
                      application.paymentStatus === "failed" ? "Failed" :
                      application.paymentStatus || "—"}
                  </span>
                </li>
              </ul>

              <div className="mt-auto shrink-0 border-t border-border bg-surface pt-4">
                <Select
                  id="admin-application-status"
                  label="Application status"
                  className="h-10 min-h-[2.5rem] bg-background py-0 pr-8 leading-[2.5rem]"
                  value={
                    application.status === 'approved' || application.status === 'rejected'
                      ? application.status
                      : 'review'
                  }
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  options={[
                    { value: "review", label: "Under review" },
                    { value: "approved", label: "Approved" },
                    { value: "rejected", label: "Rejected" },
                  ]}
                />
                <p className="mt-3 text-xs text-text-muted">Applies as soon as you select an option.</p>
              </div>
            </Card>

            <Card className="flex min-h-[280px] flex-col">
              <h3 className="mb-4 shrink-0 border-b border-border pb-3 font-semibold text-text-primary">
                Visa Delivery
              </h3>
              <input
                ref={visaFileInputRef}
                type="file"
                className="sr-only"
                accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                disabled={visaFileUploading}
                onChange={(e) => {
                  handleVisaFileUpload(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />

              <div className="min-h-0 flex-1 space-y-3">
                {application.visaFilePath ? (
                  <>
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <p className="text-sm font-semibold text-emerald-400">Visa file uploaded</p>
                      <p className="mt-1 break-all text-xs text-text-muted">
                        {application.visaFileName || application.visaFilePath.split("/").pop()}
                      </p>
                      {application.visaFileUploadedAt && (
                        <p className="mt-1 text-xs text-text-muted">
                          Uploaded on {new Date(application.visaFileUploadedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      fullWidth
                      leftIcon={<Download size={14} />}
                      onClick={() => window.open(`${SERVER_URL}${application.visaFilePath}`, "_blank")}
                    >
                      Open file
                    </Button>
                  </>
                ) : (
                  <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm text-text-secondary">
                    No visa file has been sent to the applicant yet.
                  </div>
                )}
              </div>

              <div className="mt-auto shrink-0 border-t border-border bg-surface pt-4">
                <Button
                  type="button"
                  variant="primary"
                  fullWidth
                  className="bg-cyan hover:bg-cyan-dim"
                  leftIcon={<Upload size={16} />}
                  loading={visaFileUploading}
                  disabled={visaFileUploading}
                  onClick={() => visaFileInputRef.current?.click()}
                >
                  {visaFileUploading
                    ? "Uploading…"
                    : application.visaFilePath
                      ? "Replace visa file"
                      : "Upload visa file"}
                </Button>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-text-muted">
                  <UploadCloud size={14} className="shrink-0 text-cyan" />
                  PDF, PNG, JPG, JPEG, WEBP
                </p>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Details;
