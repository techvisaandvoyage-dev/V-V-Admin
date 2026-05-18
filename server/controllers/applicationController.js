const Application = require('../models/Application');
const Counter = require('../models/Counter');
const Country = require('../models/Country');
const User = require('../models/User');

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
          { returnDocument: 'after', new: true }
        );
        return String(counter.value);
      }

      counter = await Counter.findOneAndUpdate(
        { name: APPLICATION_ID_COUNTER },
        { $inc: { value: 1 } },
        { returnDocument: 'after', new: true }
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
      countryId,
      countryName,
      flagEmoji,
      visaType,
      travelDateFrom,
      travelDateTo,
      travellerCount: rawCount,
      processingDays: rawProcessing,
      travelerNames: rawTravelerNames,
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

    const country = await Country.findOne({ slug: String(countryId) }).select('requiredDocuments');
    const requiredDocuments = Array.isArray(country?.requiredDocuments) && country.requiredDocuments.length
      ? country.requiredDocuments
      : ['passport'];

    const count = Math.min(Math.max(1, parseInt(rawCount, 10) || 1), 20);
    const travelerNames = Array.isArray(rawTravelerNames)
      ? rawTravelerNames.slice(0, count).map((n) => String(n || '').trim())
      : [];
    const SERVICE = 1500;
    const GST_RATE = 0.18;
    const serviceAmount = SERVICE * count;
    const gstAmount = Math.round(serviceAmount * GST_RATE);
    const fee = serviceAmount + gstAmount;

    const nameParts = (user.name || 'Applicant').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Applicant';
    const lastName = nameParts.slice(1).join(' ') || '-';

    const existingDraft = await Application.findOne({
      user: req.user.id,
      countryId: String(countryId),
      paymentStatus: 'pending_payment',
    }).sort({ createdAt: -1 });

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
      const updated = await Application.findByIdAndUpdate(req.params.id, updates, { new: true });
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
        } else {
          travellers.push({
            travelerNo: Number(travelerNo),
            travelerName: travelerName || '',
            gdriveLink: travelerGdriveLink || '',
            gdriveFurtherInfoLink: String(travelerGdriveFurtherInfoLink || '').trim(),
            documents: {}
          });
        }
        updates.travellerDocuments = travellers.sort((a, b) => a.travelerNo - b.travelerNo);
      }
    }

    const updated = await Application.findByIdAndUpdate(req.params.id, updates, { new: true });
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
      const otherDocuments = [];

      for (let i = 0; i < documentsMeta.length; i += 1) {
        const meta = documentsMeta[i] || {};
        const docType = String(meta.docType || '').trim();
        const docKind = String(meta.kind || '').trim();
        const pathForDoc = paths[i] || '';
        if (docKind === 'other' && pathForDoc) {
          otherDocuments.push(pathForDoc);
          continue;
        }
        if (docType && pathForDoc) {
          docMap[docType] = pathForDoc;
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
        payload.documents = { ...(payload.documents || {}), ...docMap };
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
          otherDocuments,
          uploadedAt: new Date(),
        };
      }

      if (existingIdx >= 0) travellers[existingIdx] = payload;
      else travellers.push(payload);
      application.travellerDocuments = travellers.sort((a, b) => a.travelerNo - b.travelerNo);
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
      transactionId, paymentMethod, paymentStatus, requiredDocuments
    } = req.body;

    // Normalizing the processing days to avoid "NaN" error
    const parsedProcessingDays = normalizeProcessingDays(processingDays);

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
        : ['passport']
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
      { new: true }
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
