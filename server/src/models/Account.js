const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Income', 'Expense'], required: true, index: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, default: '' },
    paymentMode: { type: String, enum: ['Bank', 'Cash'], default: 'Bank', index: true },
    details: { type: String, default: '' },
    source: { type: String, enum: ['program', 'manual'], default: 'manual' },
    program: { type: String, default: '' },
    programId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProgramMinutes', default: null },
    section: { type: String, default: '' },
    date: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Account', AccountSchema);