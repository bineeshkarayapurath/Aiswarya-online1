import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import api, { API_ORIGIN } from '../api/client';
import Spinner from '../components/Spinner';
import { useLocale } from '../context/LocaleContext';
import {
  FaImages,
  FaChevronLeft,
  FaChevronRight,
  FaTimes,
  FaCamera,
  FaArrowRight,
} from 'react-icons/fa';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

// Neutral placeholder shown when a photo is missing or fails to load, so the
// lightbox never renders a broken-image icon.
const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='100%25' height='100%25' fill='%23e2e8f0'/%3E%3Ctext x='50%25' y='50%25' fill='%2394a3b8' font-family='sans-serif' font-size='28' text-anchor='middle' dominant-baseline='middle'%3EImage unavailable%3C/text%3E%3C/svg%3E";

// Resolve any stored path into a URL the browser can load. Photos hosted under
// /uploads/ are prefixed with the API origin; absolute http(s) /
// protocol-relative / data URLs are passed through untouched, so external or
// CDN images render correctly too.
function resolvePhoto(src) {
  if (!src) return PLACEHOLDER;
  const s = String(src).replace(/\\/g, '/');
  if (s.startsWith(API_ORIGIN)) return s;
  if (/^(https?:)?\/\//i.test(s) || s.startsWith('data:')) return s;
  return API_ORIGIN + (s.startsWith('/') ? s : `/uploads/${s.replace(/^\/+/g, '')}`);
}

export default function Gallery() {
  const { t } = useLocale();
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [dir, setDir] = useState(1);

  useEffect(() => {
    api
      .get('/public/gallery')
      .then((r) => setAlbums(r.data.albums || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openAlbum = (album) => {
    setSelectedAlbum(album);
    setPhotoIndex(0);
    setDir(1);
  };

  const setPhoto = (i, d = 1) => {
    setPhotoIndex(i);
    setDir(d);
  };

  return (
    <div className="overflow-hidden">
      {/* Header */}
      <section className="relative bg-gradient-to-br from-emerald-900 via-emerald-800 to-gold/70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(255,255,255,0.1),transparent_45%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 text-center sm:py-20">
          <span className="chip bg-gold/20 text-gold-300">{t('hero.rose')}</span>
          <h1 className="mt-4 text-3xl font-extrabold text-white sm:text-5xl">
            {t('gallery.title')}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-emerald-100">
            {t('gallery.pageSub')}
          </p>
        </div>
      </section>

      {/* Album grid */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        {loading ? (
          <Spinner label={`${t('catalog.ourLibrary')}...`} />
        ) : albums.length === 0 ? (
          <div className="card flex flex-col items-center gap-4 p-16 text-center">
            <FaImages className="text-5xl text-emerald-900/20" />
            <p className="font-extrabold text-slate-600 dark:text-slate-200">{t('gallery.noAlbums')}</p>
            <p className="text-sm text-slate-400">{t('gallery.noAlbumsSub')}</p>
            <Link to="/register" className="btn-outline mt-2 !py-2 text-sm">
              {t('gallery.joinClub')} <FaArrowRight />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {albums.map((a, i) => (
              <motion.button
                key={a._id}
                type="button"
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                transition={{ delay: (i % 4) * 0.08 }}
                onClick={() => openAlbum(a)}
                className="group relative block overflow-hidden rounded-2xl bg-white text-left shadow-md ring-1 ring-slate-100 transition hover:-translate-y-1 hover:shadow-xl dark:bg-emerald-900/50 dark:ring-emerald-800/40"
              >
                <div className="aspect-[4/3] w-full overflow-hidden">
                  <img
                    src={resolvePhoto(a.cover)}
                    alt={a.title}
                    loading="lazy"
                    onError={(e) => {
                      if (e.currentTarget.src !== PLACEHOLDER) e.currentTarget.src = PLACEHOLDER;
                    }}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                  />
                </div>

                {/* Photo count badge */}
                <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                  <FaCamera className="text-[10px]" />
                  {a.count}
                </span>

                {/* Title overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-10">
                  <p className="line-clamp-2 break-words text-sm font-extrabold text-white drop-shadow">
                    {a.title}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-white/70">
                    {new Date(a.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </section>

      {/* Fullscreen lightbox — layered above everything (z-[70], above the
          sticky z-50 navbar) and animated open/close via AnimatePresence. */}
      <AnimatePresence>
        {selectedAlbum && (
          <Lightbox
            album={selectedAlbum}
            index={photoIndex}
            dir={dir}
            onClose={() => setSelectedAlbum(null)}
            setIndex={setPhoto}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Lightbox({ album, index, dir, onClose, setIndex }) {
  const photos = (album.photos || []).filter(Boolean);
  const len = photos.length;
  const [touchX, setTouchX] = useState(null);

  const prev = useCallback(() => setIndex((index - 1 + len) % len, -1), [index, len, setIndex]);
  const next = useCallback(() => setIndex((index + 1) % len, 1), [index, len, setIndex]);

  // Keyboard navigation: Esc closes, ← / → navigate photos.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, prev, next]);

  // Lock body scroll while open.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const onTouchStart = (e) => setTouchX(e.touches[0].clientX);
  const onTouchEnd = (e) => {
    if (touchX == null) return;
    const delta = e.changedTouches[0].clientX - touchX;
    if (Math.abs(delta) > 50) (delta < 0 ? next : prev)();
    setTouchX(null);
  };

  if (len === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-[70] flex flex-col bg-black/95 backdrop-blur-sm"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top bar: caption/title + counter + close */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate break-words text-sm font-extrabold text-white sm:text-base">
            {album.title}
          </p>
          <p className="text-[11px] font-medium text-white/60">
            {index + 1} of {len}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:rotate-90 hover:bg-white/20"
          title="Close (Esc)"
        >
          <FaTimes />
        </button>
      </div>

      {/* Stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
        <button
          onClick={prev}
          aria-label="Previous photo"
          className="absolute left-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/25 sm:left-5 sm:h-12 sm:w-12"
          title="Previous (←)"
        >
          <FaChevronLeft />
        </button>

        <div className="flex max-h-full items-center justify-center overflow-hidden">
          <AnimatePresence mode="popLayout" custom={dir} initial={false}>
            <motion.img
              key={index}
              src={resolvePhoto(photos[index])}
              alt={`${album.title} ${index + 1}`}
              custom={dir}
              initial={{ opacity: 0, x: 90 * dir, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -90 * dir, scale: 0.98 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              onError={(e) => {
                if (e.currentTarget.src !== PLACEHOLDER) e.currentTarget.src = PLACEHOLDER;
              }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.3}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) next();
                else if (info.offset.x > 60) prev();
              }}
              className="max-h-[68vh] max-w-full touch-pan-y select-none rounded-lg object-contain shadow-2xl"
              draggable={false}
            />
          </AnimatePresence>
        </div>

        <button
          onClick={next}
          aria-label="Next photo"
          className="absolute right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/25 sm:right-5 sm:h-12 sm:w-12"
          title="Next (→)"
        >
          <FaChevronRight />
        </button>
      </div>

      {/* Thumbnail strip */}
      <div className="flex items-center justify-center gap-2 overflow-x-auto px-4 py-4 sm:py-5">
        {photos.map((p, i) => (
          <motion.button
            key={i}
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => setIndex(i, i > index ? 1 : -1)}
            className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-2 transition sm:h-16 sm:w-16 ${
              i === index ? 'ring-gold-300' : 'opacity-60 ring-transparent hover:opacity-90'
            }`}
            title={`Photo ${i + 1}`}
          >
            <img
              src={resolvePhoto(p)}
              alt={`thumb ${i + 1}`}
              onError={(e) => {
                if (e.currentTarget.src !== PLACEHOLDER) e.currentTarget.src = PLACEHOLDER;
              }}
              className="h-full w-full object-cover"
            />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}