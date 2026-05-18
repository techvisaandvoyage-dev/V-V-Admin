const Razorpay = require('razorpay');
const crypto = require('crypto');
const Settings = require('../models/Settings');
const Transaction = require('../models/Transaction');
const Application = require('../models/Application');

const appendApplicationNote = (application, message) => {
  const line = String(message || '').trim();
  if (!line) return;
  const current = String(application.notes || '').trim();
  if (current.includes(line)) return;
  application.notes = current ? `${current}\n${line}` : line;
};

const getRazorpayCredentials = async () => {
  const settings = await Settings.findOne({ singleton: 'global' });
  const keyId =
    String(settings?.razorpayKeyId || '').trim() ||
    String(process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret =
    String(settings?.razorpayKeySecret || '').trim() ||
    String(process.env.RAZORPAY_KEY_SECRET || '').trim();
  return { keyId, keySecret };
};

const getRazorpayInstance = async () => {
  const { keyId, keySecret } = await getRazorpayCredentials();
  if (!keyId || !keySecret) {
    throw new Error("Razorpay keys are not configured in settings");
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret
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
    if (String(application.user) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not allowed for this application' });
    }

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

    appendApplicationNote(application, `Payment order created on ${new Date().toISOString()}`);
    await application.save();

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

    if (!applicationId) {
      return res.status(400).json({ success: false, message: 'applicationId is required' });
    }

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    if (String(application.user) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not allowed for this application' });
    }

    const { keySecret } = await getRazorpayCredentials();
    if (!keySecret) {
      return res.status(500).json({ success: false, message: 'Razorpay secret key not found' });
    }

    const shasum = crypto.createHmac("sha256", keySecret);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest("hex");

    if (digest !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Transaction not legit!" });
    }

    const transaction = await Transaction.create({
      user: req.user.id,
      application: applicationId,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      paymentId: razorpay_payment_id,
      amount: amount,
      status: 'success'
    });

    application.transactionId = razorpay_payment_id;
    application.paymentMethod = 'Razorpay';
    application.paymentStatus = 'completed';
    application.status = 'review';
    const orderLine = `Razorpay order: ${razorpay_order_id}`;
    appendApplicationNote(application, orderLine);
    appendApplicationNote(application, `Payment completed on ${new Date().toISOString()}`);
    await application.save();

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
    const transactions = await Transaction.find({ user: req.user.id }).populate('application', 'applicationId countryName flagEmoji visaType').sort({ createdAt: -1 });
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
      .populate('application', 'applicationId countryName flagEmoji visaType firstName lastName transactionId paymentStatus')
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
    const { applicationId, reason, razorpayOrderId } = req.body;

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    if (String(application.user) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not allowed for this application' });
    }

    const normalizedOrderId = String(razorpayOrderId || '').trim();
    if (normalizedOrderId) {
      const existing = await Transaction.findOne({
        application: applicationId,
        razorpayOrderId: normalizedOrderId,
        status: { $in: ['failed', 'cancelled'] },
      });
      if (existing) {
        return res.json({
          success: true,
          message: 'Payment outcome already recorded',
          transaction: existing,
          deduped: true,
        });
      }
    }

    if (application.paymentStatus !== 'completed') {
      application.paymentStatus = 'pending_payment';
    }
    appendApplicationNote(application, reason || 'User closed checkout before paying');
    appendApplicationNote(application, `Payment not completed on ${new Date().toISOString()}`);
    await application.save();

    await Transaction.create({
      user: req.user.id,
      application: applicationId,
      razorpayOrderId: normalizedOrderId,
      amount: application.fee || 0,
      status: 'failed',
      notes: reason || 'Checkout closed before payment'
    });

    res.json({ success: true, message: 'Payment cancellation recorded' });
  } catch (error) {
    console.error('Error recording payment cancellation:', error);
    res.status(500).json({ success: false, message: 'Server error recording cancellation' });
  }
};

const failPayment = async (req, res) => {
  try {
    const {
      applicationId,
      reason,
      razorpayOrderId,
      razorpayPaymentId,
      source: sourceRaw,
    } = req.body;
    const source = String(sourceRaw || 'gateway').toLowerCase();
    const normalizedOrderId = String(razorpayOrderId || '').trim();

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    if (String(application.user) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not allowed for this application' });
    }

    if (normalizedOrderId) {
      const existing = await Transaction.findOne({
        application: applicationId,
        razorpayOrderId: normalizedOrderId,
        status: { $in: ['failed', 'cancelled'] },
      });
      if (existing) {
        return res.json({
          success: true,
          message: 'Payment outcome already recorded',
          transaction: existing,
          deduped: true,
        });
      }
    }

    if (application.paymentStatus !== 'completed') {
      if (source === 'dismiss') {
        application.paymentStatus = 'pending_payment';
        appendApplicationNote(application, reason || 'User closed checkout before paying');
        appendApplicationNote(application, `Payment not completed on ${new Date().toISOString()}`);
      } else {
        application.paymentStatus = 'failed';
        if (razorpayPaymentId) application.transactionId = razorpayPaymentId;
        if (!application.paymentMethod) application.paymentMethod = 'Razorpay';
        appendApplicationNote(application, reason || 'Payment failed');
        if (normalizedOrderId) appendApplicationNote(application, `Failed order: ${normalizedOrderId}`);
        appendApplicationNote(application, `Payment failed on ${new Date().toISOString()}`);
      }
      await application.save();
    }

    const transaction = await Transaction.create({
      user: req.user.id,
      application: applicationId,
      razorpayOrderId: normalizedOrderId,
      razorpayPaymentId: razorpayPaymentId || '',
      paymentId: razorpayPaymentId || '',
      amount: application.fee || 0,
      status: 'failed',
      notes: reason || 'Payment failed',
    });

    res.json({ success: true, message: 'Payment failure recorded', transaction });
  } catch (error) {
    console.error('Error recording payment failure:', error);
    res.status(500).json({ success: false, message: 'Server error recording failed payment' });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  cancelPayment,
  failPayment,
  getMyTransactions,
  getAllTransactions
};
