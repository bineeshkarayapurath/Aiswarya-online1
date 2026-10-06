const mongoose = require('mongoose');
const config = require('./constants');
const Book = require('../models/Book');
const BookIssue = require('../models/BookIssue');
const ProgramMinutes = require('../models/ProgramMinutes');
const User = require('../models/User');

// MongoDB derives an index's default name from its key pattern. When a schema
// later pins an explicit name, a database that already carries the same keys
// under the older default name rejects createIndexes with "Index already exists
// with a different name" — and awaiting that here used to abort connectDB,
// taking the whole API down over a difference that affects nothing but the
// index's label.
//
// So: if the existing index is equivalent (same keys, same options, only the
// name differs) drop it and create the declared one; anything else is logged
// and startup continues, because a missing index costs query speed, not the
// server.
function keySignature(keys) {
  return JSON.stringify(Object.entries(keys || {}).sort());
}
function optionSignature(opts) {
  const out = {};
  ['unique', 'sparse', 'expireAfterSeconds', 'partialFilterExpression'].forEach((k) => {
    if (opts && opts[k] !== undefined && opts[k] !== false) out[k] = opts[k];
  });
  return JSON.stringify(out);
}

async function ensureIndexes(model) {
  try {
    await model.createIndexes();
  } catch (err) {
    const m = /already exists with a different name:\s*(\S+)/i.exec(err.message || '');
    if (!m) {
      console.warn(`[db] ${model.modelName}: indexes not created: ${err.message}`);
      return;
    }
    const staleName = m[1];
    try {
      const stale = (await model.collection.indexes()).find((i) => i.name === staleName);
      const equivalent = model.schema
        .indexes()
        .find(
          ([keys, opts]) =>
            stale &&
            keySignature(keys) === keySignature(stale.key) &&
            optionSignature(opts) === optionSignature(stale)
        );
      if (!equivalent) {
        console.warn(
          `[db] ${model.modelName}: "${staleName}" conflicts with a declared index but is not equivalent; leaving it in place`
        );
        return;
      }
      await model.collection.dropIndex(staleName);
      await model.createIndexes();
      console.warn(`[db] ${model.modelName}: replaced stale index "${staleName}" with the declared name`);
    } catch (e2) {
      console.warn(`[db] ${model.modelName}: could not reconcile index "${staleName}": ${e2.message}`);
    }
  }
}

async function connectDB() {
  try {
    await mongoose.connect(config.MONGO_URI);
    // Drop the old "stockNumber+title+author+category" text index (if a build
    // from an earlier run left it behind) and create the Unicode-safe
    // "catalog_text" index defined in the Book schema.
    try {
      await Book.syncIndexes();
    } catch (err) {
      console.warn(`[db] Book.syncIndexes skipped: ${err.message}`);
    }
    // Everything else uses createIndexes rather than syncIndexes on purpose:
    // syncIndexes DROPS any index not declared in the schema, and these models
    // carry indexes added by hand or by scripts. createIndexes is additive, so
    // booting the API can never quietly delete an index that is not visible in
    // the model files.
    //
    // These back the home page reads: the loan-availability lookup on BookIssue
    // (status + stockNumber), the approved-events strip on ProgramMinutes
    // (status + date) and the member counters on User (status + membershipId).
    await ensureIndexes(BookIssue);
    await ensureIndexes(ProgramMinutes);
    await ensureIndexes(User);
    // eslint-disable-next-line no-console
    console.log('MongoDB connected');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;