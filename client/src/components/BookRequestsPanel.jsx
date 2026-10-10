import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/client';
import { FaBookOpen, FaSearch, FaTrashAlt, FaHourglassHalf, FaCheckCircle, FaBoxOpen } from 'react-icons/fa';

const FILTERS = [
  { key: '', label: 'All', icon: null },
  { key: 'Pending', label: 'Pending', icon: FaHourglassHalf },
  { key: 'Approved', label: 'Approved', icon: FaCheckCircle },
  { key: 'Procured', label: 'Procured', icon: FaBoxOpen },
];

const STATUS_META = {
  Pending: { cls: 'bg-amber-100 text-amber-700' },
  Approved: { cls: 'bg-sky-100 text-sky-700' },
  Procured: { cls: 'bg-emerald-100 text-emerald-700' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function BookRequestsPanel() {
  const [requests, setRequests] = useState([]);
  const [counts, setCounts] = useState({ Pending: 0, Approved: 0, Procured: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/book-requests', {
        params: { ...(status ? { status } : {}), ...(query.trim() ? { q: query.trim() } : {}) },
      });
      setRequests(res.data.requests || []);
      setCounts(res.data.counts || { Pending: 0, Approved: 0, Procured: 0 });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load book requests');
    } finally {
      setLoading(false);
    }
  }, [status, query]);

  useEffect(() => {
    const id = setTimeout(() => load(), 250);
    return () => clearTimeout(id);
  }, [load]);

  const setStatusFor = async (req, next) => {
    setBusyId(req.id);
    try {
      await api.put(`/admin/book-requests/${req.id}`, { status: next });
      toast.success(`Marked as ${next}`);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (req) => {
    if (!window.confirm(`Delete the request for "${req.bookTitle}"?`)) return;
    setBusyId(req.id);
    try {
      await api.delete(`/admin/book-requests/${req.id}`);
      toast.success('Request deleted');
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-lg font-bold text-emerald-900">
          <FaBookOpen className="text-gold" /> Book Festival — Book Requests
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Member suggestions for the library collection. Review each one and move it through Pending
          → Approved → Procured. Members see the live status on the website and their dashboard.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const Icon = f.icon;
            const active = status === f.key;
            const count = f.key ? counts[f.key] : requests.length;
            return (
              <button
                key={f.key || 'all'}
                onClick={() => setStatus(f.key)}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                  active
                    ? 'bg-emerald-900 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {Icon && <Icon className="text-[11px]" />}
                {f.label}
                {f.key && <span className="opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
          <input
            className="input !py-2 pl-8 text-sm"
            placeholder="Search title, author, member..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading requests...</p>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <FaBookOpen className="h-10 w-10 text-slate-300" />
          <p className="font-semibold text-slate-500">No book requests found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-bold">Book</th>
                  <th className="px-5 py-3 font-bold">Requested By</th>
                  <th className="px-5 py-3 font-bold">Date</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r, i) => (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-700">{r.bookTitle}</p>
                      <p className="text-xs text-slate-500">
                        {[r.author, r.language].filter(Boolean).join(' · ') || '—'}
                      </p>
                      {r.notes && <p className="mt-0.5 text-xs italic text-slate-400">{r.notes}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-slate-600">{r.memberName || '—'}</p>
                      <p className="text-xs text-slate-400">{r.membershipId || ''}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-500">
                      {fmtDate(r.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          (STATUS_META[r.status] || STATUS_META.Pending).cls
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {['Pending', 'Approved', 'Procured']
                          .filter((s) => s !== r.status)
                          .map((s) => (
                            <button
                              key={s}
                              onClick={() => setStatusFor(r, s)}
                              disabled={busyId === r.id}
                              className="rounded-lg bg-emerald-900/10 px-2.5 py-1.5 text-xs font-bold text-emerald-900 transition hover:bg-emerald-900/20 disabled:opacity-50"
                            >
                              {s}
                            </button>
                          ))}
                        <button
                          onClick={() => remove(r)}
                          disabled={busyId === r.id}
                          className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          <FaTrashAlt /> Delete
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
