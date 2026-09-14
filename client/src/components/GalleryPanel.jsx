import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api/client';
import Spinner from '../components/Spinner';
import { uploadImages } from '../lib/uploadImages';
import {
  FaImages,
  FaUpload,
  FaTrashAlt,
  FaTimes,
  FaCamera,
  FaChevronLeft,
  FaChevronRight,
} from 'react-icons/fa';

export default function GalleryPanel() {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [viewer, setViewer] = useState(null); // { album, index }

  const load = async () => {
    try {
      const res = await api.get('/admin/gallery');
      setAlbums(res.data.albums || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load albums');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFiles = async (e) => {
    const list = Array.from(e.target.files || []).slice(0, 20);
    setPreviews(list.map((f) => URL.createObjectURL(f)));
    // Downscale large camera photos before upload so they never hit the
    // server's 16 MB per-photo limit and uploads stay fast on mobile.
    const compressed = await Promise.all(list.map((f) => compressImage(f)));
    setFiles(compressed.filter(Boolean));
  };

  const upload = async () => {
    if (!title.trim()) return toast.error('Enter the Program / Event Title');
    if (!files.length) return toast.error('Choose at least one photo');
    setUploading(true);

    // Local fallback: current multipart upload handled by the server (multer),
    // which stores the photos under server storage/ and serves them via /uploads/.
    const uploadLocal = () => {
      const fd = new FormData();
      fd.append('title', title.trim());
      files.forEach((f) => fd.append('photos', f));
      return api.post('/admin/gallery', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    };

    try {
      try {
        // Upload via the backend /api/upload endpoint (local storage, or ImgBB
        // when configured), then persist the returned public HTTPS URLs.
        const urls = await uploadImages(files);
        if (urls.length) {
          await api.post('/admin/gallery', { title: title.trim(), photoUrls: urls });
          toast.success('Album uploaded');
        } else {
          throw new Error('Upload returned no image URLs');
        }
      } catch (e) {
        // Graceful fallback: keep the upload working via local server storage.
        await uploadLocal();
        toast.success('Album uploaded (local storage)');
      }
      setTitle('');
      setFiles([]);
      setPreviews([]);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (album) => {
    if (!window.confirm(`Delete album "${album.title}" (${album.count} photos)?\n\nThis permanently removes the photos.`)) return;
    setDeletingId(album._id);
    try {
      await api.delete(`/admin/gallery/${album._id}`);
      toast.success('Album deleted');
      setViewer(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-100 text-pink-700">
            <FaUpload className="h-4 w-4" />
          </span>
          <div>
            <h4 className="text-sm font-extrabold text-slate-800">New Event Album</h4>
            <p className="text-xs text-slate-400">Group photos under a Program / Event title</p>
          </div>
        </div>

        <label className="label">Program / Event Title *</label>
        <input
          className="input mb-4"
          placeholder="e.g. Onam Celebration 2026"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {previews.length > 0 ? (
          <div className="mb-4">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {previews.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p} alt={`preview ${i + 1}`} className="aspect-square w-full rounded-xl border border-slate-200 object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setFiles(files.filter((_, j) => j !== i));
                      setPreviews(previews.filter((_, j) => j !== i));
                    }}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white shadow"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-400">{previews.length} photo(s) selected</p>
            <label className="text-xs font-bold text-emerald-900 underline underline-offset-2 cursor-pointer">
              Change photos
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
            </label>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-6 text-sm text-slate-500 transition hover:border-pink-600 hover:text-pink-700">
            <FaImages className="text-xl" />
            Select multiple photos (first photo becomes the album cover)
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
          </label>
        )}
        <p className="mt-2 text-[11px] font-medium text-slate-400">
          JPEG / PNG / WebP — photos are auto-compressed; up to 20 per album, 16 MB each
        </p>

        <div className="flex items-center gap-3">
          <button onClick={upload} disabled={uploading} className="btn-primary !py-2.5 text-sm disabled:opacity-60">
            {uploading ? 'Uploading...' : (<span className="flex items-center gap-2"><FaUpload /> Upload Album</span>)}
          </button>
        </div>
      </div>

      {/* Albums */}
      <div>
        <h4 className="mb-3 text-sm font-extrabold text-slate-700">
          Event Albums
          {albums.length > 0 && (
            <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500">{albums.length}</span>
          )}
        </h4>

        {loading ? (
          <Spinner label="Loading albums..." />
        ) : albums.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
            <FaImages className="text-4xl text-slate-300" />
            <p className="font-semibold text-slate-500">No albums yet — upload your first event above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((a, i) => (
              <motion.div
                key={a._id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setViewer({ album: a, index: 0 })}
                  className="relative block w-full"
                >
                  <div className="aspect-[4/3] overflow-hidden">
                    <img src={a.cover} alt={a.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                    <FaCamera className="text-[10px]" /> {a.count}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8 text-left">
                    <p className="line-clamp-2 text-sm font-extrabold text-white">{a.title}</p>
                  </div>
                </button>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-[11px] font-semibold text-slate-400">
                    {new Date(a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => remove(a)}
                    disabled={deletingId === a._id}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    <FaTrashAlt /> {deletingId === a._id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox viewer for admin */}
      <AnimatePresence>
        {viewer && (
          <AdminViewer
            album={viewer.album}
            index={viewer.index}
            onClose={() => setViewer(null)}
            setIndex={(i) => setViewer((v) => ({ ...v, index: i }))}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AdminViewer({ album, index, onClose, setIndex }) {
  const photos = album.photos;
  const len = photos.length;
  const prev = () => setIndex((index - 1 + len) % len);
  const next = () => setIndex((index + 1) % len);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex flex-col bg-black/95 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between px-5 py-3">
        <p className="truncate text-sm font-extrabold text-white">{album.title}</p>
        <p className="text-xs font-medium text-white/60">
          {index + 1} / {len}
        </p>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
          <FaTimes />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-14">
        <button onClick={prev} className="absolute left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25">
          <FaChevronLeft />
        </button>
        <motion.img
          key={index}
          src={photos[index]}
          initial={{ opacity: 0, x: 80 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28 }}
          className="max-h-[70vh] max-w-full rounded-lg object-contain shadow-2xl"
        />
        <button onClick={next} className="absolute right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25">
          <FaChevronRight />
        </button>
      </div>
      <div className="flex items-center justify-center gap-2 overflow-x-auto px-4 py-4">
        {photos.map((p, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-2 transition ${i === index ? 'ring-gold-300' : 'opacity-60 ring-transparent hover:opacity-90'}`}
          >
            <img src={p} alt={`thumb ${i + 1}`} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// Downscale and re-encode an image client-side (max 1600px long edge, JPEG 0.85).
// Returns the original file untouched when compression isn't possible or the
// compressed result would be larger, so the upload still works with the file
// as picked.
const MAX_DIM = 1600;

function compressImage(file) {
  return new Promise((resolve) => {
    if (!file || !/^image\//.test(file.type) || !window.FileReader || !document.createElement('canvas').getContext) {
      return resolve(file);
    }
    const reader = new FileReader();
    reader.onerror = () => resolve(file);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(file);
      img.onload = () => {
        try {
          const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (!blob || blob.size >= file.size) return resolve(file);
              const base = (file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
              resolve(new File([blob], `${base}.jpg`, { type: blob.type || file.type }));
            },
            'image/jpeg',
            0.85
          );
        } catch (e) {
          resolve(file);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}