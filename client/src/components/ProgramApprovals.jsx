import { useEffect, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ClipboardCheck,
  Eye,
  CheckCircle2,
  XCircle,
  Calendar,
  Users,
  Camera,
  User as UserIcon,
  NotebookPen,
  FileText,
  Wallet,
} from 'lucide-react';
import api from '../api/client';
import Spinner from './Spinner';
import { SECTIONS, fmtDate, inr, ProgramStatusBadge } from './ProgramsPanel';

const sectionInfo = (section) => SECTIONS.find((s) => s.key === section) || { label: section, tint: 'bg-slate-100 text-slate-600' };

function stripHtml(html = '') {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return div.textContent || '';
}

export default function ProgramApprovals() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/programs', { params: { status: 'PENDING_APPROVAL' } });
      setPrograms(res.data.programs || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id) => {
    setBusy(true);
    try {
      const res = await api.post(`/admin/programs/${id}/approve`);
      toast.success('Approved & synced to Main Accounts ledger');
      setSelected(null);
      setPrograms((prev) =>
        prev.map((p) => (p._id === id ? { ...p, status: res.data.program?.status || 'APPROVED' } : p))
      );
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Approval failed');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!reason.trim()) return toast.error('Enter rejection remarks');
    setBusy(true);
    try {
      await api.post(`/admin/programs/${rejectTarget}/reject`, { reason: reason.trim() });
      toast.success('Submission rejected with remarks');
      setRejectTarget(null);
      setReason('');
      setSelected(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Rejection failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
        <p className="flex items-center gap-2 text-sm font-extrabold text-amber-800">
          <ClipboardCheck className="h-4 w-4" /> Sub-Committee Submissions
        </p>
        <p className="mt-1 text-xs text-amber-700">
          {programs.length} pending entr{programs.length === 1 ? 'y' : 'ies'} from committee Presidents/Secretaries.
          Approving publishes the minutes & register and syncs income/expenses to the Main Accounts ledger automatically.
        </p>
      </div>

      {loading ? (
        <Spinner label="Loading submissions..." />
      ) : programs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <ClipboardCheck className="h-10 w-10 text-slate-300" />
          <p className="font-semibold text-slate-500">No pending sub-committee submissions</p>
          <p className="text-xs text-slate-400">Entries submitted by committee Presidents/Secretaries will appear here for approval.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {programs.map((p, i) => {
            const sec = sectionInfo(p.section);
            return (
              <motion.div
                key={p._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-100 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate font-extrabold text-slate-800">{p.title}</p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${sec.tint}`}>{sec.label}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {fmtDate(p.date)}</span>
                    {p.participantCount > 0 && (
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {p.participantCount}</span>
                    )}
                  </div>
                  {p.submittedBy && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                      <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                      Submitted by: {p.submittedBy.fullName} ({p.submittedBy.phoneNumber})
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
                    {p.minutesRichText && <span className="flex items-center gap-1"><NotebookPen className="h-3 w-3" /> Minutes attached</span>}
                    {p.minutesPhoto && <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> Minutes book photo</span>}
                    {p.attendanceSheetPhoto && <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> Attendance sheet</span>}
                    {p.eventPhotos?.length > 0 && (
                      <span className="flex items-center gap-1"><Camera className="h-3 w-3" /> {p.eventPhotos.length} event photos</span>
                    )}
                    {(p.finance?.totalIncome > 0 || p.finance?.totalExpense > 0) && (
                      <span className="flex items-center gap-1"><Wallet className="h-3 w-3" /> Finance</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 p-4">
                  <button onClick={() => setSelected(p)} className="btn-outline flex flex-1 items-center justify-center gap-2 !py-2 text-xs">
                    <Eye className="h-4 w-4" /> View &amp; Review
                  </button>
                  <button onClick={() => approve(p._id)} disabled={busy} className="btn-primary flex flex-1 items-center justify-center gap-2 !py-2 text-xs disabled:opacity-60">
                    <CheckCircle2 className="h-4 w-4" /> Approve
                  </button>
                  <button onClick={() => setRejectTarget(p._id)} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-red-200 py-2 text-xs font-bold text-red-600 transition hover:border-red-500 hover:bg-red-500 hover:text-white disabled:opacity-60">
                    <XCircle className="h-4 w-4" /> Reject
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Review detail modal */}
      {selected && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-emerald-950/50 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-6 py-4">
              <div className="min-w-0">
                <h4 className="truncate text-base font-extrabold text-emerald-900">{selected.title}</h4>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className={`rounded-full px-2.5 py-0.5 font-bold ${sectionInfo(selected.section).tint}`}>
                    {sectionInfo(selected.section).label}
                  </span>
                  <ProgramStatusBadge status={selected.status} />
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {fmtDate(selected.date)}</span>
                  {selected.submittedBy && (
                    <span className="flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" /> {selected.submittedBy.fullName} ({selected.submittedBy.phoneNumber})</span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">✕</button>
            </div>

            <div className="space-y-5 p-6">
              {(selected.minutesRichText || selected.minutesPhoto) && (
                <div className="rounded-2xl border border-slate-200 p-5">
                  <h5 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-emerald-900">
                    <NotebookPen className="h-4 w-4" /> Typed Minutes
                  </h5>
                  {selected.minutesRichText && (
                    <div className="text-sm leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: selected.minutesRichText }} />
                  )}
                  {selected.minutesPhoto && (
                    <a href={selected.minutesPhoto} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100">
                      <FileText className="h-6 w-6 text-emerald-900" />
                      <span className="text-sm font-bold text-emerald-900">Minutes Book / Register Sheet</span>
                    </a>
                  )}
                </div>
              )}

              {selected.programDetails && (
                <div className="rounded-2xl border border-slate-200 p-5">
                  <h5 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-emerald-900">
                    <FileText className="h-4 w-4" /> Program Execution &amp; Outcomes
                  </h5>
                  <p className="text-sm leading-relaxed text-slate-700">{selected.programDetails}</p>
                </div>
              )}

              {selected.attendanceSheetPhoto && (
                <a href={selected.attendanceSheetPhoto} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-slate-200 p-5 hover:bg-slate-50">
                  <FileText className="h-6 w-6 text-emerald-900" />
                  <span className="text-sm font-bold text-emerald-900">Signed Attendance Register Sheet</span>
                  <span className="ml-auto text-xs text-slate-400">Open</span>
                </a>
              )}

              {(selected.finance?.income?.length > 0 || selected.finance?.expenses?.length > 0) && (
                <div className="rounded-2xl border border-slate-200 p-5">
                  <h5 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-emerald-900">
                    <Wallet className="h-4 w-4" /> Financial Breakdown
                  </h5>
                  <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                    Will sync to the Main Accounts ledger after approval.
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {selected.finance.income.length > 0 && (
                      <div>
                        <p className="rounded-t-xl bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-800">Income</p>
                        <ul className="divide-y divide-slate-100 rounded-b-xl border border-slate-200">
                          {selected.finance.income.map((it, i) => (
                            <li key={i} className="flex justify-between gap-2 px-3 py-2 text-sm">
                              <span className="min-w-0 truncate text-slate-600">{it.description}</span>
                              <span className="flex shrink-0 items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${it.paymentMode === 'Cash' ? 'bg-lime-100 text-lime-700' : 'bg-sky-100 text-sky-700'}`}>{it.paymentMode === 'Cash' ? 'Cash' : 'Bank'}</span>
                                <span className="font-bold text-emerald-700">+{inr(it.amount)}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selected.finance.expenses.length > 0 && (
                      <div>
                        <p className="rounded-t-xl bg-rose-50 px-3 py-1.5 text-xs font-extrabold text-rose-700">Expenses</p>
                        <ul className="divide-y divide-slate-100 rounded-b-xl border border-slate-200">
                          {selected.finance.expenses.map((it, i) => (
                            <li key={i} className="flex justify-between gap-2 px-3 py-2 text-sm">
                              <span className="min-w-0 truncate text-slate-600">{it.description}</span>
                              <span className="flex shrink-0 items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${it.paymentMode === 'Cash' ? 'bg-lime-100 text-lime-700' : 'bg-sky-100 text-sky-700'}`}>{it.paymentMode === 'Cash' ? 'Cash' : 'Bank'}</span>
                                <span className="font-bold text-rose-600">−{inr(it.amount)}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(selected.eventPhotos || []).length > 0 && (
                <div className="rounded-2xl border border-slate-200 p-5">
                  <h5 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-emerald-900">
                    <Camera className="h-4 w-4" /> Event Photos ({selected.eventPhotos.length})
                  </h5>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {selected.eventPhotos.map((p, i) => (
                      <a key={i} href={p} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-lg border border-slate-200">
                        <img src={p} alt="" className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <p className="mr-auto text-xs text-slate-400">{stripHtml(selected.minutesRichText).length} characters of minutes</p>
                <button onClick={() => approve(selected._id)} disabled={busy} className="btn-primary flex items-center gap-2 !py-2.5 text-sm disabled:opacity-60">
                  <CheckCircle2 className="h-4 w-4" /> Approve &amp; Sync
                </button>
                <button onClick={() => setRejectTarget(selected._id)} disabled={busy} className="flex items-center gap-2 rounded-xl border-2 border-red-200 py-2.5 px-4 text-sm font-bold text-red-600 transition hover:border-red-500 hover:bg-red-500 hover:text-white disabled:opacity-60">
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-emerald-950/60 p-4 backdrop-blur-sm" onClick={() => { setRejectTarget(null); setReason(''); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h4 className="flex items-center gap-2 text-base font-extrabold text-red-600">
              <XCircle className="h-5 w-5" /> Reject Submission
            </h4>
            <p className="mt-1 text-xs text-slate-500">The submitting official will see these remarks and can edit &amp; re-submit.</p>
            <textarea
              className="input mt-4 min-h-[120px]"
              placeholder="Reason for rejection / correction remarks..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setRejectTarget(null); setReason(''); }} className="btn-outline !py-2.5 text-sm">Cancel</button>
              <button onClick={reject} disabled={busy} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60">
                {busy ? 'Rejecting...' : 'Reject with Remarks'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}