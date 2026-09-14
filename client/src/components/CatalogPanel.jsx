import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/client';
import Spinner from '../components/Spinner';
import {
  FaBookOpen,
  FaSearch,
  FaPlus,
  FaTrashAlt,
  FaTimes,
  FaTable,
  FaTh,
  FaFileUpload,
  FaUpload,
} from 'react-icons/fa';

const EMPTY_FORM = {
  stockNumber: '',
  callNumber: '',
  title: '',
  author: '',
  language: '',
  category: '',
  price: '',
  publisher: '',
  edition: '',
  shelf: '',
  barcode: '',
  bookType: 'Book',
};

const CARD_ATTRS = [
  { key: 'stockNumber', label: 'Accession No', icon: '🔢' },
  { key: 'shelf', label: 'Shelf', icon: '🗄️' },
  { key: 'category', label: 'Category', icon: '🏷️' },
  { key: 'price', label: 'Price', icon: '₹' },
];

export default function CatalogPanel() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('cards');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('');
  const [categories, setCategories] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [debouncedQ, setDebouncedQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = async () => {
    try {
      const params = {};
      if (debouncedQ.trim()) params.q = debouncedQ.trim();
      if (category) params.category = category;
      if (language) params.language = language;
      const res = await api.get('/admin/books', { params });
      setBooks(res.data.books || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, category, language]);

  const loadMeta = () => {
    api.get('/admin/books/meta').then((r) => {
      setCategories(r.data.categories || []);
      setLanguages(r.data.languages || []);
    }).catch(() => {});
  };

  useEffect(() => {
    loadMeta();
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const saveBook = async () => {
    if (!form.stockNumber.trim()) return toast.error('Accession No is required');
    if (!form.title.trim()) return toast.error('Title is required');
    setSaving(true);
    try {
      const res = await api.post('/admin/books', {
        ...form,
        price: form.price || 0,
      });
      toast.success(res.data.message);
      setShowAdd(false);
      setForm({ ...EMPTY_FORM });
      loadMeta();
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to add book');
    } finally {
      setSaving(false);
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      return toast.error('Only .xlsx, .xls or .csv files are supported');
    }
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      const res = await api.post('/admin/books/bulk', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(res.data.message);
      loadMeta();
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (book) => {
    if (!window.confirm(`Remove "${book.title}" (${book.stockNumber}) from the catalog?`)) return;
    setDeletingId(book._id);
    try {
      await api.delete(`/admin/books/${book._id}`);
      toast.success('Book removed');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to remove book');
    } finally {
      setDeletingId(null);
    }
  };

  const clearFilters = () => {
    setQ('');
    setCategory('');
    setLanguage('');
  };

  const hasFilters = Boolean(q.trim() || category || language);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input !pl-9"
              placeholder="Search by Accession No, Title, Author, Category (Malayalam or English)..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input w-auto" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="">All Languages</option>
            {languages.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs font-bold text-red-500 hover:underline">
              Clear
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-bold text-slate-400">
            {loading ? 'Loading...' : `${books.length} book${books.length === 1 ? '' : 's'}`}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-slate-200">
              <button
                onClick={() => setView('cards')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition ${view === 'cards' ? 'bg-emerald-900 text-white' : 'bg-white text-slate-500 hover:text-emerald-900'}`}
              >
                <FaTh /> Cards
              </button>
              <button
                onClick={() => setView('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition ${view === 'table' ? 'bg-emerald-900 text-white' : 'bg-white text-slate-500 hover:text-emerald-900'}`}
              >
                <FaTable /> Table
              </button>
            </div>
            <button onClick={() => setShowAdd(true)} className="btn-primary !py-2 text-xs">
              <FaPlus /> Add Book
            </button>
          </div>
        </div>
      </div>

      {/* Excel drag & drop upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition ${
          dragActive
            ? 'border-emerald-600 bg-emerald-50'
            : 'border-slate-300 bg-white hover:border-orange-400 hover:bg-orange-50/40'
        }`}
      >
        {uploading ? (
          <>
            <Spinner label="Importing spreadsheet..." />
          </>
        ) : (
          <>
            <FaFileUpload className={`text-3xl ${dragActive ? 'text-emerald-700' : 'text-slate-400'}`} />
            <div className="text-sm">
              <p className="font-bold text-slate-600">Drag &amp; drop an Excel file here</p>
              <p className="text-xs text-slate-400">
                .xlsx / .xls / .csv — duplicate Accession Nos are skipped automatically
              </p>
            </div>
            <label className="cursor-pointer rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-orange-600">
              <FaUpload className="mr-1 inline" /> Choose File
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
          </>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <Spinner label="Loading catalog..." />
      ) : books.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-14 text-center">
          <FaBookOpen className="text-4xl text-slate-300" />
          <p className="font-semibold text-slate-500">
            {hasFilters ? 'No books match your search' : 'The catalog is empty — add books manually or import a spreadsheet'}
          </p>
        </div>
      ) : view === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {books.map((b, i) => (
            <motion.div
              key={b._id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (i % 8) * 0.04 }}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-900 to-emerald-600 text-lg font-extrabold text-gold-300 shadow">
                  {(b.title || 'B')[0].toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words font-bold text-slate-800 group-hover:text-emerald-900">{b.title}</p>
                  <p className="mt-0.5 break-words text-xs text-slate-500">{b.author || 'Author unknown'}</p>
                  {b.bookType && b.bookType !== 'Book' && (
                    <span className="mt-1 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">
                      {b.bookType}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3">
                {CARD_ATTRS.map(({ key, label, icon }) => (
                  <div key={key}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="truncate text-sm font-semibold text-slate-700">
                      {icon} {key === 'price' ? `${b.price ? `₹${Number(b.price).toLocaleString('en-IN')}` : '—'}` : b[key] || '—'}
                    </p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => remove(b)}
                disabled={deletingId === b._id}
                className="absolute right-3 top-3 rounded-md p-1.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                title="Remove book"
              >
                <FaTrashAlt />
              </button>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Accession No</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Author</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Shelf</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-emerald-900">{b.stockNumber}</td>
                  <td className="px-4 py-3">
                    <p className="line-clamp-1 break-words font-semibold text-slate-700">{b.title}</p>
                    {b.bookType && b.bookType !== 'Book' && (
                      <span className="mt-0.5 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold uppercase text-violet-700">{b.bookType}</span>
                    )}
                  </td>
                  <td className="break-words px-4 py-3 text-slate-500">{b.author || '—'}</td>
                  <td className="px-4 py-3">
                    {b.category ? <span className="rounded-full bg-emerald-900/5 px-2 py-0.5 text-xs font-bold text-emerald-900">{b.category}</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{b.shelf || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">
                    {b.price ? `₹${Number(b.price).toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        onClick={() => remove(b)}
                        disabled={deletingId === b._id}
                        className="rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                        title="Remove book"
                      >
                        <FaTrashAlt />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual add modal */}
      <AnimatePresence>
        {showAdd && (
          <AddBookModal
            form={form}
            set={set}
            saving={saving}
            onClose={() => setShowAdd(false)}
            onSave={saveBook}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AddBookModal({ form, set, saving, onClose, onSave }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-emerald-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
          <h3 className="text-lg font-extrabold text-emerald-900">Add Book Manually</h3>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
            <FaTimes />
          </button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Title *</label>
            <input className="input" value={form.title} onChange={set('title')} placeholder="Book title" />
          </div>
          <div>
            <label className="label">Accession No (stockNumber) *</label>
            <input className="input font-mono" value={form.stockNumber} onChange={set('stockNumber')} placeholder="e.g. A-0012" />
          </div>
          <div>
            <label className="label">Author</label>
            <input className="input" value={form.author} onChange={set('author')} />
          </div>
          <div>
            <label className="label">Category</label>
            <input className="input" value={form.category} onChange={set('category')} placeholder="e.g. Novel, Poetry, Reference" />
          </div>
          <div>
            <label className="label">Language</label>
            <input className="input" value={form.language} onChange={set('language')} placeholder="e.g. Malayalam, English" />
          </div>
          <div>
            <label className="label">Call Number</label>
            <input className="input font-mono" value={form.callNumber} onChange={set('callNumber')} />
          </div>
          <div>
            <label className="label">Price (₹)</label>
            <input type="number" min="0" step="0.01" className="input" value={form.price} onChange={set('price')} />
          </div>
          <div>
            <label className="label">Publisher</label>
            <input className="input" value={form.publisher} onChange={set('publisher')} />
          </div>
          <div>
            <label className="label">Edition</label>
            <input className="input" value={form.edition} onChange={set('edition')} />
          </div>
          <div>
            <label className="label">Shelf No</label>
            <input className="input" value={form.shelf} onChange={set('shelf')} placeholder="e.g. A3 / Rack 2" />
          </div>
          <div>
            <label className="label">Barcode</label>
            <input className="input font-mono" value={form.barcode} onChange={set('barcode')} />
          </div>
          <div>
            <label className="label">Book Type</label>
            <select className="input" value={form.bookType} onChange={set('bookType')}>
              <option value="Book">Book</option>
              <option value="Reference">Reference</option>
              <option value="Magazine">Magazine</option>
              <option value="Rare">Rare</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 border-t border-slate-100 p-5">
          <button onClick={onClose} className="btn-outline flex-1 !py-2.5 text-sm">Cancel</button>
          <button onClick={onSave} disabled={saving} className="btn-primary flex-1 !py-2.5 text-sm disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Book'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}