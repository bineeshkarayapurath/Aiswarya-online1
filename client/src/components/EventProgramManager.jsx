import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import api from '../api/client';
import { FaPlus, FaTrashAlt, FaToggleOn, FaPowerOff, FaUsers } from 'react-icons/fa';

function SubProgramRow({ sp, index, onChange, onRemove, canRemove }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <input
        className="input flex-1"
        placeholder="Sub-program name (e.g., Thiruvathirakali, Drama, Dance)"
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
        <FaUsers className="text-gold" /> Group event
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

export default function EventProgramManager() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [targetAudience, setTargetAudience] = useState('Open to All');
  const [subPrograms, setSubPrograms] = useState([{ name: '', isGroup: false }]);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [deleting, setDeleting] = useState(null);

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

  const create = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return toast.error('Event name is required');
    const validSubs = subPrograms.filter((sp) => sp.name.trim());
    setCreating(true);
    try {
      await api.post('/events', {
        name: trimmedName,
        targetAudience,
        subPrograms: validSubs.map((sp) => ({
          name: sp.name.trim(),
          isGroup: Boolean(sp.isGroup),
        })),
      });
      setName('');
      setTargetAudience('Open to All');
      setSubPrograms([{ name: '', isGroup: false }]);
      toast.success('Event created successfully');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create event');
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
    if (!window.confirm('Delete this event? All associated registrations will also be affected.')) return;
    setDeleting(id);
    try {
      await api.delete(`/events/${id}`);
      toast.success('Event deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete event');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-emerald-900">Create Event / Program</h3>
        <form onSubmit={create} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Event Name *</label>
              <input
                className="input"
                placeholder="e.g., Annual Celebration 2027, Christmas Competitions"
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

          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-semibold text-slate-700">Sub-programs / Competitions</span>
              <button type="button" onClick={addSub} className="btn-outline flex items-center gap-2 text-xs">
                <FaPlus /> Add Sub-program
              </button>
            </div>
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

          <div className="flex justify-end">
            <button className="btn-primary disabled:opacity-60" type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-emerald-900">Manage Events ({events.length})</h3>
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Loading events...</p>
        ) : events.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No events created yet</p>
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
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                        {ev.targetAudience}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ${
                          ev.isRegistrationOpen
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {ev.isRegistrationOpen ? 'Registration OPEN' : 'Registration CLOSED'}
                      </span>
                      <span className="text-slate-500">{ev.subPrograms?.length || 0} sub-program(s)</span>
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
                {ev.subPrograms?.length > 0 && (
                  <div className="mt-3 rounded-lg bg-white p-3">
                    <div className="text-xs font-semibold text-slate-600">Sub-programs:</div>
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
