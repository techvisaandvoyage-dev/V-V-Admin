import { getApplicationProgress, resolveApplicationStatus } from "./utils/applicationProgress.js";

const dummyApp = {
  applicationId: "1045634",
  status: "pending",
  paymentStatus: "completed",
  documents: [],
  travellerDocuments: [],
  requiredDocuments: ["passport"],
  travellerCount: 1,
};

const progress = getApplicationProgress(dummyApp, {});
console.log("Progress:", progress.allDocumentsUploaded);
console.log("Status:", resolveApplicationStatus(dummyApp, progress));
