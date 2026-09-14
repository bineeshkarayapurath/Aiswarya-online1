import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/client';
import Spinner from '../components/Spinner';
import {
  FaArrowRight,
  FaBookOpen,
  FaCheckCircle,
  FaSearch,
  FaTimes,
  FaUndo,
} from 'react-icons/fa';
import { ArrowLeftRight, AlertTriangle, CircleDollarSign, RotateCcw } from 'lucide-react';

const DAY_MS = 24 * 60 * 60 * 1000;
const FINE_PER_DAY = 5;
const STATUS_TABS = [
  { key: 'ACTIVE', label: 'Active Loans' },
  { key: 'RETURNED', label: 'Returned' },
  { key: 'ALL', label: 'All Issues' },
];

const STATUS_STYLES = {
  ISSUED: 'bg-emerald-100 text-emerald-800',
  RETURNED: 'bg-slate-200 text-slate-600',
  OVERDUE: 'bg-red-100 text-red-800',
};
const STATUS_LABELS = { ISSUED: 'On Loan', RETURNED: 'Returned', OVERDUE: 'Overdue' };

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function BorrowingPanel() {
  const [issues, setIssues] = useState([]);
  const [summary, setSummary] = useState({ active: 0, overdue: 0, returned: 0 });
  const [tab, setTab] = useState('ACTIVE');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [returningId, setReturningId] = useState(null);
  const [showIssue, setShowIssue] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { status: tab };
      if (q.trim()) params.q = q.trim();
      const res = await api.get('/admin/issues', { params });
      setIssues(res.data.issues || []);
      setSummary(res.data.summary || { active: 0, overdue: 0, returned: 0 });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load issues');
    } finally {
      setLoading(false);
    }
  }, [tab, q]);

  useEffect(() => { load(); }, [load]);

  const returnBook = async (issue) => {
    const fineText =
      new Date(issue.dueDate) < new Date()
        ? '\nFine will be calculated on return.'
        : '\nThe book is not yet overdue — no fine.';
    const ok = window.confirm(
      `Return "${issue.book.title}" from ${issue.member.memberName}?${fineText}`
    );
    if (!ok) return;
    setReturningId(issue._id);
    try {
      const res = await api.post(`/admin/issues/${issue._id}/return`);
      toast.success(res.data.message);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Return failed');
    } finally {
      setReturningId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Summary chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Active Loans', value: summary.active, cls: 'bg-violet-100 text-violet-800', icon: FaArrowRight },
          { label: 'Overdue', value: summary.overdue, cls: 'bg-red-100 text-red-800', icon: AlertTriangle },
          { label: 'Returned', value: summary.returned, cls: 'bg-slate-200 text-slate-600', icon: FaCheckCircle },
          { label: 'Fine Accrued', value: `₹${summary.fineCollected ?? 0}`, cls: 'bg-amber-100 text-amber-800', icon: CircleDollarSign },
        ].map((s) => (
          <span key={s.label} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-sm ${s.cls}`}>
            <s.icon className="h-5 w-5 shrink-0" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{s.label}</p>
              <p className="text-lg font-extrabold leading-none">{s.value}</p>
            </div>
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-xl border border-slate-200">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-xs font-bold transition ${tab === t.key ? 'bg-emerald-900 text-white' : 'bg-white text-slate-500 hover:text-emerald-900'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative min-w-[180px] flex-1">
            <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input !py-2 !pl-9 !text-xs"
              placeholder="Search by Member, Book, Accession No..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button onClick={() => setShowIssue(true)} className="btn-primary !py-2 !px-4 text-xs">
            <FaBookOpen className="mr-1" /> Issue Book
          </button>
        </div>
      </div>

      {/* Issue table */}
      {loading ? (
        <Spinner label="Loading register..." />
      ) : issues.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-14 text-center">
          <ArrowLeftRight className="text-4xl text-slate-300" />
          <p className="font-semibold text-slate-500">
            {tab === 'ACTIVE' ? 'No books currently issued' : 'No issues found'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Book</th>
                <th className="px-4 py-3">Issue Date</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Fine</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((i, idx) => {
                const isOverdue = i.status === 'OVERDUE';
                const days = isOverdue ? Math.ceil((Date.now() - new Date(i.dueDate)) / DAY_MS) : 0;
                return (
                  <tr
                    key={i._id}
                    className={`border-b last:border-0 transition hover:bg-slate-50/60 ${isOverdue ? 'bg-red-50/70' : 'border-slate-50'}`}
                  >
                    <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-700">{i.member.memberName}</p>
                      <span className="text-[11px] font-extrabold text-gold">{i.member.memberId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="line-clamp-1 font-semibold text-slate-700">{i.book.title}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{i.book.author || ''}</span>
                        <span className="rounded-full bg-emerald-900/5 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-900">
                          {i.book.stockNumber}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{fmt(i.issueDate)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {fmt(i.dueDate)}
                      {isOverdue && (
                        <p className="mt-0.5 font-bold text-red-600">{days}d overdue</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`chip ${STATUS_STYLES[i.status]}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {STATUS_LABELS[i.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-amber-700">
                      {i.fineAmount > 0 ? `₹${i.fineAmount}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {i.status !== 'RETURNED' ? (
                        <button
                          onClick={() => returnBook(i)}
                          disabled={returningId === i._id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-900 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> {returningId === i._id ? 'Processing...' : 'Return'}
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Closed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {showIssue && (
          <IssueBookModal onClose={() => setShowIssue(false)} onIssued={() => { setShowIssue(false); load(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Issue Book Modal — searchable autocomplete for member & book
 * ------------------------------------------------------------------ */
function IssueBookModal({ onClose, onIssued }) {
  const [memberQ, setMemberQ] = useState('');
  const [bookQ, setBookQ] = useState('');
  const [memberHits, setMemberHits] = useState([]);
  const [bookHits, setBookHits] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);
  const [issuing, setIssuing] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const memberTimer = useRef(null);
  const bookTimer = useRef(null);

  const fetchMembers = useCallback(async (q) => {
    setLoadingMembers(true);
    try {
      const res = await api.get('/admin/issues/members', { params: { q } });
      setMemberHits(res.data.members || []);
    } catch {
      setMemberHits([]);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const fetchBooks = useCallback(async (q) => {
    setLoadingBooks(true);
    try {
      const res = await api.get('/admin/books/available', { params: { q } });
      setBookHits(res.data.books || []);
    } catch {
      setBookHits([]);
    } finally {
      setLoadingBooks(false);
    }
  }, []);

  const onMemberChange = (e) => {
    const v = e.target.value;
    setMemberQ(v);
    setSelectedMember(null);
    clearTimeout(memberTimer.current);
    memberTimer.current = setTimeout(() => fetchMembers(v), 300);
  };

  const onBookChange = (e) => {
    const v = e.target.value;
    setBookQ(v);
    setSelectedBook(null);
    clearTimeout(bookTimer.current);
    bookTimer.current = setTimeout(() => fetchBooks(v), 300);
  };

  useEffect(() => {
    fetchMembers('');
    fetchBooks('');
  }, [fetchMembers, fetchBooks]);

  const issue = async () => {
    if (!selectedMember) return toast.error('Select a member');
    if (!selectedBook) return toast.error('Select a book');
    setIssuing(true);
    try {
      await api.post('/admin/issues', {
        memberId: selectedMember.membershipId,
        stockNumber: selectedBook.stockNumber,
      });
      toast.success(`"${selectedBook.title}" issued to ${selectedMember.fullName}`);
      onIssued();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Issue failed');
    } finally {
      setIssuing(false);
    }
  };

  const listClass = 'absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-emerald-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
          <h3 className="text-lg font-extrabold text-emerald-900">
            <FaBookOpen className="mr-2 inline" /> Issue Book
          </h3>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
            <FaTimes />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Member autocomplete */}
          <div className="relative">
            <label className="label">
              Member (search by ID, Name or Phone)
            </label>
            {selectedMember ? (
              <div className="flex items-center justify-between rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-bold text-emerald-900">{selectedMember.fullName}</p>
                  <span className="text-xs font-extrabold text-gold">{selectedMember.membershipId}</span>
                </div>
                <button
                  onClick={() => { setSelectedMember(null); setMemberQ(''); }}
                  className="ml-3 rounded-full p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                >
                  <FaTimes />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="input !pl-9"
                    placeholder="Type to search members..."
                    value={memberQ}
                    onChange={onMemberChange}
                    onFocus={() => fetchMembers(memberQ)}
                  />
                </div>
                {memberQ && !selectedMember && (
                  <ul className={listClass}>
                    {loadingMembers && <li className="px-4 py-3 text-xs text-slate-400">Searching...</li>}
                    {!loadingMembers && memberHits.length === 0 && (
                      <li className="px-4 py-3 text-xs text-slate-400">No members found</li>
                    )}
                    {memberHits.map((m) => (
                      <li key={m._id}>
                        <button
                          type="button"
                          onClick={() => { setSelectedMember(m); setMemberQ(''); }}
                          className="flex w-full items-center justify-between px-4 py-2.5 text-left transition hover:bg-emerald-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-700">{m.fullName}</p>
                            <span className="text-xs text-slate-400">+91 {m.phoneNumber}</span>
                          </div>
                          <span className="ml-3 shrink-0 text-[11px] font-extrabold text-gold">{m.membershipId}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {/* Book autocomplete */}
          <div className="relative">
            <label className="label">
              Book (search by Accession No, Title or Author)
            </label>
            {selectedBook ? (
              <div className="flex items-center justify-between rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-bold text-emerald-900">{selectedBook.title}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">{selectedBook.author || ''}</span>
                    <span className="rounded-full bg-emerald-900/5 px-2 py-0.5 font-mono font-bold text-emerald-900">
                      {selectedBook.stockNumber}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedBook(null); setBookQ(''); }}
                  className="ml-3 rounded-full p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                >
                  <FaTimes />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="input !pl-9"
                    placeholder="Type to search available books..."
                    value={bookQ}
                    onChange={onBookChange}
                    onFocus={() => fetchBooks(bookQ)}
                  />
                </div>
                {bookQ && !selectedBook && (
                  <ul className={listClass}>
                    {loadingBooks && <li className="px-4 py-3 text-xs text-slate-400">Searching...</li>}
                    {!loadingBooks && bookHits.length === 0 && (
                      <li className="px-4 py-3 text-xs text-slate-400">No available books found</li>
                    )}
                    {bookHits.map((b) => (
                      <li key={b._id}>
                        <button
                          type="button"
                          onClick={() => { setSelectedBook(b); setBookQ(''); }}
                          className="flex w-full items-center justify-between px-4 py-2.5 text-left transition hover:bg-emerald-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-700">{b.title}</p>
                            <span className="text-xs text-slate-400">{b.author || 'No author'}</span>
                          </div>
                          <span className="ml-3 shrink-0 rounded-full bg-emerald-900/5 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-900">
                            {b.stockNumber}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
            <p className="font-bold text-slate-600">Loan Terms</p>
            <p className="mt-1">
              The book is due for return in <strong>14 days</strong>. A fine of{' '}
              <strong>₹5 per day</strong> applies for each day the book is overdue.
            </p>
          </div>
        </div>

        <div className="flex gap-2 border-t border-slate-100 p-5">
          <button onClick={onClose} className="btn-outline flex-1 !py-2.5 text-sm">Cancel</button>
          <button
            onClick={issue}
            disabled={issuing || !selectedMember || !selectedBook}
            className="btn-primary flex-1 !py-2.5 text-sm disabled:opacity-60"
          >
            {issuing ? 'Issuing...' : 'Issue Book'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}