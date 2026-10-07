import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/client';
import Spinner from './Spinner';
import {
  FaTicketAlt,
  FaUserFriends,
  FaSearch,
  FaTrashAlt,
  FaPowerOff,
  FaToggleOn,
  FaPhoneAlt,
  FaIdCard,
  FaEnvelope,
  FaMusic,
} from 'react-icons/fa';

function ChestBadge({ chest }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-sm font-extrabold text-gold">
      <FaTicketAlt className="h-3.5 w-3.5" /> {chest}
    </span>
  );
}

function RegistrationDetail({ r }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-extrabold text-slate-800">{r.itemTitle}</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            {r.isGroup ? 'Group / Team Entry' : 'Solo Entry'}
          </p>
        </div>
        <ChestBadge chest={r.chestNumber} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-1.5 text-xs text-slate-600">
        <p>
          <span className="font-bold">{r.isGroup ? 'Team Name' : 'Participant'}:</span>{' '}
          {r.participantName}
        </p>
        <p className="flex items-center gap-1.5">
          <FaPhoneAlt className="text-slate-400" /> {r.contactNumber}
        </p>
        {r.membershipId && (
          <p className="flex items-center gap-1.5">
            <FaIdCard className="text-slate-400" /> {r.membershipId}
          </p>
        )}
        {r.isGroup && (
          <div className="mt-1 rounded-xl bg-slate-50 p-3">
            <p className="mb-1 flex items-center gap-1.5 font-bold text-emerald-900">
              <FaUserFriends className="text-gold" /> Lead Person
            </p>
            <p className="font-semibold">{r.lead?.name || '—'}</p>
            {r.lead?.phoneNumber && <p>{r.lead.phoneNumber}</p>}
            {r.lead?.email && (
              <p className="flex items-center gap-1.5">
                <FaEnvelope className="text-slate-400" /> {r.lead.email}
              </p>
            )}
            {r.lead?.membershipId && (
              <p className="flex items-center gap-1.5">
                <FaIdCard className="text-slate-400" /> {r.lead.membershipId}
              </p>
            )}
            {r.members?.length > 0 && (
              <>
                <p className="mb-1 mt-2 font-bold text-emerald-900">
                  Team Members ({r.members.length})
                </p>
                <ul className="space-y-0.5">
                  {r.members.map((m, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                      {m.name}
                      {m.phoneNumber ? ` · ${m.phoneNumber}` : ''}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Admin module: the on/off switch plus the full register grouped by category.
export default function ProgramRegistrationPanel() {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [grouped, setGrouped] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [category, setCategory] = useState('All');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/registrations', {
        params: { category, q: q || undefined },
      });
      setGrouped(res.data.grouped || []);
      setCategories(res.data.categories || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load registrations');
    } finally {
      setLoading(false);
    }
  }, [category, q]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .get('/registrations/config')
      .then((r) => setOpen(Boolean(r.data.open)))
      .catch(() => {});
  }, []);

  const toggle = async () => {
    const next = !open;
    setToggling(true);
    try {
      let res;
      try {
        res = await api.put('/admin/registrations/settings', { open: next });
      } catch (err) {
        const status = err.response?.status;
        if (status === 404) {
          try {
            res = await api.put('/admin/program-registrations/settings', { open: next });
          } catch (err2) {
            throw err2;
          }
        } else {
          throw err;
        }
      }
      setOpen(Boolean(res.data.open));
      toast.success(res.data.message);
    } catch (e) {
      const status = e.response?.status;
      toast.error(
        e.response?.data?.message ||
          (status ? `Could not change the setting (server replied ${status})` : 'Network error — could not change the setting')
      );
    } finally {
      setToggling(false);
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Remove registration ${r.chestNumber} (${r.participantName})?`)) return;
    setDeletingId(r._id);
    try {
      await api.delete(`/admin/registrations/${r._id}`);
      toast.success('Registration removed');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to remove');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Master switch */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 p-5 ${
          open ? 'border-emerald-500/40 bg-emerald-50' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-xl ${
              open ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'
            }`}
          >
            {open ? <FaToggleOn className="h-6 w-6" /> : <FaPowerOff className="h-6 w-6" />}
          </span>
          <div>
            <p className="font-extrabold text-emerald-900">
              Registration is {open ? 'OPEN' : 'CLOSED'}
            </p>
            <p className="text-xs text-slate-500">
              {open
                ? 'Members and the public can register for programs from their profile.'
                : 'The registration form is hidden from member profiles and the public page.'}
            </p>
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={toggling}
          className={`${
            open ? 'btn-outline !text-red-600 !border-red-200' : 'btn-primary'
          } !py-2.5 text-sm disabled:opacity-60`}
        >
          {toggling ? 'Updating...' : open ? 'Disable Registration' : 'Enable Registration'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input !pl-9"
            placeholder="Search name, item, chest no, phone..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="input !w-auto"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="All">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          {total} entr{total === 1 ? 'y' : 'ies'}
        </span>
      </div>

      {loading ? (
        <Spinner label="Loading registrations..." />
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <FaMusic className="h-10 w-10 text-slate-300" />
          <p className="font-semibold text-slate-500">No program registrations yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={g.category}>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-sm font-extrabold text-emerald-900">
                  <span className="h-2.5 w-2.5 rounded-full bg-gold" /> {g.category}
                </h4>
                <span className="rounded-full bg-emerald-900/10 px-3 py-1 text-[11px] font-bold text-emerald-900">
                  {g.count}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {g.registrations.map((r) => (
                  <motion.div
                    key={r._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative"
                  >
                    <RegistrationDetail r={r} />
                    <button
                      onClick={() => remove(r)}
                      disabled={deletingId === r._id}
                      className="absolute right-3 top-3 rounded-lg bg-red-50 p-2 text-xs font-bold text-red-500 transition hover:bg-red-100 disabled:opacity-50"
                      title="Remove registration"
                    >
                      <FaTrashAlt />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
