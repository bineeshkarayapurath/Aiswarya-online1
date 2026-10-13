import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import api from '../api/client';
import { FaPlus, FaTrashAlt, FaToggleOn, FaPowerOff, FaUsers, FaTrophy, FaLayerGroup } from 'react-icons/fa';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

function SubProgramRow({ sp, index, onChange, onRemove, canRemove }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <input
        className="input flex-1"
        placeholder="Sub-program / competition (e.g., Dance, Song, Drama)"
        value={sp.name}
        onChange={(e) => onChange(index, 'name', e.target.value)}
      />
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
        <input
          type="checkbox"
          checked={sp.isGroup}
          onChange={(e) => onChange(index, 'isGroup', e.target.checked)}
          className="accent-emerald-700"
        />
        <FaUsers className="text-gold" /> Group item
      </label>
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
          title="Remove sub-program"
        >
          <FaTrashAlt />
        </button>
      )}
    </div>
  );
}

function TypeChoice({ value, onChange }) {
  const options = [
    {
      key: 'single',
      icon: FaTrophy,
      title: 'Single Program',
      desc: 'One competition, e.g. Women’s Reading Competition',
    },
    {
      key: 'multi',
      icon: FaLayerGroup,
      title: 'Multi-Item / Group Program',
      desc: 'A headline event with many competitions, e.g. Christmas',
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.key;
        return (
          <button
            type="button"
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
              active
                ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20'
                : 'border-slate-200 bg-white hover:border-emerald-300'
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                active ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Icon />
            </span>
            <span>
              <span className="block text-sm font-extrabold text-emerald-900">{opt.title}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{opt.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function EventProgramManager() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [deleting, setDeleting] = useState(null);

  // Create form state.
  const [type, setType] = useState('single');
  const [name, setName] = useState('');
  const [targetAudience, setTargetAudience] = useState('Open to All');
  const [registrationStartDate, setRegistrationStartDate] = useState('');
  const [registrationEndDate, setRegistrationEndDate] = useState('');
  const [programDate, setProgramDate] = useState('');
  const [description, setDescription] = useState('');
  const [subPrograms, setSubPrograms] = useState([{ name: '', isGroup: false }]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/events');
      setEvents(res.data.events || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addSub = () => setSubPrograms((prev) => [...prev, { name: '', isGroup: false }]);
  const updateSub = (i, key, val) =>
    setSubPrograms((prev) => prev.map((sp, idx) => (idx === i ? { ...sp, [key]: val } : sp)));
  const removeSub = (i) => setSubPrograms((prev) => prev.filter((_, idx) => idx !== i));

  const resetForm = () => {
    setType('single');
    setName('');
    setTargetAudience('Open to All');
    setRegistrationStartDate('');
    setRegistrationEndDate('');
    setProgramDate('');
    setDescription('');
    setSubPrograms([{ name: '', isGroup: false }]);
  };

  const create = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return toast.error('Program heading is required');
    const validSubs = subPrograms.filter((sp) => sp.name.trim());
    if (type === 'multi' && validSubs.length === 0) {
      return toast.error('Add at least one sub-program / competition');
    }
    setCreating(true);
    try {
      await api.post('/events', {
        type,
        name: trimmedName,
        targetAudience,
        description: description.trim(),
        registrationStartDate: registrationStartDate || null,
        registrationEndDate: registrationEndDate || null,
        programDate: programDate || null,
        subPrograms:
          type === 'multi'
            ? validSubs.map((sp) => ({ name: sp.name.trim(), isGroup: Boolean(sp.isGroup) }))
            : [],
      });
      resetForm();
      toast.success(type === 'multi' ? 'Multi-item program created' : 'Program created');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create program');
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (id, open) => {
    setToggling(id);
    try {
      await api.put(`/events/${id}/toggle`, { isRegistrationOpen: open });
      toast.success(open ? 'Registration enabled' : 'Registration disabled');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to toggle registration');
    } finally {
      setToggling(null);
    }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this program? All associated registrations will also be affected.')) return;
    setDeleting(id);
    try {
      await api.delete(`/events/${id}`);
      toast.success('Program deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete program');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-emerald-900">Create Program / Event</h3>
        <form onSubmit={create} className="space-y-5">
          <div>
            <label className="label">Program Type *</label>
            <TypeChoice value={type} onChange={setType} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">{type === 'multi' ? 'Main Event Heading *' : 'Program Heading / Title *'}</label>
              <input
                className="input"
                placeholder={
                  type === 'multi' ? 'e.g., Christmas & New Year Celebrations' : 'e.g., Women’s Reading Competition'
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Target Audience *</label>
              <select
                className="input"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              >
                <option value="Open to All">Open to All</option>
                <option value="Balavedi">Balavedi members only</option>
                <option value="Vanithavedi">Vanithavedi members only</option>
                <option value="Library members">Library members</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label">Registration Start Date</label>
              <input
                type="date"
                className="input"
                value={registrationStartDate}
                onChange={(e) => setRegistrationStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Registration Close Date</label>
              <input
                type="date"
                className="input"
                value={registrationEndDate}
                onChange={(e) => setRegistrationEndDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Program Date</label>
              <input
                type="date"
                className="input"
                value={programDate}
                onChange={(e) => setProgramDate(e.target.value)}
              />
            </div>
          </div>

          {type === 'multi' && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="font-semibold text-slate-700">Sub-programs / Competitions *</span>
                <button type="button" onClick={addSub} className="btn-outline flex items-center gap-2 text-xs">
                  <FaPlus /> Add Sub-program
                </button>
              </div>
              <p className="mb-2 text-xs text-slate-500">
                Each item members can choose from a dropdown. Tick “Group item” for team entries (e.g. group dance).
              </p>
              <div className="space-y-2">
                {subPrograms.map((sp, i) => (
                  <SubProgramRow
                    key={i}
                    sp={sp}
                    index={i}
                    onChange={updateSub}
                    onRemove={removeSub}
                    canRemove={subPrograms.length > 1}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[80px]"
              placeholder="Short description shown to members"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <button className="btn-primary disabled:opacity-60" type="submit" disabled={creating}>
              {creating ? 'Creating...' : type === 'multi' ? 'Create Multi-Item Program' : 'Create Program'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-emerald-900">Manage Programs ({events.length})</h3>
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading programs...</p>
        ) : events.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No programs created yet</p>
        ) : (
          <div className="space-y-3">
            {events.map((ev, i) => (
              <motion.div
                key={ev._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-slate-800">{ev.name}</h4>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-700">
                        {ev.type === 'single' ? 'Single Program' : `Multi-Item (${ev.subPrograms?.length || 0})`}
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                        {ev.targetAudience}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ${
                          ev.isRegistrationOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {ev.isRegistrationOpen ? 'Registration OPEN' : 'Registration CLOSED'}
                      </span>
                      {ev.programDate && <span className="text-slate-500">Program: {fmtDate(ev.programDate)}</span>}
                      {(ev.registrationStartDate || ev.registrationEndDate) && (
                        <span className="text-slate-500">
                          Reg: {fmtDate(ev.registrationStartDate) || '—'} → {fmtDate(ev.registrationEndDate) || '—'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => toggle(ev._id, !ev.isRegistrationOpen)}
                      disabled={toggling === ev._id}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                        ev.isRegistrationOpen
                          ? 'border border-red-200 text-red-600 hover:bg-red-50'
                          : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {ev.isRegistrationOpen ? <FaPowerOff /> : <FaToggleOn />}
                      {ev.isRegistrationOpen ? 'Disable Registration' : 'Enable Registration'}
                    </button>
                    <button
                      onClick={() => del(ev._id)}
                      disabled={deleting === ev._id}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                    >
                      <FaTrashAlt />
                      Delete
                    </button>
                  </div>
                </div>
                {ev.description && <p className="mt-2 text-xs text-slate-600">{ev.description}</p>}
                {ev.subPrograms?.length > 0 && (
                  <div className="mt-3 rounded-lg bg-white p-3">
                    <div className="text-xs font-semibold text-slate-600">Sub-programs / competitions:</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ev.subPrograms.map((sp) => (
                        <span
                          key={sp._id || sp.name}
                          className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                        >
                          {sp.name}
                          {sp.isGroup && <FaUsers className="text-gold" />}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
