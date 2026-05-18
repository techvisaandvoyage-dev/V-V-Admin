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

export const getApplicationProgress = (application, settings = { enableFileUpload: true, enableGDriveUpload: true }) => {
  const travellerCount = Math.max(1, Number(application?.travellerCount || 1));
  const requiredDocuments = Array.isArray(settings?.customRequiredDocs) && settings.customRequiredDocs.length
    ? settings.customRequiredDocs
    : Array.isArray(application?.requiredDocuments) && application.requiredDocuments.length
    ? application.requiredDocuments
    : ["passport"];
  const travellers = Array.isArray(application?.travellerDocuments) ? application.travellerDocuments : [];
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

    const docs = uploaded?.documents || {};
    const missingKeys = requiredDocuments.filter((key) => !hasStoredDocument(docs, key));
    const hasAllFiles = missingKeys.length === 0;

    // Logic: If both are enabled, we require files for "complete" status.
    // If only GDrive is enabled, Drive link is enough.
    // If only File Upload is enabled, Files are required.
    let complete = false;
    if (fileOn && gdOn) {
      complete = hasAllFiles;
    } else if (fileOn) {
      complete = hasAllFiles;
    } else if (gdOn) {
      complete = hasDriveLink;
    }

    return {
      travelerNo,
      travelerName,
      missingKeys,
      missingLabels: missingKeys.map((key) => DOCUMENT_LABELS[key] || key),
      complete,
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
