const mongoose = require('mongoose');

const AccountTransferSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    from: { type: String, enum: ['Bank', 'Cash'], required: true },
    to: { type: String, enum: ['Bank', 'Cash'], required: true },
    note: { type: String, default: '' },
    date: { type: Date, default: Date.now, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

AccountTransferSchema.pre('validate', function (next) {
  if (this.from === this.to) {
    next(new Error('Internal transfer must be between Bank and Cash'));
  } else {
    next();
  }
});

module.exports = mongoose.model('AccountTransfer', AccountTransferSchema);