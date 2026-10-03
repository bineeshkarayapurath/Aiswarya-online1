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

// Category is the one catalog field that is matched EXACTLY (the librarian
// filter in catalogController.listBooks), so it is the only one that can be
// indexed usefully. Leading with category and trailing stockNumber lets a single
// index serve both the filter and the stockNumber ordering that every browse
// listing is sorted by, instead of filtering in the app after fetching.
BookSchema.index({ category: 1, stockNumber: 1 });

// Newest-first ordering (recently added / latest arrivals). `timestamps: true`
// adds these fields but MongoDB does not index them automatically. Without
// this, a "newest books" sort is an in-memory blocking sort of the whole
// collection, which measured ~30 ms at 50k books.
BookSchema.index({ createdAt: -1 });

// Deliberately NOT indexed: title and author. The catalog search is an
// UNANCHORED, case-insensitive regex (visitors expect "Randa" to match
// "Randamoozham"), and a B-tree index cannot serve a leading-wildcard match —
// measured at 4.69 ms without a title index vs 3.34 ms with one, i.e. noise.
// Adding one would cost on every write and imply substring search is
// index-backed when it is not. The cost is instead bounded where it matters:
// buildSearchFilter caps the scan with maxTimeMS.

module.exports = mongoose.model('Book', BookSchema);