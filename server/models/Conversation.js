const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  userName: {
    type: String,
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userPhone: {
    type: String,
    default: ""
  },
  lastMessage: {
    type: String,
    default: ""
  },
  unreadCount: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  },
  adminTyping: {
    type: Boolean,
    default: false
  },
  adminTypingAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Conversation', conversationSchema);
