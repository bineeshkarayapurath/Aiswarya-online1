/* eslint-disable no-console */
// One-off maintenance: wipe EVERY financial record and start from a clean slate.
//
// Removes:
//   - transactionvouchers  (all Receipts & Vouchers)
//   - accounts             (all Accounts & Finance Income/Expense ledger rows)
//   - accounttransfers     (all internal Bank <-> Cash transfers)
//   - accountsettings      (opening balances reset to 0)
//   - RCP-<year> / VCH-<year> counters reset to 0 (next document = 0001)
//
// Balances shown on the dashboard are derived live from these collections, so
// once they are cleared Cash in Hand, Bank Balance and Net Club Balance read 0.
//
// Usage (run from the server/ directory so .env is picked up):
//   node scripts/purge-all-financials.js            -> DRY RUN (counts only)
//   node scripts/purge-all-financials.js --apply    -> actually deletes everything
//
// Override the target database without editing .env:
//   MONGO_URI="mongodb+srv://..." node scripts/purge-all-financials.js --apply

const config = require('../src/config/constants');
const mongoose = require('mongoose');
const TransactionVoucher = require('../src/models/TransactionVoucher');
const Account = require('../src/models/Account');
const AccountTransfer = require('../src/models/AccountTransfer');
const AccountSettings = require('../src/models/AccountSettings');
const Counter = require('../src/models/Counter');
const { computeBalances, updateSettings } = require('../src/services/accountService');

const COUNTER_RE = /^(RCP|VCH)-\d{4}$/;

async function snapshot() {
  const [vouchers, receipts, accounts, transfers, counters] = await Promise.all([
    TransactionVoucher.countDocuments({}),
    TransactionVoucher.countDocuments({ type: 'RECEIPT' }),
    Account.countDocuments({}),
    AccountTransfer.countDocuments({}),
    Counter.find({ key: COUNTER_RE }).lean(),
  ]);
  const settings = await AccountSettings.find({}).lean();
  return { vouchers, receipts, vouchersOut: vouchers - receipts, accounts, transfers, counters, settings };
}

(async () => {
  const apply = process.argv.includes('--apply');

  await mongoose.connect(config.MONGO_URI);
  const dbName = mongoose.connection.name;
  const host = (mongoose.connection.host || '').replace(/:[^:]*@/, ':****@');
  console.log(`\nTarget database: ${dbName} @ ${host}`);
  console.log(`Mode: ${apply ? 'APPLY (will DELETE all financial data)' : 'DRY RUN (no changes)'}`);

  const before = await snapshot();
  console.log('\nCurrent records:');
  console.log(`  receipts:          ${before.receipts}`);
  console.log(`  vouchers (expense):${before.vouchersOut}`);
  console.log(`  ledger rows:       ${before.accounts}`);
  console.log(`  transfers:         ${before.transfers}`);
  console.log(`  counters:          ${before.counters.map((c) => `${c.key}=${c.seq}`).join(', ') || '(none)'}`);
  console.log(`  opening balances:  bank=${before.settings[0] ? before.settings[0].openingBankBalance : 0} cash=${before.settings[0] ? before.settings[0].openingCashInHand : 0}`);
  console.log(`  balances:          ${JSON.stringify(await computeBalances())}`);

  if (!apply) {
    console.log('\nDRY RUN complete. Re-run with --apply to purge everything and reset counters.\n');
    await mongoose.disconnect();
    return;
  }

  const delVouchers = await TransactionVoucher.deleteMany({});
  const delAccounts = await Account.deleteMany({});
  const delTransfers = await AccountTransfer.deleteMany({});
  // Zero every settings doc, then upsert 'default' via updateSettings so the
  // in-process settings cache (5s TTL in accountService) is invalidated too.
  const resetSettings = await AccountSettings.updateMany(
    {},
    { $set: { openingBankBalance: 0, openingCashInHand: 0, updatedBy: null } }
  );
  await updateSettings({ openingBankBalance: 0, openingCashInHand: 0 });
  const resetCounters = await Counter.updateMany({ key: COUNTER_RE }, { $set: { seq: 0 } });

  const after = await snapshot();
  const balances = await computeBalances();

  console.log('\nPurged:');
  console.log(`  transactionvouchers: ${delVouchers.deletedCount}`);
  console.log(`  accounts:            ${delAccounts.deletedCount}`);
  console.log(`  accounttransfers:    ${delTransfers.deletedCount}`);
  console.log(`  accountsettings zeroed: ${resetSettings.modifiedCount}`);
  console.log(`  counters reset:      ${resetCounters.modifiedCount}`);
  console.log('\nAfter:');
  console.log(`  remaining vouchers/accounts/transfers: ${after.vouchers}/${after.accounts}/${after.transfers}`);
  console.log(`  counters: ${after.counters.map((c) => `${c.key}=${c.seq}`).join(', ') || '(none)'}`);
  console.log(`  balances: ${JSON.stringify(balances)}`);

  const clean =
    after.vouchers === 0 &&
    after.accounts === 0 &&
    after.transfers === 0 &&
    balances.bankBalance === 0 &&
    balances.cashBalance === 0 &&
    balances.clubBalance === 0;
  console.log(`\n${clean ? 'CLEAN SLATE CONFIRMED' : 'WARNING: not fully clean, review above'}\n`);

  await mongoose.disconnect();
})().catch((err) => {
  console.error('PURGE FAILED:', err.message);
  process.exit(1);
});
