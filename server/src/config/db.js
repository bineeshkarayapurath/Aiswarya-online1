const mongoose = require('mongoose');
const config = require('./constants');
const Book = require('../models/Book');
const BookIssue = require('../models/BookIssue');
const ProgramMinutes = require('../models/ProgramMinutes');
const User = require('../models/User');

async function connectDB() {
  try {
    await mongoose.connect(config.MONGO_URI);
    // Drop the old "stockNumber+title+author+category" text index (if a build
    // from an earlier run left it behind) and create the Unicode-safe
    // "catalog_text" index defined on the Book schema.
    await Book.syncIndexes();
    // Everything else uses createIndexes rather than syncIndexes on purpose:
    // syncIndexes DROPS any index not declared on the schema, and these models
    // carry indexes added by hand or by scripts (see scripts/fix-membership-index.js).
    // createIndexes is additive, so booting the API can never quietly delete an
    // index that is not visible in the model files.
    //
    // These back the home page reads: the loan-availability lookup on BookIssue
    // (status + stockNumber), the approved-events strip on ProgramMinutes
    // (status + date) and the member counters on User (status + membershipId).
    await Promise.all([
      BookIssue.createIndexes(),
      ProgramMinutes.createIndexes(),
      User.createIndexes(),
    ]);
    // eslint-disable-next-line no-console
    console.log('MongoDB connected');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;