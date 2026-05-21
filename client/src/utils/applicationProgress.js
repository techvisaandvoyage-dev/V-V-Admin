export const DOCUMENT_LABELS = {
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

const hasStoredDocument = (docs, key) => {
  if (!docs || !key) return false;
  if (docs instanceof Map) return Boolean(docs.get(key));
  if (typeof docs.get === "function") return Boolean(docs.get(key));
  if (typeof docs === "object") return Boolean(docs[key]);
  return false;
};

const getStoredDocumentValue = (docs, key) => {
  if (!docs || !key) return "";
  if (docs instanceof Map) return String(docs.get(key) || "").trim();
  if (typeof docs.get === "function") return String(docs.get(key) || "").trim();
  if (typeof docs === "object") return String(docs[key] || "").trim();
  return "";
};

const resolveVisibleRequiredDocuments = (rawRequiredDocuments = [], settings = {}) => {
  const incoming = Array.isArray(rawRequiredDocuments) && rawRequiredDocuments.length
    ? rawRequiredDocuments
    : ["passport"];
  const normalized = incoming.map((key) => String(key || "").trim()).filter(Boolean);
  const unique = Array.from(new Set(normalized));
  const optionalKeys = settings?.enableFileUpload === false
    ? []
    : unique.filter((key) => key !== "passport");
  return ["passport", ...optionalKeys];
};

const getTravelerNoFromDocumentPath = (path) => {
  const fileName = String(path || "").split("/").pop() || "";
  const match = fileName.match(/^traveler-(\d+)_/i);
  return match ? Number(match[1]) : null;
};

const getDocumentKeyFromPath = (path) => {
  const fileName = String(path || "").split("/").pop() || "";
  const match = fileName.match(/^traveler-\d+_([^._]+)/i);
  return match ? String(match[1] || "").trim() : "";
};

export const getApplicationProgress = (application, settings = { enableFileUpload: true, enableGDriveUpload: true }) => {
  const travellerCount = Math.max(1, Number(application?.travellerCount || 1));
  const requiredDocuments = resolveVisibleRequiredDocuments(
    Array.isArray(settings?.customRequiredDocs) && settings.customRequiredDocs.length
      ? settings.customRequiredDocs
      : Array.isArray(application?.requiredDocuments) && application.requiredDocuments.length
        ? application.requiredDocuments
        : ["passport"],
    settings
  );
  const travellers = Array.isArray(application?.travellerDocuments) ? application.travellerDocuments : [];
  const rootDocuments = Array.isArray(application?.documents) ? application.documents.filter(Boolean) : [];
  const rootGdrive = String(application?.gdriveLink || "").trim();
  const sharedRootDrive = Boolean(rootGdrive);

  const { enableFileUpload: fileOn, enableGDriveUpload: gdOn } = settings;

  const missingByTraveler = Array.from({ length: travellerCount }, (_, index) => {
    const travelerNo = index + 1;
    const uploaded = travellers.find((entry) => Number(entry?.travelerNo) === travelerNo);
    const travelerName =
      uploaded?.travelerName ||
      application?.travelerNames?.[index] ||
      `Traveler ${travelerNo}`;

    const hasTravelerGdrive = Boolean(String(uploaded?.gdriveLink || "").trim());
    const hasDriveLink = sharedRootDrive || hasTravelerGdrive;

    const docs = uploaded?.documents || {};
    const rootDocKeys = rootDocuments
      .filter((path) => Number(getTravelerNoFromDocumentPath(path)) === travelerNo)
      .map(getDocumentKeyFromPath)
      .filter(Boolean);
    const missingKeys = requiredDocuments.filter((key) => !hasStoredDocument(docs, key) && !rootDocKeys.includes(key));
    const hasAllFiles = missingKeys.length === 0;

    return {
      travelerNo,
      travelerName,
      missingKeys,
      missingLabels: missingKeys.map((key) => DOCUMENT_LABELS[key] || key),
      complete: hasAllFiles,
    };
  });

  return {
    travellerCount,
    requiredDocuments,
    uploadedTravelerCount: missingByTraveler.filter((item) => item.complete).length,
    totalMissingDocuments: missingByTraveler.reduce((sum, item) => sum + item.missingKeys.length, 0),
    missingByTraveler,
    allDocumentsUploaded: missingByTraveler.every((item) => item.complete),
  };
};

export const getDerivedApplicationProgress = (
  application,
  requiredDocumentKeys = [],
  settings = { enableFileUpload: true, enableGDriveUpload: true },
  uploadedDocSuccesses = {}
) => {
  if (!application || typeof application !== "object") {
    return {
      allDocumentsUploaded: false,
      totalMissingDocuments: 0,
      hasDriveLink: false,
    };
  }

  const travellerCount = Math.max(1, Number(application?.travellerCount || 1));
  const travellers = Array.isArray(application?.travellerDocuments) ? application.travellerDocuments : [];
  const rootDocuments = Array.isArray(application?.documents) ? application.documents.filter(Boolean) : [];
  const requiredDocuments = resolveVisibleRequiredDocuments(
    Array.isArray(requiredDocumentKeys) && requiredDocumentKeys.length
      ? requiredDocumentKeys
      : Array.isArray(application?.requiredDocuments) && application.requiredDocuments.length
        ? application.requiredDocuments
        : ["passport"],
    settings
  );
  const rootGdrive = String(application?.gdriveLink || "").trim();
  const hasDriveLink = Boolean(
    settings?.enableGDriveUpload &&
      (rootGdrive.length > 0 ||
        travellers.some((entry) => typeof entry?.gdriveLink === "string" && entry.gdriveLink.trim().length > 0))
  );

  let totalMissingDocuments = 0;
  for (let travelerNo = 1; travelerNo <= travellerCount; travelerNo += 1) {
    const uploadedTraveler = travellers.find((entry) => Number(entry?.travelerNo) === travelerNo);
    const savedDocuments = uploadedTraveler?.documents;
    const rootDocKeys = rootDocuments
      .filter((path) => Number(getTravelerNoFromDocumentPath(path)) === travelerNo)
      .map(getDocumentKeyFromPath)
      .filter(Boolean);
    const missingCount = requiredDocuments.filter((key) => {
      const savedValue = getStoredDocumentValue(savedDocuments, key);
      const localSuccess = uploadedDocSuccesses[`${travelerNo}-${key}`];
      return !savedValue && !localSuccess && !rootDocKeys.includes(key);
    }).length;
    totalMissingDocuments += missingCount;
  }

  return {
    allDocumentsUploaded: totalMissingDocuments === 0,
    totalMissingDocuments,
    hasDriveLink,
  };
};

export const resolveApplicationStatus = (
  application,
  derivedProgress = { allDocumentsUploaded: false }
) => {
  if (!application || typeof application !== "object") return "pending";
  if (
    application.status === "approved" ||
    application.status === "rejected" ||
    application.status === "cancelled" ||
    application.status === "review"
  ) {
    return application.status;
  }
  if (application.paymentStatus === "completed") {
    return derivedProgress.allDocumentsUploaded ? "review" : "doc_pending";
  }
  return "pending";
};
