const mongoose = require('mongoose');

// The Book Festival wishlist form is admin-configurable: rather than hard-coding
// "Book Title / Author / ...", an officer edits the title, description and the
// list of input fields here, and the member-facing form and the admin table both
// follow it. Stored as a single document (key = 'default'), created lazily with
// the sensible defaults below on first read.
const MAX_FIELDS = 20;

const DEFAULT_FIELDS = [
  {
    id: 'bookTitle',
    label: 'Book Title',
    placeholder: 'e.g. Randamoozham',
    required: true,
    type: 'text',
  },
  {
    id: 'author',
    label: 'Author Name',
    placeholder: 'e.g. M. T. Vasudevan Nair',
    required: false,
    type: 'text',
  },
  {
    id: 'publisher',
    label: 'Publisher Name',
    placeholder: 'e.g. DC Books',
    required: false,
    type: 'text',
  },
  {
    id: 'language',
    label: 'Language',
    placeholder: 'e.g. Malayalam',
    required: false,
    type: 'text',
  },
  {
    id: 'notes',
    label: 'Notes',
    placeholder: 'Anything that helps the committee — publisher, edition, why it would be valuable...',
    required: false,
    type: 'textarea',
  },
];

const DEFAULT_CONFIG = {
  formTitle: 'Book Festival — Book Requests',
  formDescription:
    'Suggest a book for the club to buy for the Book Festival. Check the list below first — if ' +
    'someone has already asked for the same title, there is no need to add it again.',
  submitLabel: 'Submit Request',
};

// A single configurable input. `id` is the stable key the member form submits
// against; `label` is what is shown and what is stored with each answer so a
// request still reads correctly after the field list is later changed.
const FieldSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    placeholder: { type: String, default: '', trim: true },
    required: { type: Boolean, default: false },
    type: { type: String, enum: ['text', 'textarea'], default: 'text' },
  },
  { _id: false }
);

const BookRequestConfigSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'default' },
    formTitle: { type: String, default: DEFAULT_CONFIG.formTitle, trim: true },
    formDescription: { type: String, default: DEFAULT_CONFIG.formDescription, trim: true },
    submitLabel: { type: String, default: DEFAULT_CONFIG.submitLabel, trim: true },
    fields: { type: [FieldSchema], default: () => DEFAULT_FIELDS.map((f) => ({ ...f })) },
  },
  { timestamps: true }
);

const BookRequestConfig = mongoose.model('BookRequestConfig', BookRequestConfigSchema);

BookRequestConfig.DEFAULT_FIELDS = DEFAULT_FIELDS;
BookRequestConfig.DEFAULT_CONFIG = DEFAULT_CONFIG;
BookRequestConfig.MAX_FIELDS = MAX_FIELDS;

module.exports = BookRequestConfig;
