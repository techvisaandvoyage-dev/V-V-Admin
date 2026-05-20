const TravelerProfile = require('../models/TravelerProfile');
const {
  sanitizeTravelerProfilePayload,
  validateTravelerProfilePayload,
} = require('../utils/travelerProfile');

const listTravelers = async (req, res) => {
  try {
    const travelers = await TravelerProfile.find({ userId: req.user.id }).sort({
      isDefault: -1,
      updatedAt: -1,
    });
    res.json({ success: true, travelers });
  } catch (error) {
    console.error('listTravelers:', error);
    res.status(500).json({ success: false, message: 'Server error fetching travelers' });
  }
};

const createTraveler = async (req, res) => {
  try {
    const payload = sanitizeTravelerProfilePayload(req.body);
    const validationError = validateTravelerProfilePayload(payload);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const existingCount = await TravelerProfile.countDocuments({ userId: req.user.id });
    const shouldBeDefault = req.body.isDefault === true || existingCount === 0;

    if (shouldBeDefault) {
      await TravelerProfile.updateMany({ userId: req.user.id, isDefault: true }, { $set: { isDefault: false } });
    }

    const traveler = await TravelerProfile.create({
      userId: req.user.id,
      ...payload,
      isDefault: shouldBeDefault,
    });

    res.status(201).json({ success: true, traveler });
  } catch (error) {
    console.error('createTraveler:', error);
    res.status(500).json({ success: false, message: 'Server error creating traveler' });
  }
};

const updateTraveler = async (req, res) => {
  try {
    const traveler = await TravelerProfile.findOne({ _id: req.params.id, userId: req.user.id });
    if (!traveler) {
      return res.status(404).json({ success: false, message: 'Traveler not found' });
    }

    const payload = sanitizeTravelerProfilePayload(req.body);
    const validationError = validateTravelerProfilePayload(payload);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const shouldBeDefault = req.body.isDefault === true;
    if (shouldBeDefault) {
      await TravelerProfile.updateMany(
        { userId: req.user.id, _id: { $ne: traveler._id }, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    Object.assign(traveler, payload, {
      isDefault: shouldBeDefault ? true : traveler.isDefault,
    });
    await traveler.save();

    res.json({ success: true, traveler });
  } catch (error) {
    console.error('updateTraveler:', error);
    res.status(500).json({ success: false, message: 'Server error updating traveler' });
  }
};

const deleteTraveler = async (req, res) => {
  try {
    const traveler = await TravelerProfile.findOne({ _id: req.params.id, userId: req.user.id });
    if (!traveler) {
      return res.status(404).json({ success: false, message: 'Traveler not found' });
    }

    const wasDefault = traveler.isDefault === true;
    await traveler.deleteOne();

    if (wasDefault) {
      const nextTraveler = await TravelerProfile.findOne({ userId: req.user.id }).sort({ updatedAt: -1 });
      if (nextTraveler) {
        nextTraveler.isDefault = true;
        await nextTraveler.save();
      }
    }

    res.json({ success: true, message: 'Traveler deleted successfully' });
  } catch (error) {
    console.error('deleteTraveler:', error);
    res.status(500).json({ success: false, message: 'Server error deleting traveler' });
  }
};

const setDefaultTraveler = async (req, res) => {
  try {
    const traveler = await TravelerProfile.findOne({ _id: req.params.id, userId: req.user.id });
    if (!traveler) {
      return res.status(404).json({ success: false, message: 'Traveler not found' });
    }

    await TravelerProfile.updateMany({ userId: req.user.id, isDefault: true }, { $set: { isDefault: false } });
    traveler.isDefault = true;
    await traveler.save();

    res.json({ success: true, traveler });
  } catch (error) {
    console.error('setDefaultTraveler:', error);
    res.status(500).json({ success: false, message: 'Server error setting default traveler' });
  }
};

module.exports = {
  listTravelers,
  createTraveler,
  updateTraveler,
  deleteTraveler,
  setDefaultTraveler,
};
