const Settings = require('../models/Settings');
const { loadSettingsDocument } = require('../utils/settingsDocument');

/** Strip secret JSON from admin API; expose whether server env supplies the Admin SDK key. */
const sanitizeSettingsForAdminResponse = (doc) => {
  const o = doc?.toObject ? doc.toObject() : { ...doc };
  delete o.firebaseServiceAccountJson;
  o.firebaseAdminFromEnv = Boolean(String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim());
  return o;
};

const DESTINATION_WHY_BOOK_NOW_FALLBACK = [
  'Fast document pre-check by visa specialists',
  'Transparent pricing and status updates',
  'Dedicated support throughout your application',
];

const DESTINATION_INCLUDED_FALLBACK = [
  {
    title: 'Application Form Guidance',
    description:
      'Step-by-step guidance to fill your visa application form accurately and confidently.',
    icon: 'ri-file-edit-line',
    color: 'blue',
  },
  {
    title: 'Document Checklist & Validation',
    description:
      'We provide a complete checklist and verify your documents to ensure everything is in order.',
    icon: 'ri-file-list-3-line',
    color: 'green',
  },
  {
    title: 'End-to-end Support till Submission',
    description:
      'Our experts assist you at every step until your application is successfully submitted.',
    icon: 'ri-customer-service-2-line',
    color: 'purple',
  },
];

const DESTINATION_HOW_IT_WORKS_FALLBACK = [
  {
    title: 'Apply with SprintVisa',
    description:
      'Upload your documents on SprintVisa or share over WhatsApp with our visa expert.',
  },
  {
    title: 'Experts review the documents',
    description: 'Our visa experts will verify your documents.',
  },
  {
    title: 'Prepare the application',
    description:
      'Our visa expert will help you create the application for document submission.',
  },
  {
    title: 'Visit the Visa Application Center',
    description:
      'Traveller visits their nearest Visa Application Center for document submission.',
  },
  {
    title: 'Get your visa',
    description:
      'Traveller will collect their passport from VAC or via courier with a stamped visa.',
  },
  {
    title: 'Enjoy your vacation',
    description:
      'Thanks for choosing SprintVisa and we wish you an amazing journey.',
  },
];

const DESTINATION_VISA_REQUIREMENTS_FALLBACK = [
  'Original passport valid for at least 6 months with two blank pages',
  'Recent passport-size photograph on white background',
  'Confirmed return flight tickets',
  'Hotel booking or proof of accommodation for the entire stay',
  'Bank statements showing sufficient funds for the trip',
];

const DESTINATION_FAQS_FALLBACK = [
  {
    question: 'How long does processing take?',
    answer:
      'Typical processing varies by destination — each country page lists estimated timelines based on current embassy guidance.',
  },
  {
    question: 'Can I track my application?',
    answer: 'Yes, you can track status updates from your user dashboard after applying.',
  },
  {
    question: 'Is this fee refundable?',
    answer: 'Government and service fees depend on visa policy and review stage.',
  },
];

const LANDING_HERO_HIGHLIGHTS_FALLBACK = [
  {
    title: 'Fast Processing',
    body: 'Quick application flow and updates',
  },
  {
    title: 'Trusted Guidance',
    body: 'Accurate help for every step',
  },
  {
    title: 'All-in-One Platform',
    body: 'Search, apply, track, and upload',
  },
  {
    title: 'Secure & Private',
    body: 'Your documents stay protected',
  },
];

/**
 * Admin saves one settings card at a time. The client always sends keys for that card;
 * password inputs often arrive as "" even though Mongo already has the secret (browser
 * state, tab order, or a refetch race). Never wipe an existing stored value when the
 * incoming trimmed string is empty — only a non-empty value replaces it.
 * @param {Record<string, unknown>} doc
 * @param {string} path
 * @param {unknown} incoming
 */
const assignSecretUnlessEmpty = (doc, path, incoming) => {
  if (incoming === undefined) return;
  const next = String(incoming ?? '').trim();
  if (next) doc[path] = next;
};

const sanitizeIncludedItemsList = (arr) =>
  Array.isArray(arr)
    ? arr
        .map((item) => {
          if (typeof item === 'string') {
            return {
              title: item.trim(),
              description: '',
              icon: '',
              color: 'blue',
            };
          }

          return {
            title: String(item?.title ?? '').trim(),
            description: String(item?.description ?? '').trim(),
            icon: String(item?.icon ?? '').trim(),
            color: String(item?.color ?? 'blue').trim() || 'blue',
          };
        })
        .filter((item) => item.title)
    : [];

const sanitizeLandingHeroHighlights = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => ({
      title: String(item?.title ?? '').trim(),
      body: String(item?.body ?? '').trim(),
    }))
    .filter((item) => item.title || item.body)
    .slice(0, 4);
};

const normalizeSettingsUpdatePayload = (body = {}) => ({
  ...body,
  gstEnabled:
    body.gstEnabled === undefined
      ? undefined
      : body.gstEnabled === false || body.gstEnabled === 'false'
        ? false
        : true,
  gstRate:
    body.gstRate === undefined
      ? undefined
      : Number(String(body.gstRate || '0').trim()),
  destinationWhyBookNow:
    body.destinationWhyBookNow === undefined
      ? undefined
      : Array.isArray(body.destinationWhyBookNow)
        ? body.destinationWhyBookNow.map((item) => String(item ?? '').trim()).filter(Boolean)
        : [],
  destinationIncludedItems:
    body.destinationIncludedItems === undefined
      ? []
      : sanitizeIncludedItemsList(body.destinationIncludedItems),
  destinationFaqs:
    body.destinationFaqs === undefined
      ? undefined
      : Array.isArray(body.destinationFaqs)
        ? body.destinationFaqs
            .map((item) => ({
              question: String(item?.question ?? '').trim(),
              answer: String(item?.answer ?? '').trim(),
            }))
            .filter((item) => item.question && item.answer)
        : [],
  destinationHowItWorks:
    body.destinationHowItWorks === undefined
      ? undefined
      : Array.isArray(body.destinationHowItWorks)
        ? body.destinationHowItWorks
            .map((item) => ({
              title: String(item?.title ?? '').trim(),
              description: String(item?.description ?? '').trim(),
            }))
            .filter((item) => item.title && item.description)
        : [],
  destinationVisaRequirements:
    body.destinationVisaRequirements === undefined
      ? undefined
      : Array.isArray(body.destinationVisaRequirements)
        ? body.destinationVisaRequirements.map((item) => String(item ?? '').trim()).filter(Boolean)
        : [],
  landingHeroHighlights:
    body.landingHeroHighlights === undefined
      ? undefined
      : sanitizeLandingHeroHighlights(body.landingHeroHighlights),
});

/**
 * @route   GET /api/admin/settings
 * @desc    Get global settings (Admin only)
 * @access  Private (Admin)
 */
const getSettings = async (req, res) => {
  try {
    const settings = await loadSettingsDocument();
    res.json({ success: true, settings: sanitizeSettingsForAdminResponse(settings) });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, message: 'Server error fetching settings' });
  }
};

/**
 * @route   PUT /api/admin/settings
 * @desc    Update global settings (Admin only)
 * @access  Private (Admin)
 */
const updateSettings = async (req, res) => {
  try {
    const safePayload = normalizeSettingsUpdatePayload(req.body);
    const {
      razorpayKeyId,
      razorpayKeySecret,
      firebaseApiKey,
      firebaseAuthDomain,
      firebaseProjectId,
      googleClientId,
      googleClientSecret,
      firebaseStorageBucket,
      firebaseMessagingSenderId,
      firebaseAppId,
      sms91AuthKey,
      sms91TemplateId,
      sms91OtpLength,
      smtpEmailUser,
      smtpEmailPass,
      smtpFromEmail,
      smtpEmailService,
      enableGDriveUpload,
      enableFileUpload,
      showTravelerDetails,
      customerChatEnabled,
      customerChatMode,
      customerChatLink,
      customerChatTitle,
      customerChatDescription,
      customerChatHeaderTitle,
      customerChatHeaderSubtitle,
      whatsappTemplate,
      unsplashAccessKey,
      unsplashSecretKey,
      unsplashApplicationId,
      showRequiredDocuments,
      showVisaRequirements,
      gstEnabled,
      gstRate,
      destinationWhyBookNow,
      destinationIncludedItems,
      destinationFaqs,
      destinationHowItWorks,
      destinationVisaRequirements,
      landingHeroHighlights,
    } = safePayload;
    console.log('Admin updating settings:', {
      razorpayKeyId,
      razorpayKeySecret: razorpayKeySecret ? '***' : '',
      firebaseProjectId,
      googleClientId,
      googleClientSecret: googleClientSecret ? '***' : '',
      firebaseApiKey: firebaseApiKey ? '***' : '',
      sms91AuthKey: sms91AuthKey ? '***' : '',
      sms91TemplateId,
      unsplashAccessKey: unsplashAccessKey ? '***' : '',
      unsplashSecretKey: unsplashSecretKey ? '***' : '',
      unsplashApplicationId: unsplashApplicationId || ''
    });
    
    const settings = await loadSettingsDocument();
    
    if (razorpayKeyId !== undefined) settings.razorpayKeyId = String(razorpayKeyId || '').trim();
    assignSecretUnlessEmpty(settings, 'razorpayKeySecret', razorpayKeySecret);
    assignSecretUnlessEmpty(settings, 'firebaseApiKey', firebaseApiKey);
    if (firebaseAuthDomain !== undefined) settings.firebaseAuthDomain = String(firebaseAuthDomain || '').trim();
    if (firebaseProjectId !== undefined) settings.firebaseProjectId = String(firebaseProjectId || '').trim();
    if (googleClientId !== undefined) settings.googleClientId = String(googleClientId || '').trim();
    assignSecretUnlessEmpty(settings, 'googleClientSecret', googleClientSecret);
    if (firebaseStorageBucket !== undefined) settings.firebaseStorageBucket = String(firebaseStorageBucket || '').trim();
    if (firebaseMessagingSenderId !== undefined) settings.firebaseMessagingSenderId = String(firebaseMessagingSenderId || '').trim();
    assignSecretUnlessEmpty(settings, 'firebaseAppId', firebaseAppId);
    assignSecretUnlessEmpty(settings, 'sms91AuthKey', sms91AuthKey);
    assignSecretUnlessEmpty(settings, 'sms91TemplateId', sms91TemplateId);
    if (sms91OtpLength !== undefined) {
      const normalizedOtpLength = String(sms91OtpLength || '6').trim();
      settings.sms91OtpLength = ['4', '6'].includes(normalizedOtpLength) ? normalizedOtpLength : '6';
    }
    if (smtpEmailUser !== undefined) settings.smtpEmailUser = String(smtpEmailUser || '').trim();
    assignSecretUnlessEmpty(settings, 'smtpEmailPass', smtpEmailPass);
    if (smtpFromEmail !== undefined) settings.smtpFromEmail = String(smtpFromEmail || '').trim();
    if (smtpEmailService !== undefined) {
      settings.smtpEmailService = String(smtpEmailService || '').trim();
    }
    if (enableGDriveUpload !== undefined) settings.enableGDriveUpload = Boolean(enableGDriveUpload);
    if (enableFileUpload !== undefined) settings.enableFileUpload = Boolean(enableFileUpload);
    if (showTravelerDetails !== undefined) settings.showTravelerDetails = Boolean(showTravelerDetails);
    if (customerChatEnabled !== undefined) settings.customerChatEnabled = Boolean(customerChatEnabled);
    if (customerChatMode !== undefined) settings.customerChatMode = String(customerChatMode || '').trim() || 'external_link';
    if (customerChatLink !== undefined) settings.customerChatLink = String(customerChatLink || '').trim();
    if (customerChatTitle !== undefined) settings.customerChatTitle = String(customerChatTitle || '').trim();
    if (customerChatDescription !== undefined) settings.customerChatDescription = String(customerChatDescription || '').trim();
    if (customerChatHeaderTitle !== undefined) settings.customerChatHeaderTitle = String(customerChatHeaderTitle || '').trim();
    if (customerChatHeaderSubtitle !== undefined) settings.customerChatHeaderSubtitle = String(customerChatHeaderSubtitle || '').trim();
    if (whatsappTemplate !== undefined) settings.whatsappTemplate = String(whatsappTemplate || '').trim();
    if (showRequiredDocuments !== undefined) settings.showRequiredDocuments = Boolean(showRequiredDocuments);
    if (showVisaRequirements !== undefined) settings.showVisaRequirements = Boolean(showVisaRequirements);
    assignSecretUnlessEmpty(settings, 'unsplashAccessKey', unsplashAccessKey);
    assignSecretUnlessEmpty(settings, 'unsplashSecretKey', unsplashSecretKey);
    if (unsplashApplicationId !== undefined) settings.unsplashApplicationId = String(unsplashApplicationId || '').trim();
    if (gstEnabled !== undefined) settings.gstEnabled = Boolean(gstEnabled);
    if (gstRate !== undefined) {
      const nextRate = Number.isFinite(Number(gstRate)) ? Number(gstRate) : 0;
      settings.gstRate = nextRate >= 0 ? nextRate : 0;
    }

    if (destinationWhyBookNow !== undefined) {
      settings.destinationWhyBookNow = Array.isArray(destinationWhyBookNow)
        ? destinationWhyBookNow.map((s) => String(s ?? '').trim()).filter(Boolean)
        : [];
    }
    if (destinationIncludedItems !== undefined) {
      settings.destinationIncludedItems = sanitizeIncludedItemsList(destinationIncludedItems);
    }
    if (destinationFaqs !== undefined) {
      settings.destinationFaqs = Array.isArray(destinationFaqs)
        ? destinationFaqs
            .map((f) => ({
              question: String(f?.question ?? '').trim(),
              answer: String(f?.answer ?? '').trim(),
            }))
            .filter((f) => f.question && f.answer)
        : [];
    }
    if (destinationHowItWorks !== undefined) {
      settings.destinationHowItWorks = Array.isArray(destinationHowItWorks)
        ? destinationHowItWorks
            .map((s) => ({
              title: String(s?.title ?? '').trim(),
              description: String(s?.description ?? '').trim(),
            }))
            .filter((s) => s.title && s.description)
        : [];
    }
    if (destinationVisaRequirements !== undefined) {
      settings.destinationVisaRequirements = Array.isArray(destinationVisaRequirements)
        ? destinationVisaRequirements.map((s) => String(s ?? '').trim()).filter(Boolean)
        : [];
    }
    if (landingHeroHighlights !== undefined) {
      settings.landingHeroHighlights = sanitizeLandingHeroHighlights(landingHeroHighlights);
    }

    await settings.save();
    console.log('Settings updated successfully');
    res.json({
      success: true,
      settings: sanitizeSettingsForAdminResponse(settings),
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error updating settings' });
  }
};

/**
 * @route   GET /api/config/razorpay
 * @desc    Get public Razorpay Key ID (Public/User)
 * @access  Public
 */
const getRazorpayKeyId = async (req, res) => {
  try {
    const settings = await loadSettingsDocument();
    const keyIdFromSettings = String(settings?.razorpayKeyId || '').trim();
    const keyIdFromEnv = String(process.env.RAZORPAY_KEY_ID || '').trim();
    const keyId = keyIdFromSettings || keyIdFromEnv;

    if (!keyId) {
      return res.json({ success: false, message: 'Razorpay keys not configured' });
    }
    res.json({ success: true, keyId });
  } catch (error) {
    console.error('Error fetching Razorpay Key ID:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @route   GET /api/config/firebase
 * @desc    Get public Firebase web config for the client app
 * @access  Public
 */
const getPaymentConfig = async (req, res) => {
  try {
    const settings = await loadSettingsDocument();
    const keyIdFromSettings = String(settings?.razorpayKeyId || '').trim();
    const keyIdFromEnv = String(process.env.RAZORPAY_KEY_ID || '').trim();
    const keyId = keyIdFromSettings || keyIdFromEnv;
    const gstEnabled = settings?.gstEnabled !== false;
    const gstRate = Number.isFinite(Number(settings?.gstRate)) ? Number(settings?.gstRate) : 18;

    res.json({ success: true, keyId, gstEnabled, gstRate });
  } catch (error) {
    console.error('Error fetching payment config:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getFirebaseConfig = async (req, res) => {
  try {
    const settings = await loadSettingsDocument();
    const config = {
      apiKey: String(settings?.firebaseApiKey || process.env.FIREBASE_API_KEY || '').trim(),
      authDomain: String(settings?.firebaseAuthDomain || process.env.FIREBASE_AUTH_DOMAIN || '').trim(),
      projectId: String(settings?.firebaseProjectId || process.env.FIREBASE_PROJECT_ID || '').trim(),
      googleClientId: String(settings?.googleClientId || process.env.GOOGLE_CLIENT_ID || '').trim(),
      storageBucket: String(settings?.firebaseStorageBucket || process.env.FIREBASE_STORAGE_BUCKET || '').trim(),
      messagingSenderId: String(settings?.firebaseMessagingSenderId || process.env.FIREBASE_MESSAGING_SENDER_ID || '').trim(),
      appId: String(settings?.firebaseAppId || process.env.FIREBASE_APP_ID || '').trim(),
    };

    if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
      return res.json({ success: false, message: 'Firebase is not configured' });
    }

    res.json({ success: true, config });
  } catch (error) {
    console.error('Error fetching Firebase config:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @route   GET /api/config/upload-settings
 * @desc    Get public document upload settings (Public/User)
 * @access  Public
 */
const getUploadSettings = async (req, res) => {
  try {
    const settings = await loadSettingsDocument();
    const config = {
      enableGDriveUpload: settings?.enableGDriveUpload !== false,
      enableFileUpload: settings?.enableFileUpload !== false,
      showTravelerDetails: settings?.showTravelerDetails !== false,
    };
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error fetching upload settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @route   GET /api/config/destination-content
 * @desc    Global "Why book now?" + "What's included" + FAQs for all destination detail pages.
 *          Per-country overrides on `Country` take precedence on the client.
 * @access  Public
 */
const getDestinationPageContent = async (req, res) => {
  try {
    const settings = await loadSettingsDocument();
    const rawWhy = settings?.destinationWhyBookNow;
    const whyBookNow =
      Array.isArray(rawWhy) && rawWhy.length
        ? rawWhy.map((s) => String(s ?? '').trim()).filter(Boolean)
        : DESTINATION_WHY_BOOK_NOW_FALLBACK;
    const rawInc = settings?.destinationIncludedItems;
    const included =
      Array.isArray(rawInc) && rawInc.length
        ? sanitizeIncludedItemsList(rawInc)
        : DESTINATION_INCLUDED_FALLBACK;
    const rawFaqs = settings?.destinationFaqs;
    const faqs =
      Array.isArray(rawFaqs) && rawFaqs.length
        ? rawFaqs
            .map((f) => ({
              question: String(f?.question ?? '').trim(),
              answer: String(f?.answer ?? '').trim(),
            }))
            .filter((f) => f.question && f.answer)
        : DESTINATION_FAQS_FALLBACK;
    const rawHow = settings?.destinationHowItWorks;
    const howItWorks =
      Array.isArray(rawHow) && rawHow.length
        ? rawHow
            .map((s) => ({
              title: String(s?.title ?? '').trim(),
              description: String(s?.description ?? '').trim(),
            }))
            .filter((s) => s.title && s.description)
        : DESTINATION_HOW_IT_WORKS_FALLBACK;
    const rawVisaReq = settings?.destinationVisaRequirements;
    const visaRequirements =
      Array.isArray(rawVisaReq) && rawVisaReq.length
        ? rawVisaReq.map((s) => String(s ?? '').trim()).filter(Boolean)
        : DESTINATION_VISA_REQUIREMENTS_FALLBACK;
    const rawLandingHighlights = settings?.landingHeroHighlights;
    const landingHeroHighlights =
      Array.isArray(rawLandingHighlights) && rawLandingHighlights.length
        ? sanitizeLandingHeroHighlights(rawLandingHighlights)
        : LANDING_HERO_HIGHLIGHTS_FALLBACK;
    const showVisaRequirements = settings?.showVisaRequirements !== false;

    res.json({
      success: true,
      config: {
        whyBookNow,
        included,
        faqs,
        howItWorks,
        visaRequirements,
        showVisaRequirements,
        landingHeroHighlights,
      },
    });
  } catch (error) {
    console.error('Error fetching destination page content:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getCustomerChatConfig = async (req, res) => {
  try {
    const settings = await loadSettingsDocument();
    res.json({
      success: true,
      config: {
        enabled: settings?.customerChatEnabled !== false,
        mode: String(settings?.customerChatMode || 'external_link').trim() || 'external_link',
        link: String(settings?.customerChatLink || '').trim(),
        title: String(settings?.customerChatTitle || '').trim() || 'Continue with Chat',
        description:
          String(settings?.customerChatDescription || '').trim() ||
          'Get instant support from our visa team',
        headerTitle: String(settings?.customerChatHeaderTitle || '').trim() || 'Chat with us',
        headerSubtitle:
          String(settings?.customerChatHeaderSubtitle || '').trim() ||
          'We typically reply in a few minutes',
        whatsappTemplate: String(settings?.whatsappTemplate || '').trim() ||
          'Hello Visa & Voyage Team,\nI need help with my visa application.\n\nName: {{userName}}\nCountry: {{country}}\nVisa Type: {{visaType}}\nTravel Date: {{travelDate}}\nApplication ID: {{applicationId}}\n\nPlease guide me.',
      },
    });
  } catch (error) {
    console.error('Error fetching customer chat config:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @route   GET /api/config/site-state
 * @desc    Public runtime site flags for the client app shell
 * @access  Public
 */
const getSiteState = async (req, res) => {
  try {
    const settings = await loadSettingsDocument();
    res.json({
      success: true,
      config: {
        maintenanceModeEnabled: settings?.maintenanceModeEnabled === true,
      },
    });
  } catch (error) {
    console.error('Error fetching site state:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  getRazorpayKeyId,
  getPaymentConfig,
  getFirebaseConfig,
  getUploadSettings,
  getDestinationPageContent,
  getSiteState,
  getCustomerChatConfig,
};
