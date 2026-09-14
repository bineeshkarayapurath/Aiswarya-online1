import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/client';
import { uploadImages } from '../lib/uploadImages';
import {
  NotebookPen,
  Plus,
  Calendar,
  Upload,
  Users,
  FileText,
  Camera,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Image,
  File as FileIcon,
  Trash2,
  Wallet,
  PlusCircle,
  MinusCircle,
  IndianRupee,
  Check,
  PenLine,
} from 'lucide-react';
import Spinner from './Spinner';

export const SECTIONS = [
  { key: 'Main', label: 'Main Library & Club', short: 'Main Library', tint: 'bg-emerald-100 text-emerald-800' },
  { key: 'Vanitha Vedi', label: 'Vanitha Vedi', short: 'Vanitha Vedi', tint: 'bg-rose-100 text-rose-700' },
  { key: 'Bala Vedi', label: 'Bala Vedi', short: 'Bala Vedi', tint: 'bg-teal-100 text-teal-700' },
  { key: 'Yuvatha', label: 'Yuvatha', short: 'Yuvatha', tint: 'bg-lime-100 text-lime-700' },
];

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export function isPdf(url = '') {
  return /\.pdf($|\?)/i.test(url);
}

export function ProgramStatusBadge({ status }) {
  if (status === 'APPROVED') {
    return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-emerald-700">Approved</span>;
  }
  if (status === 'REJECTED') {
    return <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-red-600">Rejected</span>;
  }
  return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-700">Pending</span>;
}

export default function ProgramsPanel({ sectionOnly = null, apiBase = '/admin' }) {
  const [section, setSection] = useState(sectionOnly || 'Main');
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [year, setYear] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`${apiBase}/programs`, {
        params: { section, year: year || undefined, q: q || undefined },
      });
      setPrograms(res.data.programs || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load programs');
    } finally {
      setLoading(false);
    }
  }, [section, year, q, apiBase]);

  useEffect(() => {
    load();
  }, [load]);

  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= 2020; y--) years.push(y);

  return (
    <div className="space-y-5">
      {/* Section selector */}
      {!sectionOnly && (
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                section === s.key
                  ? 'bg-emerald-900 text-white shadow-lg shadow-emerald-900/20'
                  : 'bg-white text-slate-500 shadow-sm hover:text-emerald-900'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      {sectionOnly && (
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${SECTIONS.find((s) => s.key === sectionOnly)?.tint || 'bg-slate-100 text-slate-600'}`}>
            {SECTIONS.find((s) => s.key === sectionOnly)?.label || sectionOnly}
          </span>
          <span className="text-xs font-semibold text-slate-400">Register locked to this sub-committee</span>
        </div>
      )}

      {/* Filter bar + new entry */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input !pl-9"
            placeholder="Search by program/meeting title..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">All Years</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button onClick={() => setShowForm(true)} className="btn-primary !py-2.5 text-sm">
          <Plus className="h-4 w-4" /> New Entry
        </button>
      </div>

      {/* Archive list */}
      {loading ? (
        <Spinner label="Loading register..." />
      ) : programs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <NotebookPen className="h-10 w-10 text-slate-300" />
          <p className="font-semibold text-slate-500">
            No program entries yet for {SECTIONS.find((s) => s.key === section)?.label}
          </p>
          <button onClick={() => setShowForm(true)} className="btn-outline !py-2 text-sm">
            <Plus className="h-4 w-4" /> Record the first entry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {programs.map((p, i) => (
            <motion.div
              key={p._id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <button onClick={() => setSelected(p)} className="block w-full text-left">
                <div className="flex h-24 items-center justify-center bg-gradient-to-br from-emerald-900/10 to-transparent">
                  {p.eventPhotos?.[0] ? (
                    <img src={p.eventPhotos[0]} alt={p.title} className="h-full w-full object-cover" />
                  ) : (
                    <NotebookPen className="h-9 w-9 text-emerald-900/30" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-extrabold text-slate-800">{p.title}</p>
                    <ProgramStatusBadge status={p.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {fmtDate(p.date)}</span>
                    {p.participantCount > 0 && (
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {p.participantCount}</span>
                    )}
                    {p.eventPhotos?.length > 0 && (
                      <span className="flex items-center gap-1"><Camera className="h-3.5 w-3.5" /> {p.eventPhotos.length}</span>
                    )}
                  </div>
                  {p.status === 'REJECTED' && p.rejectionReason && (
                    <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-red-600">
                      Admin remarks: {p.rejectionReason}
                    </p>
                  )}
                  <p className="mt-2 line-clamp-2 text-xs text-slate-500">{stripHtml(p.minutesRichText) || p.programDetails}</p>
                </div>
              </button>

              {apiBase === '/member' && p.status === 'REJECTED' && (
                <div className="border-t border-slate-100 p-3">
                  <button
                    onClick={() => setEditing(p)}
                    className="w-full rounded-xl border-2 border-emerald-900/20 py-2 text-xs font-extrabold text-emerald-900 transition hover:bg-emerald-900 hover:text-white"
                  >
                    <PenLine className="mr-1.5 inline h-3.5 w-3.5" /> Edit & Re-submit
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {showForm && <EntryFormModal section={section} apiBase={apiBase} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {editing && <EntryFormModal program={editing} section={editing.section} apiBase={apiBase} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {selected && <ProgramDetail program={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function stripHtml(html = '') {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

/* ------------------------------------------------------------------ *
 *  New Entry Form
 * ------------------------------------------------------------------ */
function EntryFormModal({ section, apiBase, onClose, onSaved, program = null }) {
  const isResubmit = Boolean(program);
  const [title, setTitle] = useState(program?.title || '');
  const [date, setDate] = useState(program?.date ? program.date.slice(0, 10) : '');
  const [minutesHtml, setMinutesHtml] = useState(program?.minutesRichText || '');
  const [programDetails, setProgramDetails] = useState(program?.programDetails || '');
  const [participantCount, setParticipantCount] = useState(program?.participantCount ? String(program.participantCount) : '');
  const [minutesPhoto, setMinutesPhoto] = useState(null);
  const [attendanceSheet, setAttendanceSheet] = useState(null);
  const [eventPhotos, setEventPhotos] = useState([]);
  const [incomeRows, setIncomeRows] = useState(
    program?.finance?.income?.length
      ? program.finance.income.map((e) => ({ description: e.description, amount: String(e.amount), mode: e.paymentMode || 'Bank' }))
      : [{ description: '', amount: '', mode: 'Bank' }]
  );
  const [expenseRows, setExpenseRows] = useState(
    program?.finance?.expenses?.length
      ? program.finance.expenses.map((e) => ({ description: e.description, amount: String(e.amount), mode: e.paymentMode || 'Bank' }))
      : [{ description: '', amount: '', mode: 'Bank' }]
  );
  const [saving, setSaving] = useState(false);
  const existingFiles = program
    ? {
        minutesPhoto: program.minutesPhoto || '',
        attendanceSheetPhoto: program.attendanceSheetPhoto || '',
        eventPhotos: program.eventPhotos || [],
      }
    : null;

  const sectionLabel = SECTIONS.find((s) => s.key === section)?.label || section;

  const incomeTotal = incomeRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const expenseTotal = expenseRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const netBalance = incomeTotal - expenseTotal;

  const pickFile = (setter) => (e) => {
    const f = e.target.files?.[0];
    if (f) setter(f);
    e.target.value = '';
  };

  const save = async () => {
    if (!title.trim()) return toast.error('Program/meeting name is required');
    if (!date) return toast.error('Program date is required');

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('section', section);
      fd.append('title', title.trim());
      fd.append('date', date);
      fd.append('minutesRichText', minutesHtml);
      fd.append('programDetails', programDetails);
      fd.append('participantCount', participantCount || '0');
      fd.append(
        'finance',
        JSON.stringify({
          income: incomeRows.map((r) => ({ description: r.description.trim(), amount: Number(r.amount) || 0, paymentMode: r.mode || 'Bank' })),
          expenses: expenseRows.map((r) => ({ description: r.description.trim(), amount: Number(r.amount) || 0, paymentMode: r.mode || 'Bank' })),
        })
      );

      // Upload photos through the backend /api/upload endpoint (local storage,
      // or ImgBB when configured). Returned public HTTPS URLs are passed along;
      // on any failure we fall back to the multipart FormData upload instead.
      const pendingPhotos = [minutesPhoto, attendanceSheet, ...eventPhotos].filter(Boolean);
      let uploadedViaApi = false;
      if (pendingPhotos.length) {
        try {
          const urls = await uploadImages(pendingPhotos);
          if (urls.length === pendingPhotos.length) {
            let i = 0;
            if (minutesPhoto) fd.append('minutesPhotoUrl', urls[i++]);
            if (attendanceSheet) fd.append('attendanceSheetPhotoUrl', urls[i++]);
            if (eventPhotos.length) fd.append('eventPhotoUrls', JSON.stringify(urls.slice(i)));
            uploadedViaApi = true;
          }
        } catch (e) {
          uploadedViaApi = false;
        }
      }
      if (!uploadedViaApi) {
        if (minutesPhoto) fd.append('minutesPhoto', minutesPhoto);
        if (attendanceSheet) fd.append('attendanceSheetPhoto', attendanceSheet);
        eventPhotos.forEach((f) => fd.append('eventPhotos', f));
      }

      if (isResubmit) {
        await api.post(`${apiBase}/programs/${program._id}/resubmit`, fd);
        toast.success('Entry re-submitted for approval');
      } else {
        await api.post(`${apiBase}/programs`, fd);
        toast.success('Program entry saved');
      }
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-emerald-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div>
            <h4 className="text-base font-extrabold text-emerald-900">
              {isResubmit ? 'Edit & Re-submit Entry' : 'New Program Entry'}
            </h4>
            <p className="text-xs text-slate-500">{sectionLabel}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {isResubmit && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-extrabold">This entry was rejected.</p>
              {program?.rejectionReason && (
                <p className="mt-1 text-xs">Admin remarks: “{program.rejectionReason}”</p>
              )}
              <p className="mt-1 text-xs">Make the required corrections and re-submit for approval.</p>
            </div>
          )}
          {/* Meeting minutes entry */}
          <div className="rounded-2xl border border-slate-200 p-5">
            <h5 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-emerald-900">
              <NotebookPen className="h-4 w-4" /> Meeting Minutes Entry
            </h5>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Program / Meeting Name *</label>
                <input className="input" placeholder='e.g. "Vanitha Dinam 2026"' value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="label">Date *</label>
                <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="mt-3">
              <label className="label">Meeting Decisions & Minutes</label>
              <RichTextEditor value={minutesHtml} onChange={setMinutesHtml} />
            </div>
            <div className="mt-3">
              <label className="label">Minutes Book / Register Sheet Photo (optional)</label>
              <FileUpload value={minutesPhoto} onChange={setMinutesPhoto} accept="image/*,application/pdf" existing={existingFiles?.minutesPhoto} />
            </div>
          </div>

          {/* Program execution & attendance */}
          <div className="rounded-2xl border border-slate-200 p-5">
            <h5 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-emerald-900">
              <FileText className="h-4 w-4" /> Program Execution & Attendance
            </h5>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px]">
              <div>
                <label className="label">Program Details & Outcomes</label>
                <textarea className="input min-h-[70px]" placeholder="What was planned, conducted and the outcomes achieved..." value={programDetails} onChange={(e) => setProgramDetails(e.target.value)} />
              </div>
              <div>
                <label className="label">Participants</label>
                <input type="number" min="0" className="input" placeholder="e.g. 120" value={participantCount} onChange={(e) => setParticipantCount(e.target.value)} />
              </div>
            </div>
            <div className="mt-3">
              <label className="label">Signed Attendance Register Photo (optional)</label>
              <FileUpload value={attendanceSheet} onChange={setAttendanceSheet} accept="image/*,application/pdf" existing={existingFiles?.attendanceSheetPhoto} />
            </div>
          </div>

          {/* Program Finance & Accounts */}
          <div className="rounded-2xl border border-slate-200 p-5">
            <h5 className="mb-1 flex items-center gap-2 text-sm font-extrabold text-emerald-900">
              <Wallet className="h-4 w-4" /> Program Finance & Accounts
            </h5>
            <p className="mb-4 text-xs text-slate-500">
              Entries sync to the Main Accounts ledger after admin approval (sub-committee submissions) or immediately (main club entries).
            </p>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FinanceColumn
                title="Income Entries"
                tint="bg-emerald-50 text-emerald-800"
                rows={incomeRows}
                setRows={setIncomeRows}
                placeholderDesc="Sponsorship / Registration / Donation..."
              />
              <FinanceColumn
                title="Expense Entries"
                tint="bg-rose-50 text-rose-700"
                rows={expenseRows}
                setRows={setExpenseRows}
                placeholderDesc="Food & Refreshment / Stage & Sound / Flex Printing..."
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <TotalsCard label="Total Income" value={incomeTotal} tone="text-emerald-700" />
              <TotalsCard label="Total Expense" value={expenseTotal} tone="text-rose-600" />
              <TotalsCard
                label="Net Program Balance"
                value={netBalance}
                tone={netBalance >= 0 ? 'text-emerald-700' : 'text-rose-600'}
              />
            </div>
          </div>

          {/* Event gallery */}
          <div className="rounded-2xl border border-slate-200 p-5">
            <h5 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-emerald-900">
              <Camera className="h-4 w-4" /> Program Event Gallery
            </h5>
            {isResubmit && existingFiles?.eventPhotos?.length > 0 && (
              <div className="mb-2">
                <p className="label">Current photos ({existingFiles.eventPhotos.length})</p>
                <div className="flex flex-wrap gap-2">
                  {existingFiles.eventPhotos.map((p, i) => (
                    <a key={i} href={p} target="_blank" rel="noreferrer" className="h-16 w-20 overflow-hidden rounded-lg border border-slate-200">
                      <img src={p} alt="" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Adding new photos below replaces the current gallery for this entry.
                </p>
              </div>
            )}
            <label className="label">Event Photos (up to 8)</label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-500 transition hover:border-emerald-900/50 hover:text-emerald-900">
              <Image className="h-5 w-5" /> Click to add photos
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []).slice(0, 8);
                  setEventPhotos((prev) => [...prev, ...files].slice(0, 8));
                  e.target.value = '';
                }}
              />
            </label>
            {eventPhotos.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {eventPhotos.map((f, i) => (
                  <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200">
                    <img src={URL.createObjectURL(f)} alt={f.name} className="h-full w-full object-cover" />
                    <button
                      onClick={() => setEventPhotos((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute right-1 top-1 rounded-full bg-red-500/90 p-1 text-white opacity-0 transition group-hover:opacity-100"
                      title="Remove"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button onClick={onClose} className="btn-outline !py-2.5 text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary !py-2.5 text-sm disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function RichTextEditor({ value, onChange }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = value || '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange(ref.current?.innerHTML || '');
  const exec = (cmd, arg) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
        <button type="button" onClick={() => exec('bold')} className="h-7 w-7 rounded-md text-sm font-extrabold text-slate-600 hover:bg-white">B</button>
        <button type="button" onClick={() => exec('italic')} className="h-7 w-7 rounded-md text-sm italic text-slate-600 hover:bg-white">I</button>
        <button type="button" onClick={() => exec('underline')} className="h-7 w-7 rounded-md text-sm underline text-slate-600 hover:bg-white">U</button>
        <button type="button" onClick={() => exec('insertUnorderedList')} className="h-7 w-7 rounded-md text-sm text-slate-600 hover:bg-white">• List</button>
        <button type="button" onClick={() => exec('removeFormat')} className="h-7 rounded-md px-2 text-xs font-semibold text-slate-500 hover:bg-white">
          Clear Format
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        className="min-h-[130px] px-3 py-2 text-sm leading-relaxed text-slate-700 outline-none"
      />
    </div>
  );
}

function FileUpload({ value, onChange, accept, existing = '' }) {
  const label = existing ? 'Replace existing file' : 'Choose file (photo or PDF)';
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500 transition hover:border-emerald-900/50 hover:text-emerald-900">
      <Upload className="h-5 w-5 shrink-0" />
      {value ? (
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
          {value.type?.startsWith('image/') ? (
            <img src={URL.createObjectURL(value)} alt="preview" className="h-9 w-9 rounded object-cover" />
          ) : (
            <FileIcon className="h-5 w-5" />
          )}
          <span className="truncate font-semibold">{value.name}</span>
        </span>
      ) : existing ? (
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-emerald-100 text-emerald-700">
            <Check className="h-4 w-4" />
          </span>
          <span className="truncate">
            <span className="block text-xs text-slate-400">Keeping existing upload</span>
            <span className="block w-52 truncate font-semibold">{decodeURIComponent(existing.split('/').pop() || existing)}</span>
          </span>
        </span>
      ) : (
        <span className="font-semibold">{label}</span>
      )}
      <input type="file" accept={accept} className="hidden" onChange={(e) => { onChange(e.target.files?.[0] || null); e.target.value = ''; }} />
    </label>
  );
}

function FinanceColumn({ title, tint, rows, setRows, placeholderDesc }) {
  const update = (i, key, val) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [key]: val } : r)));

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h6 className={`rounded-full px-3 py-1 text-xs font-extrabold ${tint}`}>{title}</h6>
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { description: '', amount: '', mode: 'Bank' }])}
          className="flex items-center gap-1 text-xs font-bold text-emerald-900 hover:underline"
        >
          <PlusCircle className="h-4 w-4" /> Add Entry
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="input flex-1 !py-2 text-sm"
              placeholder={placeholderDesc}
              value={r.description}
              onChange={(e) => update(i, 'description', e.target.value)}
            />
            <div className="relative w-24 shrink-0">
              <IndianRupee className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                min="0"
                step="0.01"
                className="input !py-2 pl-8 pr-2 text-sm"
                placeholder="0"
                value={r.amount}
                onChange={(e) => update(i, 'amount', e.target.value)}
              />
            </div>
            <div className="flex shrink-0 overflow-hidden rounded-lg border border-slate-300">
              {['Bank', 'Cash'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => update(i, 'mode', m)}
                  className={`px-2 py-1.5 text-[10px] font-extrabold transition ${
                    r.mode === m ? (m === 'Bank' ? 'bg-sky-600 text-white' : 'bg-lime-600 text-white') : 'bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
              disabled={rows.length === 1}
              className="shrink-0 rounded-md p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              title="Remove entry"
            >
              <MinusCircle className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TotalsCard({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-extrabold ${tone}`}>{inr(value)}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Program Detail Modal (archive view)
 * ------------------------------------------------------------------ */
function ProgramDetail({ program, onClose }) {
  const [idx, setIdx] = useState(0);
  const photos = program.eventPhotos || [];

  const sectionInfo = SECTIONS.find((s) => s.key === program.section);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-emerald-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-6 py-4">
          <div className="min-w-0">
            <h4 className="truncate text-base font-extrabold text-emerald-900">{program.title}</h4>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className={`rounded-full px-2.5 py-0.5 font-bold ${sectionInfo?.tint || 'bg-slate-100 text-slate-600'}`}>
                {sectionInfo?.label || program.section}
              </span>
              <ProgramStatusBadge status={program.status} />
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {fmtDate(program.date)}</span>
              {program.participantCount > 0 && (
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {program.participantCount} participants</span>
              )}
            </div>
            {program.status === 'REJECTED' && program.rejectionReason && (
              <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600">
                Admin remarks: {program.rejectionReason}
              </p>
            )}
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {(program.minutesRichText || program.minutesPhoto) && (
            <div className="rounded-2xl border border-slate-200 p-5">
              <h5 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-emerald-900">
                <NotebookPen className="h-4 w-4" /> Meeting Decisions & Minutes
              </h5>
              {program.minutesRichText && (
                <div className="prose-sm text-sm leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: program.minutesRichText }} />
              )}
              {program.minutesPhoto && (
                <a href={program.minutesPhoto} target="_blank" rel="noreferrer" className="mt-3 block">
                  <DocThumb url={program.minutesPhoto} label="Minutes Book / Register Sheet" />
                </a>
              )}
            </div>
          )}

          {(program.programDetails || program.attendanceSheetPhoto) && (
            <div className="rounded-2xl border border-slate-200 p-5">
              <h5 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-emerald-900">
                <FileText className="h-4 w-4" /> Program Execution & Attendance
              </h5>
              {program.programDetails && <p className="text-sm leading-relaxed text-slate-700">{program.programDetails}</p>}
              {program.attendanceSheetPhoto && (
                <a href={program.attendanceSheetPhoto} target="_blank" rel="noreferrer" className="mt-3 block">
                  <DocThumb url={program.attendanceSheetPhoto} label="Signed Attendance Register" />
                </a>
              )}
            </div>
          )}

          {program.finance &&
            (program.finance.totalIncome > 0 || program.finance.totalExpense > 0) && (
              <div className="rounded-2xl border border-slate-200 p-5">
                <h5 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-emerald-900">
                  <Wallet className="h-4 w-4" /> Program Finance
                </h5>
                {program.status === 'PENDING_APPROVAL' ? (
                  <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                    Awaiting admin approval — these entries are NOT yet synced to the Main Accounts ledger.
                  </p>
                ) : (
                  <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                    Approved and synced to the Main Accounts ledger.
                  </p>
                )}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {program.finance.income.length > 0 && (
                    <FinanceList type="income" items={program.finance.income} />
                  )}
                  {program.finance.expenses.length > 0 && (
                    <FinanceList type="expenses" items={program.finance.expenses} />
                  )}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <TotalsCard label="Total Income" value={program.finance.totalIncome} tone="text-emerald-700" />
                  <TotalsCard label="Total Expense" value={program.finance.totalExpense} tone="text-rose-600" />
                  <TotalsCard
                    label="Net Program Balance"
                    value={program.finance.netBalance}
                    tone={program.finance.netBalance >= 0 ? 'text-emerald-700' : 'text-rose-600'}
                  />
                </div>
              </div>
            )}

          {photos.length > 0 && (
            <div className="rounded-2xl border border-slate-200 p-5">
              <h5 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-emerald-900">
                <Camera className="h-4 w-4" /> Event Gallery ({photos.length})
              </h5>
              <div className="relative flex items-center justify-center">
                <button
                  onClick={() => setIdx((idx - 1 + photos.length) % photos.length)}
                  className="absolute left-1 z-10 rounded-full bg-white/90 p-2 text-slate-600 shadow hover:bg-white"
                  title="Previous"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex h-72 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                  {isPdf(photos[idx]) ? (
                    <iframe src={photos[idx]} title="event" className="h-full w-full" />
                  ) : (
                    <img src={photos[idx]} alt="event" className="h-full w-full object-contain" />
                  )}
                </div>
                <button
                  onClick={() => setIdx((idx + 1) % photos.length)}
                  className="absolute right-1 z-10 rounded-full bg-white/90 p-2 text-slate-600 shadow hover:bg-white"
                  title="Next"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {photos.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setIdx(i)}
                    className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${i === idx ? 'border-gold' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    {isPdf(p) ? (
                      <span className="flex h-full items-center justify-center bg-slate-100 text-xs font-bold text-slate-400">PDF</span>
                    ) : (
                      <img src={p} alt="" className="h-full w-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function FinanceList({ type, items }) {
  const isIncome = type === 'income';
  return (
    <div className="rounded-xl border border-slate-200">
      <p className={`rounded-t-xl px-3 py-1.5 text-xs font-extrabold ${isIncome ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>
        {isIncome ? 'Income Entries' : 'Expense Entries'}
      </p>
      <ul className="divide-y divide-slate-100">
        {items.map((it, i) => (
          <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="min-w-0 truncate text-slate-600">{it.description}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${it.paymentMode === 'Cash' ? 'bg-lime-100 text-lime-700' : 'bg-sky-100 text-sky-700'}`}>
                {it.paymentMode === 'Cash' ? 'Cash' : 'Bank'}
              </span>
              <span className={`font-bold ${isIncome ? 'text-emerald-700' : 'text-rose-600'}`}>
                {isIncome ? '+' : '−'}{inr(it.amount)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DocThumb({ url, label }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:bg-slate-100">
      {isPdf(url) ? (
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 text-red-600">
          <FileIcon className="h-6 w-6" />
        </span>
      ) : (
        <img src={url} alt={label} className="h-12 w-12 rounded-lg object-cover" />
      )}
      <span className="text-sm font-bold text-emerald-900">{label}</span>
    </div>
  );
}