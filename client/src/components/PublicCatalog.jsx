import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FaSearch,
  FaBookOpen,
  FaCalendarAlt,
  FaTimes,
} from 'react-icons/fa';
import { BookMarked, BookX } from 'lucide-react';
import api from '../api/client';
import Spinner from '../components/Spinner';

function fmt(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function PublicCatalog({ title = 'Library Book Catalog', limit = 60 }) {
  const [q, setQ] = useState('');
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [debouncedQ, setDebouncedQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = () => {
    setLoading(true);
    api
      .get('/public/catalog', { params: { q: debouncedQ.trim() || undefined, limit } })
      .then((res) => setBooks(res.data.books || []))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gold">Members Library</p>
          <h2 className="text-2xl font-extrabold text-emerald-900 dark:text-white">{title}</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Search by Title, Author or Accession No. Availability updates in real time.
          </p>
        </div>
      </div>

      <div className="relative">
        <FaSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input !py-3 !pl-11 !text-sm"
          placeholder="Search books by title, author or accession no..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button
            onClick={() => setQ('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <FaTimes className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? (
        <Spinner label="Loading catalog..." />
      ) : books.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-14 text-center">
          <FaBookOpen className="text-4xl text-slate-300" />
          <p className="font-semibold text-slate-500">
            {q.trim() ? 'No books match your search' : 'The catalog is being prepared'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {books.map((b, i) => (
            <motion.div
              key={b.stockNumber || b.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (i % 6) * 0.04 }}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-900 to-emerald-600 text-xl text-gold-300 shadow">
                  {b.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words text-sm font-bold text-slate-800">{b.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{b.author}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="rounded-full bg-emerald-900/5 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-900">
                  {b.stockNumber}
                </span>
                {b.available ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
                    <BookMarked className="h-3 w-3" /> Available
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-rose-700"
                    title={b.dueDate ? `Expected return: ${fmt(b.dueDate)}` : 'Currently on loan'}
                  >
                    <BookX className="h-3 w-3" /> Issued
                    {b.dueDate && (
                      <span className="ml-0.5 flex items-center gap-1 font-semibold normal-case">
                        <FaCalendarAlt className="h-2.5 w-2.5" /> {fmt(b.dueDate)}
                      </span>
                    )}
                  </span>
                )}
              </div>

              <span className="chip mt-2 self-start bg-slate-100 text-[10px] text-slate-500">
                {b.category}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}