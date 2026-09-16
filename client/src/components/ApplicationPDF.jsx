import { motion } from 'framer-motion';
import { CLUB } from '../lib/club';
import { FaPrint, FaTimes } from 'react-icons/fa';
import clubConfig from '../config/clubConfig';
import { resolveMedia } from '../api/client';

const ROWS = (user) => [
  ['Membership ID', user.membershipId || 'Pending'],
  ['Full Name', user.fullName],
  ['Date of Birth', user.dob?.slice(0, 10) || '—'],
  ['Age', user.age != null ? `${user.age} years` : '—'],
  ['Phone', user.phoneNumber],
  ['Email', user.email || '—'],
  ['Occupation', user.occupation || '—'],
  ['Qualification', user.education || '—'],
  ['Address', user.address || '—'],
  ['Recommender', user.recommender?.name || '—'],
];

export default function ApplicationPDF({ user, onClose }) {
  const fmt = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-emerald-950/50 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-h-[92vh] w-full max-w-[820px] overflow-y-auto rounded-2xl bg-[#f0f2f5] shadow-2xl"
      >
        <div className="flex items-center justify-between p-4">
          <p className="text-sm font-bold text-emerald-900">Application Letterhead Preview</p>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="btn-primary !py-1.5 text-xs"
            >
              <FaPrint /> Print
            </button>
            <button
              onClick={onClose}
              className="rounded-lg bg-white px-3 py-1.5 text-slate-500 shadow hover:bg-slate-100"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {/* A4 letterhead */}
        <div id="application-pdf" className="mx-auto max-w-[720px] bg-white p-10 shadow-xl print:max-w-none print:shadow-none">
          {/* Header */}
          <div className="flex items-start gap-4 border-b-2 border-gold pb-4">
            <img src={CLUB.logo} alt="logo" className="h-16 w-16 object-contain" />
            <div className="flex-1 text-center">
              <h1 className="text-xl font-extrabold uppercase tracking-wide text-emerald-900">
                {CLUB.fullName}
              </h1>
              <p className="text-sm text-slate-500">{CLUB.tagline}</p>
              <p className="mt-1 text-sm font-bold text-gold">Reg No: {CLUB.regNo}</p>
            </div>
            {user.photoUrl && (
              <img src={resolveMedia(user.photoUrl)} alt="photo" className="h-20 w-16 rounded border border-slate-300 object-cover" />
            )}
          </div>

          <h2 className="mt-6 text-center text-lg font-extrabold text-emerald-900">
            Membership Application
          </h2>
          <p className="text-center text-xs text-slate-400">
            (Receipt of Application &amp; Record of Approval)
          </p>

          {/* Details */}
          <div className="mt-6 grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-sm">
            {ROWS(user).map(([k, v]) => (
              <>
                <div className="font-bold text-slate-600">{k}</div>
                <div className="text-slate-800">{v}</div>
              </>
            ))}
          </div>

          <p className="mt-4 text-sm text-slate-600">
            <span className="font-bold text-slate-700">Recommender Member ID: </span>
            {user.recommender?.memberId || '—'}
          </p>

          {/* Approval stamp */}
          {user.status === 'APPROVED' && (
            <div className="mt-10 flex justify-end">
              <div className="w-44 rounded-xl border-2 border-emerald-900 p-3 text-center">
                <p className="text-base font-extrabold tracking-wide text-emerald-900">APPROVED</p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Authorised by: {user.approvedBy || 'Club Authority'}
                </p>
                <p className="text-[10px] text-slate-500">Date: {fmt(user.approvedAt)}</p>
              </div>
            </div>
          )}

          <p className="mt-10 text-center text-[11px] italic text-slate-400">
            This is a computer generated document and does not require a physical signature.
          </p>
          <p className="mt-8 text-center text-xs text-slate-500">
            Certificate of Membership • Digital Record
          </p>
        </div>

        {/* print styles */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #application-pdf, #application-pdf * { visibility: visible; }
            #application-pdf { position: absolute; left: 0; top: 0; width: 100%; }
          }
        `}</style>
      </motion.div>
    </div>
  );
}