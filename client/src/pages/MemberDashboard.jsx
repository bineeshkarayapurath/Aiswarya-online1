import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import IDCard from '../components/IDCard';
import ApplicationPDF from '../components/ApplicationPDF';
import PublicCatalog from '../components/PublicCatalog';
import { StatusBadge } from '../components/StatusBadge';
import CommitteeManagementPanel from '../components/CommitteeManagementPanel';
import MemberReceipts from '../components/MemberReceipts';
import { featureEnabled, subcommitteeEnabled, CLUB } from '../lib/club';
import {
  FaFilePdf,
  FaIdCardAlt,
  FaRegAddressCard,
  FaUserPlus,
  FaEye,
  FaUserTie,
  FaUsers,
  FaBookOpen,
  FaCheckCircle,
} from 'react-icons/fa';

export default function MemberDashboard() {
  const { user, setAuth } = useAuth();
  const [member, setMember] = useState(user || null);
  const [showPdf, setShowPdf] = useState(false);
  const [clubStats, setClubStats] = useState(null);

  // Fallback empty object so first render never crashes on null fields; the
  // profile fetch below replaces it with the authoritative server record.
  const m = member || {};

  useEffect(() => {
    api
      .get('/member/profile')
      .then((r) => setMember(r.data.user))
      .catch(() => {});
    api
      .get('/public/stats')
      .then((r) => setClubStats(r.data))
      .catch(() => {});
  }, []);

  const download = async (type) => {
    try {
      const res = await api.get(`/member/document/${type}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'application' ? 'Membership_Application.pdf' : 'Digital_ID_Card.pdf';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Download failed');
    }
  };

  const rows = [
    ['Membership ID', m.membershipId],
    ['Full Name', m.fullName],
    ['Role', m.role || 'MEMBER'],
    ['Phone', m.phoneNumber],
    ['Email', m.email || '—'],
    ['Date of Birth', m.dob?.slice(0, 10) || '—'],
    ['Age', m.age != null ? `${m.age} years` : '—'],
    ['Occupation', m.occupation || '—'],
    ['Qualification', m.education || '—'],
    ['Address', m.address],
    ['Recommender', m.recommender?.name || '—'],
    ['Registration No', m.registrationNo || CLUB.regNo],
  ];

  const committees = m.subCommittees || [];
  const isCommitteeOfficer = committees.some(
    (s) =>
      ['President', 'Secretary'].includes(s.role) &&
      ['Vanitha Vedi', 'Bala Vedi', 'Yuvatha'].includes(s.committeeName)
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Personal profile banner */}
      <div className="mb-8 flex flex-wrap items-center gap-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 p-6 shadow-lg">
        <div className="relative shrink-0">
          <img
            src={m.photoUrl || '/assets/club-logo.png'}
            alt="profile"
            className="h-20 w-20 rounded-2xl border-2 border-gold bg-white object-cover shadow-md"
          />
          {m.status === 'APPROVED' && (
            <span className="absolute -bottom-1.5 -right-1.5 rounded-full bg-emerald-500 p-1 text-white shadow">
              <FaCheckCircle className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
            Welcome, {m.fullName?.split(' ')[0] || 'Member'}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={m.status} />
            {m.role && (
              <span className="rounded-full bg-gold px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-emerald-950">
                {m.role}
              </span>
            )}
            {m.membershipId && (
              <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-emerald-100">
                {m.membershipId}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => download('idcard')} className="btn-gold !py-2 text-sm">
            <FaIdCardAlt /> Download ID Card
          </button>
          <button onClick={() => download('application')} className="btn-primary !py-2 text-sm">
            <FaFilePdf /> Application PDF
          </button>
          <button onClick={() => setShowPdf(true)} className="btn-outline !border-white/40 !text-white hover:!bg-white/10 !py-2 text-sm">
            <FaEye /> Preview
          </button>
        </div>
      </div>

      {/* Club summary stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-3xl">
        {[
          {
            icon: FaUsers,
            label: 'Total Approved Members',
            value: clubStats?.activeMembers ?? '...',
            cls: 'bg-emerald-100 text-emerald-800',
          },
          {
            icon: FaBookOpen,
            label: 'Total Library Books',
            value: clubStats?.books ?? '...',
            cls: 'bg-gold/10 text-gold',
          },
          {
            icon: FaCheckCircle,
            label: 'Membership Status',
            value: m.status === 'APPROVED' ? 'Active' : m.status,
            cls: 'bg-sky-100 text-sky-800',
          },
        ].map((s) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${s.cls}`}>
              <s.icon className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-extrabold text-slate-800">{s.value}</p>
              <p className="truncate text-xs font-medium text-slate-500">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-900">
            <FaRegAddressCard className="text-gold" /> Digital ID Card
          </h2>
          <IDCard
            user={{
              ...m,
              photoUrl: m.photoUrl || '/assets/club-logo.png',
            }}
          />

          {/* Club Positions & Roles */}
          <PositionsCard member={m} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-900">
            <FaUserPlus className="text-gold" /> Membership Details
          </h2>
          <div className="card overflow-hidden">
            <div className="grid grid-cols-[1fr_2fr] gap-px bg-slate-100">
              {rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-subgrid col-span-2 bg-white">
                  <div className="bg-emerald-900/5 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-emerald-900">
                    {k}
                  </div>
                  <div className="px-4 py-2.5 text-sm text-slate-700">{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5 text-sm text-slate-600">
            <p className="mb-2 font-bold text-emerald-900">Club Rules Reminder</p>
            <p>
              Your digital card is the official identification document. Present it upon entry
              to the library. For sports events and cultural programs, your card is your entry pass.
            </p>
          </div>
        </motion.div>
      </div>

      {isCommitteeOfficer && (
        <CommitteeManagementPanel />
      )}
      {featureEnabled('enableVouchers') && (
        <div className="mt-10 border-t border-slate-200 pt-10">
          <MemberReceipts />
        </div>
      )}
      {featureEnabled('enableCatalog') && (
        <div className="mt-10 border-t border-slate-200 pt-10">
          <PublicCatalog />
        </div>
      )}
      {showPdf && <ApplicationPDF user={m} onClose={() => setShowPdf(false)} />}
    </div>
  );
}

const EXEC_DESIGNATIONS = ['President', 'Secretary', 'Treasurer', 'Executive Member'];

function PositionsCard({ member }) {
  const subCommittees = member.subCommittees || [];
  const execAssignment = subCommittees.find(
    (s) => s.isExecutive || EXEC_DESIGNATIONS.includes(s.role)
  );

  return (
    <div className="card p-5">
      <h3 className="flex items-center gap-2 text-base font-extrabold text-emerald-900">
        <FaUserTie className="text-gold" /> Club Positions &amp; Roles
      </h3>
      {subCommittees.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <FaUsers className="text-slate-400" /> No committee positions assigned yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {execAssignment && (
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Main Executive Committee
              </p>
              <span className="inline-flex items-center gap-2 rounded-full bg-gold px-3.5 py-1.5 text-xs font-extrabold text-emerald-950 shadow-sm">
                <FaUserTie /> {execAssignment.role}
              </span>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Sub-Committee Assignees
            </p>
            <div className="flex flex-wrap gap-2">
              {subCommittees.map((s, i) => (
                <span
                  key={`${s.committeeName}-${i}`}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-900 px-3.5 py-1.5 text-xs font-bold text-white"
                >
                  <FaUsers className="text-gold" />
                  {s.committeeName} &middot; {s.role}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}