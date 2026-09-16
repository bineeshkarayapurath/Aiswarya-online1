import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CLUB, featureEnabled } from '../lib/club';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { useTheme } from '../context/ThemeContext';
import { resolveMedia } from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { FaBookOpen, FaShieldAlt, FaImages, FaSun, FaMoon, FaChevronDown, FaUser } from 'react-icons/fa';

function Avatar({ user, name, className = '' }) {
  const [broken, setBroken] = useState(false);
  const photoSrc = resolveMedia(user?.photoUrl);
  const initials = (n) =>
    !n ? '?' : n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

  // Reset the error flag whenever the resolved source changes (e.g. login
  // state refreshes with a valid absolute URL) so a stale failure never
  // permanently hides a now-valid photo.
  useEffect(() => setBroken(false), [photoSrc]);

  if (photoSrc && !broken) {
    return (
      <img
        src={photoSrc}
        alt="profile"
        onError={() => setBroken(true)}
        className={`rounded-full border-2 border-gold bg-white object-cover shadow ${className}`}
      />
    );
  }
  return (
    <span
      className={`flex items-center justify-center rounded-full border-2 border-gold bg-emerald-900 font-extrabold text-gold-300 shadow ${className}`}
    >
      {initials(name)}
    </span>
  );
}

// Resolve the "My Profile" destination from the logged-in user's role.
// Authority role accounts (ADMIN / SUPER_ADMIN) land on the Authority
// Dashboard; regular members (MEMBER, including members who hold a
// sub-committee or executive designation but have a MEMBER role) land on the
// Member Dashboard. Routes mirror the guards in App.jsx.
function resolveProfileRoute(user) {
  const role = String(user?.role || '').toUpperCase();
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return '/admin/dashboard';
  return '/member/dashboard';
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLocale();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const goToProfile = () => {
    setMenuOpen(false);
    navigate(resolveProfileRoute(user));
  };

  useEffect(() => {
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const displayName = user?.fullName || 'Member';

  const langPill = (isActive) =>
    `px-2.5 py-1.5 transition ${
      isActive
        ? 'bg-emerald-900 text-white dark:bg-emerald-400 dark:text-emerald-950'
        : 'text-slate-500 hover:bg-emerald-900/10 dark:text-slate-300 dark:hover:bg-white/10'
    }`;

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-50 glass shadow-sm"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img
            src={CLUB.logo}
            alt="Club Logo"
            className="h-10 w-10 shrink-0 rounded-full border-2 border-gold bg-white object-contain shadow-sm sm:h-12 sm:w-12"
          />
          <div className="hidden min-w-0 leading-tight sm:block">
            <p className="truncate bg-gradient-to-r from-gold via-amber-500 to-gold bg-clip-text text-[15px] font-extrabold leading-tight text-transparent">
              {CLUB.fullName}
            </p>
            <p className="mt-0.5 text-xs font-bold text-emerald-900 dark:text-emerald-300">
              Reg No: {CLUB.regNo}
            </p>
          </div>
          <div className="sm:hidden">
            <p className="bg-gradient-to-r from-gold via-amber-500 to-gold bg-clip-text text-sm font-extrabold leading-tight text-transparent">
              {CLUB.shortName}
            </p>
            <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
              Reg No: {CLUB.regNo}
            </p>
          </div>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2">
          {user ? (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 transition hover:bg-emerald-900/10 dark:hover:bg-white/10"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <span className="relative shrink-0">
                  <Avatar user={user} name={displayName} className="h-9 w-9" />
                  {user.status === 'APPROVED' && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
                  )}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-emerald-300/70">
                    {t('nav.welcome')}
                  </span>
                  <span className="block max-w-[10rem] truncate text-sm font-extrabold text-emerald-900 dark:text-white">
                    {displayName.split(' ')[0]}
                  </span>
                </span>
                <FaChevronDown
                  className={`hidden text-xs text-slate-400 transition sm:block ${menuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-emerald-800 dark:bg-emerald-950"
                    role="menu"
                  >
                    <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-emerald-900">
                      <Avatar user={user} name={displayName} className="h-10 w-10" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold text-emerald-900 dark:text-white">
                          {displayName}
                        </p>
                        <p className="truncate text-[11px] text-slate-500 dark:text-emerald-300/70">
                          {isAdmin ? t('nav.adminPanel') : t('nav.member')} &middot; {user.role}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={goToProfile}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-white/10"
                      role="menuitem"
                    >
                      <FaUser className="text-gold" /> {t('nav.myProfile')}
                    </button>

                    {isAdmin && (
                      <Link
                        to="/admin/dashboard"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-white/10"
                        role="menuitem"
                      >
                        <FaShieldAlt className="text-gold" /> {t('nav.adminPanel')}
                      </Link>
                    )}

                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        logout();
                        navigate('/');
                      }}
                      className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-2.5 text-left text-sm font-semibold text-red-500 transition hover:bg-red-50 dark:border-emerald-900 dark:hover:bg-white/10"
                      role="menuitem"
                    >
                      {t('nav.logout')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              {featureEnabled('enableGallery') && (
                <Link
                  to="/gallery"
                  className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-900/10 md:flex dark:text-emerald-300 dark:hover:bg-white/10"
                >
                  <FaImages className="text-sm" />
                  {t('nav.gallery')}
                </Link>
              )}
              <Link
                to="/register"
                className="hidden items-center gap-1.5 rounded-lg bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20 sm:flex dark:text-gold-300"
              >
                <FaBookOpen className="text-sm" />
                {t('nav.becomeMember')}
              </Link>
              <Link
                to="/member-login"
                className="rounded-lg bg-emerald-900/10 px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-white/10"
              >
                {t('nav.login')}
              </Link>
            </>
          )}

          {/* Language switcher */}
          <div
            className="flex shrink-0 overflow-hidden rounded-full border border-emerald-900/25 text-xs font-extrabold shadow-sm dark:border-emerald-400/30"
            role="group"
            aria-label="Language"
          >
            <button
              onClick={() => setLang('ml')}
              title="മലയാളം"
              aria-pressed={lang === 'ml'}
              className={langPill(lang === 'ml')}
            >
              ML
            </button>
            <button
              onClick={() => setLang('en')}
              title="English"
              aria-pressed={lang === 'en'}
              className={`${langPill(lang === 'en')} border-l border-emerald-900/20 dark:border-emerald-400/20`}
            >
              EN
            </button>
          </div>

          {/* Dark / light mode toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
            aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-900/25 text-sm text-slate-500 transition hover:bg-emerald-900/10 hover:text-emerald-900 dark:border-emerald-400/30 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-gold-300"
          >
            {theme === 'dark' ? <FaSun /> : <FaMoon />}
          </button>
        </nav>
      </div>
    </motion.header>
  );
}