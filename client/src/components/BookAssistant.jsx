import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FaBookOpen,
  FaSearch,
  FaLightbulb,
  FaClock,
  FaBook,
  FaQuestionCircle,
} from 'react-icons/fa';
import { Sparkles } from 'lucide-react';
import api from '../api/client';
import Spinner from './Spinner';

// AI Book Assistant - member-facing.
//
// Everything here is rendered from a validated, normalised payload (see
// server/src/services/bookAssistantService.js). If the assistant is not
// configured the server says so with 503 and this component shows that plainly
// rather than an empty panel.
function Chips({ items, tone = 'emerald' }) {
  if (!items || !items.length) return null;
  const toneClass =
    tone === 'emerald'
      ? 'bg-emerald-900/10 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200'
      : 'bg-gold/10 text-gold';
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <span key={`${t}-${i}`} className={`chip ${toneClass}`}>
          {t}
        </span>
      ))}
    </div>
  );
}

function Block({ icon, title, children }) {
  return (
    <div className="mt-4">
      <h5 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">
        {icon} {title}
      </h5>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default function BookAssistant() {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState(null);

  // Ask the server up front whether the assistant is available, so the panel can
  // explain itself instead of only failing when a member presses the button.
  useEffect(() => {
    let alive = true;
    api
      .get('/member/book-assistant')
      .then((r) => {
        if (alive) setMeta(r.data);
      })
      .catch(() => {
        /* the panel still works; the error surfaces on submit */
      });
    return () => {
      alive = false;
    };
  }, []);

  const ask = async (e) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.error('Please enter the name of a book');
      return;
    }
    setLoading(true);
    setBook(null);
    try {
      const r = await api.post('/member/book-assistant', {
        title: cleanTitle,
        author: author.trim(),
      });
      setBook(r.data.book);
      setMeta((m) => ({ ...(m || {}), remaining: r.data.remaining, limit: r.data.limit }));
      if (r.data.book.cached) toast.success('Loaded from cache');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not look that book up');
      if (err.response?.data?.code === 'not_configured') setMeta((m) => ({ ...(m || {}), configured: false }));
    } finally {
      setLoading(false);
    }
  };

  const notConfigured = meta && meta.configured === false;

  return (
    <div className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-900">
          <FaBookOpen className="text-gold" /> AI Book Assistant
        </h2>
        {meta && meta.limit && (
          <span className="text-xs font-semibold text-slate-400">
            {meta.remaining} of {meta.limit} questions left this hour
          </span>
        )}
      </div>

      <p className="text-sm text-slate-500">
        Type a book title and get a summary, its themes, key points and what else to read next.
      </p>

      {notConfigured && (
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <strong className="block font-bold">The Book Assistant is not configured yet.</strong>
          <span className="mt-1 block text-xs">
            An administrator needs to set <code className="font-mono">AI_API_KEY</code> (and
            optionally <code className="font-mono">AI_BASE_URL</code> /{' '}
            <code className="font-mono">AI_MODEL</code>) in the server environment. Any
            OpenAI-compatible provider works. Everything else on this page is ready.
          </span>
        </div>
      )}

      <form onSubmit={ask} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="label" htmlFor="ai-book-title">
            Book title
          </label>
          <input
            id="ai-book-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The White Tiger"
            maxLength={120}
          />
        </div>
        <div>
          <label className="label" htmlFor="ai-book-author">
            Author <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="ai-book-author"
            className="input"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="e.g. Aravind Adiga"
            maxLength={80}
          />
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={loading} className="btn-primary w-full !py-2.5 sm:w-auto">
            {loading ? <Spinner label="" /> : <FaSearch />} {loading ? 'Asking…' : 'Ask'}
          </button>
        </div>
      </form>

      {loading && (
        <div className="mt-6">
          <Spinner label="Asking the assistant…" />
        </div>
      )}

      {!loading && book && (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-extrabold text-emerald-900">{book.title}</h3>
              <p className="text-sm font-semibold text-slate-600">{book.author}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {book.genre && <span className="chip bg-emerald-900/10 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200">{book.genre}</span>}
              {book.readingLevel && <span className="chip bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-200">{book.readingLevel}</span>}
              {book.readingTimeMinutes && (
                <span className="chip bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-200">
                  <FaClock /> {book.readingTimeMinutes} min
                </span>
              )}
            </div>
          </div>

          {(book.publishedYear || book.language) && (
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              {[book.publishedYear, book.language].filter(Boolean).join(' · ')}
            </p>
          )}

          <p className="mt-3 text-sm leading-relaxed text-slate-700">{book.summary}</p>

          {book.themes.length > 0 && (
            <Block icon={<FaLightbulb className="text-gold" />} title="Themes">
              <Chips items={book.themes} tone="gold" />
            </Block>
          )}

          {book.keyPoints.length > 0 && (
            <Block icon={<FaBook className="text-emerald-700" />} title="Key points">
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
                {book.keyPoints.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </Block>
          )}

          {book.similarBooks.length > 0 && (
            <Block icon={<FaBookOpen className="text-emerald-700" />} title="Read next">
              <div className="space-y-2">
                {book.similarBooks.map((b, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:bg-white/5">
                    <p className="text-sm font-bold text-slate-800">
                      {b.title}
                      {b.author && <span className="font-normal text-slate-500"> — {b.author}</span>}
                    </p>
                    {b.why && <p className="mt-0.5 text-xs text-slate-500">{b.why}</p>}
                  </div>
                ))}
              </div>
            </Block>
          )}

          {book.discussionQuestions.length > 0 && (
            <Block icon={<FaQuestionCircle className="text-emerald-700" />} title="For your next club discussion">
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
                {book.discussionQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </Block>
          )}

          <p className="mt-5 flex items-center gap-1.5 text-[11px] text-slate-400">
            <Sparkles className="h-3 w-3" />
            Generated by AI. Double-check details against the book before quoting them.
          </p>
        </div>
      )}
    </div>
  );
}