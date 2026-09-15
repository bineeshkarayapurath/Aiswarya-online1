import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/client';
import { CLUB, featureEnabled } from '../lib/club';
import {
  FaBookOpen,
  FaUsers,
  FaCalendarAlt,
  FaArrowRight,
  FaTrophy,
  FaHandsHelping,
  FaSms,
  FaImages,
  FaCamera,
} from 'react-icons/fa';
import Spinner from '../components/Spinner';
import { useLocale } from '../context/LocaleContext';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

export default function Landing() {
  const { t } = useLocale();
  const [stats, setStats] = useState(null);
  const [catalog, setCatalog] = useState({ books: [], events: [] });
  const [albums, setAlbums] = useState([]);

  useEffect(() => {
    api
      .get('/public/stats')
      .then((r) => setStats(r.data))
      .catch(() => {});
    api
      .get('/public/catalog')
      .then((r) => setCatalog(r.data))
      .catch(() => {});
    api
      .get('/public/gallery')
      .then((r) => setAlbums(r.data.albums || []))
      .catch(() => {});
  }, []);

  return (
    <div className="overflow-hidden">
      {/* HERO */}
      <section className="relative bg-gradient-to-br from-emerald-900 via-emerald-800 to-gold/70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_45%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 lg:grid-cols-2 lg:py-28">
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <span className="chip bg-gold/20 text-gold-300">
              Reg No: {CLUB.regNo}
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
              {t('hero.title1')} <span className="text-gold-300">{t('hero.ignites')}</span>,{' '}
              {t('hero.title2')} <span className="text-gold-300">{t('hero.unites')}</span>.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-emerald-100">{t('hero.sub')}</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/register" className="btn-gold">
                <FaBookOpen /> {t('hero.becomeMember')}
              </Link>
              <a href="#catalog" className="btn-outline !border-white !text-white hover:!bg-white hover:!text-emerald-900">
                {t('hero.exploreCatalog')}
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center"
          >
            <img
              src={CLUB.logo}
              alt="Club Logo"
              className="h-40 w-40 object-contain opacity-50 sm:h-52 sm:w-52"
            />
          </motion.div>
        </div>
      </section>

      {/* STATS */}
      <section className="relative -mt-8 mx-auto max-w-7xl px-4">
        <div className="card grid grid-cols-2 gap-6 p-8 lg:grid-cols-4">
{[
            { icon: FaBookOpen, label: t('stats.booksInLibrary'), value: stats?.books ?? '...' },
            { icon: FaUsers, label: t('stats.activeMembers'), value: stats?.activeMembers ?? '...' },
            { icon: FaTrophy, label: t('stats.yearsOfService'), value: stats?.years ?? '...' },
            { icon: FaCalendarAlt, label: t('stats.pendingApplications'), value: stats?.pendingApplications ?? '...' },
          ].map(({ icon: Icon, label, value }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-4"
            >
              <div className="rounded-2xl bg-emerald-900/5 p-3 text-2xl text-emerald-900 dark:bg-white/5 dark:text-emerald-300">
                <Icon />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-300">{value}</p>
                <p className="text-xs font-medium text-slate-500 dark:text-emerald-200/60">{label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CATALOG SNEAK PEEK */}
      {featureEnabled('enableCatalog') && (
      <section id="catalog" className="mx-auto max-w-7xl px-4 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gold">{t('catalog.ourLibrary')}</p>
            <h2 className="text-3xl font-extrabold text-emerald-900 dark:text-emerald-300">{t('catalog.popularBooks')}</h2>
          </div>
          <Link to="/register" className="btn-outline !py-2 text-sm">
            {t('catalog.membersBorrowFree')} <FaArrowRight />
          </Link>
        </div>

        {catalog.books.length === 0 ? (
          <Spinner label={t('catalog.loading')} />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.books.map((b, i) => (
              <motion.div
                key={b.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="card group cursor-pointer p-6 transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-900 to-emerald-600 text-3xl text-gold-300 shadow-md">
                  {b.emoji}
                </div>
                <h3 className="text-lg font-bold text-slate-800 group-hover:text-emerald-900 dark:text-slate-100 dark:group-hover:text-emerald-300">
                  {b.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-emerald-200/60">{b.author}</p>
                <span className="chip mt-3 bg-emerald-900/5 text-emerald-900 dark:bg-white/10 dark:text-emerald-300">{b.category}</span>
              </motion.div>
            ))}
          </div>
        )}
      </section>
      )}

      {/* EVENTS */}
      {featureEnabled('enablePrograms') && (
      <section id="events" className="bg-gradient-to-b from-transparent to-emerald-900/5 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-gold">{t('events.upcoming')}</p>
            <h2 className="text-3xl font-extrabold text-emerald-900 dark:text-emerald-300">
              {t('events.title')}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {catalog.events.map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: i % 2 ? 24 : -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="card flex items-center gap-5 p-6"
              >
                <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-emerald-900 text-gold-300 shadow-lg">
                  <span className="text-2xl">{e.emoji}</span>
                </div>
                <div className="flex-1">
                  <span className="chip bg-gold/10 text-gold">{e.type}</span>
                  <h3 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">{e.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-emerald-200/60">
                    {new Date(e.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}{' '}
                    &middot; {e.place}
                  </p>
                </div>
                <FaCalendarAlt className="text-2xl text-emerald-900/20" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* GALLERY */}
      {albums.length > 0 && featureEnabled('enableGallery') && (
        <section className="bg-gradient-to-b from-emerald-900/5 to-transparent py-16">
          <div className="mx-auto max-w-7xl px-4">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gold">{t('gallery.moments')}</p>
                <h2 className="text-3xl font-extrabold text-emerald-900 dark:text-emerald-300">{t('gallery.title')}</h2>
              </div>
              <Link to="/gallery" className="btn-outline !py-2 text-sm">
                {t('gallery.viewAll')} <FaArrowRight />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {albums.slice(0, 4).map((a, i) => (
                <motion.button
                  key={a._id}
                  onClick={() => (window.location.href = '/gallery')}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className="group relative block overflow-hidden rounded-2xl shadow-md"
                >
                  <div className="aspect-[4/3]">
                    <img
                      src={a.cover}
                      alt={a.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>
                  <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                    <FaCamera className="text-[9px]" /> {a.count}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8 text-left">
                    <p className="line-clamp-2 text-xs font-extrabold text-white">{a.title}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass relative overflow-hidden rounded-3xl border-emerald-900/10 bg-gradient-to-br from-emerald-900 to-emerald-700 p-10 text-center shadow-2xl"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(184,134,11,0.35),transparent_50%)]" />
          <div className="relative">
            <FaHandsHelping className="mx-auto mb-4 text-4xl text-gold-300" />
            <h2 className="text-3xl font-extrabold text-white">
              {t('cta.title')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-emerald-100">
              {t('cta.sub')}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <Link to="/register" className="btn-gold">
                <FaSms /> {t('cta.registerNow')}
              </Link>
              <Link to="/member-login" className="btn-outline !border-white !text-white hover:!bg-white hover:!text-emerald-900">
                {t('cta.alreadyMember')}
              </Link>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}