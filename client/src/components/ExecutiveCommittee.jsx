import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  FaSearch,
  FaUserTie,
  FaUsers,
  FaIdCardAlt,
  FaSave,
  FaCheckCircle,
  FaTimes,
  FaShieldAlt,
  FaKey,
} from 'react-icons/fa';
import { Crown, GraduationCap, Landmark, BookCheck } from 'lucide-react';
import { FaMedal, FaFileSignature } from 'react-icons/fa';
import api from '../api/client';
import Spinner from '../components/Spinner';
import { StatusBadge } from '../components/StatusBadge';
import { DESIGNATION_ROLES, DESIGNATIONS } from '../lib/permissions';

const ROLE_HINTS = [
  { role: DESIGNATIONS.PRESIDENT, icon: Crown, desc: 'Approvals · sub-committees · executive overview · settings', cls: 'bg-gold/10 text-gold' },
  { role: DESIGNATIONS.VICE_PRESIDENT, icon: FaMedal, desc: 'Approvals · sub-committees · administrative overview', cls: 'bg-sky-100 text-sky-800' },
  { role: DESIGNATIONS.SECRETARY, icon: FaShieldAlt, desc: 'Approvals · sub-committees · program registers · settings', cls: 'bg-emerald-900/10 text-emerald-900' },
  { role: DESIGNATIONS.JOINT_SECRETARY, icon: FaFileSignature, desc: 'Approvals · sub-committees · administrative registers', cls: 'bg-teal-100 text-teal-800' },
  { role: DESIGNATIONS.TREASURER, icon: Landmark, desc: 'Accounts · income/expense register · cash/bank ledger', cls: 'bg-amber-100 text-amber-800' },
  { role: DESIGNATIONS.LIBRARIAN, icon: BookCheck, desc: 'Book issue/return register · stock management · book catalog', cls: 'bg-violet-100 text-violet-800' },
  { role: DESIGNATIONS.EXECUTIVE_MEMBER, icon: GraduationCap, desc: 'Approval workflows · sub-committee management', cls: 'bg-rose-100 text-rose-800' },
];

const STATUS_OK = 'APPROVED';

export default function ExecutiveCommittee() {
  const [members, setMembers] = useState([]);
  const [summary, setSummary] = useState({ total: 0, designated: 0 });
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [roster, setRoster] = useState([]);
  const searchTimer = useRef(null);

  const [formDesignation, setFormDesignation] = useState('');
  const [saving, setSaving] = useState(false);

  const loadRoster = useCallback(async () => {
    try {
      const res = await api.get('/admin/committee/executive');
      setRoster(res.data.members || []);
      setSummary(res.data.summary || { total: 0, designated: 0 });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load executive committee');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  const fetchHits = useCallback(async (value) => {
    setSearching(true);
    try {
      const res = await api.get('/admin/committee/search', { params: { q: value } });
      setHits(res.data.members || []);
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const onSearchChange = (e) => {
    const v = e.target.value;
    setQ(v);
    setSelected(null);
    setFormDesignation('');
    clearTimeout(searchTimer.current);
    if (v.trim().length < 1) {
      setHits([]);
      return;
    }
    searchTimer.current = setTimeout(() => fetchHits(v.trim()), 300);
  };

  const pickMember = (m) => {
    setSelected(m);
    setFormDesignation(m.designation || '');
    setQ('');
    setHits([]);
  };

  const assign = async (e) => {
    e.preventDefault();
    if (!selected) return toast.error('Search and select a member first');
    if (!formDesignation) return toast.error('Choose a designation');
    setSaving(true);
    try {
      const res = await api.post('/admin/committee/designation', {
        membershipId: selected.membershipId,
        designation: formDesignation,
      });
      toast.success(res.data.message);
      setSelected(res.data.member || selected);
      loadRoster();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Assignment failed');
    } finally {
      setSaving(false);
    }
  };

  const changeRosterRole = async (member, designation) => {
    try {
      const res = await api.post('/admin/committee/designation', {
        membershipId: member.membershipId,
        designation,
      });
      toast.success(res.data.message);
      loadRoster();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const clearRole = async (member) => {
    if (!window.confirm(`Remove "${member.membershipId}" from all executive designations?`)) return;
    await changeRosterRole(member, '');
  };

  const sorted = [...roster].sort(
    (a, b) =>
      (b.designation ? 1 : 0) - (a.designation ? 1 : 0) ||
      a.membershipId.localeCompare(b.membershipId)
  );

  return (
    <div className="space-y-6">
      {/* Permissions legend */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h4 className="flex items-center gap-2 text-sm font-extrabold text-emerald-900">
          <FaKey className="text-gold" /> Role-Based Dashboard Access
        </h4>
        <p className="mt-1 text-xs text-slate-500">
          The designation you assign here decides which Authority Dashboard modules each
          officer can open after logging in.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLE_HINTS.map(({ role, icon: Icon, desc, cls }) => (
            <div key={role} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cls}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-slate-700">{role}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search & Assign */}
      <form onSubmit={assign} className="rounded-2xl border border-slate-200 bg-white p-5">
        <h4 className="flex items-center gap-2 text-sm font-extrabold text-emerald-900">
          <FaUserTie className="text-gold" /> Assign Executive Designation
        </h4>
        <p className="mt-1 text-xs text-slate-500">
          Search by Member ID, Name or Phone — the selected member&apos;s profile loads instantly.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
          {/* Search + selected member */}
          <div className="relative">
            <div className="relative">
              <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input !pl-9"
                placeholder="Type a Member ID, Name or Phone..."
                value={q}
                onChange={onSearchChange}
                onFocus={() => { if (q.trim() && !selected) fetchHits(q.trim()); }}
              />
            </div>

            {q && !selected && (
              <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                {searching && <li className="px-4 py-3 text-xs text-slate-400">Searching...</li>}
                {!searching && hits.length === 0 && (
                  <li className="px-4 py-3 text-xs text-slate-400">No members found</li>
                )}
                {hits.map((m) => (
                  <li key={m._id}>
                    <button
                      type="button"
                      onClick={() => pickMember(m)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-emerald-50"
                    >
                      <img
                        src={m.photoUrl || '/assets/club-logo.png'}
                        alt=""
                        className="h-9 w-9 rounded-lg border border-slate-200 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-700">{m.fullName}</p>
                        <p className="text-[11px] text-slate-400">+91 {m.phoneNumber}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] font-extrabold text-gold">{m.membershipId}</p>
                        <p className="text-[10px] text-slate-400">{m.designation || 'General Member'}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Selected member profile */}
            {selected && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-4"
              >
                <img
                  src={selected.photoUrl || '/assets/club-logo.png'}
                  alt="member"
                  className="h-16 w-16 rounded-2xl border-2 border-white object-cover shadow"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-base font-extrabold text-emerald-900">{selected.fullName}</p>
                    {selected.status === STATUS_OK && (
                      <FaCheckCircle className="shrink-0 text-emerald-600" />
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                    <span className="flex items-center gap-1 font-extrabold text-gold">
                      <FaIdCardAlt /> {selected.membershipId}
                    </span>
                    <span className="text-slate-500">+91 {selected.phoneNumber}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <StatusBadge status={selected.status} />
                    <span className="rounded-full bg-emerald-900 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                      {selected.designation || 'General Member'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelected(null); setFormDesignation(''); }}
                  className="self-start rounded-full p-1.5 text-slate-400 hover:bg-white hover:text-red-500"
                >
                  <FaTimes />
                </button>
              </motion.div>
            )}
          </div>

          {/* Designation picker */}
          <div className="flex flex-col gap-3 lg:w-72">
            <div>
              <label className="label">Designation</label>
              <select
                className="input"
                value={formDesignation}
                onChange={(e) => setFormDesignation(e.target.value)}
                disabled={!selected}
              >
                <option value="">— Select designation —</option>
                {DESIGNATION_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={saving || !selected || !formDesignation}
              className="btn-primary mt-auto !py-2.5 text-sm disabled:opacity-60"
            >
              <FaSave /> {saving ? 'Saving...' : 'Assign Role'}
            </button>
          </div>
        </div>
      </form>

      {/* Current roster */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <p className="flex items-center gap-2 text-sm font-extrabold text-emerald-900">
            <FaUsers className="text-gold" /> Executive Committee Roster
          </p>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {summary.designated} of {summary.total} designated
          </span>
        </div>
        {loading ? (
          <div className="px-6 py-10"><Spinner label="Loading roster..." /></div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <FaUsers className="h-9 w-9 text-slate-300" />
            <p className="text-sm font-semibold text-slate-500">No approved members yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2.5">Member</th>
                  <th className="px-5 py-2.5">ID</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5">Designation</th>
                  <th className="px-5 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((m) => (
                  <tr key={m._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={m.photoUrl || '/assets/club-logo.png'}
                          alt=""
                          className="h-9 w-9 rounded-lg border border-slate-200 object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-700">{m.fullName}</p>
                          <p className="text-[11px] text-slate-400">+91 {m.phoneNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-xs font-extrabold text-gold">{m.membershipId}</td>
                    <td className="px-5 py-2.5"><StatusBadge status={m.status} /></td>
                    <td className="px-5 py-2.5">
                      <select
                        className="input !w-auto !py-1.5 !text-xs"
                        value={m.designation || ''}
                        onChange={(e) => changeRosterRole(m, e.target.value)}
                      >
                        <option value="">General Member</option>
                        {DESIGNATION_ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      {m.designationUpdatedAt && (
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          updated {new Date(m.designationUpdatedAt).toLocaleDateString('en-IN')}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <button
                        onClick={() => clearRole(m)}
                        disabled={!m.designation}
                        className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Clear
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}