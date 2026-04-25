const Settings = require('../models/Settings');

/**
 * @route   GET /api/admin/settings
 * @desc    Get global settings (Admin only)
 * @access  Private (Admin)
 */
const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne({ singleton: 'global' });
    if (!settings) {
      settings = await Settings.create({ singleton: 'global' });
    }
    res.json({ success: true, settings });
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
    const { razorpayKeyId, razorpayKeySecret } = req.body;
    console.log('Admin updating settings:', { razorpayKeyId, razorpayKeySecret: '***' });
    
    let settings = await Settings.findOne({ singleton: 'global' });
    if (!settings) {
      console.log('Creating global settings singleton...');
      settings = await Settings.create({ singleton: 'global' });
    }
    
    if (razorpayKeyId !== undefined) settings.razorpayKeyId = razorpayKeyId;
    if (razorpayKeySecret !== undefined) settings.razorpayKeySecret = razorpayKeySecret;
    
    await settings.save();
    console.log('Settings updated successfully');
    res.json({ success: true, settings, message: 'Settings updated successfully' });
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
    const settings = await Settings.findOne({ singleton: 'global' });
    if (!settings || !settings.razorpayKeyId) {
      return res.status(404).json({ success: false, message: 'Razorpay keys not configured' });
    }
    res.json({ success: true, keyId: settings.razorpayKeyId });
  } catch (error) {
    console.error('Error fetching Razorpay Key ID:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  getRazorpayKeyId
};
