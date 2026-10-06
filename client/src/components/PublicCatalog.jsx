import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FaSearch,
  FaBookOpen,
  FaCalendarAlt,
  FaTimes,
  FaSortAmountDown,
} from 'react-icons/fa';
import { BookMarked, BookX } from 'lucide-react';
import api from '../api/client';
import Spinner from '../components/Spinner';
import useCachedResource, { publicCatalogKey } from '../lib/useCachedResource';
import { CATALOG_SORTS, DEFAULT_CATALOG_SORT } from '../lib/catalogSorts';

function fmt(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function PublicCatalog({ title = 'Library Book Catalog', limit = 60 }) {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [category, setCategory] = useState('');
  const [author, setAuthor] = useState('');
  // Narrows the author dropdown only. Never sent to the API — it is a local
  // search box, not a filter.
  const [authorSearch, setAuthorSearch] = useState('');
  const [sort, setSort] = useState(DEFAULT_CATALOG_SORT);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const term = debouncedQ.trim();

  // Results are cached per search term, so returning to a term the visitor has
  // already typed renders instantly while the request revalidates in the
  // background. `isLoading` is only true with nothing cached to show, which
  // stops the panel flashing "Loading catalog..." on every revisit.
  const catalog = useCachedResource(publicCatalogKey(term, limit, { category, author, sort }), () =>
    api
      .get('/public/catalog', {
        params: {
          q: term || undefined,
          limit,
          category: category || undefined,
          author: author || undefined,
          sort,
        },
      })
      .then((res) => ({ books: res.data.books || [], facets: res.data.facets })),
  );
  const books = catalog.data?.books || [];

  // The facets are constant for the life of the catalog, so they ride along with
  // whichever page is cached and never need a request of their own.
  const categoryOptions = catalog.data?.facets?.categories || [];
  const allAuthors = catalog.data?.facets?.authors || [];

  // The catalog holds ~630 distinct authors, so listing them all in one <select>
  // is an unusable wall of options. Typing narrows the list locally and the
  // select picks from what is left — and only a value that exists in the facet
  // list is ever committed, which matters because the server matches `author`
  // exactly.
  const authorMatches = useMemo(() => {
    const needle = authorSearch.trim().toLowerCase();
    if (!needle) return allAuthors;
    return allAuthors.filter((a) => a.toLowerCase().includes(needle));
  }, [allAuthors, authorSearch]);

  // The filter that is actually applied can fall outside the narrowed list once
  // the text box is retyped, which would otherwise leave the <select> blank while
  // the request still filtered by the old author.
  const authorChoices = useMemo(
    () => (author && !authorMatches.includes(author) ? [author, ...authorMatches] : authorMatches),
    [authorMatches, author],
  );

  const hasFilters = Boolean(term || category || author || sort !== DEFAULT_CATALOG_SORT);

  const clearAll = () => {
    setQ('');
    setCategory('');
    setAuthor('');
    setAuthorSearch('');
    setSort(DEFAULT_CATALOG_SORT);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gold">Members Library</p>
          <h2 className="text-2xl font-extrabold text-emerald-900 dark:text-white">{title}</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Search by Title, Author or Accession No. Filter by category or author, and sort the
            results any way you like. Availability updates in real time.
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

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <label className="label">Category</label>
          <select className="input !py-2 !text-xs" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="min-w-[180px] flex-1">
          <label className="label">Author</label>
          <input
            className="input !py-1.5 !text-xs"
            placeholder="Type to narrow authors..."
            value={authorSearch}
            onChange={(e) => setAuthorSearch(e.target.value)}
          />
          <select
            className="input mt-1.5 !py-1.5 !text-xs"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          >
            <option value="">All Authors</option>
            {authorChoices.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div className="min-w-[200px] flex-1">
          <label className="label">
            <FaSortAmountDown className="mr-1 inline" /> Sort by
          </label>
          <select className="input !py-2 !text-xs" value={sort} onChange={(e) => setSort(e.target.value)}>
            {CATALOG_SORTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button onClick={clearAll} className="pb-2 text-xs font-bold text-red-500 hover:underline">
            Clear
          </button>
        )}
      </div>

      {catalog.isLoading ? (
        <Spinner label="Loading catalog..." />
      ) : books.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-14 text-center">
          <FaBookOpen className="text-4xl text-slate-300" />
          <p className="font-semibold text-slate-500">
            {hasFilters ? 'No books match your search' : 'The catalog is being prepared'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs font-bold text-slate-400">
            Showing {books.length} book{books.length === 1 ? '' : 's'}
          </p>
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
        </>
      )}
    </section>
  );
}