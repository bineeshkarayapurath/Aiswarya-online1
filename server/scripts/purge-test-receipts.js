/* eslint-disable no-console */
// One-off maintenance: purge test receipts (and their auto-posted Accounts &
// Finance ledger rows), then reset the receipt counter so numbering restarts.
//
// Usage (run from the server/ directory so .env is picked up):
//   node scripts/purge-test-receipts.js                 -> DRY RUN (shows what would go)
//   node scripts/purge-test-receipts.js --apply         -> actually deletes + resets counter
//   node scripts/purge-test-receipts.js --apply --nos=RCP-2026-0001,RCP-2026-0002
//
// Override the target database without editing .env:
//   MONGO_URI="mongodb+srv://..." node scripts/purge-test-receipts.js --apply

const config = require('../src/config/constants');
const mongoose = require('mongoose');
const TransactionVoucher = require('../src/models/TransactionVoucher');
const Account = require('../src/models/Account');
const Counter = require('../src/models/Counter');
const { computeBalances } = require('../src/services/accountService');

const DEFAULT_NOS = ['RCP-2026-0001', 'RCP-2026-0002'];

function parseArgs(argv) {
  const apply = argv.includes('--apply');
  const noArg = argv.find((a) => a.startsWith('--nos='));
  const nos = noArg
    ? noArg
        .slice('--nos='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : DEFAULT_NOS;
  return { apply, nos };
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

(async () => {
  const { apply, nos } = parseArgs(process.argv.slice(2));
  const year = (nos[0].match(/(\d{4})/) || [, ''])[1];

  await mongoose.connect(config.MONGO_URI);
  const dbName = mongoose.connection.name;
  const host = (mongoose.connection.host || '').replace(/:[^:]*@/, ':****@');
  console.log(`\nTarget database: ${dbName} @ ${host}`);
  console.log(`Mode: ${apply ? 'APPLY (will delete)' : 'DRY RUN (no changes)'}`);
  console.log(`Receipts: ${nos.join(', ')}\n`);

  const before = await computeBalances();

  const vouchers = await TransactionVoucher.find({ voucherNo: { $in: nos } }).lean();
  const accountIds = vouchers.map((v) => v.accountEntryId).filter(Boolean);

  const descRegex = new RegExp(nos.map(escapeRegex).join('|'));
  const accounts = await Account.find({
    $or: [{ _id: { $in: accountIds } }, { description: descRegex }],
  }).lean();

  console.log(`Matched vouchers: ${vouchers.length}`);
  vouchers.forEach((v) =>
    console.log(`  - ${v.voucherNo}  ${v.type}  ${v.partyName}  ${v.amount}  (${v._id})`)
  );
  console.log(`Matched ledger rows: ${accounts.length}`);
  accounts.forEach((a) =>
    console.log(`  - ${a.type}  ${a.amount}  ${a.paymentMode}  ${a.description}  (${a._id})`)
  );

  if (!vouchers.length && !accounts.length) {
    console.log('\nNothing to delete. Counter will still be reset below if applying.');
  }

  if (!apply) {
    console.log('\nDRY RUN complete. Re-run with --apply to delete and reset the counter.\n');
    await mongoose.disconnect();
    return;
  }

  const delAcc = accounts.length
    ? await Account.deleteMany({ _id: { $in: accounts.map((a) => a._id) } })
    : { deletedCount: 0 };
  const delVch = vouchers.length
    ? await TransactionVoucher.deleteMany({ _id: { $in: vouchers.map((v) => v._id) } })
    : { deletedCount: 0 };

  let counterMsg = 'no counter reset requested (could not detect year)';
  if (year) {
    const key = `RCP-${year}`;
    const existing = await Counter.findOne({ key }).lean();
    if (existing) {
      await Counter.updateOne({ key }, { $set: { seq: 0 } });
      counterMsg = `counter "${key}" reset ${existing.seq} -> 0`;
    } else {
      counterMsg = `no "${key}" counter found (nothing to reset)`;
    }
  }

  const after = await computeBalances();

  console.log('\nDeleted:');
  console.log(`  vouchers: ${delVch.deletedCount}`);
  console.log(`  ledger rows: ${delAcc.deletedCount}`);
  console.log(`  ${counterMsg}`);
  console.log('\nBalances before:', JSON.stringify(before));
  console.log('Balances after :', JSON.stringify(after));
  console.log('');

  await mongoose.disconnect();
})().catch((err) => {
  console.error('PURGE FAILED:', err.message);
  process.exit(1);
});
