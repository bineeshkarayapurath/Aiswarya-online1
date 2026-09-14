const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema(
  {
    // Accession No — unique key used for automatic deduplication
    stockNumber: { type: String, required: true, unique: true, index: true, trim: true },
    callNumber: { type: String, default: '' },
    title: { type: String, required: true, trim: true },
    author: { type: String, default: '' },
    language: { type: String, default: '' },
    category: { type: String, default: '' },
    price: { type: Number, default: 0 },
    publisher: { type: String, default: '' },
    edition: { type: String, default: '' },
    shelf: { type: String, default: '' },
    barcode: { type: String, default: '' },
    bookType: { type: String, default: 'Book' },
  },
  { timestamps: true }
);

BookSchema.index(
  { title: 'text', author: 'text', category: 'text', publisher: 'text', callNumber: 'text' },
  // default_language "none" keeps MongoDB from applying the English stemmer /
  // stopword filter, so Unicode / Malayalam words tokenise cleanly and $text
  // queries never fail on unsupported-language documents. The regex search in
  // listBooks still handles substring / partial matches for both scripts.
  { name: 'catalog_text', default_language: 'none', language_override: 'none' }
);

module.exports = mongoose.model('Book', BookSchema);