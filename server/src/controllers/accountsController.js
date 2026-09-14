const Account = require('../models/Account');
const AccountTransfer = require('../models/AccountTransfer');
const { getSettings, updateSettings, computeBalances } = require('../services/accountService');

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toView(a) {
  return {
    ...a,
    _id: String(a._id),
    date: a.date ? new Date(a.date).toISOString() : null,
  };
}

exports.getSettings = async (req, res) => {
  try {
    const settings = await getSettings();
    const balances = await computeBalances();
    return res.json({ settings, balances });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { openingBankBalance, openingCashInHand } = req.body;
    if (openingBankBalance === undefined || openingCashInHand === undefined) {
      return res.status(400).json({ message: 'openingBankBalance and openingCashInHand are required' });
    }
    if (Number(openingBankBalance) < 0 || Number(openingCashInHand) < 0) {
      return res.status(400).json({ message: 'Opening balances cannot be negative' });
    }
    const settings = await updateSettings({
      openingBankBalance,
      openingCashInHand,
      updatedBy: req.user._id,
    });
    const balances = await computeBalances();
    return res.json({ message: 'Opening balances updated', settings, balances });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Manual income/expense entry with mandatory payment mode.
exports.createManualEntry = async (req, res) => {
  try {
    const { type, description, amount, paymentMode, category, details, date } = req.body;
    if (!['Income', 'Expense'].includes(type)) {
      return res.status(400).json({ message: 'type must be Income or Expense' });
    }
    if (!description || !String(description).trim()) {
      return res.status(400).json({ message: 'Description is required' });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than zero' });
    }
    if (!['Bank', 'Cash'].includes(paymentMode)) {
      return res.status(400).json({ message: 'paymentMode must be Bank or Cash' });
    }

    const doc = await Account.create({
      type,
      description: String(description).trim(),
      amount: Math.round(amt * 100) / 100,
      paymentMode,
      category: String(category || '').trim(),
      details: String(details || '').trim(),
      date: date ? new Date(date) : new Date(),
      source: 'manual',
    });

    const balances = await computeBalances();
    return res.status(201).json({ message: 'Entry recorded', account: toView(doc.toObject()), balances });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.listAccounts = async (req, res) => {
  try {
    const { year, type, q, mode } = req.query;
    const filter = {};
    if (['Income', 'Expense'].includes(type)) filter.type = type;
    if (['Bank', 'Cash'].includes(mode)) filter.paymentMode = mode;
    if (year && /^\d{4}$/.test(String(year))) {
      filter.date = {
        $gte: new Date(`${year}-01-01T00:00:00.000Z`),
        $lte: new Date(`${year}-12-31T23:59:59.999Z`),
      };
    }
    if (q && String(q).trim()) {
      filter.$or = [
        { description: { $regex: escapeRegex(String(q).trim()), $options: 'i' } },
        { details: { $regex: escapeRegex(String(q).trim()), $options: 'i' } },
      ];
    }

    const [accounts, totals, byCategory] = await Promise.all([
      Account.find(filter).sort({ date: -1 }).lean(),
      Account.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            income: { $sum: { $cond: [{ $eq: ['$type', 'Income'] }, '$amount', 0] } },
            expense: { $sum: { $cond: [{ $eq: ['$type', 'Expense'] }, '$amount', 0] } },
          },
        },
      ]),
      Account.aggregate([
        { $match: filter },
        { $group: { _id: { type: '$type', category: '$category', mode: '$paymentMode' }, amount: { $sum: '$amount' } } },
        { $sort: { amount: -1 } },
      ]),
    ]);

    const t = totals[0] || { income: 0, expense: 0 };
    const income = Math.round(t.income * 100) / 100;
    const expense = Math.round(t.expense * 100) / 100;
    const balances = await computeBalances();

    return res.json({
      accounts: accounts.map(toView),
      summary: {
        income,
        expense,
        netBalance: Math.round((income - expense) * 100) / 100,
        count: accounts.length,
      },
      byCategory: byCategory.map((c) => ({
        type: c._id.type,
        category: c._id.category || 'General',
        paymentMode: c._id.mode || 'Bank',
        amount: Math.round(c.amount * 100) / 100,
      })),
      balances,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.listTransfers = async (req, res) => {
  try {
    const transfers = await AccountTransfer.find({}).sort({ date: -1 }).lean();
    return res.json({
      transfers: transfers.map((t) => ({
        ...t,
        _id: String(t._id),
        date: t.date ? new Date(t.date).toISOString() : null,
      })),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.createTransfer = async (req, res) => {
  try {
    const { amount, from, to, note, date } = req.body;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than zero' });
    }
    if (!['Bank', 'Cash'].includes(from) || !['Bank', 'Cash'].includes(to) || from === to) {
      return res.status(400).json({ message: 'Transfer must be between Bank and Cash' });
    }

    const doc = await AccountTransfer.create({
      amount: Math.round(amt * 100) / 100,
      from,
      to,
      note: String(note || '').trim(),
      date: date ? new Date(date) : new Date(),
      createdBy: req.user._id,
    });

    const balances = await computeBalances();
    return res.status(201).json({
      message: `${from} → ${to} transfer recorded`,
      transfer: { ...doc.toObject(), _id: String(doc._id) },
      balances,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};