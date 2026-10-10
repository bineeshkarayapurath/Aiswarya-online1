import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  FaBookOpen,
  FaPlus,
  FaSearch,
  FaTrashAlt,
  FaUserLock,
  FaCheckCircle,
  FaBoxOpen,
  FaHourglassHalf,
} from 'react-icons/fa';

// Book Festival wishlist. Shown in two places from one component:
//   - the public /book-festival page (everyone can read the list),
//   - the member dashboard (an approved member can also add and withdraw).
// A logged-out visitor sees the same shared list plus a prompt to sign in before
// submitting, because a request has to be attributable to a member.
//
// The form itself is not fixed: its title, description and input fields are read
// from the admin-configured /public/book-requests/config and rendered dynamically.
const STATUS_META = {
  Pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700', icon: FaHourglassHalf },
  Approved: { label: 'Approved', cls: 'bg-sky-100 text-sky-700', icon: FaCheckCircle },
  Procured: { label: 'Procured', cls: 'bg-emerald-100 text-emerald-700', icon: FaBoxOpen },
};

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.Pending;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${meta.cls}`}
    >
      <Icon className="text-[10px]" /> {meta.label}
    </span>
  );
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Everything after the headline value, as a single subtitle line.
function requestSubtitle(r) {
  return (r.answers || [])
    .slice(1)
    .map((a) => a.value)
    .filter(Boolean)
    .join(' · ');
}

export default function BookFestivalRequests({ heading }) {
  const { user } = useAuth();
  const isMember = Boolean(user && user.status === 'APPROVED');

  const [config, setConfig] = useState(null);
  const [all, setAll] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(null);

  const loadConfig = useCallback(async () => {
    const res = await api.get('/public/book-requests/config');
    setConfig(res.data.config || null);
  }, []);

  const loadAll = useCallback(async (q = '') => {
    const res = await api.get('/public/book-requests', { params: q ? { q } : {} });
    setAll(res.data.requests || []);
  }, []);

  const loadMine = useCallback(async () => {
    if (!isMember) return;
    const res = await api.get('/member/book-requests');
    setMine(res.data.requests || []);
  }, [isMember]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadConfig(), loadAll(), loadMine()])
      .catch((e) => toast.error(e.response?.data?.message || 'Failed to load book requests'))
      .finally(() => setLoading(false));
  }, [loadConfig, loadAll, loadMine]);

  // Server-side search, debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      loadAll(query.trim()).catch(() => {});
    }, 300);
    return () => clearTimeout(id);
  }, [query, loadAll]);

  const fields = config?.fields || [];

  const submit = async (e) => {
    e.preventDefault();
    for (const f of fields) {
      if (f.required && !String(values[f.id] || '').trim()) {
        return toast.error(`Please fill in "${f.label}"`);
      }
    }
    setSubmitting(true);
    try {
      await api.post('/member/book-requests', { values });
      toast.success('Request submitted — thank you!');
      setValues({});
      await Promise.all([loadAll(query.trim()), loadMine()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const withdraw = async (req) => {
    if (!window.confirm(`Withdraw your request for "${req.title}"?`)) return;
    setWithdrawing(req.id);
    try {
      await api.delete(`/member/book-requests/${req.id}`);
      toast.success('Request withdrawn');
      await Promise.all([loadAll(query.trim()), loadMine()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not withdraw request');
    } finally {
      setWithdrawing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-emerald-900">
          <FaBookOpen className="text-gold" /> {heading || config?.formTitle || 'Book Festival — Book Requests'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {config?.formDescription ||
            'Suggest a book for the club to buy for the Book Festival. Check the list below first — if someone has already asked for the same title, there is no need to add it again.'}
        </p>
      </div>

      {isMember ? (
        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-emerald-900">
            <FaPlus className="text-gold" /> Request a Book
          </h3>
          {fields.length === 0 ? (
            <p className="text-sm text-slate-500">The request form is being set up. Please check back soon.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.id} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                  <label className="label">
                    {f.label}
                    {f.required ? ' *' : ' (optional)'}
                  </label>
                  {f.type === 'textarea' ? (
                    <textarea
                      className="input min-h-[70px]"
                      placeholder={f.placeholder}
                      value={values[f.id] || ''}
                      onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                    />
                  ) : (
                    <input
                      className="input"
                      placeholder={f.placeholder}
                      value={values[f.id] || ''}
                      onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || fields.length === 0}
              className="btn-primary !py-2.5 text-sm disabled:opacity-60"
            >
              <FaPlus className="mr-1.5 inline" />{' '}
              {submitting ? 'Submitting...' : config?.submitLabel || 'Submit Request'}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-emerald-900/30 bg-emerald-50/60 px-6 py-8 text-center">
          <FaUserLock className="h-8 w-8 text-emerald-900/60" />
          <p className="text-sm font-semibold text-emerald-900">
            Sign in as a member to request a book
          </p>
          <p className="max-w-md text-xs text-slate-500">
            The full wishlist below is open to everyone. To add your own request you need to be
            signed in with an approved membership.
          </p>
          <Link to="/member-login" className="btn-primary !py-2 text-sm">
            Member Login
          </Link>
        </div>
      )}

      {isMember && mine.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <p className="text-sm font-extrabold text-emerald-900">Your Requests</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {mine.length}
            </span>
          </div>
          <ul className="divide-y divide-slate-50">
            {mine.map((r) => (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-center gap-2 px-5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-700">{r.title}</p>
                  {requestSubtitle(r) && (
                    <p className="truncate text-xs text-slate-500">{requestSubtitle(r)}</p>
                  )}
                </div>
                <StatusPill status={r.status} />
                {r.status === 'Pending' && (
                  <button
                    onClick={() => withdraw(r)}
                    disabled={withdrawing === r.id}
                    className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    <FaTrashAlt /> {withdrawing === r.id ? 'Withdrawing...' : 'Withdraw'}
                  </button>
                )}
              </motion.li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <p className="text-sm font-extrabold text-emerald-900">All Requests (shared list)</p>
          <div className="relative">
            <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
            <input
              className="input !py-2 pl-8 text-sm"
              placeholder="Search a title, author or member..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Loading requests...</p>
        ) : all.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <FaBookOpen className="h-9 w-9 text-slate-300" />
            <p className="text-sm font-semibold text-slate-500">
              {query ? 'No matching requests' : 'No book requests yet — be the first!'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {all.map((r, i) => (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.015, 0.3) }}
                className="flex flex-wrap items-center gap-2 px-5 py-3 hover:bg-slate-50/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-700">{r.title}</p>
                  <p className="truncate text-xs text-slate-500">{requestSubtitle(r)}</p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="truncate text-xs font-semibold text-slate-600">
                    {r.memberName || 'Member'}
                    {r.membershipId ? ` (${r.membershipId})` : ''}
                  </p>
                  <p className="text-[11px] text-slate-400">{fmtDate(r.createdAt)}</p>
                </div>
                <StatusPill status={r.status} />
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
