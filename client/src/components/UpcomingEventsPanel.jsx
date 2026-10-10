import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api, { resolveMedia } from '../api/client';
import { uploadImages } from '../lib/uploadImages';
import { invalidateCachedResource } from '../lib/useCachedResource';
import {
  FaPlus,
  FaEdit,
  FaTrashAlt,
  FaCalendarAlt,
  FaClock,
  FaMapMarkerAlt,
  FaBullhorn,
  FaImage,
  FaEye,
  FaEyeSlash,
  FaTimes,
  FaUpload,
} from 'react-icons/fa';

const CATEGORIES = ['Sports', 'Cultural', 'Other'];

const CATEGORY_STYLES = {
  Sports: 'bg-emerald-100 text-emerald-700',
  Cultural: 'bg-violet-100 text-violet-700',
  Other: 'bg-slate-200 text-slate-600',
};

function emojiFor(category) {
  if (category === 'Sports') return '🏆';
  if (category === 'Cultural') return '🎭';
  return '📢';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Turn any failed request into a readable message AND log the full server
// response to the browser console. Previously each catch showed a bare fallback
// ("Save failed") whether the server said why or not, so a real cause - a 400
// validation message, a 404 from a stale deployment, or a network/CORS failure -
// was invisible.
function describeError(e, fallback) {
  const data = e.response?.data;
  console.error(
    '[UpcomingEvents] request failed:',
    e.response?.status || '(no response)',
    data || e.message
  );
  if (data?.message) return data.message;
  if (data?.detail) return data.detail;
  if (e.response) return `${fallback} (HTTP ${e.response.status})`;
  return `${fallback}: network error — could not reach the server`;
}

export default function UpcomingEventsPanel() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // 'new' | event object | null
  const [deleting, setDeleting] = useState(null);
  const [toggling, setToggling] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/upcoming-events');
      setEvents(res.data.events || []);
    } catch (e) {
      toast.error(describeError(e, 'Failed to load events'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The home page caches its public payload, so a change here must drop it or
  // the section would keep showing the pre-edit list for a short while.
  const refreshHome = () => invalidateCachedResource('public/catalog');

  const del = async (ev) => {
    if (!window.confirm(`Delete "${ev.title}"? It will be removed from the website immediately.`)) return;
    setDeleting(ev._id);
    try {
      await api.delete(`/admin/upcoming-events/${ev._id}`);
      toast.success('Event deleted');
      refreshHome();
      load();
    } catch (e) {
      toast.error(describeError(e, 'Failed to delete event'));
    } finally {
      setDeleting(null);
    }
  };

  const togglePublish = async (ev) => {
    setToggling(ev._id);
    try {
      await api.put(`/admin/upcoming-events/${ev._id}`, { isPublished: !ev.isPublished });
      toast.success(ev.isPublished ? 'Hidden from the website' : 'Published to the website');
      refreshHome();
      load();
    } catch (e) {
      toast.error(describeError(e, 'Failed to update event'));
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-emerald-900">
            <FaBullhorn className="text-gold" /> Upcoming Events
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Sports &amp; cultural events added here appear automatically in the
            {' '}
            <span className="font-semibold text-emerald-900">Upcoming Programs</span>
            {' '}
            section on the home page.
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="btn-primary flex items-center gap-2 !py-2.5 text-sm"
        >
          <FaPlus /> Add Event
        </button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading events...</p>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <FaCalendarAlt className="h-10 w-10 text-slate-300" />
          <p className="font-semibold text-slate-500">No upcoming events yet</p>
          <button onClick={() => setEditing('new')} className="btn-outline !py-2 text-sm">
            <FaPlus className="mr-1.5 inline" /> Create the first event
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {events.map((ev, i) => (
            <motion.div
              key={ev._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
                ev.isPublished ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-75'
              }`}
            >
              <div className="flex gap-4 p-4">
                {ev.posterUrl ? (
                  <img
                    src={resolveMedia(ev.posterUrl)}
                    alt={ev.title}
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden';
                    }}
                    className="h-24 w-24 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-emerald-900/5 text-3xl">
                    {emojiFor(ev.category)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="truncate font-bold text-slate-800">{ev.title}</h4>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        CATEGORY_STYLES[ev.category] || CATEGORY_STYLES.Other
                      }`}
                    >
                      {ev.category || 'Other'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <FaCalendarAlt /> {fmtDate(ev.date)}
                    </span>
                    {ev.time && (
                      <span className="flex items-center gap-1">
                        <FaClock /> {ev.time}
                      </span>
                    )}
                    {ev.venue && (
                      <span className="flex items-center gap-1">
                        <FaMapMarkerAlt /> {ev.venue}
                      </span>
                    )}
                  </div>
                  {ev.description && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">{ev.description}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5">
                <button
                  onClick={() => togglePublish(ev)}
                  disabled={toggling === ev._id}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition disabled:opacity-60 ${
                    ev.isPublished
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                  title="Toggle visibility on the website"
                >
                  {ev.isPublished ? <FaEye /> : <FaEyeSlash />}
                  {ev.isPublished ? 'Published' : 'Hidden'}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(ev)}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-900/10 px-2.5 py-1.5 text-xs font-bold text-emerald-900 transition hover:bg-emerald-900/20"
                  >
                    <FaEdit /> Edit
                  </button>
                  <button
                    onClick={() => del(ev)}
                    disabled={deleting === ev._id}
                    className="flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                  >
                    <FaTrashAlt /> {deleting === ev._id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <EventFormModal
            event={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              refreshHome();
              load();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EventFormModal({ event, onClose, onSaved }) {
  const isEdit = Boolean(event);
  const [form, setForm] = useState({
    title: event?.title || '',
    date: event?.date ? String(event.date).slice(0, 10) : '',
    time: event?.time || '',
    category: event?.category || 'Cultural',
    venue: event?.venue || '',
    description: event?.description || '',
    posterUrl: event?.posterUrl || '',
    isPublished: event ? event.isPublished !== false : true,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const pickPoster = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast.error('Poster must be under 16 MB');
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const [url] = await uploadImages([file]);
      if (url) {
        setForm((f) => ({ ...f, posterUrl: url }));
        toast.success('Poster uploaded');
      } else {
        toast.error('Poster upload failed — you can still save without an image');
      }
    } catch (err) {
      console.error(
        '[UpcomingEvents] poster upload failed:',
        err.response?.status || '(no response)',
        err.response?.data || err.message
      );
      toast.error(
        err.response?.data?.message || 'Poster upload failed — you can still save without an image'
      );
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const save = async () => {
    if (uploading) return toast.error('Please wait for the poster to finish uploading');
    if (!form.title.trim()) return toast.error('Event title is required');
    if (!form.date) return toast.error('Event date is required');
    setSaving(true);
    try {
      const payload = { ...form, title: form.title.trim() };
      if (isEdit) {
        await api.put(`/admin/upcoming-events/${event._id}`, payload);
        toast.success('Event updated');
      } else {
        await api.post('/admin/upcoming-events', payload);
        toast.success('Event added');
      }
      onSaved();
    } catch (e) {
      toast.error(describeError(e, 'Save failed'));
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
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-900/10 text-emerald-900">
              <FaBullhorn />
            </span>
            <h4 className="text-base font-extrabold text-emerald-900">
              {isEdit ? 'Edit Event' : 'Add Upcoming Event'}
            </h4>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100" title="Close">
            <FaTimes />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <label className="label">Event Title *</label>
            <input
              className="input"
              placeholder="e.g. Annual Sports Meet 2027, Onam Celebration"
              value={form.title}
              onChange={set('title')}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input" value={form.date} onChange={set('date')} />
            </div>
            <div>
              <label className="label">Time</label>
              <input
                className="input"
                placeholder="e.g. 10:00 AM"
                value={form.time}
                onChange={set('time')}
              />
            </div>
            <div>
              <label className="label">Category / Type</label>
              <select className="input" value={form.category} onChange={set('category')}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Venue</label>
            <input
              className="input"
              placeholder="e.g. Club Ground, Aiswarya Hall"
              value={form.venue}
              onChange={set('venue')}
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[90px]"
              placeholder="A short description of the event, who it is for and what to expect..."
              value={form.description}
              onChange={set('description')}
            />
          </div>

          <div>
            <label className="label">Event Poster / Image (optional)</label>
            <div className="flex items-center gap-4">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
                {form.posterUrl ? (
                  <img
                    src={resolveMedia(form.posterUrl)}
                    alt="Poster preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <FaImage className="h-7 w-7 text-slate-300" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="btn-outline cursor-pointer !py-2 text-xs">
                  <FaUpload className="mr-2 inline" />
                  {uploading ? 'Uploading...' : form.posterUrl ? 'Replace Poster' : 'Upload Poster'}
                  <input type="file" accept="image/*" className="hidden" onChange={pickPoster} disabled={uploading} />
                </label>
                {form.posterUrl && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, posterUrl: '' }))}
                    className="text-xs font-bold text-red-600 hover:underline"
                  >
                    Remove poster
                  </button>
                )}
              </div>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
              className="accent-emerald-700"
            />
            <FaEye className="text-emerald-700" /> Show this event on the website
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button onClick={onClose} className="btn-outline !py-2.5 text-sm">Cancel</button>
            <button onClick={save} disabled={saving || uploading} className="btn-primary !py-2.5 text-sm disabled:opacity-60">
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Event'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
