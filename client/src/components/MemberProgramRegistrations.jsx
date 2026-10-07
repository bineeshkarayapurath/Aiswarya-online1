import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';
import Spinner from './Spinner';
import ProgramRegistrationForm from './ProgramRegistrationForm';
import { DEFAULT_PROGRAM_CATEGORIES } from '../lib/programRegistration';
import { FaTicketAlt, FaUserFriends, FaMusic, FaLock } from 'react-icons/fa';

function ChestBadge({ chest }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-sm font-extrabold text-gold">
      <FaTicketAlt className="h-3.5 w-3.5" /> {chest}
    </span>
  );
}

function RegistrationCard({ r }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-extrabold text-slate-800">{r.itemTitle}</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">{r.category}</p>
        </div>
        <ChestBadge chest={r.chestNumber} />
      </div>
      <div className="mt-3 space-y-1 text-xs text-slate-500">
        <p>
          <span className="font-bold text-slate-600">
            {r.isGroup ? 'Team' : 'Participant'}:
          </span>{' '}
          {r.participantName}
        </p>
        <p>
          <span className="font-bold text-slate-600">Contact:</span> {r.contactNumber}
        </p>
        {r.isGroup && (
          <p className="flex items-start gap-1.5">
            <FaUserFriends className="mt-0.5 shrink-0 text-gold" />
            <span>
              <span className="font-bold text-slate-600">Lead:</span> {r.lead?.name || '—'}
              {r.members?.length > 0 && ` · ${r.members.length} other member(s)`}
            </span>
          </p>
        )}
        {r.isGroup && r.members?.length > 0 && (
          <p className="pl-5 text-[11px] text-slate-400">{r.members.map((m) => m.name).join(', ')}</p>
        )}
      </div>
    </div>
  );
}

// Member-profile section. Shows the registration form and ONLY this member's
// own entries — never the club-wide list, which lives in the admin panel. When
// an administrator switches registration off, the whole section is hidden.
export default function MemberProgramRegistrations({ member }) {
  const [config, setConfig] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMine = useCallback(async () => {
    try {
      const res = await api.get('/member/registrations');
      setRegistrations(res.data.registrations || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not load your registrations');
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [cfg] = await Promise.all([
          api.get('/registrations/config'),
          loadMine(),
        ]);
        if (active) setConfig(cfg.data);
      } catch {
        // A failed config probe should not break the profile page.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadMine]);

  if (loading) return null;

  const closed = !config?.open;

  // Closed — hide the form (and the club-wide controls a member never sees) and
  // say so plainly instead of leaving the section blank.
  if (closed) {
    return (
      <div className="border-t border-slate-200 pt-10">
        <div className="mb-5 flex items-center gap-2">
          <FaMusic className="text-gold" />
          <h2 className="text-lg font-bold text-emerald-900">
            New Year 2027 Annual Celebration
          </h2>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <FaLock className="h-9 w-9 text-slate-300" />
          <p className="text-base font-extrabold uppercase tracking-wide text-slate-600">
            Registration is CLOSED
          </p>
          <p className="max-w-md text-sm text-slate-500">
            Program registration is not open right now. Please check back later or contact the
            club office.
          </p>
        </div>
      </div>
    );
  }

  const categories = config.categories?.length ? config.categories : DEFAULT_PROGRAM_CATEGORIES;

  return (
    <div className="border-t border-slate-200 pt-10">
      <div className="mb-5 flex items-center gap-2">
        <FaMusic className="text-gold" />
        <h2 className="text-lg font-bold text-emerald-900">
          New Year 2027 Annual Celebration — My Programs
        </h2>
      </div>

      <ProgramRegistrationForm
        categories={categories}
        defaultMemberId={member?.membershipId || ''}
        defaultName={member?.fullName || ''}
        defaultPhone={member?.phoneNumber || ''}
        defaultEmail={member?.email || ''}
        onRegistered={(r) => {
          setRegistrations((prev) => [...prev, r]);
          void loadMine();
        }}
      />

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
              <RegistrationCard key={r._id} r={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
