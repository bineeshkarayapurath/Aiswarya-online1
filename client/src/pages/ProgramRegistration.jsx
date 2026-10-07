import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/client';
import Spinner from '../components/Spinner';
import ProgramRegistrationForm from '../components/ProgramRegistrationForm';
import { DEFAULT_PROGRAM_CATEGORIES } from '../lib/programRegistration';
import { FaMusic, FaTicketAlt, FaCalendarAlt, FaLock } from 'react-icons/fa';

// Public / self-service registration page for the New Year Annual Celebration.
// Open to non-members; a Member ID is optional and only used to autofill.
export default function ProgramRegistration() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [last, setLast] = useState(null);

  useEffect(() => {
    api
      .get('/registrations/config')
      .then((r) => setConfig(r.data))
      .catch((e) => toast.error(e.response?.data?.message || 'Could not load registration details'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <Spinner label="Loading..." />
      </div>
    );
  }

  const open = Boolean(config?.open);
  const categories = config?.categories?.length ? config.categories : DEFAULT_PROGRAM_CATEGORIES;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 rounded-2xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 p-6 text-white shadow-lg">
        <span className="chip bg-gold/20 text-gold-300">
          <FaCalendarAlt className="mr-1.5 inline" /> New Year 2027
        </span>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
          <FaMusic className="text-gold-300" /> Annual Celebration Program Registration
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-emerald-100">
          Register for Bharatanatyam, group dances, drama and more. Each participant or team
          receives a unique chest number automatically.
        </p>
      </div>

      {last && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50 p-6 text-center"
        >
          <FaTicketAlt className="mx-auto h-8 w-8 text-gold" />
          <p className="mt-2 text-sm font-bold text-emerald-900">Registration successful!</p>
          <p className="mt-1 text-xs text-slate-600">Your chest number is</p>
          <p className="mt-1 text-3xl font-extrabold tracking-wide text-emerald-900">
            {last.chestNumber}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {last.participantName} · {last.category} · {last.itemTitle}
          </p>
        </motion.div>
      )}

      {open ? (
        <ProgramRegistrationForm categories={categories} onRegistered={setLast} />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <FaLock className="h-10 w-10 text-slate-300" />
          <h2 className="text-lg font-extrabold text-slate-700">Registration is currently closed</h2>
          <p className="max-w-md text-sm text-slate-500">
            The New Year 2027 program registration is not open at the moment. Please check back
            later or contact the club office.
          </p>
        </div>
      )}
    </div>
  );
}
