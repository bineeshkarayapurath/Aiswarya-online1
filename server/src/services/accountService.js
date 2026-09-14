const Account = require('../models/Account');
const AccountTransfer = require('../models/AccountTransfer');
const AccountSettings = require('../models/AccountSettings');

let cachedSettings = null;
let cachedSettingsAt = 0;
const SETTINGS_TTL = 5000;

async function getSettings({ touchCache = false } = {}) {
  if (touchCache || !cachedSettings || Date.now() - cachedSettingsAt > SETTINGS_TTL) {
    let doc = await AccountSettings.findOne({ key: 'default' });
    if (!doc) doc = await AccountSettings.create({ key: 'default', openingBankBalance: 0, openingCashInHand: 0 });
    cachedSettings = doc.toObject();
    cachedSettingsAt = Date.now();
  }
  return { openingBankBalance: cachedSettings.openingBankBalance || 0, openingCashInHand: cachedSettings.openingCashInHand || 0 };
}

async function updateSettings({ openingBankBalance, openingCashInHand, updatedBy = null }) {
  const doc = await AccountSettings.findOneAndUpdate(
    { key: 'default' },
    {
      $set: {
        openingBankBalance: Number(openingBankBalance) || 0,
        openingCashInHand: Number(openingCashInHand) || 0,
        updatedBy,
      },
    },
    { upsert: true, new: true }
  );
  cachedSettings = doc.toObject();
  cachedSettingsAt = Date.now();
  return { openingBankBalance: doc.openingBankBalance, openingCashInHand: doc.openingCashInHand };
}

// Real-time balances derived from opening balances + transaction flows + internal transfers.
async function computeBalances() {
  const { openingBankBalance, openingCashInHand } = await getSettings();

  const [flows, allTransfers] = await Promise.all([
    Account.aggregate([
      {
        $group: {
          _id: { type: '$type', mode: '$paymentMode' },
          amount: { $sum: '$amount' },
        },
      },
    ]),
    AccountTransfer.find({}),
  ]);

  const f = { incomeBank: 0, incomeCash: 0, expenseBank: 0, expenseCash: 0 };
  flows.forEach((g) => {
    const key = `${g._id.type === 'Income' ? 'income' : 'expense'}${g._id.mode === 'Bank' ? 'Bank' : 'Cash'}`;
    f[key] = g.amount;
  });

  const transferIn = { Bank: 0, Cash: 0 };
  const transferOut = { Bank: 0, Cash: 0 };
  allTransfers.forEach((t) => {
    transferIn[t.to] += t.amount;
    transferOut[t.from] += t.amount;
  });

  const bankBalance = openingBankBalance + f.incomeBank - f.expenseBank + (transferIn.Bank - transferOut.Bank);
  const cashBalance = openingCashInHand + f.incomeCash - f.expenseCash + (transferIn.Cash - transferOut.Cash);

  return {
    openingBankBalance,
    openingCashInHand,
    incomeBank: f.incomeBank,
    incomeCash: f.incomeCash,
    expenseBank: f.expenseBank,
    expenseCash: f.expenseCash,
    transfersToBank: transferIn.Bank,
    transfersFromBank: transferOut.Bank,
    bankBalance: Math.round(bankBalance * 100) / 100,
    cashBalance: Math.round(cashBalance * 100) / 100,
    clubBalance: Math.round((bankBalance + cashBalance) * 100) / 100,
  };
}

module.exports = { getSettings, updateSettings, computeBalances };