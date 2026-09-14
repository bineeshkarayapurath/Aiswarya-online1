const mongoose = require('mongoose');

const AccountSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    openingBankBalance: { type: Number, default: 0, min: 0 },
    openingCashInHand: { type: Number, default: 0, min: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AccountSettings', AccountSettingsSchema);