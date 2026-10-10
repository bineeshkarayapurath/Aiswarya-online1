import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api, { resolveMedia } from '../api/client';
import {
  UserCheck,
  Users,
  ShieldCheck,
  BookOpen,
  ArrowLeftRight,
  Wallet,
  ImagePlus,
  Settings,
  X,
  LayoutGrid,
  HeartHandshake,
  Baby,
  Zap,
  Search,
  UserPlus,
  UserMinus,
  NotebookPen,
  Boxes,
  Receipt,
  HeartPulse,
  Music,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import Spinner from '../components/Spinner';
import ProgramsPanel from '../components/ProgramsPanel';
import AccountsPanel from '../components/AccountsPanel';
import GalleryPanel from '../components/GalleryPanel';
import CatalogPanel from '../components/CatalogPanel';
import BorrowingPanel from '../components/BorrowingPanel';
import ReceiptsAndVouchers from '../components/ReceiptsAndVouchers';
import CommunityServicePanel from '../components/CommunityServicePanel';
import ExecutiveCommittee from '../components/ExecutiveCommittee';
import ProgramApprovals from '../components/ProgramApprovals';
import EventProgramManager from '../components/EventProgramManager';
import EventRegistrationsList from '../components/EventRegistrationsList';
import AssetsPanel from '../components/AssetsPanel';
import { canAccessModule, effectiveRole, roleLabel } from '../lib/permissions';
import { moduleEnabled } from '../lib/club';
import { uploadImages } from '../lib/uploadImages';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { FaCheckCircle, FaTimesCircle, FaEdit, FaFilePdf, FaIdCardAlt, FaTrashAlt, FaHourglass, FaPhoneAlt, FaEnvelope, FaMapMarkerAlt, FaFacebook, FaInstagram, FaWhatsapp, FaYoutube, FaSave, FaSignature, FaUpload } from 'react-icons/fa';
import { invalidateClubSignatures } from '../lib/useClubSignatures';
import { invalidateClubContact } from '../lib/useClubContact';
import { invalidateCachedResource } from '../lib/useCachedResource';

const MODULES = [
  {
    key: 'approvals',
    titleKey: 'admin.modules.approvals.title',
    descKey: 'admin.modules.approvals.desc',
    icon: UserCheck,
    chip: 'bg-emerald-900 text-amber-300',
    card: 'hover:border-emerald-900/40',
  },
  {
    key: 'members',
    titleKey: 'admin.modules.members.title',
    descKey: 'admin.modules.members.desc',
    icon: Users,
    chip: 'bg-emerald-100 text-emerald-800',
    card: 'hover:border-emerald-600/40',
  },
  {
    key: 'committee',
    titleKey: 'admin.modules.committee.title',
    descKey: 'admin.modules.committee.desc',
    icon: ShieldCheck,
    chip: 'bg-sky-100 text-sky-800',
    card: 'hover:border-sky-600/40',
  },
  {
    key: 'catalog',
    titleKey: 'admin.modules.catalog.title',
    descKey: 'admin.modules.catalog.desc',
    icon: BookOpen,
    chip: 'bg-orange-100 text-orange-800',
    card: 'hover:border-orange-600/40',
  },
  {
    key: 'issues',
    titleKey: 'admin.modules.issues.title',
    descKey: 'admin.modules.issues.desc',
    icon: ArrowLeftRight,
    chip: 'bg-violet-100 text-violet-800',
    card: 'hover:border-violet-600/40',
  },
  {
    key: 'programs',
    titleKey: 'admin.modules.programs.title',
    descKey: 'admin.modules.programs.desc',
    icon: NotebookPen,
    chip: 'bg-cyan-100 text-cyan-800',
    card: 'hover:border-cyan-600/40',
  },
  {
    key: 'programRegistration',
    titleKey: 'admin.modules.programRegistration.title',
    descKey: 'admin.modules.programRegistration.desc',
    icon: Music,
    chip: 'bg-violet-100 text-violet-800',
    card: 'hover:border-violet-600/40',
  },
  {
    key: 'accounts',
    titleKey: 'admin.modules.accounts.title',
    descKey: 'admin.modules.accounts.desc',
    icon: Wallet,
    chip: 'bg-amber-100 text-amber-800',
    card: 'hover:border-amber-600/40',
  },
  {
    key: 'vouchers',
    titleKey: 'admin.modules.vouchers.title',
    descKey: 'admin.modules.vouchers.desc',
    icon: Receipt,
    chip: 'bg-fuchsia-100 text-fuchsia-800',
    card: 'hover:border-fuchsia-600/40',
  },
  {
    key: 'communityService',
    titleKey: 'admin.modules.communityService.title',
    descKey: 'admin.modules.communityService.desc',
    icon: HeartPulse,
    chip: 'bg-rose-100 text-rose-700',
    card: 'hover:border-rose-500/40',
  },
  {
    key: 'gallery',
    titleKey: 'admin.modules.gallery.title',
    descKey: 'admin.modules.gallery.desc',
    icon: ImagePlus,
    chip: 'bg-pink-100 text-pink-800',
    card: 'hover:border-pink-600/40',
  },
  {
    key: 'vanitha',
    titleKey: 'admin.modules.vanitha.title',
    descKey: 'admin.modules.vanitha.desc',
    icon: HeartHandshake,
    chip: 'bg-rose-100 text-rose-700',
    card: 'hover:border-rose-500/40',
  },
  {
    key: 'bala',
    titleKey: 'admin.modules.bala.title',
    descKey: 'admin.modules.bala.desc',
    icon: Baby,
    chip: 'bg-teal-100 text-teal-700',
    card: 'hover:border-teal-500/40',
  },
  {
    key: 'yuvatha',
    titleKey: 'admin.modules.yuvatha.title',
    descKey: 'admin.modules.yuvatha.desc',
    icon: Zap,
    chip: 'bg-lime-100 text-lime-700',
    card: 'hover:border-lime-600/40',
  },
  {
    key: 'assets',
    titleKey: 'admin.modules.assets.title',
    descKey: 'admin.modules.assets.desc',
    icon: Boxes,
    chip: 'bg-indigo-100 text-indigo-700',
    card: 'hover:border-indigo-600/40',
  },
  {
    key: 'settings',
    titleKey: 'admin.modules.settings.title',
    descKey: 'admin.modules.settings.desc',
    icon: Settings,
    chip: 'bg-slate-200 text-slate-700',
    card: 'hover:border-slate-500/40',
  },
];

export default function AuthorityDashboard() {
  const [active, setActive] = useState(null);
  const { user } = useAuth();
  const { t } = useLocale();

  // Role-based module access: an administrator only sees tiles their
  // designation may open (no designation = full access). ADMIN role accounts
  // always get full access. Feature toggles (clubConfig.features) additionally
  // hide disabled modules.
  const accessibleModules = MODULES.filter(
    (m) => moduleEnabled(m.key) && canAccessModule(m.key, user?.designation, user?.role)
  );;

  const open = (key) => setActive({ key, data: MODULES.find((m) => m.key === key) });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2.5">
          <LayoutGrid className="h-7 w-7 text-emerald-900" />
          <h1 className="text-3xl font-extrabold text-emerald-900 dark:text-white">{t('admin.title')}</h1>
        </div>
        <p className="mt-2 text-sm text-slate-500">{t('admin.subtitle')}</p>
      </div>

      <motion.div
        layout
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {accessibleModules.map((m, i) => (
          <motion.button
            key={m.key}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => open(m.key)}
            className={`group flex items-start gap-4 rounded-2xl border-2 border-slate-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${m.card}`}
          >
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${m.chip}`}>
              <m.icon className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block font-extrabold text-slate-800">{t(m.titleKey)}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{t(m.descKey)}</span>
            </span>
          </motion.button>
        ))}
      </motion.div>

      <AnimatePresence>
        {active && (
          <ModuleModal
            module={active.data}
            onClose={() => setActive(null)}
          >
            {active.key === 'approvals' && <ApprovalsPanel />}
            {active.key === 'members' && <ApprovedMembers />}
            {active.key === 'settings' && <SettingsPanel />}
            {active.key === 'vanitha' && <CommitteePanel committeeName="Vanitha Vedi" />}
            {active.key === 'bala' && <CommitteePanel committeeName="Bala Vedi" />}
            {active.key === 'yuvatha' && <CommitteePanel committeeName="Yuvatha" />}
            {active.key === 'programs' && <ProgramsPanel />}
            {active.key === 'programRegistration' && <EventProgramModule />}
            {active.key === 'accounts' && <AccountsPanel />}
            {active.key === 'vouchers' && <ReceiptsAndVouchers />}
            {active.key === 'communityService' && <CommunityServicePanel />}
            {active.key === 'gallery' && <GalleryPanel />}
            {active.key === 'catalog' && <CatalogPanel />}
            {active.key === 'issues' && <BorrowingPanel />}
            {active.key === 'committee' && <ExecutiveCommittee />}
            {active.key === 'assets' && <AssetsPanel />}
            {!['approvals', 'members', 'committee', 'settings', 'vanitha', 'bala', 'yuvatha', 'programs', 'programRegistration', 'accounts', 'vouchers', 'communityService', 'gallery', 'catalog', 'issues'].includes(active.key) && (
              <PlaceholderPanel module={active.data} />
            )}
          </ModuleModal>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModuleModal({ module, onClose, children }) {
  const { t } = useLocale();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-900/10 text-emerald-900">
              <module.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-extrabold text-emerald-900">{t(module.titleKey)}</h3>
              <p className="text-xs text-slate-500">{t(module.descKey)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            title={t('admin.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-50/60 p-6">{children}</div>
      </motion.div>
    </div>
  );
}

function EventProgramModule() {
  const [tab, setTab] = useState('manage');
  const tabs = [
    { key: 'manage', label: 'Events & Sub-programs' },
    { key: 'registrations', label: 'Registrations List' },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`rounded-xl px-4 py-2 text-xs font-extrabold transition ${
              tab === tb.key ? 'bg-emerald-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>
      <div className="transition-all">
        {tab === 'manage' && <EventProgramManager />}
        {tab === 'registrations' && <EventRegistrationsList />}
      </div>
    </div>
  );
}

function PlaceholderPanel({ module }) {
  const Icon = module.icon;
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-14 text-center">
        <span className={`flex h-16 w-16 items-center justify-center rounded-2xl ${module.chip}`}>
          <Icon className="h-8 w-8" />
        </span>
        <div>
          <h4 className="text-lg font-extrabold text-slate-700">{t(module.titleKey)}</h4>
          <p className="mt-1 text-sm text-slate-500">
            This module is under development. The full {t(module.titleKey).toLowerCase()} workflow will be added here shortly.
          </p>
        </div>
        <span className="rounded-full bg-emerald-900/10 px-4 py-1.5 text-xs font-bold text-emerald-900">
          {t('admin.comingSoon')}
        </span>
      </div>

      {/* Empty container skeleton to build on */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <p className="text-sm font-bold text-slate-600">{t('admin.placeholderFramework')}</p>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {t('admin.empty')}
          </span>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-slate-50 px-5 py-3.5 last:border-0">
            <span
              className="h-8 w-8 rounded-lg bg-slate-100"
              style={{ opacity: 1 - i * 0.22 }}
            />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 w-2/5 rounded-full bg-slate-100" style={{ opacity: 1 - i * 0.22 }} />
              <div className="h-2 w-1/3 rounded-full bg-slate-50" style={{ opacity: 1 - i * 0.22 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Module: Approved Members List
 * ------------------------------------------------------------------ */
// Initials badge rendered when a member has no photo (or it fails to load).
function InitialsBadge({ name, className = '' }) {
  const initials = (n) =>
    !n ? '?' : n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return (
    <span
      className={`flex items-center justify-center rounded-xl bg-emerald-900 font-extrabold text-gold-300 shadow-sm ${className}`}
      title={name || 'Member'}
    >
      {initials(name)}
    </span>
  );
}

// Photo cell: renders the member photo when available, otherwise (or on load
// failure) a neat initials avatar — never a broken <img>.
// resolveMedia() is required: a stored relative path (photos/abc.jpg or
// /uploads/photos/abc.jpg) must be prefixed with the API origin, otherwise the
// browser requests it from the frontend domain and 404s, dropping the officer
// back to initials even though their photo exists.
function MemberAvatar({ member }) {
  const [broken, setBroken] = useState(false);
  const photo = resolveMedia(member?.photoUrl);
  useEffect(() => setBroken(false), [photo]);

  if (photo && !broken) {
    return (
      <img
        src={photo}
        alt={member?.fullName || 'member'}
        onError={() => setBroken(true)}
        className="h-10 w-10 rounded-xl border border-slate-200 object-cover"
      />
    );
  }
  return <InitialsBadge name={member?.fullName} className="h-10 w-10 text-xs" />;
}

// Membership ID display: prefer the assigned member ID; fall back to a short
// code derived from the record id so the cell never renders a blank dash.
function formatMemberId(m) {
  if (m?.membershipId) return m.membershipId;
  const raw = String(m?.id || m?._id || '').trim();
  const tail = raw.replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase();
  return raw && tail ? `ID-${tail}` : 'N/A';
}

// Edit dialog for an approved member row: updates member details, photoUrl,
// and the membership ID via PUT /admin/users/:id.
function EditMemberModal({ member, onClose, onSaved }) {
  const { t } = useLocale();
  const [form, setForm] = useState({
    fullName: member?.fullName || '',
    membershipId: member?.membershipId || '',
    phoneNumber: member?.phoneNumber || '',
    email: member?.email || '',
    dob: member?.dob ? String(member.dob).slice(0, 10) : '',
    address: member?.address || '',
    occupation: member?.occupation || '',
    education: member?.education || '',
    photoUrl: member?.photoUrl || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const [url] = await uploadImages([file]);
      if (url) {
        setForm((f) => ({ ...f, photoUrl: url }));
        toast.success('Photo uploaded');
      } else {
        toast.error('Photo upload failed');
      }
    } catch {
      toast.error('Photo upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/users/${member._id}`, form);
      toast.success('Member updated');
      invalidateCachedResource('public/stats');
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-emerald-950/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
          <h3 className="text-lg font-extrabold text-emerald-900">{t('admin.editMember')}</h3>
          <button onClick={onClose} className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-100">
            ✕
          </button>
        </div>

        <div className="grid gap-3 p-5">
          <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-3">
            <img
              src={resolveMedia(form.photoUrl) || '/assets/club-logo.png'}
              alt="member"
              className="h-16 w-16 rounded-2xl border-2 border-emerald-900/20 object-cover"
            />
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-800">{form.fullName || member?.fullName}</p>
              <p className="text-xs text-slate-500">{form.membershipId || member?.membershipId || 'No ID assigned'}</p>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-900/10 px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-900/20">
                <ImagePlus className="h-3.5 w-3.5" />
                {uploading ? 'Uploading...' : 'Upload photo'}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              </label>
            </div>
          </div>

          <div>
            <label className="label">Full Name</label>
            <input className="input" value={form.fullName} onChange={set('fullName')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Membership ID</label>
              <input className="input uppercase" value={form.membershipId} onChange={set('membershipId')} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phoneNumber} onChange={set('phoneNumber')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date of Birth</label>
              <input type="date" className="input" value={form.dob} onChange={set('dob')} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={form.email} onChange={set('email')} />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <textarea className="input min-h-[60px]" value={form.address} onChange={set('address')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Occupation / Status</label>
              <select className="input" value={form.occupation} onChange={set('occupation')}>
                <option value="">Select status</option>
                <option>Student</option>
                <option>Employed</option>
                <option>Self-Employed / Business</option>
                <option>Homemaker</option>
                <option>Retired</option>
                <option>Others</option>
              </select>
            </div>
            <div>
              <label className="label">Educational Qualification</label>
              <select className="input" value={form.education} onChange={set('education')}>
                <option value="">Select qualification</option>
                <option>SSLC</option>
                <option>Higher Secondary</option>
                <option>Diploma</option>
                <option>Graduate</option>
                <option>Post Graduate</option>
                <option>Others</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Photo URL</label>
            <input className="input" value={form.photoUrl} onChange={set('photoUrl')} />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="btn-outline flex-1 !py-2 text-sm">
              Cancel
            </button>
            <button onClick={save} disabled={saving || uploading} className="btn-primary flex-1 !py-2 text-sm">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ApprovedMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [editing, setEditing] = useState(null);
  const { t } = useLocale();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users');
      setMembers(res.data.users || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const deleteMember = async (member) => {
    const ok = window.confirm(
      'Are you sure you want to delete this member? This permanently removes their record and generated documents.'
    );
    if (!ok) return;
    setDeletingId(member._id);
    try {
      const res = await api.delete(`/admin/users/${member._id}`);
      toast.success(res.data.message || 'Member deleted');
      invalidateCachedResource('public/stats');
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to delete member');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <Spinner label="Loading members..." />;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <p className="flex items-center gap-2 text-sm font-extrabold text-emerald-900">
          <ShieldCheck className="text-gold" /> {t('admin.membersHeader')}
        </p>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
          {members.length} member{members.length === 1 ? '' : 's'}
        </span>
      </div>
      {members.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Users className="h-10 w-10 text-slate-300" />
          <p className="font-semibold text-slate-500">{t('admin.noApprovedMembers')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="whitespace-nowrap px-5 py-3 font-bold">S.No</th>
                <th className="whitespace-nowrap px-5 py-3 font-bold">Photo</th>
                <th className="whitespace-nowrap px-5 py-3 font-bold">Member ID</th>
                <th className="whitespace-nowrap px-5 py-3 font-bold">Full Name</th>
                <th className="whitespace-nowrap px-5 py-3 font-bold">Phone</th>
                <th className="whitespace-nowrap px-5 py-3 font-bold">Designation</th>
                <th className="whitespace-nowrap px-5 py-3 font-bold">Role</th>
                <th className="whitespace-nowrap px-5 py-3 font-bold">Status</th>
                <th className="whitespace-nowrap px-5 py-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={m._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">{i + 1}</td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <MemberAvatar member={m} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-extrabold text-gold">
                      {formatMemberId(m)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 font-semibold text-slate-700">{m.fullName}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                    {m.phoneNumber ? `+91 ${m.phoneNumber}` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">{m.designation || 'Member'}</td>
                  <td className="whitespace-nowrap px-5 py-3">
                    {/* The ADMIN badge is reserved for the accounts that actually
                        hold administrative authority: the membership IDs on the
                        admin allowlist (ALC-001 / ALC-002 / ALC-003) and the
                        President / Secretary. Every other officer — including
                        Vice Presidents and other Executive Committee members —
                        shows only their designation. */}
                    {effectiveRole(m) === 'ADMIN' ? (
                      <span
                        className="rounded-full bg-emerald-900 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white"
                        title="Has administrative access"
                      >
                        ADMIN
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-extrabold text-slate-600">
                        {roleLabel(m)}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3"><StatusBadge status={m.status} /></td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setEditing(m)}
                        className="flex items-center gap-1 rounded-lg bg-emerald-900/10 px-2.5 py-1.5 text-xs font-bold text-emerald-900 transition hover:bg-emerald-900/20"
                        title="Edit member"
                      >
                        <FaEdit /> Edit
                      </button>
                      <button
                        onClick={() => deleteMember(m)}
                        disabled={deletingId === m._id}
                        className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                        title="Delete member"
                      >
                        <FaTrashAlt /> {deletingId === m._id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <EditMemberModal
            member={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              load();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Module: System Settings (Footer & Social Links)
 * ------------------------------------------------------------------ */
// Published contact details. These are the club's live values: the website footer,
// the application letterhead, the ID cards and the receipts/vouchers all read them
// through GET /api/public/settings, and each field falls back to the white-label
// config in client/src/config/clubConfig.js until it is filled in here.
const CONTACT_FIELDS = [
  { key: 'phoneNumber', label: 'Official Phone Number', placeholder: '+91 9999999999', type: 'tel', icon: FaPhoneAlt },
  { key: 'emailAddress', label: 'Official Email Address', placeholder: '12bty6652@gmail.com', type: 'email', icon: FaEnvelope },
];

// Officer phone numbers. Leaving one blank means "use whatever number the member
// currently holding that post has on their account", which is what makes electing
// a new President or Secretary show up in the footer and on every document without
// a second edit. Set a value only to publish a different number, e.g. a landline.
const OFFICER_FIELDS = [
  { key: 'presidentPhone', label: "President's Phone Number", autoKey: 'president', icon: FaPhoneAlt },
  { key: 'secretaryPhone', label: "Secretary's Phone Number", autoKey: 'secretary', icon: FaPhoneAlt },
];

const SOCIAL_FIELDS = [
  { key: 'mapsUrl', label: 'Google Maps Location URL', placeholder: 'https://maps.google.com/?q=...', type: 'url', icon: FaMapMarkerAlt },
  { key: 'facebookUrl', label: 'Facebook URL', placeholder: 'https://facebook.com/...', type: 'url', icon: FaFacebook },
  { key: 'instagramUrl', label: 'Instagram URL', placeholder: 'https://instagram.com/...', type: 'url', icon: FaInstagram },
  { key: 'whatsappUrl', label: 'WhatsApp Group Link', placeholder: 'https://chat.whatsapp.com/...', type: 'url', icon: FaWhatsapp },
  { key: 'youtubeUrl', label: 'YouTube Channel Link', placeholder: 'https://youtube.com/@...', type: 'url', icon: FaYoutube },
];

// Signature uploads feed the ID card back and every generated PDF/letterhead.
const SIGNATURE_FIELDS = [
  {
    key: 'secretarySignatureUrl',
    label: "Secretary's Signature",
    hint: "Printed on the back of every member ID card, on official PDFs and letterheads, and on the authorised signatory block of every receipt and voucher.",
  },
  {
    key: 'presidentSignatureUrl',
    label: "President's Signature",
    hint: 'Added to official PDFs and letterheads alongside the Secretary.',
  },
];

const EMPTY_SETTINGS = {
  address: '',
  phoneNumber: '',
  emailAddress: '',
  presidentPhone: '',
  secretaryPhone: '',
  mapsUrl: '',
  facebookUrl: '',
  instagramUrl: '',
  whatsappUrl: '',
  youtubeUrl: '',
  secretarySignatureUrl: '',
  presidentSignatureUrl: '',
};

// Single signature slot: preview, replace, clear.
//
// Uploading persists immediately. This used to only update local form state and
// rely on a later "Save Settings", which meant a signature could be uploaded,
// previewed, and then lost on navigating away - leaving every document with a
// blank signature and no obvious cause. A file upload is a completed action on
// its own, so it now writes through to the server and invalidates the cache.
function SignatureField({ field, value, onChange }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const persist = async (url) => {
    const res = await api.put('/admin/settings', { [field.key]: url });
    onChange((res.data.settings && res.data.settings[field.key]) || url);
    // Cards, receipts and documents already on screen must pick up the new image.
    invalidateClubSignatures();
    return res;
  };

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const [url] = await uploadImages([file]);
      if (!url) {
        toast.error('Signature upload failed');
        return;
      }
      await persist(url);
      toast.success(`${field.label} uploaded and saved`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save the signature');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await persist('');
      toast.success(`${field.label} removed`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove the signature');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <label className="label flex items-center gap-1.5">
        <FaSignature className="text-slate-400" /> {field.label}
      </label>
      <p className="mt-1 text-xs text-slate-500">{field.hint}</p>

      <div className="mt-3 flex items-center gap-4">
        <div className="flex h-20 w-full max-w-[15rem] items-end justify-center rounded-lg border border-dashed border-slate-300 bg-white p-2">
          {value ? (
            <img
              src={resolveMedia(value)}
              alt={field.label}
              className="max-h-full w-auto max-w-full object-contain"
            />
          ) : (
            <span className="text-[11px] font-medium text-slate-400">Not uploaded</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="btn-outline !py-2 text-xs"
          >
            <FaUpload className="mr-2" /> {busy ? 'Uploading...' : value ? 'Replace' : 'Upload'}
          </button>
          {value && (
            <button
              type="button"
              onClick={clear}
              disabled={busy}
              className="btn-outline !py-2 text-xs !text-red-600"
            >
              <FaTrashAlt className="mr-2" /> Remove
            </button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={pick}
      />
    </div>
  );
}

function SettingsPanel() {
  const { t } = useLocale();
  const [form, setForm] = useState(EMPTY_SETTINGS);
  // The number each blank officer field is currently resolving to, so it can be
  // shown as the field's hint instead of being saved back as a pinned value.
  const [autoPhones, setAutoPhones] = useState({ president: '', secretary: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Contact/social details are public; signature URLs come from their own
    // authenticated endpoint so they are never served to anonymous visitors.
    Promise.all([
      api.get('/public/settings'),
      api.get('/settings/signatures').catch(() => ({ data: {} })),
    ])
      .then(([social, sig]) => {
        const settings = social.data.settings || {};
        const fromAccount = social.data.officerPhonesFromAccount || {};
        setAutoPhones({
          president: settings.presidentPhone || '',
          secretary: settings.secretaryPhone || '',
        });
        setForm({
          ...EMPTY_SETTINGS,
          ...settings,
          // A number that is only following the current office-bearer has to load
          // blank, or simply saving this form would pin today's number in place.
          ...(fromAccount.president ? { presidentPhone: '' } : {}),
          ...(fromAccount.secretary ? { secretaryPhone: '' } : {}),
          ...(sig.data.signatures || {}),
        });
      })
      .catch((e) => toast.error(e.response?.data?.message || 'Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put('/admin/settings', form);
      setForm({ ...EMPTY_SETTINGS, ...res.data.settings });
      setAutoPhones({
        president: res.data.settings.presidentPhone || '',
        secretary: res.data.settings.secretaryPhone || '',
      });
      // Cards and receipts already on screen must pick up the new signatures, and
      // the footer the new contact details.
      invalidateClubSignatures();
      invalidateClubContact();
      toast.success('Settings saved');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Loading settings..." />;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h4 className="flex items-center gap-2 text-base font-extrabold text-emerald-900">
          <FaSignature className="text-gold" /> Officer Signatures
        </h4>
        <p className="mt-1 text-sm text-slate-500">
          Upload a transparent PNG of each officer&rsquo;s signature. Saving is immediate &mdash; each
          image is stored as soon as it is chosen, and applied automatically wherever an authorised
          signature is required: the Secretary&rsquo;s appears on the back of every digital ID card
          and on the signatory block of every receipt and voucher, and both are appended to official
          PDF documents and letterheads.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {SIGNATURE_FIELDS.map((field) => (
            <SignatureField
              key={field.key}
              field={field}
              value={form[field.key]}
              onChange={(url) => setForm({ ...form, [field.key]: url })}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h4 className="text-base font-extrabold text-emerald-900">{t('admin.footerSocial')}</h4>
        <p className="mt-1 text-sm text-slate-500">
          The club&rsquo;s official contact details. The address, email and phone appear on the website
          footer, on membership application PDFs and letterheads, on the back of member ID cards and
          on receipts and vouchers — a change here reaches all of them at once.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="label flex items-center gap-1.5">
              <FaMapMarkerAlt className="text-slate-400" /> Official Address
            </label>
            <textarea
              className="input min-h-[60px]"
              placeholder="Street, Post office, District, PIN"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {CONTACT_FIELDS.map(({ key, label, placeholder, type, icon: Icon }) => (
              <div key={key}>
                <label className="label flex items-center gap-1.5">
                  <Icon className="text-slate-400" /> {label}
                </label>
                <input
                  type={type}
                  className="input"
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5">
          <h5 className="text-sm font-extrabold text-emerald-900">Office-Bearer Phone Numbers</h5>
          <p className="mt-1 text-sm text-slate-500">
            Leave a field blank to publish the number on the member account currently holding that
            post — electing a new President or Secretary then updates the footer and the documents by
            itself. Enter a number only to publish a different one, such as a club landline.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {OFFICER_FIELDS.map(({ key, label, autoKey, icon: Icon }) => (
              <div key={key}>
                <label className="label flex items-center gap-1.5">
                  <Icon className="text-slate-400" /> {label}
                </label>
                <input
                  type="tel"
                  className="input"
                  placeholder={
                    autoPhones[autoKey]
                      ? `Auto: ${autoPhones[autoKey]}`
                      : 'Auto: no number on the current officer account'
                  }
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Currently publishing: <span className="font-semibold">{autoPhones[autoKey] || '—'}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="text-sm text-slate-500">
            Social links shown alongside the contact details in the footer. Leave a field empty to hide
            the icon/link.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {SOCIAL_FIELDS.map(({ key, label, placeholder, type, icon: Icon }) => (
              <div key={key}>
                <label className="label flex items-center gap-1.5">
                  <Icon className="text-slate-400" /> {label}
                </label>
                <input
                  type={type}
                  className="input"
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* One save action covers both cards above. */}
      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn-primary !py-2.5 text-sm">
          <FaSave className="mr-2" /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Module: Sub-Committees (Vanitha Vedi / Bala Vedi / Yuvatha)
 * ------------------------------------------------------------------ */
const DESIGNATIONS = [
  'General Member',
  'President',
  'Secretary',
  'Treasurer',
  'Executive Member',
];
const EXEC_DESIGNATIONS = ['President', 'Secretary', 'Treasurer', 'Executive Member'];

function CommitteePanel({ committeeName }) {
  const { t } = useLocale();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [idInput, setIdInput] = useState('');
  const [role, setRole] = useState('General Member');
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/committee/members', {
        params: { committee: committeeName },
      });
      setMembers(res.data.members || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load committee');
    } finally {
      setLoading(false);
    }
  }, [committeeName]);

  useEffect(() => {
    load();
  }, [load]);

  const assign = async () => {
    if (!idInput.trim()) {
      toast.error('Enter a Member ID, e.g. AISC-001');
      return;
    }
    setAssigning(true);
    try {
      const res = await api.post('/admin/committee/assign', {
        committeeName,
        membershipId: idInput.trim(),
        role,
      });
      toast.success(res.data.message);
      setIdInput('');
      setRole('General Member');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  };

  const remove = async (m) => {
    const ok = window.confirm(`Remove ${m.fullName} from ${committeeName}?`);
    if (!ok) return;
    try {
      await api.post('/admin/committee/remove', {
        committeeName,
        membershipId: m.membershipId,
      });
      toast.success('Removed from committee');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to remove');
    }
  };

  const executive = members.filter((m) => m.isExecutive || EXEC_DESIGNATIONS.includes(m.role));
  const allMembers = members;

  return (
    <div className="space-y-6">
      {/* Search & Assign */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h4 className="flex items-center gap-2 text-sm font-extrabold text-emerald-900">
          <Search className="h-4 w-4" /> Assign Member to {committeeName}
        </h4>
        <div className="mt-3 grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="label">Member ID</label>
            <input
              className="input"
              placeholder="AISC-001"
              value={idInput}
              onChange={(e) => setIdInput(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Designation</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              {DESIGNATIONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <button
            onClick={assign}
            disabled={assigning}
            className="btn-primary flex items-center justify-center gap-2 !py-2.5 text-sm disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" /> {assigning ? 'Adding...' : 'Add to Committee'}
          </button>
        </div>
      </div>

      {/* Executive Committee list */}
      <div className="overflow-hidden rounded-2xl border border-gold/40 bg-white">
        <div className="flex items-center justify-between border-b border-gold/40 bg-gold/10 px-5 py-3">
          <p className="text-sm font-extrabold text-emerald-900">{t('admin.execCommittee')}</p>
          <span className="rounded-full bg-gold/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gold">
            {executive.length} member{executive.length === 1 ? '' : 's'}
          </span>
        </div>
        {executive.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <ShieldCheck className="h-9 w-9 text-slate-300" />
            <p className="text-sm font-semibold text-slate-500">No executive members yet</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5 font-bold">Designation</th>
                <th className="px-5 py-2.5 font-bold">Member ID</th>
                <th className="px-5 py-2.5 font-bold">Name</th>
              </tr>
            </thead>
            <tbody>
              {executive.map((m) => (
                <tr key={m._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-2.5">
                    <span className="rounded-full bg-emerald-900 px-2.5 py-0.5 text-[11px] font-bold text-white">
                      {m.role}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-xs font-extrabold text-gold">{m.membershipId}</td>
                  <td className="px-5 py-2.5 font-semibold text-slate-700">{m.fullName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* All committee members */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <p className="text-sm font-extrabold text-emerald-900">{t('admin.allCommitteeMembers')}</p>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {allMembers.length} member{allMembers.length === 1 ? '' : 's'}
          </span>
        </div>
        {loading ? (
          <div className="px-6 py-8"><Spinner label="Loading members..." /></div>
        ) : allMembers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Users className="h-9 w-9 text-slate-300" />
            <p className="text-sm font-semibold text-slate-500">No members assigned yet</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5 font-bold">Designation</th>
                <th className="px-5 py-2.5 font-bold">Member ID</th>
                <th className="px-5 py-2.5 font-bold">Name</th>
                <th className="px-5 py-2.5 text-right font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {allMembers.map((m) => (
                <tr key={m._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-2.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        EXEC_DESIGNATIONS.includes(m.role)
                          ? 'bg-emerald-900 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {m.role}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-xs font-extrabold text-gold">{m.membershipId}</td>
                  <td className="px-5 py-2.5 font-semibold text-slate-700">{m.fullName}</td>
                  <td className="px-5 py-2.5 text-right">
                    <button
                      onClick={() => remove(m)}
                      title="Remove from committee"
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-500 transition hover:bg-red-50"
                    >
                      <UserMinus className="h-3.5 w-3.5" /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Module: Approval Control Panel (existing workflow)
 * ------------------------------------------------------------------ */
const TABS = [
  { key: 'PENDING_APPROVAL', label: 'Pending', icon: FaHourglass },
  { key: 'APPROVED', label: 'Approved', icon: FaCheckCircle },
  { key: 'REJECTED', label: 'Rejected', icon: FaTimesCircle },
];

function ApprovalsPanel() {
  const { t } = useLocale();
  const [view, setView] = useState('members');
  const [tab, setTab] = useState('PENDING_APPROVAL');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [approvingId, setApprovingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/requests', { params: { status: tab } });
      setRequests(res.data.requests);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id) => {
    setApprovingId(id);
    try {
      const res = await api.post(`/admin/requests/${id}/approve`);
      const approved = res.data.user || { status: 'APPROVED', membershipId: res.data.membershipId };
      toast.success(`Approved! ID: ${approved.membershipId}`);
      setSelected(null);
      // Approval changes the member count shown on the home page. That number is
      // cached in sessionStorage for up to 30 minutes and invalidateCachedResource
      // was never called anywhere, so without this the officer approves someone,
      // walks to the home page, and sees the old total with no obvious reason.
      invalidateCachedResource('public/stats');
      setRequests((prev) =>
        prev.map((r) => (r._id === id ? { ...r, status: approved.status, membershipId: approved.membershipId } : r))
      );
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Approval failed');
    } finally {
      setApprovingId(null);
    }
  };

  const reject = async (id, reason = '') => {
    try {
      await api.post(`/admin/requests/${id}/reject`, { reason });
      toast.success('Request rejected');
      invalidateCachedResource('public/stats');
      setSelected(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed');
    }
  };

  const removeMember = async (member, scope = 'card') => {
    const label = `${member.fullName} (${member.membershipId || member.phoneNumber})`;
    const ok = window.confirm(
      `Delete ${label}?\n\nThis permanently removes the record and files, so the phone number can be re-registered.`
    );
    if (!ok) return;
    try {
      await api.delete(`/admin/users/${member._id}`);
      toast.success('Member record deleted');
      invalidateCachedResource('public/stats');
      if (scope === 'modal') setSelected(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div>
      {/* View switch */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setView('members')}
          className={`rounded-xl px-4 py-2 text-xs font-extrabold uppercase tracking-wide transition ${
            view === 'members' ? 'bg-emerald-900 text-white' : 'bg-white text-slate-500 shadow-sm hover:text-emerald-900'
          }`}
        >
          {t('admin.membershipApplications')}
        </button>
        <button
          onClick={() => setView('submissions')}
          className={`rounded-xl px-4 py-2 text-xs font-extrabold uppercase tracking-wide transition ${
            view === 'submissions' ? 'bg-emerald-900 text-white' : 'bg-white text-slate-500 shadow-sm hover:text-emerald-900'
          }`}
        >
          {t('admin.subCommitteeSubmissions')}
        </button>
      </div>

      {view === 'submissions' ? (
        <ProgramApprovals />
      ) : (
      <>
      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
              tab === key
                ? 'bg-emerald-900 text-white shadow-lg shadow-emerald-900/20'
                : 'bg-white text-slate-500 shadow-sm hover:text-emerald-900'
            }`}
          >
            <Icon /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Loading requests..." />
      ) : requests.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-14 text-center">
          <Users className="text-4xl text-slate-300" />
          <p className="font-semibold text-slate-500">
            No {tab === 'PENDING_APPROVAL' ? 'pending' : tab.toLowerCase()} applications
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {requests.map((r, i) => (
            <motion.div
              key={r._id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card p-5"
            >
              <div className="flex items-start gap-4">
                <img
                  src={resolveMedia(r.photoUrl) || '/assets/club-logo.png'}
                  alt="applicant"
                  className="h-14 w-14 rounded-xl border-2 border-emerald-900/20 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-800">{r.fullName}</p>
                  <p className="text-xs text-slate-500">+91 {r.phoneNumber}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusBadge status={r.status} />
                    {r.membershipId && (
                      <span className="text-[11px] font-bold text-gold">{r.membershipId}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-1 text-xs text-slate-500">
                <p>Age {r.age} &middot; {r.occupation || 'No occupation'}</p>
                <p className="truncate">{r.address}</p>
                <p className="truncate">
                  Recommender: {r.recommender?.name || '—'} {r.recommender?.memberId || ''}
                </p>
                <p className="text-[11px] text-slate-400">
                  Applied {new Date(r.createdAt).toLocaleDateString('en-IN')}
                </p>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setSelected(r)}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                    r.status === 'PENDING_APPROVAL'
                      ? 'bg-emerald-900 text-white hover:bg-emerald-700'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  View / Edit
                </button>
                {r.status === 'PENDING_APPROVAL' && (
                  <button
                    onClick={() => approve(r._id)}
                    disabled={approvingId === r._id}
                    className="flex-1 rounded-xl bg-gold py-2 text-xs font-bold text-white transition hover:bg-gold-700 disabled:opacity-60"
                  >
                    {approvingId === r._id ? 'Processing...' : 'Approve & Collect Fee'}
                  </button>
                )}

                <button
                  onClick={() => removeMember(r)}
                  title="Delete Member"
                  className="flex items-center justify-center rounded-xl border-2 border-red-200 px-3 py-2 text-sm text-red-500 transition hover:border-red-500 hover:bg-red-500 hover:text-white"
                >
                  <FaTrashAlt />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail / Edit modal (nested above module shell) */}
      <AnimatePresence>
        {selected && (
          <DetailModal
            request={selected}
            onClose={() => setSelected(null)}
            onApprove={approve}
            onReject={reject}
            onDelete={removeMember}
            approving={approvingId === selected._id}
          />
        )}
      </AnimatePresence>
      </>
      )}
    </div>
  );
}

function DetailModal({ request, onClose, onApprove, onReject, onDelete, approving }) {
  const [edit, setEdit] = useState(false);
  const [docs, setDocs] = useState({ applicationPdfUrl: '', idCardPdfUrl: '' });
  const [form, setForm] = useState({
    fullName: request.fullName,
    dob: request.dob?.slice(0, 10),
    address: request.address,
    occupation: request.occupation,
    education: request.education || '',
    email: request.email || '',
    recommenderName: request.recommender?.name,
    recommenderMemberId: request.recommender?.memberId,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get(`/admin/requests/${request._id}`)
      .then((r) =>
        setDocs({
          applicationPdfUrl: r.data.user.applicationPdfUrl,
          idCardPdfUrl: r.data.user.idCardPdfUrl,
        })
      )
      .catch(() => {});
  }, [request._id]);

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/requests/${request._id}`, form);
      toast.success('Corrections saved');
      setEdit(false);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const fmt = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-emerald-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
          <h3 className="text-lg font-extrabold text-emerald-900">Application Review</h3>
          <button onClick={onClose} className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-100">
            ✕
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex items-center gap-4">
            <img
              src={resolveMedia(request.photoUrl) || '/assets/club-logo.png'}
              alt="applicant"
              className="h-20 w-20 rounded-2xl border-2 border-emerald-900/20 object-cover"
            />
            <div>
              <p className="text-lg font-bold text-slate-800">{request.fullName}</p>
              <p className="text-sm text-slate-500">+91 {request.phoneNumber}</p>
              <div className="mt-1"><StatusBadge status={request.status} /></div>
            </div>
          </div>

          {edit ? (
            <div className="grid gap-3">
              <div>
                <label className="label">Full Name</label>
                <input className="input" value={form.fullName} onChange={set('fullName')} />
              </div>
              <div>
                <label className="label">Date of Birth</label>
                <input type="date" className="input" value={form.dob} onChange={set('dob')} />
              </div>
              <div>
                <label className="label">Address</label>
                <textarea className="input min-h-[60px]" value={form.address} onChange={set('address')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Occupation / Status</label>
                  <select className="input" value={form.occupation} onChange={set('occupation')}>
                    <option value="">Select status</option>
                    <option>Student</option>
                    <option>Employed</option>
                    <option>Self-Employed / Business</option>
                    <option>Homemaker</option>
                    <option>Retired</option>
                    <option>Others</option>
                  </select>
                </div>
                <div>
                  <label className="label">Educational Qualification</label>
                  <select className="input" value={form.education} onChange={set('education')}>
                    <option value="">Select qualification</option>
                    <option>SSLC</option>
                    <option>Higher Secondary</option>
                    <option>Diploma</option>
                    <option>Graduate</option>
                    <option>Post Graduate</option>
                    <option>Others</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Email</label>
                  <input className="input" value={form.email} onChange={set('email')} />
                </div>
                <div>
                  <label className="label">Recommender Name</label>
                  <input className="input" value={form.recommenderName} onChange={set('recommenderName')} />
                </div>
                <div>
                  <label className="label">Recommender Member ID</label>
                  <input className="input" value={form.recommenderMemberId} onChange={set('recommenderMemberId')} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEdit(false)} className="btn-outline flex-1 !py-2 text-sm">
                  Cancel
                </button>
                <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1 !py-2 text-sm">
                  {saving ? 'Saving...' : 'Save Corrections'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
              {[
                ['Date of Birth', fmt(request.dob)],
                ['Age', request.age],
                ['Address', request.address],
                ['Occupation', request.occupation || '—'],
                ['Qualification', request.education || '—'],
                ['Email', request.email || '—'],
                ['Recommender', `${request.recommender?.name || '—'} (${request.recommender?.memberId || '—'})`],
                ['Applied On', fmt(request.createdAt)],
                ['Reg No', '12 BTY 6652'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="font-bold text-slate-500">{k}</span>
                  <span className="text-right text-slate-700">{v}</span>
                </div>
              ))}

              {(docs.applicationPdfUrl || docs.idCardPdfUrl) && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                  {docs.applicationPdfUrl && (
                    <a
                      href={docs.applicationPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-900/10 px-3 py-1.5 text-xs font-bold text-emerald-900"
                    >
                      <FaFilePdf /> Application PDF
                    </a>
                  )}
                  {docs.idCardPdfUrl && (
                    <a
                      href={docs.idCardPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-lg bg-gold/10 px-3 py-1.5 text-xs font-bold text-gold"
                    >
                      <FaIdCardAlt /> ID Card PDF
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 p-5">
          {!edit && (
            <>
              <button
                onClick={() => setEdit(true)}
                className="btn-outline flex-1 !py-2 text-sm"
              >
                <FaEdit /> Edit Details
              </button>
              {request.status === 'PENDING_APPROVAL' && (
                <>
                  <button
                    onClick={() => onReject(request._id)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-red-500 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-500 hover:text-white"
                  >
                    <FaTimesCircle /> Reject
                  </button>
                  <button
                    onClick={() => onApprove(request._id)}
                    disabled={approving}
                    className="btn-gold flex-1 !py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    title="Approve application"
                  >
                    {approving ? 'Generating...' : 'Approve & Collect Fee'}
                  </button>
                </>
              )}
              <button
                onClick={() => onDelete(request, 'modal')}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-red-200 px-4 py-2 text-sm font-semibold text-red-400 transition hover:border-red-500 hover:bg-red-500 hover:text-white"
              >
                <FaTrashAlt /> Delete Member
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}