const mongoose = require('mongoose');

const SECTION_TYPES = [
  'heading',
  'paragraph',
  'image',
  'gallery',
  'faq',
  'video',
  'list',
  'quote',
  'table',
];

/**
 * Embedded section document for BlogPost. `payload` holds type-specific fields
 * (rich text JSON, URLs, FAQ pairs, table rows, etc.) as structured objects.
 */
const blogSectionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: SECTION_TYPES,
      required: true,
    },
    order: { type: Number, default: 0 },
    /** Type-specific content; validated loosely at API layer for flexibility */
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: true, timestamps: true }
);

module.exports = { blogSectionSchema, SECTION_TYPES };
