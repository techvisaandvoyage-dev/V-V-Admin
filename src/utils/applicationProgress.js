export const DOCUMENT_LABELS = {
  passport: "Passport",
  idCard: "Aadhaar / ID Card",
  dobCertificate: "DOB Certificate",
  photo: "Passport Photo",
  bankStatement: "Bank Statement",
  travelInsurance: "Travel Insurance",
  flightTicket: "Flight Ticket",
  hotelBooking: "Hotel Booking",
  coverLetter: "Cover Letter",
  invitationLetter: "Invitation Letter",
  employmentLetter: "Employment Letter",
  taxReturn: "ITR / Tax Return",
  marriageCertificate: "Marriage Certificate",
};

export const getApplicationProgress = (application) => {
  const travellerCount = Math.max(1, Number(application?.travellerCount || 1));
  const requiredDocuments = Array.isArray(application?.requiredDocuments) && application.requiredDocuments.length
    ? application.requiredDocuments
    : ["passport"];
  const travellers = Array.isArray(application?.travellerDocuments) ? application.travellerDocuments : [];
  const rootGdrive = String(application?.gdriveLink || "").trim();
  const singleTravellerRootDrive = travellerCount === 1 && Boolean(rootGdrive);

  const missingByTraveler = Array.from({ length: travellerCount }, (_, index) => {
    const travelerNo = index + 1;
    const uploaded = travellers.find((entry) => Number(entry?.travelerNo) === travelerNo);
    const travelerName =
      uploaded?.travelerName ||
      application?.travelerNames?.[index] ||
      `Traveler ${travelerNo}`;

    const hasTravelerGdrive = Boolean(String(uploaded?.gdriveLink || "").trim());
    const hasLegacyRootGdrive = singleTravellerRootDrive && travelerNo === 1;

    if (hasTravelerGdrive || hasLegacyRootGdrive) {
      return {
        travelerNo,
        travelerName,
        missingKeys: [],
        missingLabels: [],
        complete: true,
      };
    }

    const docs = uploaded?.documents || {};
    const missingKeys = requiredDocuments.filter((key) => !docs[key]);

    return {
      travelerNo,
      travelerName,
      missingKeys,
      missingLabels: missingKeys.map((key) => DOCUMENT_LABELS[key] || key),
      complete: missingKeys.length === 0,
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
