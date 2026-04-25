const Application = require('../models/Application');

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

/**
 * @route   POST /api/users/application
 * @desc    Submit a new visa application with documents
 * @access  Private (User)
 */
const submitApplication = async (req, res) => {
  try {
    const {
      firstName, lastName, email, passportNo, nationality,
      dob, travelDate, returnDate, countryId, countryName,
      flagEmoji, visaType, fee, processingDays,
      transactionId, paymentMethod, paymentStatus
    } = req.body;

    // Normalizing the processing days to avoid "NaN" error
    const parsedProcessingDays = normalizeProcessingDays(processingDays);

    const application = await Application.create({
      user: req.user.id,
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
      documents: req.body.documents || []
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
    const applications = await Application.find().populate('user', 'name email').sort({ createdAt: -1 });
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
    const application = await Application.findById(req.params.id).populate('user', 'name email phone');
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
  getUserApplications,
  getAllApplications,
  getApplicationById,
  updateApplicationStatus
};  