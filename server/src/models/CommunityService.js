const mongoose = require('mongoose');

const CommunityServiceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['Wedding', 'Funeral Support', 'Medical Assistance', 'General Charity'],
      required: true,
      index: true,
    },
    coordinator: {
      memberId: { type: String, default: '' },
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    eventDate: { type: Date, default: Date.now, index: true },
    description: { type: String, default: '' },

    collections: [
      {
        memberId: { type: String, default: '' },
        memberName: { type: String, default: '' },
        amount: { type: Number, default: 0, min: 0 },
        date: { type: Date, default: Date.now },
      },
    ],

    expenses: [
      {
        itemOrPurpose: { type: String, default: '' },
        amount: { type: Number, default: 0, min: 0 },
        type: { type: String, enum: ['CASH_GIFT', 'PURCHASE'], default: 'CASH_GIFT' },
        remarks: { type: String, default: '' },
      },
    ],

    photos: { type: [String], default: [] },

    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED'],
      default: 'ACTIVE',
      index: true,
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CommunityService', CommunityServiceSchema);
