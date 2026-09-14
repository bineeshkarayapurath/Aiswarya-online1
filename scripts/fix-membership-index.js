const mongoose = require('../server/node_modules/mongoose');
const cfg = require('../server/src/config/constants');

(async () => {
  await mongoose.connect(cfg.MONGO_URI);
  const col = mongoose.connection.db.collection('users');
  const r1 = await col.find({ membershipId: null }).toArray();
  const r2 = await col.updateMany({ membershipId: null }, { $unset: { membershipId: 1 } });
  console.log('null membershipId docs:', r1.map((d) => d.fullName || d._id));
  console.log('unset matched:', r2.matchedCount, 'modified:', r2.modifiedCount);
  const idx = await col.indexes();
  console.log('membershipId index:', JSON.stringify(idx.find((i) => i.name === 'membershipId_1')));
  await mongoose.disconnect();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});