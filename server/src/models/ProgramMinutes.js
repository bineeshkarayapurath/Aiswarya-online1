const mongoose = require('mongoose');

const ProgramMinutesSchema = new mongoose.Schema(
  {
    section: { type: String, required: true, index: true },
    title: { type: String, required: true },
    date: { type: Date, required: true, index: true },
    minutesRichText: { type: String, default: '' },
    minutesPhoto: { type: String, default: '' },
    programDetails: { type: String, default: '' },
    participantCount: { type: Number, default: 0 },
    attendanceSheetPhoto: { type: String, default: '' },
    eventPhotos: { type: [String], default: [] },
    finance: {
      income: [
        {
          description: { type: String, default: '' },
          amount: { type: Number, default: 0 },
          paymentMode: { type: String, enum: ['Bank', 'Cash'], default: 'Bank' },
        },
      ],
      expenses: [
        {
          description: { type: String, default: '' },
          amount: { type: Number, default: 0 },
          paymentMode: { type: String, enum: ['Bank', 'Cash'], default: 'Bank' },
        },
      ],
      totalIncome: { type: Number, default: 0 },
      totalExpense: { type: Number, default: 0 },
      netBalance: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
      default: 'PENDING_APPROVAL',
      index: true,
    },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    rejectionReason: { type: String, default: '' },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// The home page events strip always asks for APPROVED minutes, newest first, so
// it filters on status AND sorts on date. The two single-field indexes above
// cannot serve both at once; this compound one lets MongoDB answer from the
// index without an in-memory sort.
ProgramMinutesSchema.index({ status: 1, date: -1 });

module.exports = mongoose.model('ProgramMinutes', ProgramMinutesSchema);