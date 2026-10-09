const mongoose = require('./server/node_modules/mongoose');
const cfg = require('./server/src/config/constants');
const TransactionVoucher = require('./server/src/models/TransactionVoucher');

(async () => {
  await mongoose.connect(cfg.MONGO_URI);
  const result = await TransactionVoucher.deleteMany({
    type: 'RECEIPT',
    memberId: 'ALC-005'
  });
  console.log('Deleted receipts for ALC-005:', result.deletedCount);
  await mongoose.disconnect();
})();
