import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/client';
import {
  FaBookOpen,
  FaSearch,
  FaTrashAlt,
  FaHourglassHalf,
  FaCheckCircle,
  FaBoxOpen,
  FaCog,
  FaPlus,
  FaArrowUp,
  FaArrowDown,
  FaFileCsv,
  FaSave,
} from 'react-icons/fa';

const FILTERS = [
  { key: '', label: 'All', icon: null },
  { key: 'Pending', label: 'Pending', icon: FaHourglassHalf },
  { key: 'Approved', label: 'Approved', icon: FaCheckCircle },
  { key: 'Procured', label: 'Procured', icon: FaBoxOpen },
];

const STATUS_META = {
  Pending: { cls: 'bg-amber-100 text-amber-700' },
  Approved: { cls: 'bg-sky-100 text-sky-700' },
  Procured: { cls: 'bg-emerald-100 text-emerald-700' },
};

// Mirrors the server default so an officer can restore the standard set.
const DEFAULT_FIELDS = [
  { id: 'bookTitle', label: 'Book Title', placeholder: 'e.g. Randamoozham', required: true, type: 'text' },
  { id: 'author', label: 'Author Name', placeholder: 'e.g. M. T. Vasudevan Nair', required: false, type: 'text' },
  { id: 'publisher', label: 'Publisher Name', placeholder: 'e.g. DC Books', required: false, type: 'text' },
  { id: 'language', label: 'Language', placeholder: 'e.g. Malayalam', required: false, type: 'text' },
  { id: 'notes', label: 'Notes', placeholder: 'Anything that helps the committee...', required: false, type: 'textarea' },
];

const genId = () =>
  window.crypto?.randomUUID
    ? `f-${window.crypto.randomUUID()}`
    : `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toForm(config) {
  return {
    formTitle: config?.formTitle || '',
    formDescription: config?.formDescription || '',
    submitLabel: config?.submitLabel || '',
    fields: (config?.fields || []).map((f) => ({ ...f })),
  };
}

// Read a request's answer for a given column: match by field id first (survives a
// rename), then by label (covers answers stored under an older label).
function answerFor(request, column) {
  const answers = request.answers || [];
  return (
    answers.find((a) => column.id && a.id === column.id)?.value ??
    answers.find((a) => a.label === column.label)?.value ??
    ''
  );
}

export default function BookRequestsPanel() {
  const [requests, setRequests] = useState([]);
  const [counts, setCounts] = useState({ Pending: 0, Approved: 0, Procured: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(toForm(null));
  const [showConfig, setShowConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/book-requests', {
        params: { ...(status ? { status } : {}), ...(query.trim() ? { q: query.trim() } : {}) },
      });
      setRequests(res.data.requests || []);
      setCounts(res.data.counts || { Pending: 0, Approved: 0, Procured: 0 });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load book requests');
    } finally {
      setLoading(false);
    }
  }, [status, query]);

  const loadConfig = useCallback(async () => {
    try {
      const res = await api.get('/admin/book-requests/config');
      setConfig(res.data.config || null);
      setForm(toForm(res.data.config));
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load form settings');
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const id = setTimeout(() => load(), 250);
    return () => clearTimeout(id);
  }, [load]);

  // Columns = configured fields, plus any answer label found in the current page
  // that is no longer configured, so an older request never loses a value.
  const columns = useMemo(() => {
    const map = new Map();
    for (const f of config?.fields || []) map.set(f.id || f.label, { id: f.id, label: f.label });
    for (const r of requests) {
      for (const a of r.answers || []) {
        const key = a.id || a.label;
        if (key && !map.has(key)) map.set(key, { id: a.id, label: a.label || key });
      }
    }
    return [...map.values()];
  }, [config, requests]);

  const setStatusFor = async (req, next) => {
    setBusyId(req.id);
    try {
      await api.put(`/admin/book-requests/${req.id}`, { status: next });
      toast.success(`Marked as ${next}`);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (req) => {
    if (!window.confirm(`Delete the request for "${req.title}"?`)) return;
    setBusyId(req.id);
    try {
      await api.delete(`/admin/book-requests/${req.id}`);
      toast.success('Request deleted');
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  /* --------------------------- Form configuration --------------------------- */

  const addField = () =>
    setForm((f) => ({
      ...f,
      fields: [...f.fields, { id: genId(), label: `Field ${f.fields.length + 1}`, placeholder: '', required: false, type: 'text' }],
    }));

  const updateField = (idx, patch) =>
    setForm((f) => ({ ...f, fields: f.fields.map((x, i) => (i === idx ? { ...x, ...patch } : x)) }));

  const removeField = (idx) =>
    setForm((f) => ({ ...f, fields: f.fields.filter((_, i) => i !== idx) }));

  const moveField = (idx, dir) =>
    setForm((f) => {
      const next = [...f.fields];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return f;
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...f, fields: next };
    });

  const restoreDefaults = () =>
    setForm((f) => ({ ...f, fields: DEFAULT_FIELDS.map((x) => ({ ...x })) }));

  const saveConfig = async () => {
    if (!form.fields.length) return toast.error('Add at least one input field');
    if (form.fields.some((f) => !String(f.label || '').trim())) return toast.error('Every field needs a label');
    setSavingConfig(true);
    try {
      const res = await api.put('/admin/book-requests/config', {
        formTitle: form.formTitle,
        formDescription: form.formDescription,
        submitLabel: form.submitLabel,
        fields: form.fields.map((f) => ({
          id: f.id,
          label: String(f.label).trim(),
          placeholder: f.placeholder,
          required: !!f.required,
          type: f.type,
        })),
      });
      setConfig(res.data.config || null);
      setForm(toForm(res.data.config));
      toast.success('Form settings saved — members see the new form immediately');
      setShowConfig(false);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not save form settings');
    } finally {
      setSavingConfig(false);
    }
  };

  const exportCsv = async () => {
    try {
      const res = await api.get('/admin/book-requests/export', {
        params: { ...(status ? { status } : {}), ...(query.trim() ? { q: query.trim() } : {}) },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `book-requests-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Export failed');
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-emerald-900">
              <FaBookOpen className="text-gold" /> Book Festival — Book Requests
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Member suggestions for the library collection. Configure the form members fill in, review
              each request, and move it through Pending → Approved → Procured. Members see the live
              status on the website and their dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowConfig((s) => !s)}
              className="btn-outline flex items-center gap-2 !py-2 text-sm"
            >
              <FaCog /> {showConfig ? 'Close Form Settings' : 'Form Settings'}
            </button>
            <button onClick={exportCsv} className="btn-primary flex items-center gap-2 !py-2 text-sm">
              <FaFileCsv /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {showConfig && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="overflow-hidden rounded-2xl border border-emerald-900/15 bg-emerald-50/40 p-5"
        >
          <h4 className="flex items-center gap-2 text-sm font-extrabold text-emerald-900">
            <FaCog className="text-gold" /> Request Form Settings
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            These labels and inputs are what members see when they submit a request. Changes apply to
            new submissions; existing requests keep the labels they were submitted with.
          </p>

          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Form Title</label>
                <input
                  className="input"
                  placeholder="Book Festival — Book Requests"
                  value={form.formTitle}
                  onChange={(e) => setForm((f) => ({ ...f, formTitle: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Submit Button Label</label>
                <input
                  className="input"
                  placeholder="Submit Request"
                  value={form.submitLabel}
                  onChange={(e) => setForm((f) => ({ ...f, submitLabel: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Form Description</label>
                <textarea
                  className="input min-h-[70px]"
                  placeholder="A short line explaining what to do..."
                  value={form.formDescription}
                  onChange={(e) => setForm((f) => ({ ...f, formDescription: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="label !mb-0">Input Fields ({form.fields.length})</label>
                <div className="flex gap-2">
                  <button onClick={restoreDefaults} className="text-xs font-bold text-slate-500 hover:underline">
                    Restore defaults
                  </button>
                  <button
                    onClick={addField}
                    className="flex items-center gap-1 rounded-lg bg-emerald-900/10 px-2.5 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-900/20"
                  >
                    <FaPlus /> Add Field
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {form.fields.map((field, idx) => (
                  <div key={field.id} className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
                    <span className="col-span-12 text-[11px] font-bold uppercase tracking-wide text-slate-400 sm:col-span-1">
                      #{idx + 1}
                    </span>
                    <input
                      className="input col-span-12 !py-2 text-sm sm:col-span-3"
                      placeholder="Label (e.g. Book Title)"
                      value={field.label}
                      onChange={(e) => updateField(idx, { label: e.target.value })}
                    />
                    <input
                      className="input col-span-12 !py-2 text-sm sm:col-span-4"
                      placeholder="Placeholder / hint (optional)"
                      value={field.placeholder}
                      onChange={(e) => updateField(idx, { placeholder: e.target.value })}
                    />
                    <select
                      className="input col-span-6 !py-2 text-sm sm:col-span-2"
                      value={field.type}
                      onChange={(e) => updateField(idx, { type: e.target.value })}
                    >
                      <option value="text">Text</option>
                      <option value="textarea">Paragraph</option>
                    </select>
                    <label className="col-span-6 flex items-center gap-1.5 text-xs font-semibold text-slate-600 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={!!field.required}
                        onChange={(e) => updateField(idx, { required: e.target.checked })}
                        className="accent-emerald-700"
                      />
                      Required
                    </label>
                    <div className="col-span-12 flex justify-end gap-1 sm:col-span-12">
                      <button
                        onClick={() => moveField(idx, -1)}
                        disabled={idx === 0}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                        title="Move up"
                      >
                        <FaArrowUp className="text-xs" />
                      </button>
                      <button
                        onClick={() => moveField(idx, 1)}
                        disabled={idx === form.fields.length - 1}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                        title="Move down"
                      >
                        <FaArrowDown className="text-xs" />
                      </button>
                      <button
                        onClick={() => removeField(idx)}
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                        title="Remove field"
                      >
                        <FaTrashAlt className="text-xs" />
                      </button>
                    </div>
                  </div>
                ))}
                {form.fields.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400">
                    No fields yet — add at least one.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-emerald-900/10 pt-4">
              <button onClick={() => { setForm(toForm(config)); setShowConfig(false); }} className="btn-outline !py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={saveConfig}
                disabled={savingConfig}
                className="btn-primary flex items-center gap-2 !py-2 text-sm disabled:opacity-60"
              >
                <FaSave /> {savingConfig ? 'Saving...' : 'Save Form Settings'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const Icon = f.icon;
            const active = status === f.key;
            const count = f.key ? counts[f.key] : requests.length;
            return (
              <button
                key={f.key || 'all'}
                onClick={() => setStatus(f.key)}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                  active ? 'bg-emerald-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {Icon && <Icon className="text-[11px]" />}
                {f.label}
                {f.key && <span className="opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
          <input
            className="input !py-2 pl-8 text-sm"
            placeholder="Search title, author, member..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading requests...</p>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <FaBookOpen className="h-10 w-10 text-slate-300" />
          <p className="font-semibold text-slate-500">No book requests found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  {columns.map((c) => (
                    <th key={c.id || c.label} className="px-5 py-3 font-bold">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-5 py-3 font-bold">Requested By</th>
                  <th className="px-5 py-3 font-bold">Date</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r, i) => (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                  >
                    {columns.map((c) => (
                      <td key={c.id || c.label} className="px-5 py-3 align-top text-slate-700">
                        {answerFor(r, c) || <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                    <td className="px-5 py-3 align-top">
                      <p className="text-sm text-slate-600">{r.memberName || '—'}</p>
                      <p className="text-xs text-slate-400">{r.membershipId || ''}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 align-top text-xs text-slate-500">
                      {fmtDate(r.createdAt)}
                    </td>
                    <td className="px-5 py-3 align-top">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          (STATUS_META[r.status] || STATUS_META.Pending).cls
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 align-top">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {['Pending', 'Approved', 'Procured']
                          .filter((s) => s !== r.status)
                          .map((s) => (
                            <button
                              key={s}
                              onClick={() => setStatusFor(r, s)}
                              disabled={busyId === r.id}
                              className="rounded-lg bg-emerald-900/10 px-2.5 py-1.5 text-xs font-bold text-emerald-900 transition hover:bg-emerald-900/20 disabled:opacity-50"
                            >
                              {s}
                            </button>
                          ))}
                        <button
                          onClick={() => remove(r)}
                          disabled={busyId === r.id}
                          className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          <FaTrashAlt /> Delete
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
