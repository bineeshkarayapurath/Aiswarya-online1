import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/client';
import { sharePollOnWhatsApp } from './Polls';
import {
  FaPoll,
  FaPlus,
  FaEdit,
  FaTrashAlt,
  FaWhatsapp,
  FaLink,
  FaEye,
  FaEyeSlash,
  FaTimes,
} from 'react-icons/fa';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PollsPanel() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // 'new' | poll | null
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/polls');
      setPolls(res.data.polls || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load polls');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (poll) => {
    setBusyId(poll.id);
    try {
      await api.put(`/admin/polls/${poll.id}`, { isActive: !poll.isActive });
      toast.success(poll.isActive ? 'Poll closed' : 'Poll re-opened');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (poll) => {
    if (!window.confirm(`Delete the poll "${poll.question}"? All its votes will be removed.`)) return;
    setBusyId(poll.id);
    try {
      await api.delete(`/admin/polls/${poll.id}`);
      toast.success('Poll deleted');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = async (poll) => {
    const url = `${window.location.origin}/polls/${poll.slug || poll.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error(url);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-emerald-900">
            <FaPoll className="text-gold" /> Polls
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Create a poll and share it to WhatsApp. Members open the link, sign in and vote; results
            update live. Each member may vote once per poll.
          </p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary flex items-center gap-2 !py-2.5 text-sm">
          <FaPlus /> Create Poll
        </button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading polls...</p>
      ) : polls.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <FaPoll className="h-10 w-10 text-slate-300" />
          <p className="font-semibold text-slate-500">No polls yet</p>
          <button onClick={() => setEditing('new')} className="btn-outline !py-2 text-sm">
            <FaPlus className="mr-1.5 inline" /> Create the first poll
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {polls.map((poll, i) => (
            <motion.div
              key={poll.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${
                poll.isActive ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-80'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-slate-800">{poll.question}</h4>
                  {poll.description && <p className="mt-0.5 text-sm text-slate-500">{poll.description}</p>}
                  <p className="mt-1.5 flex flex-wrap gap-3 text-[11px] font-semibold text-slate-400">
                    <span>{poll.totalVotes} vote{poll.totalVotes === 1 ? '' : 's'}</span>
                    <span>Created {fmtDate(poll.createdAt)}</span>
                    {poll.isClosed ? (
                      <span className="text-red-500">Closed</span>
                    ) : (
                      <span className="text-emerald-700">Open</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                {poll.options.map((o) => {
                  const pct = poll.totalVotes > 0 ? Math.round((o.count / poll.totalVotes) * 100) : 0;
                  return (
                    <div key={o.id} className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <div className="absolute inset-y-0 left-0 bg-emerald-900/10" style={{ width: `${pct}%` }} aria-hidden />
                      <div className="relative flex items-center justify-between px-3 py-1.5 text-xs">
                        <span className="truncate font-semibold text-slate-700">{o.text}</span>
                        <span className="shrink-0 font-bold text-slate-500">{o.count} · {pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => toggleActive(poll)}
                  disabled={busyId === poll.id}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition disabled:opacity-60 ${
                    poll.isActive
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {poll.isActive ? <FaEye /> : <FaEyeSlash />}
                  {poll.isActive ? 'Open' : 'Closed'}
                </button>
                <button
                  onClick={() => sharePollOnWhatsApp(poll)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#25D366]/15 px-2.5 py-1.5 text-xs font-bold text-[#128C7E] transition hover:bg-[#25D366]/25"
                >
                  <FaWhatsapp /> Share
                </button>
                <button
                  onClick={() => copyLink(poll)}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200"
                >
                  <FaLink /> Copy link
                </button>
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => setEditing(poll)}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-900/10 px-2.5 py-1.5 text-xs font-bold text-emerald-900 transition hover:bg-emerald-900/20"
                  >
                    <FaEdit /> Edit
                  </button>
                  <button
                    onClick={() => remove(poll)}
                    disabled={busyId === poll.id}
                    className="flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                  >
                    <FaTrashAlt /> Delete
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <PollFormModal
            poll={editing === 'new' ? null : editing}
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

function PollFormModal({ poll, onClose, onSaved }) {
  const isEdit = Boolean(poll);
  const hasVotes = Boolean(poll && poll.totalVotes > 0);

  const [question, setQuestion] = useState(poll?.question || '');
  const [description, setDescription] = useState(poll?.description || '');
  const [allowMultiple, setAllowMultiple] = useState(poll?.allowMultiple || false);
  const [isActive, setIsActive] = useState(poll ? poll.isActive !== false : true);
  const [closesAt, setClosesAt] = useState(poll?.closesAt ? String(poll.closesAt).slice(0, 10) : '');
  const [options, setOptions] = useState(
    poll?.options?.length ? poll.options.map((o) => o.text) : ['', '']
  );
  const [saving, setSaving] = useState(false);

  const setOption = (i, val) => setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));
  const addOption = () => setOptions((prev) => [...prev, '']);
  const removeOption = (i) => setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));

  const save = async () => {
    if (!question.trim()) return toast.error('Poll question is required');
    const clean = options.map((o) => o.trim()).filter(Boolean);
    if (!hasVotes && clean.length < 2) return toast.error('Add at least two options');
    if (new Set(clean.map((c) => c.toLowerCase())).size !== clean.length) {
      return toast.error('Options must be different');
    }

    setSaving(true);
    try {
      const payload = {
        question: question.trim(),
        description: description.trim(),
        allowMultiple,
        isActive,
        closesAt: closesAt || null,
      };
      if (!hasVotes) payload.options = clean;

      if (isEdit) {
        await api.put(`/admin/polls/${poll.id}`, payload);
        toast.success('Poll updated');
      } else {
        await api.post('/admin/polls', payload);
        toast.success('Poll created');
      }
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Save failed');
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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-900/10 text-emerald-900">
              <FaPoll />
            </span>
            <h4 className="text-base font-extrabold text-emerald-900">
              {isEdit ? 'Edit Poll' : 'Create Poll'}
            </h4>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100" title="Close">
            <FaTimes />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <label className="label">Question *</label>
            <input
              className="input"
              placeholder="e.g. Which day should the Book Festival be held?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Description (optional)</label>
            <textarea
              className="input min-h-[70px]"
              placeholder="Extra context for voters..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label !mb-0">Options *</label>
              {hasVotes && (
                <span className="text-[11px] font-semibold text-amber-600">
                  Options are locked — people have voted
                </span>
              )}
            </div>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="input"
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    disabled={hasVotes}
                    onChange={(e) => setOption(i, e.target.value)}
                  />
                  {!hasVotes && options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      className="rounded-lg bg-red-50 px-2.5 py-2 text-red-500 hover:bg-red-100"
                      title="Remove option"
                    >
                      <FaTimes />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!hasVotes && (
              <button
                type="button"
                onClick={addOption}
                className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-900 hover:underline"
              >
                <FaPlus /> Add option
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Closes on (optional)</label>
              <input
                type="date"
                className="input"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
              />
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={allowMultiple}
                  onChange={(e) => setAllowMultiple(e.target.checked)}
                  className="accent-emerald-700"
                />
                Allow multiple choices
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="accent-emerald-700"
                />
                <FaEye className="text-emerald-700" /> Open for voting
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button onClick={onClose} className="btn-outline !py-2.5 text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary !py-2.5 text-sm disabled:opacity-60">
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Poll'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
