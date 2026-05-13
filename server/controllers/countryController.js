const Country = require('../models/Country');
const Settings = require('../models/Settings');
const { processUnsplashCountryImageBatch } = require('../services/unsplashCountryImages');

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
  { key: 'passport', label: 'Passport' },
  { key: 'oldPassport', label: 'Old / Previous Passport' },
  { key: 'photo', label: 'Passport Photo' },
  { key: 'idCard', label: 'Aadhaar / ID Card' },
  { key: 'panCard', label: 'PAN Card' },
  { key: 'drivingLicense', label: 'Driving License' },
  { key: 'birthCertificate', label: 'Birth Certificate' },
  { key: 'dobCertificate', label: 'DOB Certificate' },
  { key: 'marriageCertificate', label: 'Marriage Certificate' },
  { key: 'educationCertificate', label: 'Education / Academic Records' },
  // ── Employment & finance ────────────────────────────────────────
  { key: 'employmentLetter', label: 'Employment Letter' },
  { key: 'offerLetter', label: 'Offer Letter' },
  { key: 'salarySlip', label: 'Salary Slip / Pay Stub' },
  { key: 'form16', label: 'Form 16' },
  { key: 'taxReturn', label: 'ITR / Tax Return' },
  { key: 'bankStatement', label: 'Bank Statement' },
  { key: 'bankCertificate', label: 'Bank Solvency Certificate' },
  { key: 'propertyDocuments', label: 'Property Documents' },
  // ── Travel ─────────────────────────────────────────────────────
  { key: 'travelInsurance', label: 'Travel Insurance' },
  { key: 'healthInsurance', label: 'Health Insurance' },
  { key: 'flightTicket', label: 'Flight Ticket' },
  { key: 'hotelBooking', label: 'Hotel Booking' },
  { key: 'itinerary', label: 'Travel Itinerary' },
  // ── Letters & supporting ───────────────────────────────────────
  { key: 'coverLetter', label: 'Cover Letter' },
  { key: 'invitationLetter', label: 'Invitation Letter' },
  { key: 'sponsorLetter', label: 'Sponsor / Affidavit Letter' },
  // ── Certificates & clearances ──────────────────────────────────
  { key: 'policeClearance', label: 'Police Clearance Certificate' },
  { key: 'noObjectionCertificate', label: 'No Objection Certificate (NOC)' },
  { key: 'yellowFever', label: 'Yellow Fever Certificate' },
  { key: 'covidVaccination', label: 'COVID Vaccination Certificate' },
  // ── Forms & business ───────────────────────────────────────────
  { key: 'visaApplicationForm', label: 'Visa Application Form' },
  { key: 'businessLicense', label: 'Business License' },
  { key: 'companyRegistration', label: 'Company Registration Certificate' },
]);
const BUILT_IN_DOCUMENT_KEYS = new Set(BUILT_IN_DOCUMENT_CATALOG.map((d) => d.key));

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
  const customs = Array.isArray(settings?.customDocuments) ? settings.customDocuments : [];
  const customDocs = customs
    .map((doc) => ({
      key: String(doc?.key ?? '').trim(),
      label: String(doc?.label ?? '').trim(),
    }))
    .filter((d) => d.key && d.label)
    .map((d) => ({ ...d, builtIn: false }));
  const builtIns = BUILT_IN_DOCUMENT_CATALOG.map((d) => ({ ...d, builtIn: true }));
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
  let settings = await Settings.findOne({ singleton: 'global' });
  if (!settings) {
    settings = await Settings.create({ singleton: 'global' });
  }
  return settings;
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
  const globalVisaType = String(settings?.globalVisaType ?? '').trim();
  const globalValidity = String(settings?.globalValidity ?? '').trim();
  const globalProcessingDays = String(settings?.globalProcessingDays ?? '').trim();
  const globalRequiredDocuments = Array.isArray(settings?.globalRequiredDocuments)
    ? settings.globalRequiredDocuments.map((k) => String(k ?? '').trim()).filter(Boolean)
    : [];
  const useGlobalVisaType = obj.useGlobalVisaType !== false;
  const useGlobalValidity = obj.useGlobalValidity !== false;
  const useGlobalProcessingDays = obj.useGlobalProcessingDays !== false;
  const useGlobalRequiredDocuments = obj.useGlobalRequiredDocuments !== false;
  const visaTypeOverride = String(obj.visaType ?? '').trim();
  const validityOverride = String(obj.validity ?? '').trim();
  const processingDaysOverride = String(obj.processingDays ?? '').trim();
  const requiredDocumentsOverride = Array.isArray(obj.requiredDocuments)
    ? obj.requiredDocuments.map((k) => String(k ?? '').trim()).filter(Boolean)
    : [];
  const resolvedVisaType =
    useGlobalVisaType && globalVisaType ? globalVisaType : visaTypeOverride || 'Tourist Visa';
  const resolvedValidity =
    useGlobalValidity && globalValidity ? globalValidity : validityOverride;
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
  return {
    ...obj,
    visaType: resolvedVisaType,
    validity: resolvedValidity,
    processingDays: resolvedProcessingDays,
    requiredDocuments: resolvedRequiredDocuments,
    useGlobalVisaType,
    useGlobalValidity,
    useGlobalProcessingDays,
    useGlobalRequiredDocuments,
    visaTypeOverride,
    validityOverride,
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
  showProcessingDays: settings?.showProcessingDays !== false,
  showRequiredDocuments: settings?.showRequiredDocuments !== false,
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
      visaType, validity, continent, imageUrl, description,
      requirements, requiredDocuments, trending, successRate,
      whyBookNow, includedItems, faqs, howItWorks,
      excludeDestinationWhyBookNow,
      excludeDestinationIncludedItems,
      excludeDestinationFaqQuestions,
      excludeDestinationHowItWorksTitles,
      excludeDestinationVisaRequirements,
    } = req.body;

    if (!name || !basePrice) {
      return res.status(400).json({ success: false, message: 'Name and base price are required.' });
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
    const globalProcessingDays = String(settings?.globalProcessingDays ?? '').trim();
    const globalRequiredDocs = Array.isArray(settings?.globalRequiredDocuments)
      ? settings.globalRequiredDocuments.map((k) => String(k ?? '').trim()).filter(Boolean)
      : [];
    const typedVisa = String(visaType ?? '').trim();
    const typedValidity = String(validity ?? '').trim();
    const typedProcessingDays = String(processingDays ?? '').trim();
    const typedReqDocs = Array.isArray(requiredDocuments)
      ? requiredDocuments.map((k) => String(k ?? '').trim()).filter(Boolean)
      : [];
    const newUseGlobalVisaType = !typedVisa || typedVisa === globalVisaType;
    const newUseGlobalValidity = !typedValidity || typedValidity === globalValidity;
    const newUseGlobalProcessingDays = !typedProcessingDays || typedProcessingDays === globalProcessingDays;
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
      basePrice: Number(basePrice),
      processingDays: typedProcessingDays || '5-10',
      useGlobalProcessingDays: newUseGlobalProcessingDays,
      difficulty: difficulty || 'moderate',
      visaType: typedVisa || 'Tourist Visa',
      useGlobalVisaType: newUseGlobalVisaType,
      validity: typedValidity,
      useGlobalValidity: newUseGlobalValidity,
      continent: continent || 'Global',
      imageUrl: imageUrl || '',
      description: description || '',
      requirements: Array.isArray(requirements) ? requirements.filter(Boolean) : [],
      requiredDocuments: typedReqDocs.length ? typedReqDocs : ['passport'],
      useGlobalRequiredDocuments: newUseGlobalRequiredDocuments,
      trending: Boolean(trending),
      successRate: Number(successRate) || 80,
      whyBookNow: sanitizeStringList(whyBookNow),
      includedItems: sanitizeStringList(includedItems),
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
      visaType, validity, continent, imageUrl, description,
      requirements, requiredDocuments, trending, successRate,
      whyBookNow, includedItems, faqs, howItWorks,
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
    if (basePrice !== undefined) country.basePrice = Number(basePrice);
    if (difficulty !== undefined) country.difficulty = difficulty;
    // Visa Type / Validity / Processing Days are part of the universal control system. The save logic:
    //   • If the admin clears the field → flip `useGlobal*` = true so the country
    //     falls back to the global default again.
    //   • If the admin types something that matches the current global → same as above
    //     (no point in storing a redundant override).
    //   • If the admin types something different → mark as a per-country override.
    if (visaType !== undefined || validity !== undefined || processingDays !== undefined) {
      const settings = await getOrCreateSettings();
      const globalVisaType = String(settings?.globalVisaType ?? '').trim();
      const globalValidity = String(settings?.globalValidity ?? '').trim();
      const globalProcessingDays = String(settings?.globalProcessingDays ?? '').trim();
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
    if (trending !== undefined) country.trending = Boolean(trending);
    if (successRate !== undefined) country.successRate = Number(successRate);
    if (whyBookNow !== undefined) country.whyBookNow = sanitizeStringList(whyBookNow);
    if (includedItems !== undefined) country.includedItems = sanitizeStringList(includedItems);
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
const uploadCountryImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file provided.' });
  }
  const url = `/uploads/country-images/${req.file.filename}`;
  res.json({ success: true, url });
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
    const usingGlobalVisaType = await Country.countDocuments({
      $or: [{ useGlobalVisaType: { $exists: false } }, { useGlobalVisaType: true }],
    });
    const usingGlobalValidity = await Country.countDocuments({
      $or: [{ useGlobalValidity: { $exists: false } }, { useGlobalValidity: true }],
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
        globalVisaType: String(settings?.globalVisaType ?? '').trim(),
        globalValidity: String(settings?.globalValidity ?? '').trim(),
        globalProcessingDays: String(settings?.globalProcessingDays ?? '').trim(),
        globalRequiredDocuments,
      },
      display: resolveDisplayToggles(settings),
      documentCatalog: buildDocumentCatalog(settings),
      stats: {
        totalCountries,
        usingGlobalVisaType,
        usingGlobalValidity,
        usingGlobalProcessingDays,
        usingGlobalRequiredDocuments,
        overridingVisaType: Math.max(0, totalCountries - usingGlobalVisaType),
        overridingValidity: Math.max(0, totalCountries - usingGlobalValidity),
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
 * @body    { showVisaType?: boolean, showValidity?: boolean, showProcessingDays?: boolean }
 */
const updateCountryDisplayToggles = async (req, res) => {
  const incoming = req.body || {};
  const changed = {};
  if (typeof incoming.showVisaType === 'boolean') changed.showVisaType = incoming.showVisaType;
  if (typeof incoming.showValidity === 'boolean') changed.showValidity = incoming.showValidity;
  if (typeof incoming.showProcessingDays === 'boolean')
    changed.showProcessingDays = incoming.showProcessingDays;
  if (typeof incoming.showRequiredDocuments === 'boolean')
    changed.showRequiredDocuments = incoming.showRequiredDocuments;
  if (Object.keys(changed).length === 0) {
    return res.status(400).json({
      success: false,
      message:
        'Provide at least one of showVisaType, showValidity, showProcessingDays, showRequiredDocuments (boolean).',
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
 * @desc    Add or remove an admin-defined document type. Built-in keys cannot
 *          be removed. Removing a custom key also strips it from
 *          `globalRequiredDocuments` and every country's `requiredDocuments`
 *          so we never leave dangling references.
 * @access  Admin
 * @body    { action: 'add'|'remove', label?: string, key?: string }
 */
const manageCustomDocuments = async (req, res) => {
  const action = String(req.body?.action ?? '').toLowerCase();
  if (!['add', 'remove'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'action must be either "add" or "remove".',
    });
  }
  try {
    const settings = await getOrCreateSettings();
    if (action === 'add') {
      const label = String(req.body?.label ?? '').trim();
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
      settings.customDocuments = [...(settings.customDocuments || []), { key, label }];
      await settings.save();
      console.log('[control] manageCustomDocuments add:', { key, label });
      return res.json({
        success: true,
        customDocuments: settings.customDocuments,
        documentCatalog: buildDocumentCatalog(settings),
        message: `"${label}" added to the document catalog.`,
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
  updateGlobalVisaType,
  updateGlobalValidity,
  updateGlobalProcessingDays,
  updateGlobalRequiredDocuments,
  manageCustomDocuments,
  updateCountryDisplayToggles,
};
