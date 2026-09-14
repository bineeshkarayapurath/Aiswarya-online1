const mongoose = require('mongoose');
const config = require('./constants');
const Book = require('../models/Book');

async function connectDB() {
  try {
    await mongoose.connect(config.MONGO_URI);
    // Drop the old "stockNumber+title+author+category" text index (if a build
    // from an earlier run left it behind) and create the Unicode-safe
    // "catalog_text" index defined on the Book schema.
    await Book.syncIndexes();
    // eslint-disable-next-line no-console
    console.log('MongoDB connected');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;