import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { FaTicketAlt, FaUsers, FaMusic, FaLock, FaPlus, FaTrashAlt, FaTrophy, FaLayerGroup } from 'react-icons/fa';
import api from '../api/client';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

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

// Renders one open program and its registration form. Single programs show the
// form directly (Member ID + name). Multi-item programs first show a dropdown
// of the competitions, then the form, revealing group-leader fields when the
// chosen item is a group entry.
function ProgramCard({ event, member, onRegistered }) {
  const isMulti = event.type === 'multi';
  const subPrograms = event.subPrograms || [];

  const [subProgramId, setSubProgramId] = useState('');
  const [membershipId, setMembershipId] = useState(member?.membershipId || '');
  const [participantName, setParticipantName] = useState(member?.fullName || '');
  const [contactNumber, setContactNumber] = useState(member?.phoneNumber || '');
  const [leadName, setLeadName] = useState(member?.fullName || '');
  const [otherParticipants, setOtherParticipants] = useState([emptyParticipant()]);
  const [submitting, setSubmitting] = useState(false);

  const currentSub = subPrograms.find((sp) => (sp._id || sp.name) === subProgramId);
  const isGroup = isMulti && Boolean(currentSub?.isGroup);

  const addParticipant = () => setOtherParticipants((prev) => [...prev, emptyParticipant()]);
  const removeParticipant = (i) => setOtherParticipants((prev) => prev.filter((_, idx) => idx !== i));
  const updateParticipant = (i, key, val) =>
    setOtherParticipants((prev) => prev.map((p, idx) => (idx === i ? { ...p, [key]: val } : p)));

  const submit = async (e) => {
    e.preventDefault();
    if (isMulti && !subProgramId) return toast.error('Please select a sub-program / competition');
    const name = participantName.trim() || member?.fullName || '';
    if (!name) return toast.error('Participant name is required');
    if (!membershipId.trim()) return toast.error('Member ID is required');
    setSubmitting(true);
    try {
      await api.post('/member/event-registrations', {
        eventId: event._id,
        subProgramId: isMulti ? subProgramId : undefined,
        membershipId: membershipId.trim(),
        participantName: name,
        contactNumber: contactNumber.trim(),
        isGroup,
        leadName: isGroup ? leadName.trim() || name : '',
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
      onRegistered();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {isMulti ? <FaLayerGroup className="text-indigo-500" /> : <FaTrophy className="text-gold" />}
            <h3 className="text-base font-bold text-emerald-900">{event.name}</h3>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-700">
              {isMulti ? 'Multi-Item Program' : 'Single Program'}
            </span>
            {event.programDate && <span className="text-slate-500">Program: {fmtDate(event.programDate)}</span>}
            {event.registrationEndDate && (
              <span className="text-slate-500">Register by: {fmtDate(event.registrationEndDate)}</span>
            )}
          </div>
        </div>
      </div>

      {event.description && <p className="mt-3 text-sm text-slate-600">{event.description}</p>}

      <form onSubmit={submit} className="mt-4 space-y-4">
        {isMulti && (
          <div>
            <label className="label">Select Competition / Item *</label>
            <select
              className="input"
              value={subProgramId}
              onChange={(e) => setSubProgramId(e.target.value)}
            >
              <option value="">— Choose a sub-program —</option>
              {subPrograms.map((sp) => (
                <option key={sp._id || sp.name} value={sp._id || sp.name}>
                  {sp.name} {sp.isGroup ? '(Group)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {(!isMulti || subProgramId) && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="label">Member ID *</label>
                <input
                  className="input"
                  value={membershipId}
                  onChange={(e) => setMembershipId(e.target.value)}
                  placeholder="Your membership ID"
                />
              </div>
              <div>
                <label className="label">{isGroup ? 'Main Participant' : 'Participant Name'} *</label>
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

            {isGroup && (
              <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <div>
                  <label className="label">Group Leader / Lead Name</label>
                  <input className="input" value={leadName} onChange={(e) => setLeadName(e.target.value)} />
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
              </div>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-60">
                {submitting ? 'Registering...' : 'Register'}
              </button>
            </div>
          </>
        )}
      </form>
    </motion.div>
  );
}

export default function EventProgramRegistrations({ member }) {
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load the open programs and the member's own registrations independently:
      // a failure in one must never hide the other.
      const [openRes, myRes] = await Promise.allSettled([
        api.get('/events/open'),
        api.get('/member/event-registrations'),
      ]);
      const openEvents = openRes.status === 'fulfilled' ? openRes.value.data.events || [] : [];
      const myRegs = myRes.status === 'fulfilled' ? myRes.value.data.registrations || [] : [];
      setEvents(openEvents);
      setRegistrations(myRegs);
      if (openRes.status === 'rejected') {
        toast.error(openRes.reason?.response?.data?.message || 'Failed to load open programs');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return null;

  return (
    <div className="border-t border-slate-200 pt-10">
      <div className="mb-5 flex items-center gap-2">
        <FaMusic className="text-gold" />
        <h2 className="text-lg font-bold text-emerald-900">Events & Program Registrations</h2>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <FaLock className="h-9 w-9 text-slate-300" />
          <p className="text-base font-extrabold uppercase tracking-wide text-slate-600">Registration is CLOSED</p>
          <p className="max-w-md text-sm text-slate-500">
            No programs are open for registration at the moment. Please check back later.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {events.map((ev) => (
            <ProgramCard key={ev._id} event={ev} member={member} onRegistered={loadData} />
          ))}
        </div>
      )}

      <div className="mt-8">
        <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-500">
          My Registered Programs ({registrations.length})
        </h3>
        {registrations.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
            You have not registered for any program yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {registrations.map((r) => {
              const eventName = r.event?.name || r.subProgramName;
              const showItem = r.subProgramName && r.subProgramName !== eventName;
              return (
                <div key={r._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-extrabold text-slate-800">{eventName}</p>
                      {showItem && <p className="text-xs font-semibold text-emerald-700">{r.subProgramName}</p>}
                      {r.event?.type === 'multi' && !showItem && (
                        <p className="text-xs text-slate-500">Multi-item program</p>
                      )}
                    </div>
                    <ChestBadge chest={r.chestNumber} />
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-slate-600">
                    <p>
                      <span className="font-semibold">Participant:</span> {r.participantName}
                    </p>
                    {r.membershipId && (
                      <p>
                        <span className="font-semibold">Member ID:</span> {r.membershipId}
                      </p>
                    )}
                    {r.isGroup && r.leadName && (
                      <p>
                        <span className="font-semibold">Lead:</span> {r.leadName}
                        {r.otherParticipants?.length > 0 && ` • ${r.otherParticipants.length} others`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
