const mongoose = require('mongoose');

// Receipts & Vouchers — official money-in / money-out documents. Every record
// is auto-numbered (voucherNo) and, for accounting, each creates a matching
// Income / Expense ledger entry in Accounts & Finance (see reference).
const TransactionVoucherSchema = new mongoose.Schema(
  {
    // 'RECEIPT' = money in (income), 'VOUCHER' = money out (expense).
    type: { type: String, enum: ['RECEIPT', 'VOUCHER'], required: true, index: true },
    // Auto-incremented per type per financial year, e.g. RCP-2026-0001 / VCH-2026-0001.
    voucherNo: { type: String, required: true, unique: true, index: true },

    partyType: { type: String, enum: ['MEMBER', 'NON_MEMBER'], required: true },
    // The member's membershipId string (matches User.membershipId) when
    // partyType is MEMBER. Kept as a string ref for simplicity.
    memberId: { type: String, default: '', index: true },
    partyName: { type: String, required: true },
    phone: { type: String, default: '' },

    amount: { type: Number, required: true, min: 0 },
    category: { type: String, default: '' },
    paymentMode: {
      type: String,
      enum: ['CASH', 'UPI', 'BANK_TRANSFER'],
      default: 'CASH',
      index: true,
    },
    date: { type: Date, default: Date.now, index: true },
    remarks: { type: String, default: '' },

    // Reference to the auto-created Accounts & Finance ledger entry.
    accountEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TransactionVoucher', TransactionVoucherSchema);