import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/client';
import {
  FaBell,
  FaTrophy,
  FaLayerGroup,
  FaUsers,
  FaPlus,
  FaTrashAlt,
  FaCalendarAlt,
  FaLock,
  FaTicketAlt,
  FaChevronDown,
  FaChevronUp,
} from 'react-icons/fa';

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

function emptyParticipant() {
  return { name: '', membershipId: '', phoneNumber: '' };
}

// One open program, rendered as an interactive notification card. The header is
// a button: it announces the program (name, target wing, dates) and expands into
// the registration form. An admin enabling a program makes it appear here for
// every eligible member; a member for whom nothing is targeted sees the panel's
// empty ("registration closed") state instead.
function ProgramCard({ event, member, onRegistered }) {
  const [open, setOpen] = useState(false);
  const isMulti = event.type === 'multi';
  const subs = event.subPrograms || [];
  const [subId, setSubId] = useState(subs[0] ? (subs[0]._id || '') : '');
  const [mid, setMid] = useState(member?.membershipId || '');
  const [pname, setPname] = useState(member?.fullName || '');
  const [contact, setContact] = useState(member?.phoneNumber || '');
  const [lead, setLead] = useState(member?.fullName || '');
  const [others, setOthers] = useState([emptyParticipant()]);
  const [submitting, setSubmitting] = useState(false);

  const curSub = subs.find((s) => (s._id || '') === subId);
  const isGroup = isMulti && Boolean(curSub?.isGroup);
  const addO = () => setOthers((p) => [...p, emptyParticipant()]);
  const updO = (i, k, v) => setOthers((p) => p.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  const remO = (i) => setOthers((p) => p.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    if (isMulti && !subId) return toast.error('Select a sub-program');
    const n = pname.trim() || member?.fullName || '';
    if (!n) return toast.error('Participant name required');
    if (!mid.trim()) return toast.error('Member ID required');
    setSubmitting(true);
    try {
      await api.post('/member/event-registrations', {
        eventId: event._id,
        subProgramId: isMulti ? subId : undefined,
        membershipId: mid.trim(),
        participantName: n,
        contactNumber: contact.trim(),
        isGroup,
        leadName: isGroup ? lead.trim() || n : '',
        otherParticipants: isGroup
          ? others
              .filter((o) => o.name.trim())
              .map((o) => ({
                name: o.name.trim(),
                membershipId: o.membershipId.trim(),
                phoneNumber: o.phoneNumber.trim(),
              }))
          : [],
      });
      toast.success('Registration successful');
      setOthers([emptyParticipant()]);
      setOpen(false);
      onRegistered();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
        open ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-slate-200 hover:border-emerald-300'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-4 p-4 text-left sm:p-5"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-900/10 text-emerald-800">
          {isMulti ? <FaLayerGroup className="h-5 w-5" /> : <FaTrophy className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-extrabold text-slate-800">{event.name}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-emerald-700">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
              </span>
              Registration Open
            </span>
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {event.targetAudience && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                For: {event.targetAudience}
              </span>
            )}
            {isMulti && (
              <span className="font-semibold text-indigo-600">
                {subs.length} item{subs.length === 1 ? '' : 's'}
              </span>
            )}
            {event.programDate && (
              <span className="flex items-center gap-1">
                <FaCalendarAlt /> Program: {fmtDate(event.programDate)}
              </span>
            )}
            {event.registrationEndDate && (
              <span className="flex items-center gap-1 font-semibold text-rose-500">
                Register by: {fmtDate(event.registrationEndDate)}
              </span>
            )}
          </span>
          {event.description && <span className="mt-1.5 block line-clamp-2 text-xs text-slate-500">{event.description}</span>}
        </span>
        <span className="mt-1 flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-700">
          {open ? <FaChevronUp /> : <FaChevronDown />}
          <span className="hidden sm:inline">{open ? 'Close' : 'Register'}</span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-100"
          >
            <form onSubmit={submit} className="space-y-3 p-4 sm:p-5">
              {isMulti && (
                <div>
                  <label className="label">Select Sub-program / Competition</label>
                  <select className="input" value={subId} onChange={(e) => setSubId(e.target.value)}>
                    {subs.map((s) => (
                      <option key={s._id || s.name} value={s._id || ''}>
                        {s.name} {s.isGroup ? '(Group)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="label">Member ID *</label>
                  <input className="input" value={mid} onChange={(e) => setMid(e.target.value)} />
                </div>
                <div>
                  <label className="label">Participant Name *</label>
                  <input className="input" value={pname} onChange={(e) => setPname(e.target.value)} />
                </div>
                <div>
                  <label className="label">Contact</label>
                  <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
                </div>
              </div>
              {isGroup && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                  <label className="label">Lead Name</label>
                  <input className="input" value={lead} onChange={(e) => setLead(e.target.value)} />
                  <div className="mt-2">
                    <label className="label">Other Participants</label>
                    {others.map((o, i) => (
                      <div key={i} className="mt-1 flex gap-2">
                        <input className="input flex-1" placeholder="Name" value={o.name} onChange={(e) => updO(i, 'name', e.target.value)} />
                        <input className="input w-32" placeholder="Member ID" value={o.membershipId} onChange={(e) => updO(i, 'membershipId', e.target.value)} />
                        <input className="input w-32" placeholder="Phone" value={o.phoneNumber} onChange={(e) => updO(i, 'phoneNumber', e.target.value)} />
                        {others.length > 1 && (
                          <button type="button" onClick={() => remO(i)} className="rounded-lg p-2 text-slate-400 hover:text-rose-600" title="Remove">
                            <FaTrashAlt />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={addO} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <FaPlus /> Add Participant
                    </button>
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-60">
                  {submitting ? 'Registering...' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function EventProgramRegistrations({ member }) {
  const [events, setEvents] = useState([]);
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load the programs this member is eligible for and their own
      // registrations independently: a failure in one must never hide the other,
      // or an open program would look closed.
      const [e, r] = await Promise.allSettled([
        api.get('/events/open'),
        api.get('/member/event-registrations'),
      ]);
      setEvents(e.status === 'fulfilled' ? e.value.data.events || [] : []);
      setRegs(r.status === 'fulfilled' ? r.value.data.registrations || [] : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <FaBell className="h-4 w-4" /> Loading programs...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold text-emerald-900">
          <FaBell className="text-gold" /> Programs &amp; Events
        </h2>
        {events.length > 0 && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-emerald-700">
            {events.length} open
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <FaLock className="h-9 w-9 text-slate-300" />
          <p className="text-base font-extrabold uppercase tracking-wide text-slate-600">
            Registration is closed
          </p>
          <p className="max-w-md text-sm text-slate-500">
            No programs are open for you at the moment. When an admin opens a program for your
            wing or category, it will appear here as a card you can register from.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <ProgramCard key={ev._id} event={ev} member={member} onRegistered={load} />
          ))}
        </div>
      )}

      <div className="mt-6">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-500">
          <FaTicketAlt className="text-gold" /> My Registrations ({regs.length})
        </h3>
        {regs.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">
            You have not registered for any program yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {regs.map((r) => (
              <div key={r._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-extrabold text-slate-800">{r.event?.name || r.subProgramName}</p>
                    {r.event?.name && r.subProgramName && r.subProgramName !== r.event.name && (
                      <p className="text-xs font-semibold text-emerald-700">{r.subProgramName}</p>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-sm font-extrabold text-gold">
                    <FaTicketAlt className="h-3.5 w-3.5" /> {r.chestNumber}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  <p>
                    <span className="font-semibold">Participant:</span> {r.participantName}
                  </p>
                  {r.membershipId && (
                    <p>
                      <span className="font-semibold">Member ID:</span> {r.membershipId}
                    </p>
                  )}
                  {r.isGroup && r.leadName && (
                    <p className="flex items-center gap-1">
                      <FaUsers className="text-gold" />
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
