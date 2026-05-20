const mongoose = require('mongoose');

const travelerFieldSchemaDefinition = {
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, required: true, trim: true, maxlength: 32 },
  passportNumber: { type: String, required: true, trim: true, maxlength: 64 },
  passportExpiryDate: { type: Date, required: true },
  nationality: { type: String, required: true, trim: true, maxlength: 80 },
  mobileNumber: { type: String, required: true, trim: true, maxlength: 32 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
  relationship: { type: String, required: true, trim: true, maxlength: 64 },
};

const travelerSnapshotSchemaDefinition = {
  ...travelerFieldSchemaDefinition,
  travelerProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TravelerProfile',
    default: null,
  },
};

const normalizeString = (value, fallback = '') => String(value ?? fallback).trim();

const normalizeDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const sanitizeTravelerProfilePayload = (payload = {}) => ({
  fullName: normalizeString(payload.fullName),
  dateOfBirth: normalizeDate(payload.dateOfBirth),
  gender: normalizeString(payload.gender),
  passportNumber: normalizeString(payload.passportNumber).toUpperCase(),
  passportExpiryDate: normalizeDate(payload.passportExpiryDate),
  nationality: normalizeString(payload.nationality),
  mobileNumber: normalizeString(payload.mobileNumber),
  email: normalizeString(payload.email).toLowerCase(),
  relationship: normalizeString(payload.relationship),
});

const validateTravelerProfilePayload = (payload = {}) => {
  const required = [
    ['fullName', 'Full name is required'],
    ['dateOfBirth', 'Date of birth is required'],
    ['gender', 'Gender is required'],
    ['passportNumber', 'Passport number is required'],
    ['passportExpiryDate', 'Passport expiry date is required'],
    ['nationality', 'Nationality is required'],
    ['mobileNumber', 'Mobile number is required'],
    ['email', 'Email is required'],
    ['relationship', 'Relationship is required'],
  ];

  for (const [key, message] of required) {
    if (!payload[key]) return message;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return 'Enter a valid traveler email address';
  }

  return '';
};

const buildTravelerSnapshot = (payload = {}, travelerProfileId = null) => ({
  fullName: normalizeString(payload.fullName),
  dateOfBirth: normalizeDate(payload.dateOfBirth),
  gender: normalizeString(payload.gender),
  passportNumber: normalizeString(payload.passportNumber).toUpperCase(),
  passportExpiryDate: normalizeDate(payload.passportExpiryDate),
  nationality: normalizeString(payload.nationality),
  mobileNumber: normalizeString(payload.mobileNumber),
  email: normalizeString(payload.email).toLowerCase(),
  relationship: normalizeString(payload.relationship),
  travelerProfileId: travelerProfileId || payload.travelerProfileId || null,
});

module.exports = {
  travelerFieldSchemaDefinition,
  travelerSnapshotSchemaDefinition,
  sanitizeTravelerProfilePayload,
  validateTravelerProfilePayload,
  buildTravelerSnapshot,
};
