const Razorpay = require('razorpay');
const crypto = require('crypto');
const Settings = require('../models/Settings');
const Transaction = require('../models/Transaction');
const Application = require('../models/Application');

const getRazorpayInstance = async () => {
  const settings = await Settings.findOne({ singleton: 'global' });
  if (!settings || !settings.razorpayKeyId || !settings.razorpayKeySecret) {
    throw new Error("Razorpay keys are not configured in settings");
  }
  return new Razorpay({
    key_id: settings.razorpayKeyId,
    key_secret: settings.razorpayKeySecret
  });
};

/**
 * @route   POST /api/payments/create-order
 * @desc    Create Razorpay Order
 * @access  Private
 */
const createOrder = async (req, res) => {
  try {
    const { amount, applicationId } = req.body;
    
    console.log("--- Payment Debug Start ---");
    console.log("1. Raw Amount from Frontend:", amount);

    const application = await Application.findById(applicationId);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

    const instance = await getRazorpayInstance();

    // 🛠️ LOGIC: Agar amount 1000 se kam hai, toh USD mano. 
    // Agar 1000 se zyada hai, toh samjho frontend ne pehle hi INR bhej diya hai.
    let finalRupees = Number(amount);
    if (finalRupees < 1000) { 
      finalRupees = finalRupees * 83;
      console.log("2. Detected USD, converted to INR:", finalRupees);
    } else {
      console.log("2. Detected INR, using as is:", finalRupees);
    }

    const options = {
      amount: Math.round(finalRupees * 100), // Convert to Paise
      currency: "INR",
      receipt: `receipt_order_${applicationId}`
    };

    console.log("3. Final Amount in Paise (Sent to Razorpay):", options.amount);
    console.log("--- Payment Debug End ---");

    // Safety Check: Agar amount 5 Lakh (50,00,000 paise) se upar hai toh block karo
    if (options.amount > 50000000) {
      return res.status(400).json({ success: false, message: 'Amount too high for test mode' });
    }

    const order = await instance.orders.create(options);
    res.json({ success: true, order });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   POST /api/payments/verify
 * @desc    Verify Razorpay payment signature
 * @access  Private
 */
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, applicationId, amount } = req.body;
    
    const settings = await Settings.findOne({ singleton: 'global' });
    if (!settings || !settings.razorpayKeySecret) {
      return res.status(500).json({ success: false, message: 'Razorpay secret key not found' });
    }

    // Creating our own digest
    const shasum = crypto.createHmac("sha256", settings.razorpayKeySecret);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest("hex");

    // Comparing our digest with the actual signature
    if (digest !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Transaction not legit!" });
    }

    // Success! Save transaction
    const transaction = await Transaction.create({
      user: req.user.id,
      application: applicationId,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      paymentId: razorpay_payment_id,
      amount: amount,
      status: 'success'
    });

    // Update Application payment details
    await Application.findByIdAndUpdate(applicationId, {
      transactionId: razorpay_payment_id,
      paymentMethod: 'Razorpay',
      paymentStatus: 'completed'
    });

    res.json({
      success: true,
      message: "Payment successfully verified",
      transaction
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, message: 'Server error verifying payment' });
  }
};

/**
 * @route   GET /api/payments/my-transactions
 * @desc    Get user's transactions
 * @access  Private (User)
 */
const getMyTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user.id }).populate('application', 'countryName flagEmoji visaType').sort({ createdAt: -1 });
    res.json({ success: true, transactions });
  } catch (error) {
    console.error('Error fetching user transactions:', error);
    res.status(500).json({ success: false, message: 'Server error fetching transactions' });
  }
};

/**
 * @route   GET /api/admin/transactions
 * @desc    Get all transactions (Admin)
 * @access  Private (Admin)
 */
const getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('user', 'name email')
      .populate('application', 'countryName flagEmoji visaType firstName lastName')
      .sort({ createdAt: -1 });
    res.json({ success: true, transactions });
  } catch (error) {
    console.error('Error fetching all transactions:', error);
    res.status(500).json({ success: false, message: 'Server error fetching transactions' });
  }
};

/**
 * @route   POST /api/payments/cancel
 * @desc    Record a cancelled payment
 * @access  Private
 */
const cancelPayment = async (req, res) => {
  try {
    const { applicationId, reason } = req.body;

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // Update Application payment details to cancelled
    await Application.findByIdAndUpdate(applicationId, {
      paymentStatus: 'cancelled',
      notes: reason || 'User cancelled the payment modal'
    });

    // Optionally create a transaction record with 'cancelled' status
    await Transaction.create({
      user: req.user.id,
      application: applicationId,
      amount: application.fee || 0,
      status: 'cancelled',
      notes: reason || 'User cancelled'
    });

    res.json({ success: true, message: 'Payment cancellation recorded' });
  } catch (error) {
    console.error('Error recording payment cancellation:', error);
    res.status(500).json({ success: false, message: 'Server error recording cancellation' });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  cancelPayment,
  getMyTransactions,
  getAllTransactions
};
