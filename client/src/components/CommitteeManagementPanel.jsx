import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  FaUsers,
  FaUserShield,
  FaUserTie,
  FaPhoneAlt,
  FaEnvelope,
  FaClipboardList,
} from 'react-icons/fa';
import api from '../api/client';
import Spinner from './Spinner';
import ProgramsPanel from './ProgramsPanel';

export default function CommitteeManagementPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCommittee, setActiveCommittee] = useState(null);

  useEffect(() => {
    api
      .get('/member/committee')
      .then((r) => {
        setData(r.data);
        if (r.data.officiated?.length > 0) {
          setActiveCommittee(r.data.officiated[0].committeeName);
        }
      })
      .catch((e) => toast.error(e.response?.data?.message || 'Failed to load committee panel'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card p-8">
        <Spinner label="Checking your official roles..." />
      </div>
    );
  }

  if (!data?.canManage) return null;

  const active = data.officiated.find((c) => c.committeeName === activeCommittee) || data.officiated[0];
  const directory = data.directories?.[active.committeeName] || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="card overflow-hidden"
    >
      <div className="border-b border-gold/40 bg-gold/10 px-6 py-4">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-emerald-900">
          <FaUserShield className="text-gold" /> Sub-Committee Management Panel
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Official access for {data.officiated.map((c) => `${c.role} - ${c.committeeName}`).join(' · ')}. Powered live by your active designation.
        </p>
      </div>

      {data.officiated.length > 1 && (
        <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-white px-6 py-3">
          {data.officiated.map((c) => (
            <button
              key={c.committeeName}
              onClick={() => setActiveCommittee(c.committeeName)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition ${
                active.committeeName === c.committeeName
                  ? 'bg-emerald-900 text-white shadow-lg shadow-emerald-900/20'
                  : 'bg-slate-100 text-slate-500 hover:text-emerald-900'
              }`}
            >
              {c.role} · {c.committeeName}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-6 p-6">
        {/* Members Directory */}
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-emerald-900">
            <FaUsers className="text-gold" /> Committee Members Directory — {active.committeeName}
          </h3>
          {directory.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              No members assigned to {active.committeeName} yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5">S.No</th>
                    <th className="px-4 py-2.5">Member ID</th>
                    <th className="px-4 py-2.5">Full Name</th>
                    <th className="px-4 py-2.5">Designation</th>
                    <th className="px-4 py-2.5">Phone</th>
                    <th className="px-4 py-2.5">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {directory.map((m, i) => (
                    <tr key={m.membershipId} className="transition hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-500">{i + 1}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-700">{m.membershipId}</td>
                      <td className="px-4 py-2.5 text-slate-700">{m.fullName}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            m.role === 'President' || m.role === 'Secretary'
                              ? 'bg-gold/20 text-emerald-900'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <FaUserTie className={m.role === 'President' || m.role === 'Secretary' ? 'text-gold' : ''} /> {m.role}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        <span className="flex items-center gap-1.5"><FaPhoneAlt className="text-xs text-slate-400" /> {m.phoneNumber}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        <span className="flex items-center gap-1.5"><FaEnvelope className="text-xs text-slate-400" /> {m.email}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Program & Minutes Register (scoped to this committee) */}
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-emerald-900">
            <FaClipboardList className="text-gold" /> Program Registers & Minutes — {active.committeeName}
          </h3>
          <ProgramsPanel
            key={active.committeeName}
            sectionOnly={active.committeeName}
            apiBase="/member"
          />
        </div>
      </div>
    </motion.div>
  );
}