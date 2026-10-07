import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { FaTicketAlt, FaUsers, FaMusic, FaLock, FaPlus, FaTrashAlt } from 'react-icons/fa';
import api from '../api/client';

function ChestBadge({ chest }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-sm font-extrabold text-gold">
      <FaTicketAlt className="h-3.5 w-3.5" /> {chest}
    </span>
  );
}

function emptyParticipant() {
  return { name: '', membershipId: '', phoneNumber: '' };
}

export default function EventProgramRegistrations({ member }) {
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [subProgramId, setSubProgramId] = useState('');
  const [participantName, setParticipantName] = useState(member?.fullName || '');
  const [contactNumber, setContactNumber] = useState(member?.phoneNumber || '');
  const [isGroup, setIsGroup] = useState(false);
  const [leadName, setLeadName] = useState(member?.fullName || '');
  const [otherParticipants, setOtherParticipants] = useState([emptyParticipant()]);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [openRes, myRes] = await Promise.all([
        api.get('/events/open'),
        api.get('/member/event-registrations'),
      ]);
      setEvents(openRes.data.events || []);
      setRegistrations(myRes.data.registrations || []);
      if ((openRes.data.events || []).length > 0 && !selectedEvent) {
        setSelectedEvent(openRes.data.events[0]._id);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [selectedEvent]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentEvent = events.find((e) => e._id === selectedEvent);
  const subPrograms = currentEvent?.subPrograms || [];
  const currentSub = subPrograms.find((sp) => (sp._id || sp.name) === subProgramId);

  useEffect(() => {
    if (subPrograms.length > 0 && !subProgramId) {
      setSubProgramId(subPrograms[0]._id || subPrograms[0].name);
    }
  }, [subPrograms, subProgramId]);

  useEffect(() => {
    if (currentSub?.isGroup) {
      setIsGroup(true);
    }
  }, [currentSub]);

  useEffect(() => {
    setParticipantName(member?.fullName || '');
    setContactNumber(member?.phoneNumber || '');
    setLeadName(member?.fullName || '');
  }, [member]);

  const addParticipant = () => setOtherParticipants((prev) => [...prev, emptyParticipant()]);
  const removeParticipant = (i) => setOtherParticipants((prev) => prev.filter((_, idx) => idx !== i));
  const updateParticipant = (i, key, val) =>
    setOtherParticipants((prev) => prev.map((p, idx) => (idx === i ? { ...p, [key]: val } : p)));

  const submit = async (e) => {
    e.preventDefault();
    if (!selectedEvent || !subProgramId) return toast.error('Please select event and sub-program');
    const name = participantName.trim() || member?.fullName || '';
    if (!name) return toast.error('Participant name required');
    setSubmitting(true);
    try {
      await api.post('/member/event-registrations', {
        eventId: selectedEvent,
        subProgramId: subProgramId,
        participantName: name,
        contactNumber: contactNumber.trim(),
        isGroup,
        leadName: leadName.trim() || name,
        otherParticipants: isGroup
          ? otherParticipants
              .filter((p) => p.name.trim())
              .map((p) => ({
                name: p.name.trim(),
                membershipId: p.membershipId.trim(),
                phoneNumber: p.phoneNumber.trim(),
              }))
          : [],
      });
      toast.success('Registration successful');
      setOtherParticipants([emptyParticipant()]);
      setIsGroup(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  const hasOpenEvents = events.length > 0;

  return (
    <div className="border-t border-slate-200 pt-10">
      <div className="mb-5 flex items-center gap-2">
        <FaMusic className="text-gold" />
        <h2 className="text-lg font-bold text-emerald-900">Event & Program Registrations</h2>
      </div>

      {!hasOpenEvents ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <FaLock className="h-9 w-9 text-slate-300" />
          <p className="text-base font-extrabold uppercase tracking-wide text-slate-600">Registration is CLOSED</p>
          <p className="max-w-md text-sm text-slate-500">
            No events are open for registration at the moment. Please check back later.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Event *</label>
              <select
                className="input"
                value={selectedEvent}
                onChange={(e) => {
                  setSelectedEvent(e.target.value);
                  setSubProgramId('');
                }}
              >
                {events.map((ev) => (
                  <option key={ev._id} value={ev._id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Sub-program / Competition *</label>
              <select
                className="input"
                value={subProgramId}
                onChange={(e) => setSubProgramId(e.target.value)}
              >
                {subPrograms.map((sp) => (
                  <option key={sp._id || sp.name} value={sp._id || sp.name}>
                    {sp.name} {sp.isGroup ? '(Group)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Participant Name *</label>
              <input
                className="input"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="label">Contact Number</label>
              <input
                className="input"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="Phone number"
              />
            </div>
          </div>

          {(currentSub?.isGroup || isGroup) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"
            >
              <div>
                <label className="label">Lead Name *</label>
                <input
                  className="input"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="label">Other Participants</label>
                  <button
                    type="button"
                    onClick={addParticipant}
                    className="flex items-center gap-1 text-xs font-semibold text-emerald-700"
                  >
                    <FaPlus /> Add Participant
                  </button>
                </div>
                <div className="space-y-2">
                  {otherParticipants.map((p, i) => (
                    <div key={i} className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2">
                      <input
                        className="input flex-1 min-w-[160px]"
                        placeholder="Name"
                        value={p.name}
                        onChange={(e) => updateParticipant(i, 'name', e.target.value)}
                      />
                      <input
                        className="input w-32"
                        placeholder="Membership ID"
                        value={p.membershipId}
                        onChange={(e) => updateParticipant(i, 'membershipId', e.target.value)}
                      />
                      <input
                        className="input w-36"
                        placeholder="Phone"
                        value={p.phoneNumber}
                        onChange={(e) => updateParticipant(i, 'phoneNumber', e.target.value)}
                      />
                      {otherParticipants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeParticipant(i)}
                          className="rounded-lg p-2 text-slate-400 hover:text-rose-600"
                        >
                          <FaTrashAlt />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-60">
              {submitting ? 'Registering...' : 'Register'}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-500">
          My Registered Programs ({registrations.length})
        </h3>
        {registrations.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
            You have not registered for any program yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {registrations.map((r) => (
              <div key={r._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-extrabold text-slate-800">{r.event?.name || r.subProgramName}</p>
                    <p className="text-xs text-slate-500">{r.subProgramName}</p>
                  </div>
                  <ChestBadge chest={r.chestNumber} />
                </div>
                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  <p>
                    <span className="font-semibold">Participant:</span> {r.participantName}
                  </p>
                  {r.isGroup && r.leadName && (
                    <p>
                      <span className="font-semibold">Lead:</span> {r.leadName}
                      {r.otherParticipants?.length > 0 && ` • ${r.otherParticipants.length} others`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}