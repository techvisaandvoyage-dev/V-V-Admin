import { SERVER_URL } from "../store/authStore";
import { 
  DESTINATION_PAGE_DEFAULT_WHY_BOOK_NOW,
  DESTINATION_PAGE_DEFAULT_INCLUDED,
  DESTINATION_PAGE_DEFAULT_FAQS,
  DESTINATION_PAGE_DEFAULT_HOW_IT_WORKS,
  DESTINATION_PAGE_DEFAULT_VISA_REQUIREMENTS_FLAT
} from "../constants/defaults";

/** Resolve `Country.imageUrl` for `<img src>` (https vs relative upload path). */
export const resolveCountryBannerSrc = (imageUrl) => {
  const u = String(imageUrl || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  const base = SERVER_URL.replace(/\/+$/, "");
  return `${base}${u.startsWith("/") ? u : `/${u}`}`;
};

export const bannerSourceLabel = (imageUrl) => {
  const u = String(imageUrl || "");
  if (/unsplash\.com/i.test(u)) return "Unsplash";
  if (u.startsWith("/uploads/") || /\/uploads\//i.test(u)) return "Upload";
  return "Other URL";
};

export const normDestKey = (s) => String(s ?? "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");

export const mapDestinationWhyBookNowFromApi = (s) => {
  const a = s?.destinationWhyBookNow;
  return Array.isArray(a) && a.length
    ? a.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [...DESTINATION_PAGE_DEFAULT_WHY_BOOK_NOW];
};

export const safeMapIncludedItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((x) => {
    if (typeof x === "string") {
      return { title: x.trim(), description: "", icon: "", color: "blue" };
    }
    return {
      title: String(x?.title ?? "").trim(),
      description: String(x?.description ?? "").trim(),
      icon: String(x?.icon ?? "").trim(),
      color: String(x?.color ?? "blue").trim(),
    };
  });
};

export const mapDestinationIncludedFromApi = (s) => {
  const a = s?.destinationIncludedItems;
  if (Array.isArray(a) && a.length) {
    return safeMapIncludedItems(a);
  }
  return DESTINATION_PAGE_DEFAULT_INCLUDED.map((f) => ({ ...f }));
};

export const mapDestinationFaqsFromApi = (s) => {
  const a = s?.destinationFaqs;
  if (Array.isArray(a) && a.length) {
    return a.map((f) => ({
      question: String(f?.question ?? "").trim(),
      answer: String(f?.answer ?? "").trim(),
    }));
  }
  return DESTINATION_PAGE_DEFAULT_FAQS.map((f) => ({ ...f }));
};

export const mapDestinationHowItWorksFromApi = (s) => {
  const a = s?.destinationHowItWorks;
  if (Array.isArray(a) && a.length) {
    return a.map((x) => ({
      title: String(x?.title ?? "").trim(),
      description: String(x?.description ?? "").trim(),
    }));
  }
  return DESTINATION_PAGE_DEFAULT_HOW_IT_WORKS.map((x) => ({ ...x }));
};

export const mapDestinationVisaRequirementsFromApi = (s) => {
  const a = s?.destinationVisaRequirements;
  return Array.isArray(a) && a.length
    ? a.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [...DESTINATION_PAGE_DEFAULT_VISA_REQUIREMENTS_FLAT];
};

export const mapApiSettingsToFormState = (s) => ({
  razorpayKeyId: s.razorpayKeyId || "",
  razorpayKeySecret: s.razorpayKeySecret || "",
  firebaseApiKey: s.firebaseApiKey || "",
  firebaseAuthDomain: s.firebaseAuthDomain || "",
  firebaseProjectId: s.firebaseProjectId || "",
  googleClientId: s.googleClientId || "",
  googleClientSecret: s.googleClientSecret || "",
  firebaseStorageBucket: s.firebaseStorageBucket || "",
  firebaseMessagingSenderId: s.firebaseMessagingSenderId || "",
  firebaseAppId: s.firebaseAppId || "",
  firebaseAdminFromEnv: Boolean(s.firebaseAdminFromEnv),
  sms91AuthKey: s.sms91AuthKey || "",
  sms91TemplateId: s.sms91TemplateId || "",
  sms91OtpLength: s.sms91OtpLength || "6",
  smtpEmailUser: s.smtpEmailUser || "",
  smtpEmailPass: s.smtpEmailPass || "",
  smtpEmailService: s.smtpEmailService?.trim() || "gmail",
  enableGDriveUpload: s.enableGDriveUpload !== false,
  enableFileUpload: s.enableFileUpload !== false,
  unsplashApplicationId: s.unsplashApplicationId || "",
  unsplashAccessKey: s.unsplashAccessKey || "",
  unsplashSecretKey: s.unsplashSecretKey || "",
  destinationWhyBookNow: mapDestinationWhyBookNowFromApi(s),
  destinationIncludedItems: mapDestinationIncludedFromApi(s),
  destinationFaqs: mapDestinationFaqsFromApi(s),
  destinationHowItWorks: mapDestinationHowItWorksFromApi(s),
  destinationVisaRequirements: mapDestinationVisaRequirementsFromApi(s),
});

export const integrationFlagsFromSettings = (s) => {
  const hasFirebasePublicConfig = Boolean(
    s.firebaseApiKey?.trim() &&
      s.firebaseAuthDomain?.trim() &&
      s.firebaseProjectId?.trim() &&
      s.firebaseAppId?.trim(),
  );
  return {
    isRazorpayConfigured: Boolean(s.razorpayKeyId?.trim() && s.razorpayKeySecret?.trim()),
    isFirebaseConfigured: hasFirebasePublicConfig && Boolean(s.firebaseAdminFromEnv),
    isSmtpConfigured: Boolean(s.smtpEmailUser?.trim() && s.smtpEmailPass?.trim()),
    isSms91Configured: Boolean(s.sms91AuthKey?.trim() && s.sms91TemplateId?.trim()),
    isUnsplashConfigured: Boolean(s.unsplashAccessKey?.trim()),
  };
};
