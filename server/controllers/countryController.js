const Country = require('../models/Country');
const Settings = require('../models/Settings');
const { processUnsplashCountryImageBatch } = require('../services/unsplashCountryImages');
const { loadSettingsDocument } = require('../utils/settingsDocument');

const mongoose = require('mongoose');

/**
 * Built-in catalog of document types every deployment ships with. Admin can
 * extend this via `Settings.customDocuments` (server only — the admin UI calls
 * `POST /admin/control/custom-documents` to add/remove).
 *
 * Built-in keys MUST stay stable since existing country docs reference them.
 */
const BUILT_IN_DOCUMENT_CATALOG = Object.freeze([
  // ── Identity & personal ─────────────────────────────────────────
  { key: 'passport', label: 'Passport', description: 'Valid passport with minimum 6 months validity.' },
  { key: 'oldPassport', label: 'Old / Previous Passport', description: 'Previous passport copies for travel and visa history review.' },
  { key: 'photo', label: 'Passport Photo', description: 'Recent passport-size photo matching embassy specifications.' },
  { key: 'idCard', label: 'Aadhaar / ID Card', description: 'Government-issued identity proof for applicant verification.' },
  { key: 'panCard', label: 'PAN Card', description: 'PAN card copy for identity and financial record support.' },
  { key: 'drivingLicense', label: 'Driving License', description: 'Driving license copy when accepted as supporting ID proof.' },
  { key: 'birthCertificate', label: 'Birth Certificate', description: 'Birth certificate copy for age and identity confirmation.' },
  { key: 'dobCertificate', label: 'DOB Certificate', description: 'Proof of date of birth as required by the application.' },
  { key: 'marriageCertificate', label: 'Marriage Certificate', description: 'Marriage certificate for spouse-linked visa applications.' },
  { key: 'educationCertificate', label: 'Education / Academic Records', description: 'Educational documents and academic transcripts.' },
  // ── Employment & finance ────────────────────────────────────────
  { key: 'employmentLetter', label: 'Employment Letter', description: 'Employment confirmation letter from your current employer.' },
  { key: 'offerLetter', label: 'Offer Letter', description: 'Offer or admission letter supporting the purpose of travel.' },
  { key: 'salarySlip', label: 'Salary Slip / Pay Stub', description: 'Recent salary slips to support employment and finances.' },
  { key: 'form16', label: 'Form 16', description: 'Form 16 or equivalent tax proof where applicable.' },
  { key: 'taxReturn', label: 'ITR / Tax Return', description: 'Income tax return documents to support financial eligibility.' },
  { key: 'bankStatement', label: 'Bank Statement', description: 'Recent bank statements showing stable financial capacity.' },
  { key: 'bankCertificate', label: 'Bank Solvency Certificate', description: 'Bank solvency or balance certificate from your bank.' },
  { key: 'propertyDocuments', label: 'Property Documents', description: 'Property ownership proof to strengthen home-ties evidence.' },
  // ── Travel ─────────────────────────────────────────────────────
  { key: 'travelInsurance', label: 'Travel Insurance', description: 'Travel insurance covering your planned stay and duration.' },
  { key: 'healthInsurance', label: 'Health Insurance', description: 'Health insurance proof if the destination requires it.' },
  { key: 'flightTicket', label: 'Flight Ticket', description: 'Confirmed flight itinerary or flight reservation.' },
  { key: 'hotelBooking', label: 'Hotel Booking', description: 'Confirmed hotel reservation for your stay.' },
  { key: 'itinerary', label: 'Travel Itinerary', description: 'Planned day-wise itinerary covering major travel details.' },
  // ── Letters & supporting ───────────────────────────────────────
  { key: 'coverLetter', label: 'Cover Letter', description: 'Cover letter explaining the purpose and plan of travel.' },
  { key: 'invitationLetter', label: 'Invitation Letter', description: 'Invitation letter from host, company, or family member.' },
  { key: 'sponsorLetter', label: 'Sponsor / Affidavit Letter', description: 'Sponsor letter with relationship and funding confirmation.' },
  // ── Certificates & clearances ──────────────────────────────────
  { key: 'policeClearance', label: 'Police Clearance Certificate', description: 'Police clearance certificate for background verification.' },
  { key: 'noObjectionCertificate', label: 'No Objection Certificate (NOC)', description: 'NOC from employer or institution when required.' },
  { key: 'yellowFever', label: 'Yellow Fever Certificate', description: 'Yellow fever vaccination certificate for eligible destinations.' },
  { key: 'covidVaccination', label: 'COVID Vaccination Certificate', description: 'COVID vaccination proof if the embassy asks for it.' },
  // ── Forms & business ───────────────────────────────────────────
  { key: 'visaApplicationForm', label: 'Visa Application Form', description: 'Completed visa application form signed where needed.' },
  { key: 'businessLicense', label: 'Business License', description: 'Business license copy for business or self-employed applicants.' },
  { key: 'companyRegistration', label: 'Company Registration Certificate', description: 'Company registration proof for business documentation.' },
]);
const BUILT_IN_DOCUMENT_KEYS = new Set(BUILT_IN_DOCUMENT_CATALOG.map((d) => d.key));

const sanitizeRemixIconClass = (value) => {
  const icon = String(value ?? '').trim();
  if (!icon) return '';
  return /^ri-[a-z0-9-]+$/.test(icon) ? icon : '';
};

const VISA_INFORMATION_ITEM_DEFAULTS = Object.freeze([
  {
    id: 'lengthOfStay',
    label: 'Length of Stay',
    description: 'You can stay up to the approved duration in the country.',
    icon: 'calendar',
    color: 'blue',
  },
  {
    id: 'validity',
    label: 'Validity',
    description: 'Your visa remains valid for the approved duration after issue.',
    icon: 'clock3',
    color: 'green',
  },
  {
    id: 'entry',
    label: 'Entry',
    description: 'This visa determines how many times you can enter the country.',
    icon: 'door-open',
    color: 'purple',
  },
]);

const getVisaInformationDefaultValues = (source = {}) => ({
  lengthOfStay: String(source?.lengthOfStay ?? source?.validity ?? '').trim() || 'On request',
  validity: String(source?.validity ?? '').trim() || 'On request',
  entry: String(source?.entryType ?? '').trim() || 'Single',
});

const buildDefaultVisaInformation = (source = {}) => {
  const values = getVisaInformationDefaultValues(source);
  return {
    enabled: true,
    badgeText: '100% Online Process',
    title: 'Visa Information',
    subtitle: 'A 100% online visa application process that is simple, secure and hassle-free.',
    note: 'Visa rules and conditions may change. Please check the latest requirements before applying.',
    items: VISA_INFORMATION_ITEM_DEFAULTS.map((item) => ({
      ...item,
      enabled: true,
      value: values[item.id] || '',
    })),
  };
};

const sanitizeVisaInformation = (raw, source = {}) => {
  const defaults = buildDefaultVisaInformation(source);
  const data = raw && typeof raw === 'object' ? raw : {};
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const itemsById = new Map(
    rawItems
      .map((item) => ({
        id: String(item?.id ?? '').trim(),
        enabled: item?.enabled !== false,
        label: String(item?.label ?? '').trim(),
        value: String(item?.value ?? '').trim(),
        description: String(item?.description ?? '').trim(),
        icon: String(item?.icon ?? '').trim(),
        color: String(item?.color ?? '').trim(),
      }))
      .filter((item) => item.id)
      .map((item) => [item.id, item])
  );

  return {
    enabled: data.enabled !== false,
    badgeText: String(data.badgeText ?? defaults.badgeText).trim() || defaults.badgeText,
    title: String(data.title ?? defaults.title).trim() || defaults.title,
    subtitle: String(data.subtitle ?? defaults.subtitle).trim() || defaults.subtitle,
    note: String(data.note ?? defaults.note).trim() || defaults.note,
    items: defaults.items.map((fallback) => {
      const item = itemsById.get(fallback.id);
      return {
        id: fallback.id,
        enabled: item?.enabled !== false,
        label: item?.label || fallback.label,
        value: item?.value || fallback.value,
        description: item?.description || fallback.description,
        icon: item?.icon || fallback.icon,
        color: item?.color || fallback.color,
      };
    }),
  };
};

/**
 * Convert a free-text label into a stable, prefixed key. Always starts with
 * `custom_` so it can never collide with a built-in key.
 */
const customDocumentKey = (label) => {
  const slug = String(label ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  if (!slug) return '';
  // camelCase: "medical certificate" → "medicalCertificate"
  const camel = slug.split(' ').map((w, i) =>
    i === 0 ? w : w[0].toUpperCase() + w.slice(1)
  ).join('');
  return `custom_${camel}`;
};

/**
 * Merge the built-in catalog with the admin's custom additions and return a
 * `[{ key, label, builtIn }]` array the client can use to render labels for
 * any document key the server might return.
 */
const buildDocumentCatalog = (settings) => {
  const overridesByKey = new Map(
    (Array.isArray(settings?.documentCatalogOverrides) ? settings.documentCatalogOverrides : [])
      .map((doc) => ({
        key: String(doc?.key ?? '').trim(),
        label: String(doc?.label ?? '').trim(),
        description: String(doc?.description ?? '').trim(),
        icon: sanitizeRemixIconClass(doc?.icon),
      }))
      .filter((doc) => doc.key)
      .map((doc) => [doc.key, doc])
  );
  const customs = Array.isArray(settings?.customDocuments) ? settings.customDocuments : [];
  const customDocs = customs
    .map((doc) => ({
      key: String(doc?.key ?? '').trim(),
      label: String(doc?.label ?? '').trim(),
      description: String(doc?.description ?? '').trim(),
      icon: sanitizeRemixIconClass(doc?.icon),
    }))
    .filter((d) => d.key && d.label)
    .map((d) => ({ ...d, builtIn: false }));
  const builtIns = BUILT_IN_DOCUMENT_CATALOG.map((d) => {
    const override = overridesByKey.get(d.key);
    return {
      ...d,
      label: override?.label || d.label,
      description: override?.description || d.description || '',
      icon: override?.icon || '',
      builtIn: true,
    };
  });
  // Deduplicate — admin should never be able to shadow a built-in, but be defensive.
  const seen = new Set();
  const merged = [];
  for (const d of [...builtIns, ...customDocs]) {
    if (seen.has(d.key)) continue;
    seen.add(d.key);
    merged.push(d);
  }
  return merged;
};

/**
 * Fetch (and lazily create) the singleton Settings document. Returns a plain object
 * with at least `globalVisaType` and `globalValidity` defined.
 */
const getOrCreateSettings = async () => {
  return loadSettingsDocument();
};

/**
 * Convert a stored country document into the public-facing shape consumed by every
 * card, the destination details page, and the admin edit modal.
 *
 * Resolution rules:
 *   - If `useGlobalVisaType` is true AND a non-empty `globalVisaType` exists,
 *     the response's `visaType` is the global value.
 *   - Otherwise, the response's `visaType` is whatever the country stored.
 *   - `visaTypeOverride` always exposes the raw per-country value so the admin
 *     edit modal can render the override badge / per-country edits.
 *   - Same rules for `validity`.
 */
const resolveCountryDoc = (country, settings) => {
  const obj = country?.toObject ? country.toObject() : { ...country };
  const globalBasePrice = Number(settings?.globalBasePrice);
  const globalVisaType = String(settings?.globalVisaType ?? '').trim();
  const globalValidity = String(settings?.globalValidity ?? '').trim();
  const globalLengthOfStay = String(settings?.globalLengthOfStay ?? '').trim();
  const globalEntryType = String(settings?.globalEntryType ?? '').trim();
  const globalProcessingDays = String(settings?.globalProcessingDays ?? '').trim();
  const globalRequiredDocuments = Array.isArray(settings?.globalRequiredDocuments)
    ? settings.globalRequiredDocuments.map((k) => String(k ?? '').trim()).filter(Boolean)
    : [];
  const useGlobalVisaType = obj.useGlobalVisaType !== false;
  const useGlobalValidity = obj.useGlobalValidity !== false;
  const useGlobalLengthOfStay = obj.useGlobalLengthOfStay !== false;
  const useGlobalEntryType = obj.useGlobalEntryType !== false;
  const useGlobalProcessingDays = obj.useGlobalProcessingDays !== false;
  const useGlobalBasePrice = obj.useGlobalBasePrice === true;
  const useGlobalGst = obj.useGlobalGst !== false;
  const useGlobalRequiredDocuments = obj.useGlobalRequiredDocuments !== false;
  const basePriceOverride = Number.isFinite(Number(obj.basePrice)) ? Number(obj.basePrice) : 0;
  const visaTypeOverride = String(obj.visaType ?? '').trim();
  const validityOverride = String(obj.validity ?? '').trim();
  const lengthOfStayOverride = String(obj.lengthOfStay ?? '').trim();
  const entryTypeOverride = String(obj.entryType ?? '').trim();
  const processingDaysOverride = String(obj.processingDays ?? '').trim();
  const requiredDocumentsOverride = Array.isArray(obj.requiredDocuments)
    ? obj.requiredDocuments.map((k) => String(k ?? '').trim()).filter(Boolean)
    : [];
  const resolvedGstEnabled = useGlobalGst
    ? settings?.gstEnabled !== false
    : obj.gstEnabled !== false;
  const resolvedGstRate = useGlobalGst
    ? Number.isFinite(Number(settings?.gstRate))
      ? Number(settings?.gstRate)
      : 18
    : Number.isFinite(Number(obj.gstRate))
      ? Number(obj.gstRate)
      : Number.isFinite(Number(settings?.gstRate))
        ? Number(settings?.gstRate)
        : 18;
  const resolvedBasePrice =
    useGlobalBasePrice && Number.isFinite(globalBasePrice) && globalBasePrice >= 0
      ? globalBasePrice
      : basePriceOverride;
  const resolvedVisaType =
    useGlobalVisaType && globalVisaType ? globalVisaType : visaTypeOverride || 'Tourist Visa';
  const resolvedValidity =
    useGlobalValidity && globalValidity ? globalValidity : validityOverride;
  const resolvedLengthOfStay =
    useGlobalLengthOfStay && globalLengthOfStay ? globalLengthOfStay : lengthOfStayOverride;
  const resolvedEntryType =
    useGlobalEntryType && globalEntryType ? globalEntryType : entryTypeOverride;
  const resolvedProcessingDays =
    useGlobalProcessingDays && globalProcessingDays
      ? globalProcessingDays
      : processingDaysOverride || '5-10';
  const resolvedRequiredDocuments =
    useGlobalRequiredDocuments && globalRequiredDocuments.length
      ? [...globalRequiredDocuments]
      : requiredDocumentsOverride.length
        ? requiredDocumentsOverride
        : ['passport'];
  const resolvedVisaInformation = sanitizeVisaInformation(obj.visaInformation, {
    ...obj,
    validity: resolvedValidity,
    lengthOfStay: resolvedLengthOfStay,
    entryType: resolvedEntryType,
  });
  return {
    ...obj,
    basePrice: resolvedBasePrice,
    visaType: resolvedVisaType,
    validity: resolvedValidity,
    lengthOfStay: resolvedLengthOfStay,
    entryType: resolvedEntryType,
    visaInformation: resolvedVisaInformation,
    processingDays: resolvedProcessingDays,
    requiredDocuments: resolvedRequiredDocuments,
    useGlobalVisaType,
    useGlobalValidity,
    useGlobalLengthOfStay,
    useGlobalEntryType,
    useGlobalProcessingDays,
    useGlobalBasePrice,
    useGlobalGst,
    useGlobalRequiredDocuments,
    gstEnabled: resolvedGstEnabled,
    gstRate: resolvedGstRate,
    basePriceOverride,
    visaTypeOverride,
    validityOverride,
    lengthOfStayOverride,
    entryTypeOverride,
    processingDaysOverride,
    requiredDocumentsOverride,
  };
};

/**
 * Read the four universal display toggles from Settings. Each defaults to `true`
 * so existing deployments keep showing every field until an admin explicitly hides
 * one. Used as a top-level `display` blob in public + admin country responses.
 */
const resolveDisplayToggles = (settings) => ({
  showVisaType: settings?.showVisaType !== false,
  showValidity: settings?.showValidity !== false,
  showLengthOfStay: settings?.showLengthOfStay !== false,
  showEntryType: settings?.showEntryType !== false,
  showProcessingDays: settings?.showProcessingDays !== false,
  showRequiredDocuments: settings?.showRequiredDocuments !== false,
  showVisaRequirements: settings?.showVisaRequirements !== false,
  maintenanceModeEnabled: settings?.maintenanceModeEnabled === true,
});

const slugify = (str) =>
  str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

/** Trim a string-array payload, dropping empty entries. */
const sanitizeStringList = (arr) =>
  Array.isArray(arr)
    ? arr.map((s) => String(s ?? '').trim()).filter(Boolean)
    : [];

/** Trim destination "What's included" objects, preserving shape for client/admin. */
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

/** Trim FAQ pairs, dropping rows with empty question or answer. */
const sanitizeFaqList = (arr) =>
  Array.isArray(arr)
    ? arr
        .map((f) => ({
          question: String(f?.question ?? '').trim(),
          answer: String(f?.answer ?? '').trim(),
        }))
        .filter((f) => f.question && f.answer)
    : [];

/** Trim "How it works" step pairs, dropping rows with empty title or description. */
const sanitizeHowItWorksList = (arr) =>
  Array.isArray(arr)
    ? arr
        .map((s) => ({
          title: String(s?.title ?? '').trim(),
          description: String(s?.description ?? '').trim(),
        }))
        .filter((s) => s.title && s.description)
    : [];

/** Keys for per-country hiding of global destination bullets / FAQ questions / step titles. */
const sanitizeExcludeKeys = (arr) =>
  Array.isArray(arr)
    ? arr.map((s) => String(s ?? '').trim().toLowerCase()).filter(Boolean)
    : [];

/** Find a country by MongoDB _id or by slug (fallback) */
const findCountry = (id) => {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return Country.findById(id);
  }
  return Country.findOne({ slug: id });
};

/**
 * @route   GET /api/countries
 * @desc    Get all countries (public)
 */
const getCountries = async (req, res) => {
  try {
    const [countries, settings] = await Promise.all([
      Country.find().sort({ name: 1 }),
      getOrCreateSettings(),
    ]);
    const resolved = countries.map((c) => resolveCountryDoc(c, settings));
    res.json({
      success: true,
      countries: resolved,
      display: resolveDisplayToggles(settings),
      documentCatalog: buildDocumentCatalog(settings),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @route   GET /api/countries/:slug
 * @desc    Get single country by slug (public)
 */
const getCountryBySlug = async (req, res) => {
  try {
    const [country, settings] = await Promise.all([
      Country.findOne({ slug: req.params.slug }),
      getOrCreateSettings(),
    ]);
    if (!country) return res.status(404).json({ success: false, message: 'Country not found' });
    res.json({
      success: true,
      country: resolveCountryDoc(country, settings),
      display: resolveDisplayToggles(settings),
      documentCatalog: buildDocumentCatalog(settings),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @route   POST /api/admin/countries
 * @desc    Add a new country (admin only)
 */
const addCountry = async (req, res) => {
  try {
    const {
      name, flagEmoji, basePrice, processingDays, difficulty,
      visaType, validity, lengthOfStay, entryType, continent, imageUrl, description,
      visaInformation,
      requirements, requiredDocuments, trending, successRate,
      whyBookNow, includedItems, faqs, howItWorks,
      gstEnabled, gstRate, useGlobalGst,
      excludeDestinationWhyBookNow,
      excludeDestinationIncludedItems,
      excludeDestinationFaqQuestions,
      excludeDestinationHowItWorksTitles,
      excludeDestinationVisaRequirements,
    } = req.body;

    if (!name || !basePrice) {
      return res.status(400).json({ success: false, message: 'Name and base price are required.' });
    }
    if (!Number.isFinite(Number(basePrice)) || Number(basePrice) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Base Price must be a valid number greater than or equal to 0.',
      });
    }

    const slug = slugify(name);
    const existing = await Country.findOne({ slug });
    if (existing) {
      return res.status(409).json({ success: false, message: `Country "${name}" already exists.` });
    }

    // Same "matches global = use global" auto-resolution as updateCountry below.
    const settings = await getOrCreateSettings();
    const globalVisaType = String(settings?.globalVisaType ?? '').trim();
    const globalValidity = String(settings?.globalValidity ?? '').trim();
    const globalLengthOfStay = String(settings?.globalLengthOfStay ?? '').trim();
    const globalEntryType = String(settings?.globalEntryType ?? '').trim();
    const globalProcessingDays = String(settings?.globalProcessingDays ?? '').trim();
    const globalBasePrice = Number(settings?.globalBasePrice);
    const globalRequiredDocs = Array.isArray(settings?.globalRequiredDocuments)
      ? settings.globalRequiredDocuments.map((k) => String(k ?? '').trim()).filter(Boolean)
      : [];
    const typedVisa = String(visaType ?? '').trim();
    const typedValidity = String(validity ?? '').trim();
    const typedLengthOfStay = String(lengthOfStay ?? '').trim();
    const typedEntryType = String(entryType ?? '').trim();
    const typedProcessingDays = String(processingDays ?? '').trim();
    const parsedBasePrice = Number(basePrice);
    const sanitizedVisaInformation = sanitizeVisaInformation(
      visaInformation,
      {
        validity: typedValidity,
        lengthOfStay: typedLengthOfStay,
        entryType: typedEntryType,
      }
    );
    const typedReqDocs = Array.isArray(requiredDocuments)
      ? requiredDocuments.map((k) => String(k ?? '').trim()).filter(Boolean)
      : [];
    const newUseGlobalVisaType = !typedVisa || typedVisa === globalVisaType;
    const newUseGlobalValidity = !typedValidity || typedValidity === globalValidity;
    const newUseGlobalLengthOfStay = !typedLengthOfStay || typedLengthOfStay === globalLengthOfStay;
    const newUseGlobalEntryType = !typedEntryType || typedEntryType === globalEntryType;
    const newUseGlobalProcessingDays = !typedProcessingDays || typedProcessingDays === globalProcessingDays;
    const newUseGlobalBasePrice =
      Number.isFinite(parsedBasePrice) &&
      parsedBasePrice >= 0 &&
      Number.isFinite(globalBasePrice) &&
      globalBasePrice >= 0 &&
      parsedBasePrice === globalBasePrice;
    // Treat as "same as global" when the typed set equals the global set (ignore order).
    const newUseGlobalRequiredDocuments =
      typedReqDocs.length === 0 ||
      (globalRequiredDocs.length === typedReqDocs.length &&
        new Set(globalRequiredDocs).size === globalRequiredDocs.length &&
        typedReqDocs.every((k) => globalRequiredDocs.includes(k)));

    const country = await Country.create({
      slug,
      name,
      flagEmoji: flagEmoji || '🌍',
      basePrice: parsedBasePrice,
      useGlobalBasePrice: newUseGlobalBasePrice,
      processingDays: typedProcessingDays || '5-10',
      useGlobalProcessingDays: newUseGlobalProcessingDays,
      difficulty: difficulty || 'moderate',
      visaType: typedVisa || 'Tourist Visa',
      useGlobalVisaType: newUseGlobalVisaType,
      validity: typedValidity,
      useGlobalValidity: newUseGlobalValidity,
      lengthOfStay: typedLengthOfStay,
      useGlobalLengthOfStay: newUseGlobalLengthOfStay,
      entryType: typedEntryType,
      useGlobalEntryType: newUseGlobalEntryType,
      visaInformation: sanitizedVisaInformation,
      continent: continent || 'Global',
      imageUrl: imageUrl || '',
      description: description || '',
      requirements: Array.isArray(requirements) ? requirements.filter(Boolean) : [],
      requiredDocuments: typedReqDocs.length ? typedReqDocs : ['passport'],
      useGlobalGst: useGlobalGst !== false,
      gstEnabled: gstEnabled !== undefined ? Boolean(gstEnabled) : undefined,
      gstRate: gstRate !== undefined ? (Number.isFinite(Number(gstRate)) ? Number(gstRate) : 0) : undefined,
      useGlobalRequiredDocuments: newUseGlobalRequiredDocuments,
      trending: Boolean(trending),
      successRate: Number(successRate) || 80,
      whyBookNow: sanitizeStringList(whyBookNow),
      includedItems: sanitizeIncludedItemsList(includedItems),
      faqs: sanitizeFaqList(faqs),
      howItWorks: sanitizeHowItWorksList(howItWorks),
      excludeDestinationWhyBookNow: sanitizeExcludeKeys(excludeDestinationWhyBookNow),
      excludeDestinationIncludedItems: sanitizeExcludeKeys(excludeDestinationIncludedItems),
      excludeDestinationFaqQuestions: sanitizeExcludeKeys(excludeDestinationFaqQuestions),
      excludeDestinationHowItWorksTitles: sanitizeExcludeKeys(excludeDestinationHowItWorksTitles),
      excludeDestinationVisaRequirements: sanitizeExcludeKeys(excludeDestinationVisaRequirements),
    });

    res.status(201).json({ success: true, country });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @route   PUT /api/admin/countries/:id
 * @desc    Update a country (admin only)
 */
const updateCountry = async (req, res) => {
  try {
    const {
      name, flagEmoji, basePrice, processingDays, difficulty,
      visaType, validity, lengthOfStay, entryType, continent, imageUrl, description,
      visaInformation,
      requirements, requiredDocuments, trending, successRate,
      whyBookNow, includedItems, faqs, howItWorks,
      gstEnabled, gstRate, useGlobalGst,
      excludeDestinationWhyBookNow,
      excludeDestinationIncludedItems,
      excludeDestinationFaqQuestions,
      excludeDestinationHowItWorksTitles,
      excludeDestinationVisaRequirements,
    } = req.body;

    const country = await findCountry(req.params.id);
    if (!country) return res.status(404).json({ success: false, message: 'Country not found' });

    if (name && name !== country.name) {
      country.slug = slugify(name);
    }
    if (name !== undefined) country.name = name;
    if (flagEmoji !== undefined) country.flagEmoji = flagEmoji;
    if (difficulty !== undefined) country.difficulty = difficulty;
    // Visa Type / Validity / Processing Days are part of the universal control system. The save logic:
    //   • If the admin clears the field → flip `useGlobal*` = true so the country
    //     falls back to the global default again.
    //   • If the admin types something that matches the current global → same as above
    //     (no point in storing a redundant override).
    //   • If the admin types something different → mark as a per-country override.
    if (
      basePrice !== undefined ||
      visaType !== undefined ||
      validity !== undefined ||
      lengthOfStay !== undefined ||
      entryType !== undefined ||
      processingDays !== undefined
    ) {
      const settings = await getOrCreateSettings();
      const globalVisaType = String(settings?.globalVisaType ?? '').trim();
      const globalValidity = String(settings?.globalValidity ?? '').trim();
      const globalLengthOfStay = String(settings?.globalLengthOfStay ?? '').trim();
      const globalEntryType = String(settings?.globalEntryType ?? '').trim();
      const globalProcessingDays = String(settings?.globalProcessingDays ?? '').trim();
      const globalBasePrice = Number(settings?.globalBasePrice);
      if (basePrice !== undefined) {
        const parsed = Number(basePrice);
        if (!Number.isFinite(parsed) || parsed < 0) {
          return res.status(400).json({
            success: false,
            message: 'Base Price must be a valid number greater than or equal to 0.',
          });
        }
        if (Number.isFinite(globalBasePrice) && globalBasePrice >= 0 && parsed === globalBasePrice) {
          country.useGlobalBasePrice = true;
          country.basePrice = parsed;
        } else {
          country.useGlobalBasePrice = false;
          country.basePrice = parsed;
        }
      }
      if (visaType !== undefined) {
        const typed = String(visaType ?? '').trim();
        if (!typed || typed === globalVisaType) {
          country.useGlobalVisaType = true;
          if (typed) country.visaType = typed;
        } else {
          country.useGlobalVisaType = false;
          country.visaType = typed;
        }
      }
      if (validity !== undefined) {
        const typed = String(validity ?? '').trim();
        if (!typed || typed === globalValidity) {
          country.useGlobalValidity = true;
          if (typed) country.validity = typed;
        } else {
          country.useGlobalValidity = false;
          country.validity = typed;
        }
      }
      if (lengthOfStay !== undefined) {
        const typed = String(lengthOfStay ?? '').trim();
        if (!typed || typed === globalLengthOfStay) {
          country.useGlobalLengthOfStay = true;
          if (typed) country.lengthOfStay = typed;
        } else {
          country.useGlobalLengthOfStay = false;
          country.lengthOfStay = typed;
        }
      }
      if (entryType !== undefined) {
        const typed = String(entryType ?? '').trim();
        if (!typed || typed === globalEntryType) {
          country.useGlobalEntryType = true;
          if (typed) country.entryType = typed;
        } else {
          country.useGlobalEntryType = false;
          country.entryType = typed;
        }
      }
      if (processingDays !== undefined) {
        const typed = String(processingDays ?? '').trim();
        if (!typed || typed === globalProcessingDays) {
          country.useGlobalProcessingDays = true;
          if (typed) country.processingDays = typed;
        } else {
          country.useGlobalProcessingDays = false;
          country.processingDays = typed;
        }
      }
    }
    if (useGlobalGst !== undefined) country.useGlobalGst = Boolean(useGlobalGst);
    if (gstEnabled !== undefined) country.gstEnabled = Boolean(gstEnabled);
    if (gstRate !== undefined) {
      const parsedRate = Number(gstRate);
      country.gstRate = Number.isFinite(parsedRate) && parsedRate >= 0 ? parsedRate : 0;
    }
    if (continent !== undefined) country.continent = continent;
    if (imageUrl !== undefined) country.imageUrl = imageUrl;
    if (description !== undefined) country.description = description;
    if (Array.isArray(requirements)) country.requirements = requirements.filter(Boolean);
    // Required Documents — universal control: same auto-resolve rules.
    //   • Empty array OR equal-set to global → useGlobalRequiredDocuments = true
    //   • Anything else (different members) → per-country override
    if (Array.isArray(requiredDocuments)) {
      const settings = await getOrCreateSettings();
      const globalDocs = Array.isArray(settings?.globalRequiredDocuments)
        ? settings.globalRequiredDocuments.map((k) => String(k ?? '').trim()).filter(Boolean)
        : [];
      const typed = requiredDocuments.map((k) => String(k ?? '').trim()).filter(Boolean);
      const sameAsGlobal =
        typed.length === 0 ||
        (globalDocs.length === typed.length &&
          new Set(globalDocs).size === globalDocs.length &&
          typed.every((k) => globalDocs.includes(k)));
      if (sameAsGlobal) {
        country.useGlobalRequiredDocuments = true;
        // Still persist the typed list so the override snapshot stays accurate.
        if (typed.length) country.requiredDocuments = typed;
      } else {
        country.useGlobalRequiredDocuments = false;
        country.requiredDocuments = typed;
      }
    }
    if (visaInformation !== undefined) {
      country.visaInformation = sanitizeVisaInformation(visaInformation, {
        validity: country.validity,
        lengthOfStay: country.lengthOfStay,
        entryType: country.entryType,
      });
    }
    if (trending !== undefined) country.trending = Boolean(trending);
    if (successRate !== undefined) country.successRate = Number(successRate);
    if (whyBookNow !== undefined) country.whyBookNow = sanitizeStringList(whyBookNow);
    if (includedItems !== undefined) country.includedItems = sanitizeIncludedItemsList(includedItems);
    if (faqs !== undefined) country.faqs = sanitizeFaqList(faqs);
    if (howItWorks !== undefined) country.howItWorks = sanitizeHowItWorksList(howItWorks);
    if (excludeDestinationWhyBookNow !== undefined) {
      country.excludeDestinationWhyBookNow = sanitizeExcludeKeys(excludeDestinationWhyBookNow);
    }
    if (excludeDestinationIncludedItems !== undefined) {
      country.excludeDestinationIncludedItems = sanitizeExcludeKeys(excludeDestinationIncludedItems);
    }
    if (excludeDestinationFaqQuestions !== undefined) {
      country.excludeDestinationFaqQuestions = sanitizeExcludeKeys(excludeDestinationFaqQuestions);
    }
    if (excludeDestinationHowItWorksTitles !== undefined) {
      country.excludeDestinationHowItWorksTitles = sanitizeExcludeKeys(excludeDestinationHowItWorksTitles);
    }
    if (excludeDestinationVisaRequirements !== undefined) {
      country.excludeDestinationVisaRequirements = sanitizeExcludeKeys(excludeDestinationVisaRequirements);
    }

    await country.save();
    const settings = await getOrCreateSettings();
    res.json({
      success: true,
      country: resolveCountryDoc(country, settings),
      documentCatalog: buildDocumentCatalog(settings),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @route   DELETE /api/admin/countries/:id
 * @desc    Delete a country (admin only)
 */
const deleteCountry = async (req, res) => {
  try {
    let country;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      country = await Country.findByIdAndDelete(req.params.id);
    } else {
      country = await Country.findOneAndDelete({ slug: req.params.id });
    }
    if (!country) return res.status(404).json({ success: false, message: 'Country not found' });
    res.json({ success: true, message: 'Country deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @route   POST /api/admin/countries/upload-image
 * @desc    Upload a country banner image (admin only)
 */
const uploadCountryImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file provided.' });
  }
  try {
    const { uploadToFirebase } = require('../utils/uploadOptimizer');
    const path = require('path');
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `country-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    const firebaseUrl = await uploadToFirebase(req.file.buffer, filename, req.file.mimetype);
    res.json({ success: true, url: firebaseUrl });
  } catch (error) {
    console.error('uploadCountryImage error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error uploading image to cloud storage' });
  }
};

/**
 * @route   POST /api/admin/countries/refresh-unsplash-images
 * @desc    Fetch Unsplash URLs for a batch of countries (uses Settings + env for Access Key)
 * @access  Admin
 * @body    { onlyMissing?: boolean, onlyTrending?: boolean, skip?: number, limit?: number, accessKey?: string }  limit max 50; onlyTrending targets landing "featured" rows (`trending: true`); accessKey optional override
 */
const refreshUnsplashCountryImages = async (req, res) => {
  try {
    const onlyMissing = Boolean(req.body?.onlyMissing);
    const onlyTrending = Boolean(req.body?.onlyTrending);
    const skip = Math.max(0, parseInt(String(req.body?.skip ?? '0'), 10) || 0);
    const rawLimit = parseInt(String(req.body?.limit ?? '25'), 10);
    const limit = Math.min(50, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 25));

    const accessKeyOverride = typeof req.body?.accessKey === 'string' ? req.body.accessKey : '';

    const result = await processUnsplashCountryImageBatch({
      onlyMissing,
      onlyTrending,
      skip,
      limit,
      accessKeyOverride,
    });
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('refreshUnsplashCountryImages:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

/**
 * @route   GET /api/admin/control/country-defaults
 * @desc    Universal Visa Type + Validity currently applied as the global default
 *          for every country whose override is disabled. Powers the "Update Visa
 *          Type" and "Update Validity" cards in Admin → Controls.
 * @access  Admin
 */
const getGlobalCountryDefaults = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const totalCountries = await Country.countDocuments();
    const usingGlobalBasePrice = await Country.countDocuments({
      useGlobalBasePrice: true,
    });
    const usingGlobalVisaType = await Country.countDocuments({
      $or: [{ useGlobalVisaType: { $exists: false } }, { useGlobalVisaType: true }],
    });
    const usingGlobalValidity = await Country.countDocuments({
      $or: [{ useGlobalValidity: { $exists: false } }, { useGlobalValidity: true }],
    });
    const usingGlobalLengthOfStay = await Country.countDocuments({
      $or: [{ useGlobalLengthOfStay: { $exists: false } }, { useGlobalLengthOfStay: true }],
    });
    const usingGlobalEntryType = await Country.countDocuments({
      $or: [{ useGlobalEntryType: { $exists: false } }, { useGlobalEntryType: true }],
    });
    const usingGlobalProcessingDays = await Country.countDocuments({
      $or: [{ useGlobalProcessingDays: { $exists: false } }, { useGlobalProcessingDays: true }],
    });
    const usingGlobalRequiredDocuments = await Country.countDocuments({
      $or: [{ useGlobalRequiredDocuments: { $exists: false } }, { useGlobalRequiredDocuments: true }],
    });
    const globalRequiredDocuments = Array.isArray(settings?.globalRequiredDocuments)
      ? settings.globalRequiredDocuments.map((k) => String(k ?? '').trim()).filter(Boolean)
      : [];
    res.json({
      success: true,
      defaults: {
        globalBasePrice:
          Number.isFinite(Number(settings?.globalBasePrice)) && Number(settings?.globalBasePrice) >= 0
            ? Number(settings?.globalBasePrice)
            : null,
        globalVisaType: String(settings?.globalVisaType ?? '').trim(),
        globalValidity: String(settings?.globalValidity ?? '').trim(),
        globalLengthOfStay: String(settings?.globalLengthOfStay ?? '').trim(),
        globalEntryType: String(settings?.globalEntryType ?? '').trim(),
        globalProcessingDays: String(settings?.globalProcessingDays ?? '').trim(),
        globalRequiredDocuments,
      },
      display: resolveDisplayToggles(settings),
      documentCatalog: buildDocumentCatalog(settings),
      stats: {
        totalCountries,
        usingGlobalBasePrice,
        usingGlobalVisaType,
        usingGlobalValidity,
        usingGlobalLengthOfStay,
        usingGlobalEntryType,
        usingGlobalProcessingDays,
        usingGlobalRequiredDocuments,
        overridingBasePrice: Math.max(0, totalCountries - usingGlobalBasePrice),
        overridingVisaType: Math.max(0, totalCountries - usingGlobalVisaType),
        overridingValidity: Math.max(0, totalCountries - usingGlobalValidity),
        overridingLengthOfStay: Math.max(0, totalCountries - usingGlobalLengthOfStay),
        overridingEntryType: Math.max(0, totalCountries - usingGlobalEntryType),
        overridingProcessingDays: Math.max(0, totalCountries - usingGlobalProcessingDays),
        overridingRequiredDocuments: Math.max(0, totalCountries - usingGlobalRequiredDocuments),
      },
    });
  } catch (err) {
    console.error('[control] getGlobalCountryDefaults error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

/**
 * @route   POST /api/admin/control/base-price
 * @desc    Set the universal `globalBasePrice` and flip every country's
 *          `useGlobalBasePrice=true`.
 * @access  Admin
 * @body    { basePrice: number }
 */
const updateGlobalBasePrice = async (req, res) => {
  const parsedBasePrice = Number(req.body?.basePrice);
  console.log('[control] updateGlobalBasePrice:', {
    basePrice: req.body?.basePrice,
    admin: req.user?.id || '(none)',
  });
  if (!Number.isFinite(parsedBasePrice) || parsedBasePrice < 0) {
    return res.status(400).json({
      success: false,
      message: 'Base Price must be a valid number greater than or equal to 0.',
    });
  }
  try {
    const settings = await getOrCreateSettings();
    settings.globalBasePrice = parsedBasePrice;
    await settings.save();
    const result = await Country.updateMany(
      {},
      { $set: { useGlobalBasePrice: true, basePrice: parsedBasePrice } }
    );
    res.json({
      success: true,
      globalBasePrice: parsedBasePrice,
      matched: result.matchedCount ?? result.n ?? 0,
      modified: result.modifiedCount ?? result.nModified ?? 0,
      message: `Base Price set to ₹${parsedBasePrice} on all countries.`,
    });
  } catch (err) {
    console.error('[control] updateGlobalBasePrice error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

/**
 * @route   POST /api/admin/control/visa-type
 * @desc    Set the universal `globalVisaType` and force every country to use it by
 *          flipping `useGlobalVisaType=true` everywhere. The admin can re-introduce
 *          per-country overrides later via Country Manager → Edit Country.
 * @access  Admin
 * @body    { visaType: string }
 */
const updateGlobalVisaType = async (req, res) => {
  const visaType = String(req.body?.visaType ?? '').trim();
  console.log('[control] updateGlobalVisaType:', { visaType, admin: req.user?.id || '(none)' });
  if (!visaType) {
    return res.status(400).json({
      success: false,
      message: 'Visa Type is required — pick a value or type your own.',
    });
  }
  try {
    const settings = await getOrCreateSettings();
    settings.globalVisaType = visaType;
    await settings.save();
    // Persist on every Country doc too — both flip the "use global" flag and
    // physically write the value so MongoDB reflects the universal change even
    // outside the resolve-at-read path.
    const result = await Country.updateMany(
      {},
      { $set: { useGlobalVisaType: true, visaType } }
    );
    res.json({
      success: true,
      globalVisaType: visaType,
      matched: result.matchedCount ?? result.n ?? 0,
      modified: result.modifiedCount ?? result.nModified ?? 0,
      message: `Visa Type set to "${visaType}" on all countries.`,
    });
  } catch (err) {
    console.error('[control] updateGlobalVisaType error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

/**
 * @route   POST /api/admin/control/validity
 * @desc    Mirror of `updateGlobalVisaType` but for `globalValidity`.
 * @access  Admin
 * @body    { validity: string }
 */
const updateGlobalValidity = async (req, res) => {
  const validity = String(req.body?.validity ?? '').trim();
  console.log('[control] updateGlobalValidity:', { validity, admin: req.user?.id || '(none)' });
  if (!validity) {
    return res.status(400).json({
      success: false,
      message: 'Validity is required — pick a value or type your own.',
    });
  }
  try {
    const settings = await getOrCreateSettings();
    settings.globalValidity = validity;
    await settings.save();
    const result = await Country.updateMany(
      {},
      { $set: { useGlobalValidity: true, validity } }
    );
    res.json({
      success: true,
      globalValidity: validity,
      matched: result.matchedCount ?? result.n ?? 0,
      modified: result.modifiedCount ?? result.nModified ?? 0,
      message: `Validity set to "${validity}" on all countries.`,
    });
  } catch (err) {
    console.error('[control] updateGlobalValidity error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

/**
 * @route   POST /api/admin/control/length-of-stay
 * @desc    Set the universal `globalLengthOfStay` and flip every country's
 *          `useGlobalLengthOfStay=true`.
 * @access  Admin
 * @body    { lengthOfStay: string }
 */
const updateGlobalLengthOfStay = async (req, res) => {
  const lengthOfStay = String(req.body?.lengthOfStay ?? '').trim();
  if (!lengthOfStay) {
    return res.status(400).json({
      success: false,
      message: 'Length of Stay is required — pick a value or type your own.',
    });
  }
  try {
    const settings = await getOrCreateSettings();
    settings.globalLengthOfStay = lengthOfStay;
    await settings.save();
    const result = await Country.updateMany(
      {},
      { $set: { useGlobalLengthOfStay: true, lengthOfStay } }
    );
    res.json({
      success: true,
      globalLengthOfStay: lengthOfStay,
      matched: result.matchedCount ?? result.n ?? 0,
      modified: result.modifiedCount ?? result.nModified ?? 0,
      message: `Length of Stay set to "${lengthOfStay}" on all countries.`,
    });
  } catch (err) {
    console.error('[control] updateGlobalLengthOfStay error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

/**
 * @route   POST /api/admin/control/entry-type
 * @desc    Set the universal `globalEntryType` and flip every country's
 *          `useGlobalEntryType=true`.
 * @access  Admin
 * @body    { entryType: string }
 */
const updateGlobalEntryType = async (req, res) => {
  const entryType = String(req.body?.entryType ?? '').trim();
  if (!entryType) {
    return res.status(400).json({
      success: false,
      message: 'Entry is required — pick a value or type your own.',
    });
  }
  try {
    const settings = await getOrCreateSettings();
    settings.globalEntryType = entryType;
    await settings.save();
    const result = await Country.updateMany(
      {},
      { $set: { useGlobalEntryType: true, entryType } }
    );
    res.json({
      success: true,
      globalEntryType: entryType,
      matched: result.matchedCount ?? result.n ?? 0,
      modified: result.modifiedCount ?? result.nModified ?? 0,
      message: `Entry set to "${entryType}" on all countries.`,
    });
  } catch (err) {
    console.error('[control] updateGlobalEntryType error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

/**
 * @route   POST /api/admin/control/processing-days
 * @desc    Set the universal `globalProcessingDays` and flip every country's
 *          `useGlobalProcessingDays=true`. Mirrors the Visa Type / Validity flow.
 * @access  Admin
 * @body    { processingDays: string }
 */
const updateGlobalProcessingDays = async (req, res) => {
  const processingDays = String(req.body?.processingDays ?? '').trim();
  console.log('[control] updateGlobalProcessingDays:', {
    processingDays,
    admin: req.user?.id || '(none)',
  });
  if (!processingDays) {
    return res.status(400).json({
      success: false,
      message: 'Processing Days is required — pick a value or type your own.',
    });
  }
  try {
    const settings = await getOrCreateSettings();
    settings.globalProcessingDays = processingDays;
    await settings.save();
    const result = await Country.updateMany(
      {},
      { $set: { useGlobalProcessingDays: true, processingDays } }
    );
    res.json({
      success: true,
      globalProcessingDays: processingDays,
      matched: result.matchedCount ?? result.n ?? 0,
      modified: result.modifiedCount ?? result.nModified ?? 0,
      message: `Processing Days set to "${processingDays}" on all countries.`,
    });
  } catch (err) {
    console.error('[control] updateGlobalProcessingDays error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

/**
 * @route   POST /api/admin/control/display-toggles
 * @desc    Persist the three universal "show on client" toggles. Each key is
 *          optional — only provided keys are written, so the admin UI can flip a
 *          single switch without re-sending the others.
 * @access  Admin
 * @body    { showVisaType?: boolean, showValidity?: boolean, showLengthOfStay?: boolean, showEntryType?: boolean, showProcessingDays?: boolean }
 */
const updateCountryDisplayToggles = async (req, res) => {
  const incoming = req.body || {};
  const changed = {};
  if (typeof incoming.showVisaType === 'boolean') changed.showVisaType = incoming.showVisaType;
  if (typeof incoming.showValidity === 'boolean') changed.showValidity = incoming.showValidity;
  if (typeof incoming.showLengthOfStay === 'boolean') changed.showLengthOfStay = incoming.showLengthOfStay;
  if (typeof incoming.showEntryType === 'boolean') changed.showEntryType = incoming.showEntryType;
  if (typeof incoming.showProcessingDays === 'boolean')
    changed.showProcessingDays = incoming.showProcessingDays;
  if (typeof incoming.showRequiredDocuments === 'boolean')
    changed.showRequiredDocuments = incoming.showRequiredDocuments;
  if (typeof incoming.showVisaRequirements === 'boolean')
    changed.showVisaRequirements = incoming.showVisaRequirements;
  if (typeof incoming.maintenanceModeEnabled === 'boolean')
    changed.maintenanceModeEnabled = incoming.maintenanceModeEnabled;
  if (Object.keys(changed).length === 0) {
    return res.status(400).json({
      success: false,
      message:
        'Provide at least one of showVisaType, showValidity, showLengthOfStay, showEntryType, showProcessingDays, showRequiredDocuments, showVisaRequirements, maintenanceModeEnabled (boolean).',
    });
  }
  console.log('[control] updateCountryDisplayToggles:', changed);
  try {
    const settings = await getOrCreateSettings();
    Object.assign(settings, changed);
    await settings.save();
    res.json({
      success: true,
      display: resolveDisplayToggles(settings),
      message: 'Display toggles updated.',
    });
  } catch (err) {
    console.error('[control] updateCountryDisplayToggles error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

/**
 * @route   POST /api/admin/control/required-documents
 * @desc    Set the universal `globalRequiredDocuments` list (array of doc keys)
 *          and flip every country's `useGlobalRequiredDocuments=true`.
 *          Unknown keys (not in the built-in catalog or `customDocuments`)
 *          are silently dropped to prevent typos from leaking through.
 * @access  Admin
 * @body    { requiredDocuments: string[] }
 */
const updateGlobalRequiredDocuments = async (req, res) => {
  const incoming = Array.isArray(req.body?.requiredDocuments) ? req.body.requiredDocuments : null;
  if (!incoming) {
    return res.status(400).json({
      success: false,
      message: 'requiredDocuments must be an array of document keys.',
    });
  }
  try {
    const settings = await getOrCreateSettings();
    const customKeys = new Set(
      (settings?.customDocuments || []).map((d) => String(d?.key ?? '').trim()).filter(Boolean)
    );
    const cleaned = [];
    const seen = new Set();
    for (const raw of incoming) {
      const key = String(raw ?? '').trim();
      if (!key || seen.has(key)) continue;
      if (!BUILT_IN_DOCUMENT_KEYS.has(key) && !customKeys.has(key)) continue;
      seen.add(key);
      cleaned.push(key);
    }
    settings.globalRequiredDocuments = cleaned;
    await settings.save();
    // Same pattern as visa type / validity / processing days: physically write
    // the resolved list onto every Country doc so MongoDB reflects the
    // universal update (not just the resolve-at-read merge).
    const result = await Country.updateMany(
      {},
      { $set: { useGlobalRequiredDocuments: true, requiredDocuments: cleaned } }
    );
    console.log('[control] updateGlobalRequiredDocuments:', {
      count: cleaned.length,
      admin: req.user?.id || '(none)',
    });
    res.json({
      success: true,
      globalRequiredDocuments: cleaned,
      matched: result.matchedCount ?? result.n ?? 0,
      modified: result.modifiedCount ?? result.nModified ?? 0,
      message: cleaned.length
        ? `Required Documents set on all countries (${cleaned.length} item${cleaned.length === 1 ? '' : 's'}).`
        : 'Required Documents cleared — countries will fall back to their stored override.',
    });
  } catch (err) {
    console.error('[control] updateGlobalRequiredDocuments error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

/**
 * @route   POST /api/admin/control/custom-documents
 * @desc    Manage the document catalog metadata used by admin + public pages.
 *          Supports:
 *            - `add`: create a new custom document type
 *            - `save`: update built-in/custom metadata (label, description, icon)
 *            - `remove`: remove a custom document type
 *          Built-in keys cannot be removed. Removing a custom key also strips
 *          it from `globalRequiredDocuments` and every country's
 *          `requiredDocuments` so we never leave dangling references.
 * @access  Admin
 * @body    { action: 'add'|'save'|'remove', label?: string, description?: string, icon?: string, key?: string }
 */
const manageCustomDocuments = async (req, res) => {
  const action = String(req.body?.action ?? '').toLowerCase();
  if (!['add', 'save', 'remove'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'action must be one of "add", "save", or "remove".',
    });
  }
  try {
    const settings = await getOrCreateSettings();
    if (action === 'add') {
      const label = String(req.body?.label ?? '').trim();
      const description = String(req.body?.description ?? '').trim();
      const icon = sanitizeRemixIconClass(req.body?.icon);
      if (!label) {
        return res.status(400).json({ success: false, message: 'label is required.' });
      }
      const key = customDocumentKey(label);
      if (!key) {
        return res.status(400).json({
          success: false,
          message: 'label must contain at least one alphanumeric character.',
        });
      }
      if (BUILT_IN_DOCUMENT_KEYS.has(key)) {
        return res.status(409).json({
          success: false,
          message: 'A built-in document already uses that label — choose another.',
        });
      }
      const existing = (settings.customDocuments || []).find(
        (d) => String(d.key ?? '').trim() === key
      );
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'A custom document with that label already exists.',
        });
      }
      settings.customDocuments = [...(settings.customDocuments || []), { key, label, description, icon }];
      await settings.save();
      console.log('[control] manageCustomDocuments add:', { key, label, description, icon });
      return res.json({
        success: true,
        customDocuments: settings.customDocuments,
        documentCatalog: buildDocumentCatalog(settings),
        message: `"${label}" added to the document catalog.`,
      });
    }

    if (action === 'save') {
      const key = String(req.body?.key ?? '').trim();
      const label = String(req.body?.label ?? '').trim();
      const description = String(req.body?.description ?? '').trim();
      const icon = sanitizeRemixIconClass(req.body?.icon);
      if (!key) {
        return res.status(400).json({ success: false, message: 'key is required for save.' });
      }
      if (!label) {
        return res.status(400).json({ success: false, message: 'label is required for save.' });
      }

      if (BUILT_IN_DOCUMENT_KEYS.has(key)) {
        const nextOverrides = Array.isArray(settings.documentCatalogOverrides)
          ? [...settings.documentCatalogOverrides]
          : [];
        const idx = nextOverrides.findIndex((d) => String(d?.key ?? '').trim() === key);
        const payload = { key, label, description, icon };
        if (idx >= 0) nextOverrides[idx] = payload;
        else nextOverrides.push(payload);
        settings.documentCatalogOverrides = nextOverrides;
      } else {
        const nextCustoms = Array.isArray(settings.customDocuments) ? [...settings.customDocuments] : [];
        const idx = nextCustoms.findIndex((d) => String(d?.key ?? '').trim() === key);
        if (idx < 0) {
          return res.status(404).json({ success: false, message: 'Custom document not found.' });
        }
        nextCustoms[idx] = { ...nextCustoms[idx], key, label, description, icon };
        settings.customDocuments = nextCustoms;
      }

      await settings.save();
      console.log('[control] manageCustomDocuments save:', { key, label, description, icon });
      return res.json({
        success: true,
        customDocuments: settings.customDocuments,
        documentCatalog: buildDocumentCatalog(settings),
        message: `"${label}" saved.`,
      });
    }

    // action === 'remove'
    const key = String(req.body?.key ?? '').trim();
    if (!key) {
      return res.status(400).json({ success: false, message: 'key is required for remove.' });
    }
    if (BUILT_IN_DOCUMENT_KEYS.has(key)) {
      return res.status(400).json({
        success: false,
        message: 'Built-in document types cannot be removed.',
      });
    }
    const before = (settings.customDocuments || []).length;
    settings.customDocuments = (settings.customDocuments || []).filter(
      (d) => String(d.key ?? '').trim() !== key
    );
    settings.globalRequiredDocuments = (settings.globalRequiredDocuments || []).filter(
      (k) => String(k ?? '').trim() !== key
    );
    await settings.save();
    // Strip the deleted key from every per-country requiredDocuments override so
    // applicants don't see stale entries referring to a doc that no longer exists.
    await Country.updateMany({}, { $pull: { requiredDocuments: key } });
    console.log('[control] manageCustomDocuments remove:', {
      key,
      removedCustom: before - settings.customDocuments.length,
    });
    return res.json({
      success: true,
      customDocuments: settings.customDocuments,
      documentCatalog: buildDocumentCatalog(settings),
      message: 'Custom document removed from the catalog and every country.',
    });
  } catch (err) {
    console.error('[control] manageCustomDocuments error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

module.exports = {
  getCountries,
  getCountryBySlug,
  addCountry,
  updateCountry,
  deleteCountry,
  uploadCountryImage,
  refreshUnsplashCountryImages,
  getGlobalCountryDefaults,
  updateGlobalBasePrice,
  updateGlobalVisaType,
  updateGlobalValidity,
  updateGlobalLengthOfStay,
  updateGlobalEntryType,
  updateGlobalProcessingDays,
  updateGlobalRequiredDocuments,
  manageCustomDocuments,
  updateCountryDisplayToggles,
};
