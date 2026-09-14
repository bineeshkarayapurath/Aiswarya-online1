import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Plus,
  ListOrdered,
  Search,
  Eye,
  X,
  Trash2,
  Camera,
  ImagePlus,
  ArrowLeft,
  User,
  UserX,
  Phone,
  Calendar,
  CheckCircle2,
  HandCoins,
  Package,
  PiggyBank,
  Wallet,
  HeartPulse,
  Upload,
} from 'lucide-react';
import api from '../api/client';
import { uploadImages } from '../lib/uploadImages';
import Spinner from './Spinner';

const CATEGORIES = ['Wedding', 'Funeral Support', 'Medical Assistance', 'General Charity'];

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

const CATEGORY_STYLE = {
  Wedding: 'bg-rose-100 text-rose-700',
  'Funeral Support': 'bg-slate-100 text-slate-700',
  'Medical Assistance': 'bg-sky-100 text-sky-700',
  'General Charity': 'bg-amber-100 text-amber-700',
};

export default function CommunityServicePanel() {
  const [tab, setTab] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const refreshList = useRef(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <TabBtn active={tab === 'create'} onClick={() => setTab('create')} icon={<Plus className="h-4 w-4" />}>New Initiative</TabBtn>
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')} icon={<ListOrdered className="h-4 w-4" />}>History / All Initiatives</TabBtn>
      </div>

      {tab === 'create' && !editingId && (
        <CreateEventForm
          onCreated={(event) => {
            setTab('history');
            setEditingId(event._id);
            if (refreshList.current) refreshList.current();
          }}
        />
      )}

      {tab === 'history' && !editingId && (
        <HistoryList
          refBody={(fn) => { refreshList.current = fn; }}
          onViewEvent={(id) => setEditingId(id)}
        />
      )}

      {editingId && (
        <EventDetail
          eventId={editingId}
          onBack={() => setEditingId(null)}
          onStatusChanged={() => { if (refreshList.current && tab === 'history') refreshList.current(); }}
        />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold transition ${active ? 'bg-emerald-900 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
    >
      {icon} {children}
    </button>
  );
}

function SummaryCard({ icon, tint, label, value, sub }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-3 inline-flex rounded-xl p-2.5 ${tint}`}>{icon}</div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-emerald-900">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Member search (autofills name + phone for coordinator / donors)
 * ------------------------------------------------------------------ */
function MemberSearchInput({ onSelect, clearKey }) {
  const [query, setQuery] = useState('');
  const [members, setMembers] = useState([]);
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) { setMembers([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.get('/admin/community-service/members', { params: { q } });
        setMembers(r.data.members || []);
        setShow(true);
      } catch (e) { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const pick = (m) => {
    setSelected(m);
    setQuery(m.membershipId);
    setShow(false);
    onSelect(m);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          key={clearKey}
          className="input !pl-9"
          placeholder="Membership ID or name…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
          onFocus={() => members.length && setShow(true)}
          onBlur={() => setTimeout(() => setShow(false), 200)}
        />
      </div>
      {selected && (
        <p className="mt-1 text-xs font-semibold text-emerald-700">
          {selected.fullName} · {selected.membershipId} · {selected.phoneNumber}
        </p>
      )}
      {show && members.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {members.map((m) => (
            <li key={m.membershipId}>
              <button
                onMouseDown={(e) => { e.preventDefault(); pick(m); }}
                className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-emerald-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-700">{m.fullName}</span>
                  <span className="text-xs text-slate-400">{m.membershipId} · {m.phoneNumber}</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-700">MEMBER</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Create a new initiative
 * ------------------------------------------------------------------ */
function CreateEventForm({ onCreated }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [coordType, setCoordType] = useState('MEMBER');
  const [coordMember, setCoordMember] = useState(null);
  const [coordName, setCoordName] = useState('');
  const [coordPhone, setCoordPhone] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!title.trim()) return toast.error('Title is required');
    const coordinator = coordType === 'MEMBER'
      ? { memberId: coordMember?.membershipId || '' }
      : { memberId: '', name: coordName.trim(), phone: coordPhone.trim() };
    if (coordType === 'MEMBER' && !coordMember) return toast.error('Select a member coordinator (search by ID or name)');
    setBusy(true);
    try {
      const r = await api.post('/admin/community-service', {
        title: title.trim(),
        category,
        coordinator,
        eventDate,
        description: description.trim(),
      });
      toast.success('Community initiative created');
      onCreated(r.data.event);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Creation failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-900/10 text-emerald-900">
          <HeartPulse className="h-5 w-5" />
        </span>
        <div>
          <h4 className="font-extrabold text-emerald-900">New Community Initiative</h4>
          <p className="text-xs text-slate-500">Relief fund, wedding help, medical aid, funeral support and charity drives</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input className="input" placeholder="e.g. Arun's Marriage Assistance, Medical Aid Drive" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="label">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-xl border-2 px-3 py-2.5 text-xs font-extrabold transition ${category === c ? 'border-emerald-900 bg-emerald-900/5 text-emerald-900' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Coordinator Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCoordType('MEMBER')}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition ${coordType === 'MEMBER' ? 'bg-emerald-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <User className="h-4 w-4" /> Club Member
              </button>
              <button
                onClick={() => setCoordType('OTHER')}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition ${coordType === 'OTHER' ? 'bg-emerald-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <UserX className="h-4 w-4" /> Other Person
              </button>
            </div>
          </div>

          {coordType === 'MEMBER' ? (
            <MemberSearchInput
              clearKey="coord-appear"
              onSelect={(m) => setCoordMember(m)}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="label">Coordinator Name *</label>
                <input className="input" placeholder="e.g. Sajesh Kumar" value={coordName} onChange={(e) => setCoordName(e.target.value)} />
              </div>
              <div>
                <label className="label">Phone (optional)</label>
                <input className="input" placeholder="e.g. 94xxxxxx00" value={coordPhone} onChange={(e) => setCoordPhone(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Event Date</label>
            <input type="date" className="input" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea
              className="input min-h-[120px]"
              placeholder="Purpose of the initiative, beneficiary details, amount committed…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <button onClick={save} disabled={busy} className="btn-primary w-full !py-3.5 disabled:opacity-60">
            {busy ? 'Creating…' : <><Plus className="h-5 w-5" /> Create Initiative</>}
          </button>
          <p className="text-center text-[11px] text-slate-400">
            Collections, expenses and photos are added after creation from the initiative view.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  History & lifetime audit trail
 * ------------------------------------------------------------------ */
function HistoryList({ refBody, onViewEvent }) {
  const [data, setData] = useState({ events: [], summary: { activeCount: 0, completedCount: 0, totalCollected: 0, totalSpent: 0 } });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/community-service', { params: { status: status || undefined, category: category || undefined, q: q || undefined } });
      setData(r.data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load initiatives');
    } finally {
      setLoading(false);
    }
  }, [status, category, q]);

  useEffect(() => { load(); refBody(load); }, [load, refBody]);

  const { events, summary } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={<HeartPulse className="h-5 w-5" />} tint="bg-emerald-100 text-emerald-800" label="Active Initiatives" value={summary.activeCount} />
        <SummaryCard icon={<CheckCircle2 className="h-5 w-5" />} tint="bg-sky-100 text-sky-700" label="Completed" value={summary.completedCount} />
        <SummaryCard icon={<HandCoins className="h-5 w-5" />} tint="bg-emerald-50 text-emerald-700" label="Total Collected" value={inr(summary.totalCollected)} />
        <SummaryCard icon={<Wallet className="h-5 w-5" />} tint="bg-rose-50 text-rose-600" label="Total Spent" value={inr(summary.totalSpent)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input !pl-9" placeholder="Search title, coordinator, description…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
        </select>
        <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <Spinner label="Loading initiatives…" />
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <HeartPulse className="h-10 w-10 text-slate-300" />
          <p className="font-semibold text-slate-500">No community initiatives found</p>
          <p className="text-xs text-slate-400">Create an initiative to start recording collections, expenses and aid. Everything is kept permanently for audit review.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-extrabold">Initiative</th>
                <th className="px-4 py-3 font-extrabold">Category</th>
                <th className="px-4 py-3 font-extrabold">Coordinator</th>
                <th className="px-4 py-3 font-extrabold">Event Date</th>
                <th className="px-4 py-3 text-right font-extrabold">Collected</th>
                <th className="px-4 py-3 text-right font-extrabold">Spent</th>
                <th className="px-4 py-3 text-center font-extrabold">Status</th>
                <th className="px-4 py-3 text-center font-extrabold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((e) => (
                <tr key={e._id} className="hover:bg-slate-50/70">
                  <td className="max-w-[200px] px-4 py-3">
                    <p className="truncate font-extrabold text-slate-700">{e.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {e.collectionCount} collections · {e.expenseCount} expenses{e.photoCount ? ` · ${e.photoCount} photos` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`chip ${CATEGORY_STYLE[e.category] || 'bg-slate-100 text-slate-600'}`}>{e.category}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-700">{e.coordinator?.name || '—'}</p>
                    <p className="text-[11px] text-slate-400">{e.coordinator?.memberId || ''}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmtDate(e.eventDate)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-extrabold text-emerald-700">{inr(e.totalCollected)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-extrabold text-rose-600">{inr(e.totalSpent)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`chip ${e.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-700'}`}>
                      {e.status === 'ACTIVE' ? 'Active' : 'Completed'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center">
                      <button onClick={() => onViewEvent(e._id)} title="Open initiative" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-emerald-900">
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Single initiative with Collections / Expenses / Summary / Gallery
 * ------------------------------------------------------------------ */
function EventDetail({ eventId, onBack, onStatusChanged }) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subtab, setSubtab] = useState('collections');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/community-service/${eventId}`);
      setEvent(r.data.event);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load initiative');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner label="Loading initiative…" />;
  if (!event) return null;

  const toggleStatus = async () => {
    try {
      const next = event.status === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE';
      const r = await api.put(`/admin/community-service/${eventId}`, { status: next });
      setEvent(r.data.event);
      toast.success(next === 'COMPLETED' ? 'Initiative marked as completed' : 'Initiative reopened');
      onStatusChanged();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <button onClick={onBack} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" title="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-lg font-extrabold text-emerald-900">{event.title}</h4>
                <span className={`chip ${CATEGORY_STYLE[event.category] || 'bg-slate-100 text-slate-600'}`}>{event.category}</span>
                <span className={`chip ${event.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-700'}`}>
                  {event.status === 'ACTIVE' ? 'Active' : 'Completed'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {fmtDate(event.eventDate)}
                {event.coordinator?.name && (
                  <>
                    {' · '}Coordinator: <span className="font-bold text-slate-700">{event.coordinator.name}</span>
                    {event.coordinator.memberId ? ` (${event.coordinator.memberId})` : ''}
                    {event.coordinator.phone ? ` · ${event.coordinator.phone}` : ''}
                  </>
                )}
              </p>
              {event.description && <p className="mt-2 text-sm text-slate-600">{event.description}</p>}
            </div>
          </div>
          <button onClick={toggleStatus} className={`rounded-xl border px-3 py-2 text-xs font-extrabold transition ${event.status === 'ACTIVE' ? 'border-emerald-900 bg-emerald-900 text-white hover:bg-emerald-800' : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {event.status === 'ACTIVE' ? <><CheckCircle2 className="h-4 w-4" /> Mark Completed</> : 'Reopen Initiative'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SubTab active={subtab === 'collections'} onClick={() => setSubtab('collections')} icon={<HandCoins className="h-4 w-4" />}>Collections</SubTab>
        <SubTab active={subtab === 'expenses'} onClick={() => setSubtab('expenses')} icon={<Package className="h-4 w-4" />}>Expenses &amp; Aid</SubTab>
        <SubTab active={subtab === 'summary'} onClick={() => setSubtab('summary')} icon={<PiggyBank className="h-4 w-4" />}>Financial Summary</SubTab>
        <SubTab active={subtab === 'gallery'} onClick={() => setSubtab('gallery')} icon={<ImagePlus className="h-4 w-4" />}>Photo Gallery</SubTab>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={subtab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {subtab === 'collections' && <CollectionsTab event={event} onRefresh={load} />}
          {subtab === 'expenses' && <ExpensesTab event={event} onRefresh={load} />}
          {subtab === 'summary' && <SummaryTab event={event} />}
          {subtab === 'gallery' && <GalleryTab event={event} onRefresh={load} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function SubTab({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-extrabold transition ${active ? 'border-emerald-900 bg-emerald-900 text-white shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
    >
      {icon} {children}
    </button>
  );
}

/* ----------------------------- Collections ----------------------------- */
function CollectionsTab({ event, onRefresh }) {
  const [donorType, setDonorType] = useState('MEMBER');
  const [donorMember, setDonorMember] = useState(null);
  const [donorName, setDonorName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const add = async () => {
    if (donorType === 'MEMBER' && !donorMember) return toast.error('Select the contributing member');
    if (donorType === 'OTHER' && !donorName.trim()) return toast.error('Donor name is required');
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error('Amount must be greater than zero');
    setBusy(true);
    try {
      await api.post(`/admin/community-service/${event._id}/collections`, {
        memberId: donorMember?.membershipId || '',
        memberName: donorType === 'OTHER' ? donorName.trim() : '',
        amount: amt,
        date,
      });
      toast.success('Collection recorded');
      setAmount('');
      setDonorName('');
      setDonorMember(null);
      setFormKey((k) => k + 1);
      onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to record collection');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (collId) => {
    try {
      await api.delete(`/admin/community-service/${event._id}/collections/${collId}`);
      toast.success('Collection removed');
      onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to remove collection');
    }
  };

  const total = (event.collections || []).reduce((s, c) => s + (c.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h5 className="font-extrabold text-emerald-900">Add Contribution</h5>
            <p className="text-xs text-slate-500">Record donations received for this initiative</p>
          </div>
          <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-sm font-extrabold text-emerald-700">Collected so far: {inr(total)}</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDonorType('MEMBER')}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition ${donorType === 'MEMBER' ? 'bg-emerald-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <User className="h-4 w-4" /> Club Member
              </button>
              <button
                onClick={() => setDonorType('OTHER')}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition ${donorType === 'OTHER' ? 'bg-emerald-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <UserX className="h-4 w-4" /> Other / Well-wisher
              </button>
            </div>
            {donorType === 'MEMBER' ? (
              <MemberSearchInput key={`donor-${formKey}`} onSelect={(m) => setDonorMember(m)} />
            ) : (
              <div>
                <label className="label">Donor Name *</label>
                <input key={`donorname-${formKey}`} className="input" placeholder="e.g. Well-wisher" value={donorName} onChange={(e) => setDonorName(e.target.value)} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Amount (₹) *</label>
              <input type="number" min="0" step="0.01" className="input" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <button onClick={add} disabled={busy} className="btn-primary w-full !py-3 disabled:opacity-60">
                {busy ? 'Recording…' : <><Plus className="h-5 w-5" /> Record Collection</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {(event.collections || []).length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <HandCoins className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No collections yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-extrabold">Date</th>
                <th className="px-4 py-3 font-extrabold">Donor</th>
                <th className="px-4 py-3 text-right font-extrabold">Amount</th>
                <th className="px-4 py-3 text-center font-extrabold">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {event.collections.map((c) => (
                <tr key={c._id} className="hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{fmtDate(c.date)}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-700">{c.memberName}</p>
                    {c.memberId && <p className="text-[11px] text-slate-400">{c.memberId}</p>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-extrabold text-emerald-700">+{inr(c.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => remove(c._id)} title="Remove" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* --------------------------- Expenses & Aid ---------------------------- */
function ExpensesTab({ event, onRefresh }) {
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('CASH_GIFT');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const add = async () => {
    if (!item.trim()) return toast.error('Item / purpose is required');
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error('Amount must be greater than zero');
    setBusy(true);
    try {
      await api.post(`/admin/community-service/${event._id}/expenses`, {
        itemOrPurpose: item.trim(),
        amount: amt,
        type,
        remarks: remarks.trim(),
      });
      toast.success('Expense / aid recorded');
      setItem('');
      setAmount('');
      setRemarks('');
      setFormKey((k) => k + 1);
      onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to record expense');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (expId) => {
    try {
      await api.delete(`/admin/community-service/${event._id}/expenses/${expId}`);
      toast.success('Expense removed');
      onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to remove expense');
    }
  };

  const total = (event.expenses || []).reduce((s, x) => s + (x.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h5 className="font-extrabold text-emerald-900">Record Expense / Aid</h5>
            <p className="text-xs text-slate-500">Cash given directly or items purchased for the beneficiary</p>
          </div>
          <span className="rounded-xl bg-rose-50 px-3 py-1.5 text-sm font-extrabold text-rose-600">Spent so far: {inr(total)}</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="label">Item / Purpose *</label>
              <input key={`item-${formKey}`} className="input" placeholder="e.g. Direct cash gift to family, Medical bills, Flower decoration" value={item} onChange={(e) => setItem(e.target.value)} />
            </div>
            <div>
              <label className="label">Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setType('CASH_GIFT')}
                  className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition ${type === 'CASH_GIFT' ? 'bg-emerald-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  <HandCoins className="h-4 w-4" /> Cash Gift
                </button>
                <button
                  onClick={() => setType('PURCHASE')}
                  className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition ${type === 'PURCHASE' ? 'bg-emerald-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  <Package className="h-4 w-4" /> Purchase / Bills
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Amount (₹) *</label>
              <input type="number" min="0" step="0.01" className="input" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="label">Remarks (optional)</label>
              <input className="input" placeholder="Bill no / reference…" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <button onClick={add} disabled={busy} className="btn-primary w-full !py-3 disabled:opacity-60">
                {busy ? 'Recording…' : <><Plus className="h-5 w-5" /> Record Expense / Aid</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {(event.expenses || []).length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <Package className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No expenses recorded</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-extrabold">Item / Purpose</th>
                <th className="px-4 py-3 font-extrabold">Type</th>
                <th className="px-4 py-3 font-extrabold">Remarks</th>
                <th className="px-4 py-3 text-right font-extrabold">Amount</th>
                <th className="px-4 py-3 text-center font-extrabold">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {event.expenses.map((x) => (
                <tr key={x._id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-semibold text-slate-700">{x.itemOrPurpose}</td>
                  <td className="px-4 py-3">
                    <span className={`chip ${x.type === 'CASH_GIFT' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-700'}`}>
                      {x.type === 'CASH_GIFT' ? 'Cash Gift' : 'Purchase'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{x.remarks || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-extrabold text-rose-600">−{inr(x.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => remove(x._id)} title="Remove" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* -------------------------- Financial Summary -------------------------- */
function SummaryTab({ event }) {
  const collected = (event.collections || []).reduce((s, c) => s + (c.amount || 0), 0);
  const spent = (event.expenses || []).reduce((s, x) => s + (x.amount || 0), 0);
  const balance = Math.round((collected - spent) * 100) / 100;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard icon={<HandCoins className="h-5 w-5" />} tint="bg-emerald-50 text-emerald-700" label="Total Collected" value={inr(collected)} sub={`${(event.collections || []).length} contributions`} />
        <SummaryCard icon={<Wallet className="h-5 w-5" />} tint="bg-rose-50 text-rose-600" label="Total Spent" value={inr(spent)} sub={`${(event.expenses || []).length} expense entries`} />
        <SummaryCard
          icon={<PiggyBank className="h-5 w-5" />}
          tint={balance >= 0 ? 'bg-gold/10 text-emerald-900' : 'bg-rose-100 text-rose-700'}
          label="Remaining Balance"
          value={`${balance < 0 ? '−' : ''}${inr(Math.abs(balance))}`}
          sub={balance < 0 ? 'Spending exceeds collections' : 'Available for further aid'}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h5 className="mb-3 font-extrabold text-emerald-900">Fund Position</h5>
        <div className="space-y-3">
          <PositionBar label="Total Collected" amount={collected} total={Math.max(collected, spent, 1)} tint="bg-emerald-600" />
          <PositionBar label="Total Spent" amount={spent} total={Math.max(collected, spent, 1)} tint="bg-rose-500" />
        </div>
        <div className="mt-4 border-t border-dashed border-slate-200 pt-3 text-xs text-slate-400">
          <p>Every collection and expense is stored permanently on this initiative for future audit review.</p>
        </div>
      </div>
    </div>
  );
}

function PositionBar({ label, amount, total, tint }) {
  const pct = Math.min(100, Math.round((amount / total) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className="font-extrabold text-slate-700">{inr(amount)}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tint} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ----------------------------- Photo Gallery ---------------------------- */
function GalleryTab({ event, onRefresh }) {
  const [photoUrl, setPhotoUrl] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const add = async () => {
    const url = photoUrl.trim();
    if (!url && files.length === 0) return toast.error('Choose photos or paste a photo URL');
    setBusy(true);
    try {
if (files.length > 0) {
        const uploadLocal = async () => {
          const fd = new FormData();
          for (const f of files) fd.append('photos', f);
          await api.post(`/admin/community-service/${event._id}/photos`, fd);
        };
        try {
          // Upload via the backend /api/upload endpoint (local storage, or
          // ImgBB when configured) and store the returned public HTTPS URLs.
          const urls = await uploadImages(files);
          if (!urls.length) throw new Error('Upload returned no image URLs');
          await api.post(`/admin/community-service/${event._id}/photos`, { photoUrls: urls });
          toast.success('Photos added');
        } catch (e) {
          await uploadLocal();
          toast.success('Photos added (local storage)');
        }
      } else {
        await api.post(`/admin/community-service/${event._id}/photos`, { photoUrls: url });
        toast.success('Photo added');
      }
      toast.success('Photos added');
      setPhotoUrl('');
      setFiles([]);
      onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Photo upload failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (idx) => {
    try {
      await api.delete(`/admin/community-service/${event._id}/photos/${idx}`);
      toast.success('Photo removed');
      onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to remove photo');
    }
  };

  const photos = event.photos || [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h5 className="font-extrabold text-emerald-900">Add Photos</h5>
          <p className="text-xs text-slate-500">Proof of the function / aid handover — from device or a URL</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label className="label">Photo URL (optional)</label>
            <input className="input" placeholder="https://… (Firebase / external hosted image)" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-2.5 text-xs font-extrabold text-slate-500 transition hover:border-emerald-900 hover:text-emerald-900">
              <Upload className="h-4 w-4" /> {files.length ? `${files.length} selected` : 'Choose Photos'}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            </label>
          </div>
        </div>

        <button onClick={add} disabled={busy} className="btn-primary mt-3 w-full !py-3 disabled:opacity-60">
          {busy ? 'Uploading…' : <><Camera className="h-5 w-5" /> Add Photos</>}
        </button>
      </div>

      {photos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <ImagePlus className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No photos yet — add handover / event photos for the records</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => (
            <div key={i} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button onClick={() => setLightbox(p)} className="block aspect-square w-full">
                <img src={p} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
              </button>
              <button
                onClick={() => remove(i)}
                className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-slate-500 opacity-0 shadow transition hover:text-rose-600 group-hover:opacity-100"
                title="Remove photo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-emerald-950/70 p-4 backdrop-blur-sm" onClick={() => setLightbox(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <button onClick={() => setLightbox(null)} className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-slate-600 shadow hover:text-rose-600">
              <X className="h-5 w-5" />
            </button>
            <img src={lightbox} alt="" className="max-h-[80vh] w-full object-contain" />
          </motion.div>
        </div>
      )}
    </div>
  );
}