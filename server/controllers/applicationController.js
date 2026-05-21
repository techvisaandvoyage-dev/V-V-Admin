const Application = require('../models/Application');
const Counter = require('../models/Counter');
const Country = require('../models/Country');
const User = require('../models/User');
const TravelerProfile = require('../models/TravelerProfile');
const { buildTravelerSnapshot } = require('../utils/travelerProfile');
const { loadSettingsDocument } = require('../utils/settingsDocument');

const APPLICATION_ID_COUNTER = 'applicationId';
const APPLICATION_ID_START = 1045601;

// Fix: Improved helper to ensure it ALWAYS returns a valid number
const normalizeProcessingDays = (rawValue) => {
  if (rawValue === undefined || rawValue === null) return 0; // Default to 0 instead of undefined
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) return rawValue;

  const str = String(rawValue).trim();
  if (!str) return 0;

  // Supports values like "5", "3-5", "10-25 days"
  const matches = str.match(/\d+/g);
  
  // Agar koi number nahi milta (e.g. "Instant"), toh 0 return karega
  if (!matches || matches.length === 0) return 0;

  const result = Number(matches[matches.length - 1]);
  return isNaN(result) ? 0 : result; // Final check for NaN
};

const getNextApplicationId = async () => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      let counter = await Counter.findOne({ name: APPLICATION_ID_COUNTER });
      if (!counter) {
        try {
          counter = await Counter.create({
            name: APPLICATION_ID_COUNTER,
            value: APPLICATION_ID_START,
          });
          return String(counter.value);
        } catch (err) {
          if (err.code === 11000 && attempt === 0) {
            continue;
          }
          throw err;
        }
      }

      if (counter.value < APPLICATION_ID_START) {
        counter = await Counter.findOneAndUpdate(
          { name: APPLICATION_ID_COUNTER },
          { $set: { value: APPLICATION_ID_START } },
          { returnDocument: 'after' }
        );
        return String(counter.value);
      }

      counter = await Counter.findOneAndUpdate(
        { name: APPLICATION_ID_COUNTER },
        { $inc: { value: 1 } },
        { returnDocument: 'after' }
      );

      return String(counter.value);
    } catch (error) {
      if (error?.code === 11000 && attempt === 0) continue;
      throw error;
    }
  }

  throw new Error('Could not generate application ID');
};

const appendApplicantNotes = (existingValue, incomingValue) => {
  const existing = String(existingValue || '').trim();
  const incoming = String(incomingValue || '').trim();
  if (!incoming) return existing;
  const combined = existing ? `${existing}\n\n${incoming}` : incoming;
  return combined.slice(0, 8000);
};

const resolveCheckoutPricing = async (countryId, travelerCount = 1) => {
  const country = await Country.findOne({ slug: String(countryId) }).select(
    'requiredDocuments basePrice useGlobalBasePrice useGlobalGst gstEnabled gstRate'
  );
  const settings = await loadSettingsDocument();
  const requiredDocuments =
    Array.isArray(country?.requiredDocuments) && country.requiredDocuments.length
      ? country.requiredDocuments
      : ['passport'];

  const globalBasePrice = Number(settings?.globalBasePrice);
  const countryBasePrice = Number(country?.basePrice);
  const baseFee =
    country?.useGlobalBasePrice === true &&
    Number.isFinite(globalBasePrice) &&
    globalBasePrice >= 0
      ? globalBasePrice
      : Number.isFinite(countryBasePrice) && countryBasePrice >= 0
        ? countryBasePrice
        : 0;

  const useGlobalGst = country?.useGlobalGst !== false;
  const gstEnabled = useGlobalGst ? settings?.gstEnabled !== false : country?.gstEnabled !== false;
  const globalGstRate = Number(settings?.gstRate);
  const countryGstRate = Number(country?.gstRate);
  const gstRate = useGlobalGst
    ? Number.isFinite(globalGstRate) && globalGstRate >= 0
      ? globalGstRate
      : 18
    : Number.isFinite(countryGstRate) && countryGstRate >= 0
      ? countryGstRate
      : Number.isFinite(globalGstRate) && globalGstRate >= 0
        ? globalGstRate
        : 18;
  const count = Math.max(1, Number(travelerCount) || 1);
  const serviceAmount = baseFee * count;
  const gstAmount = gstEnabled ? Math.round(serviceAmount * (gstRate / 100)) : 0;
  const fee = serviceAmount + gstAmount;

  return {
    requiredDocuments,
    baseFee,
    serviceAmount,
    gstEnabled,
    gstRate,
    gstAmount,
    fee,
  };
};

const travelerSnapshotHasRequiredFields = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') return false;

  const requiredStrings = [
    'fullName',
    'gender',
    'passportNumber',
    'nationality',
    'mobileNumber',
    'email',
    'relationship',
  ];

  for (const key of requiredStrings) {
    if (!String(snapshot[key] || '').trim()) return false;
  }

  const requiredDates = ['dateOfBirth', 'passportExpiryDate'];
  for (const key of requiredDates) {
    const value = snapshot[key];
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;
  }

  return true;
};

const normalizeTravelerSelections = async (
  rawTravelers = [],
  rawTravelerNames = [],
  count = 1,
  userId,
  options = {}
) => {
  const { allowIncompleteSnapshot = false } = options;
  const list = Array.isArray(rawTravelers) ? rawTravelers : [];
  const ids = list
    .map((entry) => String(entry?.travelerProfileId || entry?.travelerId || '').trim())
    .filter(Boolean);

  const savedTravelers = ids.length
    ? await TravelerProfile.find({ _id: { $in: ids }, userId })
    : [];
  const savedTravelerMap = new Map(savedTravelers.map((entry) => [String(entry._id), entry]));

  const travelerSelections = Array.from({ length: count }, (_, index) => {
    const incoming = list[index] || {};
    const travelerNo = index + 1;
    const travelerProfileId = String(incoming.travelerProfileId || incoming.travelerId || '').trim();
    const savedTraveler = travelerProfileId ? savedTravelerMap.get(travelerProfileId) : null;
    const fallbackName = Array.isArray(rawTravelerNames) ? rawTravelerNames[index] : '';
    const snapshotCandidate = buildTravelerSnapshot(
      savedTraveler || { ...incoming, fullName: incoming.fullName || incoming.name || fallbackName || `Traveler ${travelerNo}` },
      savedTraveler ? savedTraveler._id : travelerProfileId || null
    );
    const snapshot = allowIncompleteSnapshot && !travelerSnapshotHasRequiredFields(snapshotCandidate)
      ? null
      : snapshotCandidate;

    return {
      travelerNo,
      travelerProfileId: savedTraveler ? savedTraveler._id : travelerProfileId || null,
      travelerSnapshot: snapshot,
    };
  });

  const travelerNames = travelerSelections.map(
    (entry, index) => String(entry?.travelerSnapshot?.fullName || rawTravelerNames?.[index] || `Traveler ${index + 1}`).trim()
  );

  return { travelerSelections, travelerNames };
};

/**
 * @route   POST /api/users/application
 * @desc    Submit a new visa application with documents
 * @access  Private (User)
 */
/**
 * @route   POST /api/users/application/checkout-draft
 * @desc    Create a minimal application after "pay first" flow; user completes details in dashboard
 * @access  Private
 */
const createCheckoutDraft = async (req, res) => {
  try {
    const {
      applicationDraftId,
      countryId,
      countryName,
      flagEmoji,
      visaType,
      travelDateFrom,
      travelDateTo,
      travellerCount: rawCount,
      processingDays: rawProcessing,
      travelerNames: rawTravelerNames,
      travelers: rawTravelers,
    } = req.body;

    if (!countryId || !countryName) {
      return res.status(400).json({ success: false, message: 'Country is required' });
    }

    let user = await User.findById(req.user.id).select('name email');
    if (!user) {
      const Admin = require('../models/Admin');
      user = await Admin.findById(req.user.id).select('email');
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      user.name = 'Admin';
    }

    const count = Math.min(Math.max(1, parseInt(rawCount, 10) || 1), 20);
    const pricing = await resolveCheckoutPricing(countryId, count);
    const requiredDocuments = pricing.requiredDocuments;
    const { travelerSelections, travelerNames } = await normalizeTravelerSelections(
      rawTravelers,
      rawTravelerNames,
      count,
      req.user.id,
      { allowIncompleteSnapshot: true }
    );
    const fee = pricing.fee;

    const nameParts = (user.name || 'Applicant').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Applicant';
    const lastName = nameParts.slice(1).join(' ') || '-';

    let existingDraft = null;
    const normalizedDraftId = String(applicationDraftId || '').trim();
    if (normalizedDraftId) {
      existingDraft = await Application.findOne({
        _id: normalizedDraftId,
        user: req.user.id,
      });
      if (
        existingDraft &&
        existingDraft.paymentStatus !== 'pending_payment' &&
        existingDraft.detailsPending !== true
      ) {
        existingDraft = null;
      }
    }

    if (!existingDraft) {
      existingDraft = await Application.findOne({
        user: req.user.id,
        countryId: String(countryId),
        paymentStatus: 'pending_payment',
      }).sort({ createdAt: -1 });
    }

    let travelDate = new Date();
    if (travelDateFrom) {
      travelDate = new Date(`${String(travelDateFrom).slice(0, 10)}T12:00:00.000Z`);
      if (Number.isNaN(travelDate.getTime())) travelDate = new Date();
    }
    let returnDate = null;
    if (travelDateTo) {
      returnDate = new Date(`${String(travelDateTo).slice(0, 10)}T12:00:00.000Z`);
      if (Number.isNaN(returnDate.getTime())) returnDate = null;
    }

    if (existingDraft) {
      existingDraft.firstName = firstName;
      existingDraft.lastName = lastName;
      existingDraft.email = user.email;
      existingDraft.travelDate = travelDate;
      existingDraft.returnDate = returnDate;
      existingDraft.countryName = String(countryName);
      existingDraft.flagEmoji = flagEmoji || existingDraft.flagEmoji;
      existingDraft.visaType = visaType ? String(visaType) : existingDraft.visaType;
      existingDraft.fee = fee;
      existingDraft.processingDays = normalizeProcessingDays(rawProcessing);
      existingDraft.travellerCount = count;
      existingDraft.travelerNames = travelerNames;
      existingDraft.travelerSelections = travelerSelections;
      existingDraft.requiredDocuments = requiredDocuments;
      existingDraft.detailsPending = true;
      await existingDraft.save();
      return res.status(200).json({ success: true, application: existingDraft });
    }

    const application = await Application.create({
      user: req.user.id,
      applicationId: await getNextApplicationId(),
      firstName,
      lastName,
      email: user.email,
      passportNo: 'PENDING_UPLOAD',
      nationality: 'Pending',
      dob: new Date('1990-01-01'),
      travelDate,
      returnDate,
      countryId: String(countryId),
      countryName: String(countryName),
      flagEmoji: flagEmoji || '🛂',
      visaType: visaType ? String(visaType) : 'Tourist',
      fee,
      processingDays: normalizeProcessingDays(rawProcessing),
      paymentStatus: 'pending_payment',
      transactionId: 'pending',
      status: 'pending',
      documents: [],
      requiredDocuments,
      travellerCount: count,
      travelerNames,
      travelerSelections,
      detailsPending: true,
      notes: 'Service fee checkout — complete passport and documents in your dashboard.',
    });

    res.status(201).json({ success: true, application });
  } catch (error) {
    console.error('createCheckoutDraft:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * @route   PUT /api/users/applications/:id
 * @desc    Update own application (personal / travel fields); clears detailsPending when passport provided
 * @access  Private
 */
const updateUserApplication = async (req, res) => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      user: req.user.id,
    });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const canEditBasic = application.status === 'pending' || application.detailsPending === true;
    const canSaveApplicantNotes =
      application.status === 'pending' ||
      application.status === 'review' ||
      application.detailsPending === true;

    const updates = {};

    if (Object.prototype.hasOwnProperty.call(req.body, 'applicantNotes')) {
      if (!canSaveApplicantNotes) {
        return res.status(403).json({ success: false, message: 'Further information cannot be updated for this application.' });
      }
      updates.applicantNotes = appendApplicantNotes(application.applicantNotes, req.body.applicantNotes);
    }

    if (!canEditBasic) {
      if (Object.keys(updates).length === 0) {
        return res.status(403).json({ success: false, message: 'This application cannot be edited' });
      }
      const updated = await Application.findByIdAndUpdate(req.params.id, updates, {
        returnDocument: 'after',
      });
      return res.json({ success: true, application: updated });
    }

    const {
      firstName,
      lastName,
      email,
      passportNo,
      nationality,
      dob,
      travelDate,
      returnDate,
      gdriveLink,
      gdriveFurtherInfoLink,
    } = req.body;
    if (firstName !== undefined) updates.firstName = String(firstName).trim() || application.firstName;
    if (lastName !== undefined) updates.lastName = String(lastName).trim() || application.lastName;
    if (email !== undefined) updates.email = String(email).trim() || application.email;
    if (passportNo !== undefined) {
      const p = String(passportNo).trim();
      updates.passportNo = p || application.passportNo;
      if (p && p !== 'PENDING_UPLOAD') updates.detailsPending = false;
    }
    if (nationality !== undefined) updates.nationality = String(nationality).trim() || application.nationality;
    if (dob !== undefined && dob) {
      const d = new Date(dob);
      if (!Number.isNaN(d.getTime())) updates.dob = d;
    }
    if (travelDate !== undefined && travelDate) {
      const d = new Date(travelDate);
      if (!Number.isNaN(d.getTime())) updates.travelDate = d;
    }
    if (returnDate !== undefined) {
      if (!returnDate) updates.returnDate = null;
      else {
        const d = new Date(returnDate);
        if (!Number.isNaN(d.getTime())) updates.returnDate = d;
      }
    }
    
    if (gdriveLink !== undefined) {
      updates.gdriveLink = String(gdriveLink).trim();
      // Optionally, if they provide a GDrive link, we can consider documents uploaded
      // but maybe that's best handled by admin. We'll just save it.
    }
    if (gdriveFurtherInfoLink !== undefined) {
      updates.gdriveFurtherInfoLink = String(gdriveFurtherInfoLink).trim();
    }

    const { travelerUpdate } = req.body;
    if (travelerUpdate) {
      const {
        travelerNo,
        travelerName,
        gdriveLink: travelerGdriveLink,
        gdriveFurtherInfoLink: travelerGdriveFurtherInfoLink,
        otherDocuments: travelerOtherDocuments,
        documents: travelerDocuments,
      } = travelerUpdate;
      if (Number.isFinite(Number(travelerNo))) {
        const travellers = Array.isArray(application.travellerDocuments) ? [...application.travellerDocuments] : [];
        const existingIdx = travellers.findIndex((t) => Number(t.travelerNo) === Number(travelerNo));
        
        if (existingIdx >= 0) {
          if (travelerName !== undefined) travellers[existingIdx].travelerName = travelerName;
          if (travelerGdriveLink !== undefined) travellers[existingIdx].gdriveLink = travelerGdriveLink;
          if (travelerGdriveFurtherInfoLink !== undefined) {
            travellers[existingIdx].gdriveFurtherInfoLink = String(travelerGdriveFurtherInfoLink || '').trim();
          }
          if (travelerOtherDocuments !== undefined) {
            travellers[existingIdx].otherDocuments = travelerOtherDocuments;
          }
          if (travelerDocuments !== undefined) {
            travellers[existingIdx].documents = travelerDocuments;
          }
        } else {
          travellers.push({
            travelerNo: Number(travelerNo),
            travelerName: travelerName || '',
            gdriveLink: travelerGdriveLink || '',
            gdriveFurtherInfoLink: String(travelerGdriveFurtherInfoLink || '').trim(),
            otherDocuments: travelerOtherDocuments || [],
            documents: travelerDocuments || {},
          });
        }
        updates.travellerDocuments = travellers.sort((a, b) => a.travelerNo - b.travelerNo);
      }
    }

    const updated = await Application.findByIdAndUpdate(req.params.id, updates, {
      returnDocument: 'after',
    });
    res.json({ success: true, application: updated });
  } catch (error) {
    console.error('updateUserApplication:', error);
    res.status(500).json({ success: false, message: 'Server error updating application' });
  }
};

/**
 * @route   POST /api/users/applications/:id/documents
 * @desc    Append uploaded document files to an application (same edit rules as PUT)
 * @access  Private
 */
const appendApplicationDocuments = async (req, res) => {
  try {
    const paths = req.savedDocumentPaths;
    const savedDocumentDetails = Array.isArray(req.savedDocumentDetails) ? req.savedDocumentDetails : [];
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ success: false, message: 'No files saved' });
    }

    const application = await Application.findOne({
      _id: req.params.id,
      user: req.user.id,
    });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const canUpload =
      application.status === 'pending' ||
      application.status === 'review' ||
      application.detailsPending === true;
    if (!canUpload) {
      return res.status(403).json({ success: false, message: 'Documents cannot be uploaded for this application' });
    }

    const existing = Array.isArray(application.documents) ? application.documents : [];
    application.documents = [...existing, ...paths];

    const travelerNo = parseInt(req.body.travelerNo, 10);
    const travelerName = String(req.body.travelerName || '').trim();
    let documentsMeta = [];
    try {
      documentsMeta = JSON.parse(req.body.documentsMeta || '[]');
      if (!Array.isArray(documentsMeta)) documentsMeta = [];
    } catch (_) {
      documentsMeta = [];
    }

    if (Number.isFinite(travelerNo) && travelerNo > 0 && documentsMeta.length > 0) {
      const docMap = {};
      const docDetailsMap = {};
      const otherDocuments = [];

      for (let i = 0; i < documentsMeta.length; i += 1) {
        const meta = documentsMeta[i] || {};
        const docType = String(meta.docType || '').trim();
        const docKind = String(meta.kind || '').trim();
        const pathForDoc = paths[i] || '';
        const detailForDoc = savedDocumentDetails[i] || null;
        if (docKind === 'other' && pathForDoc) {
          otherDocuments.push(pathForDoc);
          continue;
        }
        if (docType && pathForDoc) {
          docMap[docType] = pathForDoc;
          if (detailForDoc) {
            docDetailsMap[docType] = {
              url: pathForDoc,
              fileName: String(detailForDoc.fileName || '').trim(),
              fileSize: Number(detailForDoc.fileSize || 0),
              mimeType: String(detailForDoc.mimeType || '').trim(),
              uploadedAt: detailForDoc.uploadedAt || new Date(),
            };
          }
        }
      }

      const travellers = Array.isArray(application.travellerDocuments)
        ? [...application.travellerDocuments]
        : [];
      const gdriveLink = String(req.body.gdriveLink || '').trim();
      const gdriveFurtherInfoLink = String(req.body.gdriveFurtherInfoLink || '').trim();

      const existingIdx = travellers.findIndex((t) => Number(t.travelerNo) === travelerNo);
      
      let payload;
      if (existingIdx >= 0) {
        payload = { ...travellers[existingIdx].toObject ? travellers[existingIdx].toObject() : travellers[existingIdx] };
        payload.travelerName = travelerName || payload.travelerName;
        if (gdriveLink) payload.gdriveLink = gdriveLink;
        if (Object.prototype.hasOwnProperty.call(req.body, 'gdriveFurtherInfoLink')) {
          payload.gdriveFurtherInfoLink = gdriveFurtherInfoLink;
        }
        const previousDocuments = payload.documents || {};
        const previousDocumentDetails = payload.documentDetails || {};

        Object.entries(docMap).forEach(([docType, nextPath]) => {
          const previousPath =
            typeof previousDocuments.get === 'function'
              ? previousDocuments.get(docType)
              : previousDocuments[docType];
          if (previousPath && previousPath !== nextPath) {
            application.documents = (Array.isArray(application.documents) ? application.documents : [])
              .filter((storedPath) => String(storedPath || '').trim() !== String(previousPath || '').trim());
          }
        });

        payload.documents = { ...(previousDocuments || {}), ...docMap };
        payload.documentDetails = { ...(previousDocumentDetails || {}), ...docDetailsMap };
        const existingOther = Array.isArray(payload.otherDocuments)
          ? payload.otherDocuments.map((p) => String(p || '').trim()).filter(Boolean)
          : [];
        const newOther = otherDocuments.map((p) => String(p || '').trim()).filter(Boolean);
        payload.otherDocuments = [...existingOther, ...newOther];
        payload.uploadedAt = new Date();
      } else {
        payload = {
          travelerNo,
          travelerName,
          gdriveLink,
          gdriveFurtherInfoLink,
          documents: docMap,
          documentDetails: docDetailsMap,
          otherDocuments,
          uploadedAt: new Date(),
        };
      }

      if (existingIdx >= 0) travellers[existingIdx] = payload;
      else travellers.push(payload);
      application.travellerDocuments = travellers.sort((a, b) => a.travelerNo - b.travelerNo);
      application.markModified('travellerDocuments');

      // Auto-transition status to 'review' if all required documents are uploaded
      const requiredDocs = Array.isArray(application.requiredDocuments) && application.requiredDocuments.length
        ? application.requiredDocuments
        : ['passport'];
      const travellerCount = Math.max(1, application.travellerCount || 1);

      let allUploaded = true;
      for (let tNo = 1; tNo <= travellerCount; tNo += 1) {
        const tr = travellers.find((entry) => Number(entry?.travelerNo) === tNo);
        if (!tr) {
          allUploaded = false;
          break;
        }
        const docs = tr.documents || {};
        for (const key of requiredDocs) {
          const val = typeof docs.get === 'function' ? docs.get(key) : docs[key];
          if (!val || typeof val !== 'string' || !val.trim()) {
            allUploaded = false;
            break;
          }
        }
        if (!allUploaded) break;
      }

      console.log('--- auto-transition debug ---');
      console.log('requiredDocs:', requiredDocs);
      console.log('travellerCount:', travellerCount);
      console.log('allUploaded:', allUploaded);
      console.log('currentStatus:', application.status);

      if (allUploaded && application.status !== 'approved' && application.status !== 'rejected' && application.status !== 'cancelled') {
        application.status = 'review';
        console.log('Transitioned status to: review');
      }
    }

    await application.save();

    res.json({ success: true, application });
  } catch (error) {
    console.error('appendApplicationDocuments:', error);
    res.status(500).json({ success: false, message: 'Server error uploading documents' });
  }
};

/**
 * @route   GET /api/users/applications/:id
 * @desc    Get one user application by id
 * @access  Private
 */
const getUserApplicationById = async (req, res) => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      user: req.user.id,
    });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    res.json({ success: true, application });
  } catch (error) {
    console.error('getUserApplicationById:', error);
    res.status(500).json({ success: false, message: 'Server error fetching application' });
  }
};

const submitApplication = async (req, res) => {
  try {
    const {
      firstName, lastName, email, passportNo, nationality,
      dob, travelDate, returnDate, countryId, countryName,
      flagEmoji, visaType, fee, processingDays,
      transactionId, paymentMethod, paymentStatus, requiredDocuments,
      travelerNames: rawTravelerNames,
      travelers: rawTravelers,
      travellerCount: rawTravellerCount,
    } = req.body;

    // Normalizing the processing days to avoid "NaN" error
    const parsedProcessingDays = normalizeProcessingDays(processingDays);

    const count = Math.min(Math.max(1, parseInt(rawTravellerCount, 10) || 1), 20);
    const { travelerSelections, travelerNames } = await normalizeTravelerSelections(
      rawTravelers,
      rawTravelerNames,
      count,
      req.user.id
    );

    const application = await Application.create({
      user: req.user.id,
      applicationId: await getNextApplicationId(),
      firstName,
      lastName,
      email,
      passportNo,
      nationality,
      dob,
      travelDate,
      returnDate: returnDate || null,
      countryId,
      countryName,
      flagEmoji,
      visaType,
      fee: Number(fee) || 0, // Fallback to 0 if fee is not a number
      processingDays: parsedProcessingDays,
      transactionId: transactionId || "pending",
      paymentMethod: paymentMethod || "Razorpay",
      paymentStatus: paymentStatus || 'completed',
      documents: req.body.documents || [],
      requiredDocuments: Array.isArray(requiredDocuments) && requiredDocuments.length
        ? requiredDocuments
        : ['passport'],
      travellerCount: count,
      travelerNames,
      travelerSelections,
    });

    res.status(201).json({ success: true, application });
  } catch (error) {
    // Detailed error logging to catch any other schema issues
    console.error("Error submitting application:", error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error submitting application',
      error: error.message 
    });
  }
};

/**
 * @route   GET /api/users/applications
 * @desc    Get logged in user's applications
 * @access  Private (User)
 */
const getUserApplications = async (req, res) => {
  try {
    const applications = await Application.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, applications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error fetching applications' });
  }
};

/**
 * @route   GET /api/admin/applications
 * @desc    Get all applications (Admin)
 * @access  Private (Admin)
 */
const getAllApplications = async (req, res) => {
  try {
    const applications = await Application.find()
      .populate('user', 'name email phone age gender')
      .sort({ createdAt: -1 });
    res.json({ success: true, applications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error fetching applications' });
  }
};

/**
 * @route   GET /api/admin/applications/:id
 * @desc    Get specific application details
 * @access  Private (Admin)
 */
const getApplicationById = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id).populate('user', 'name email phone age gender');
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    res.json({ success: true, application });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error fetching application' });
  }
};

/**
 * @route   POST /api/admin/applications/:id/visa-file
 * @desc    Upload approved visa file for an application
 * @access  Private (Admin)
 */
const uploadApprovedVisaFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a visa file' });
    }

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const { uploadToFirebase } = require('../utils/uploadOptimizer');
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `visa-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    const firebaseUrl = await uploadToFirebase(req.file.buffer, filename, req.file.mimetype);

    application.visaFilePath = firebaseUrl;
    application.visaFileName = req.file.originalname || filename;
    application.visaFileUploadedAt = new Date();
    if (application.status !== 'approved') {
      application.status = 'approved';
    }
    await application.save();

    const populated = await Application.findById(application._id).populate('user', 'name email phone age gender');
    res.json({ success: true, application: populated });
  } catch (error) {
    console.error('uploadApprovedVisaFile:', error);
    res.status(500).json({ success: false, message: 'Server error uploading visa file' });
  }
};

/**
 * @route   PUT /api/admin/applications/:id/status
 * @desc    Update application status
 * @access  Private (Admin)
 */
const updateApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { status },
      { returnDocument: 'after' }
    );
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    res.json({ success: true, application });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error updating status' });
  }
};

module.exports = {
  submitApplication,
  createCheckoutDraft,
  updateUserApplication,
  appendApplicationDocuments,
  getUserApplicationById,
  getUserApplications,
  getAllApplications,
  getApplicationById,
  uploadApprovedVisaFile,
  updateApplicationStatus
};  
