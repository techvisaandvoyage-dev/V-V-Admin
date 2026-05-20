const mongoose = require('mongoose');
const { travelerFieldSchemaDefinition } = require('../utils/travelerProfile');

const travelerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    ...travelerFieldSchemaDefinition,
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

travelerProfileSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('TravelerProfile', travelerProfileSchema);
