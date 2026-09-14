const config = require('../config/constants');
const User = require('../models/User');
const Account = require('../models/Account');
const TransactionVoucher = require('../models/TransactionVoucher');
const { getNextSequence } = require('../models/Counter');
const { computeBalances } = require('../services/accountService');

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toView(v) {
  const o = v.toObject ? v.toObject() : v;
  return {
    ...o,
    _id: String(o._id),
    date: o.date ? new Date(o.date).toISOString() : null,
  };
}

// Map voucher payment modes onto the Accounts & Finance ledger buckets.
function toLedgerMode(paymentMode) {
  return paymentMode === 'CASH' ? 'Cash' : 'Bank';
}

// RCP-2026-0001 (RECEIPT) / VCH-2026-0001 (VOUCHER)
async function nextVoucherNo(type, year) {
  const prefix = type === 'RECEIPT' ? 'RCP' : 'VCH';
  const seq = await getNextSequence(`${prefix}-${year}`);
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}

const CATEGORIES = [
  'Membership Fee',
  'Donation',
  'Maintenance',
  'Event Expense',
  'Subscription',
  'Library Fine',
  'Sports Fund',
  'Other',
];

// Admin: search approved members by membership ID / name / phone for the form.
exports.searchMembers = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const filter = { status: config.STATUS.APPROVED, membershipId: { $ne: '' } };
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ membershipId: rx }, { phoneNumber: rx }, { fullName: rx }];
    }
    const users = await User.find(filter)
      .select('membershipId fullName phoneNumber')
      .limit(15)
      .sort({ membershipId: 1 });
    const members = users
      .filter((u) => u.membershipId)
      .map((u) => ({ membershipId: u.membershipId, fullName: u.fullName, phoneNumber: u.phoneNumber }));
    return res.json({ members });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Create a Receipt (income) or Voucher (expense) and post the matching ledger
// entry to Accounts & Finance automatically.
exports.createVoucher = async (req, res) => {
  try {
    const { type, partyType, memberId, partyName, phone, amount, category, paymentMode, date, remarks } = req.body;

    if (!['RECEIPT', 'VOUCHER'].includes(type)) {
      return res.status(400).json({ message: 'type must be RECEIPT or VOUCHER' });
    }
    if (!['MEMBER', 'NON_MEMBER'].includes(partyType)) {
      return res.status(400).json({ message: 'partyType must be MEMBER or NON_MEMBER' });
    }
    if (!['CASH', 'UPI', 'BANK_TRANSFER'].includes(paymentMode)) {
      return res.status(400).json({ message: 'paymentMode must be CASH, UPI or BANK_TRANSFER' });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than zero' });
    }

    let resolvedMember = null;
    let name = String(partyName || '').trim();
    const phoneNo = String(phone || '').trim();

    if (partyType === 'MEMBER') {
      if (!memberId) {
        return res.status(400).json({ message: 'Select a member before generating the voucher' });
      }
      resolvedMember = await User.findOne({ membershipId: String(memberId).trim(), status: config.STATUS.APPROVED });
      if (!resolvedMember) {
        return res.status(400).json({ message: `No approved member found with ID ${memberId}` });
      }
      name = resolvedMember.fullName;
    } else if (!name && !phoneNo) {
      return res.status(400).json({ message: 'Party name is required for non-members' });
    }

    const year = new Date().getFullYear();
    const voucherNo = await nextVoucherNo(type, year);

    const voucher = await TransactionVoucher.create({
      type,
      voucherNo,
      partyType,
      memberId: partyType === 'MEMBER' ? resolvedMember.membershipId : '',
      partyName: name,
      phone: partyType === 'MEMBER' ? resolvedMember.phoneNumber : phoneNo,
      amount: Math.round(amt * 100) / 100,
      category: String(category || '').trim(),
      paymentMode,
      date: date ? new Date(date) : new Date(),
      remarks: String(remarks || '').trim(),
      createdBy: req.user._id,
    });

    // Automatically post to the Accounts & Finance ledger.
    const ledgerType = type === 'RECEIPT' ? 'Income' : 'Expense';
    const account = await Account.create({
      type: ledgerType,
      description: `${type === 'RECEIPT' ? 'Receipt' : 'Voucher'} ${voucherNo} — ${voucher.category || 'General'} (${name})`,
      amount: voucher.amount,
      paymentMode: toLedgerMode(paymentMode),
      category: voucher.category || 'General',
      details: `${name}${phoneNo ? ` · ${phoneNo}` : ''}${remarks ? ` · ${remarks}` : ''}`.slice(0, 240),
      date: voucher.date,
      source: 'manual',
    });
    voucher.accountEntryId = account._id;
    await voucher.save();

    const balances = await computeBalances();
    return res.status(201).json({ message: `${type === 'RECEIPT' ? 'Receipt' : 'Voucher'} generated`, voucher: toView(voucher), balances });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.listVouchers = async (req, res) => {
  try {
    const { type, q, year } = req.query;
    const filter = {};
    if (type === 'RECEIPT' || type === 'VOUCHER') filter.type = type;
    if (year && /^\d{4}$/.test(String(year))) {
      filter.date = {
        $gte: new Date(`${year}-01-01T00:00:00.000Z`),
        $lte: new Date(`${year}-12-31T23:59:59.999Z`),
      };
    }
    if (q && String(q).trim()) {
      const rx = new RegExp(escapeRegex(String(q).trim()), 'i');
      filter.$or = [{ voucherNo: rx }, { partyName: rx }, { phone: rx }, { memberId: rx }, { category: rx }];
    }
    const [list, totals] = await Promise.all([
      TransactionVoucher.find(filter).sort({ createdAt: -1 }).limit(200).lean(),
      TransactionVoucher.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$type',
            amount: { $sum: '$amount' },
          },
        },
      ]),
    ]);
    const summary = { receipt: 0, voucher: 0, total: 0 };
    totals.forEach((t) => {
      const amt = Math.round(t.amount * 100) / 100;
      if (t._id === 'RECEIPT') summary.receipt = amt;
      if (t._id === 'VOUCHER') summary.voucher = amt;
      summary.total += amt;
    });
    return res.json({ vouchers: list.map(toView), summary, count: list.length });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getVoucher = async (req, res) => {
  try {
    const v = await TransactionVoucher.findById(req.params.id);
    if (!v) return res.status(404).json({ message: 'Voucher not found' });
    return res.json({ voucher: toView(v) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Member-facing: every receipt issued against the logged-in member's ID.
exports.myReceipts = async (req, res) => {
  try {
    const memberId = req.user.membershipId;
    if (!memberId) return res.json({ vouchers: [], count: 0 });
    const list = await TransactionVoucher.find({ memberId }).sort({ createdAt: -1 }).lean();
    return res.json({ vouchers: list.map(toView), count: list.length });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.CATEGORIES = CATEGORIES;