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
  const singleTravellerRootDrive = travellerCount === 1 && Boolean(rootGdrive);

  const { enableFileUpload: fileOn, enableGDriveUpload: gdOn } = settings;

  const missingByTraveler = Array.from({ length: travellerCount }, (_, index) => {
    const travelerNo = index + 1;
    const uploaded = travellers.find((entry) => Number(entry?.travelerNo) === travelerNo);
    const travelerName =
      uploaded?.travelerName ||
      application?.travelerNames?.[index] ||
      `Traveler ${travelerNo}`;

    const hasTravelerGdrive = Boolean(String(uploaded?.gdriveLink || "").trim());
    const hasLegacyRootGdrive = singleTravellerRootDrive && travelerNo === 1;
    const hasDriveLink = hasTravelerGdrive || hasLegacyRootGdrive;

    const docsRaw = uploaded?.documents || {};
    const rootDocKeys = rootDocuments
      .filter((path) => Number(getTravelerNoFromDocumentPath(path)) === travelerNo)
      .map(getDocumentKeyFromPath)
      .filter(Boolean);
    // Handle both Map (via .get()) and plain object (direct access)
    const getDoc = (key) => {
      if (typeof docsRaw.get === "function") return docsRaw.get(key);
      return docsRaw[key];
    };

    const missingKeys = requiredDocuments.filter((key) => !getDoc(key) && !rootDocKeys.includes(key));
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

export const resolveApplicationStatus = (application, progress) => {
  if (!application || typeof application !== "object") return "pending";
  if (
    application.status === "approved" ||
    application.status === "rejected" ||
    application.status === "cancelled"
  ) {
    return application.status;
  }
  if (application.status === "review") {
    return "review";
  }

  const normalizedPaymentStatus = String(
    application.paymentStatus ||
    application.payment?.status ||
    application.razorpayPaymentStatus ||
    ""
  ).trim().toLowerCase();
  const isPaymentCompleted =
    application.isPaid === true ||
    ["paid", "completed", "success", "captured"].includes(normalizedPaymentStatus);

  if (isPaymentCompleted) {
    return progress?.allDocumentsUploaded ? "review" : "doc_pending";
  }

  return "pending";
};
