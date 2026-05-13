const Country = require('../models/Country');
const { processUnsplashCountryImageBatch } = require('../services/unsplashCountryImages');

const mongoose = require('mongoose');

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
    const countries = await Country.find().sort({ name: 1 });
    res.json({ success: true, countries });
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
    const country = await Country.findOne({ slug: req.params.slug });
    if (!country) return res.status(404).json({ success: false, message: 'Country not found' });
    res.json({ success: true, country });
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
      visaType, continent, imageUrl, description,
      requirements, requiredDocuments, trending, successRate,
      whyBookNow, includedItems, faqs, howItWorks,
      excludeDestinationWhyBookNow,
      excludeDestinationIncludedItems,
      excludeDestinationFaqQuestions,
      excludeDestinationHowItWorksTitles,
    } = req.body;

    if (!name || !basePrice) {
      return res.status(400).json({ success: false, message: 'Name and base price are required.' });
    }

    const slug = slugify(name);
    const existing = await Country.findOne({ slug });
    if (existing) {
      return res.status(409).json({ success: false, message: `Country "${name}" already exists.` });
    }

    const country = await Country.create({
      slug,
      name,
      flagEmoji: flagEmoji || '🌍',
      basePrice: Number(basePrice),
      processingDays: processingDays || '5-10',
      difficulty: difficulty || 'moderate',
      visaType: visaType || 'Tourist Visa',
      continent: continent || 'Global',
      imageUrl: imageUrl || '',
      description: description || '',
      requirements: Array.isArray(requirements) ? requirements.filter(Boolean) : [],
      requiredDocuments: Array.isArray(requiredDocuments) ? requiredDocuments : [],
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
      visaType, continent, imageUrl, description,
      requirements, requiredDocuments, trending, successRate,
      whyBookNow, includedItems, faqs, howItWorks,
      excludeDestinationWhyBookNow,
      excludeDestinationIncludedItems,
      excludeDestinationFaqQuestions,
      excludeDestinationHowItWorksTitles,
    } = req.body;

    const country = await findCountry(req.params.id);
    if (!country) return res.status(404).json({ success: false, message: 'Country not found' });

    if (name && name !== country.name) {
      country.slug = slugify(name);
    }
    if (name !== undefined) country.name = name;
    if (flagEmoji !== undefined) country.flagEmoji = flagEmoji;
    if (basePrice !== undefined) country.basePrice = Number(basePrice);
    if (processingDays !== undefined) country.processingDays = processingDays;
    if (difficulty !== undefined) country.difficulty = difficulty;
    if (visaType !== undefined) country.visaType = visaType;
    if (continent !== undefined) country.continent = continent;
    if (imageUrl !== undefined) country.imageUrl = imageUrl;
    if (description !== undefined) country.description = description;
    if (Array.isArray(requirements)) country.requirements = requirements.filter(Boolean);
    if (Array.isArray(requiredDocuments)) country.requiredDocuments = requiredDocuments;
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

    await country.save();
    res.json({ success: true, country });
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

module.exports = {
  getCountries,
  getCountryBySlug,
  addCountry,
  updateCountry,
  deleteCountry,
  uploadCountryImage,
  refreshUnsplashCountryImages,
};
