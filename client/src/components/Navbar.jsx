import { Link } from 'react-router-dom';
import { CLUB, featureEnabled } from '../lib/club';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { useTheme } from '../context/ThemeContext';
import { motion } from 'framer-motion';
import { FaBookOpen, FaUser, FaShieldAlt, FaImages, FaSun, FaMoon } from 'react-icons/fa';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLocale();
  const { theme, toggleTheme } = useTheme();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

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
            <>
              {isSuperAdmin && (
                <Link
                  to="/authority/dashboard"
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-900/10 px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-white/10"
                >
                  <FaShieldAlt className="text-sm" />
                  <span className="hidden sm:inline">{t('nav.adminPanel')}</span>
                </Link>
              )}
              {user.role === 'MEMBER' && user.status === 'APPROVED' && (
                <Link
                  to="/member/dashboard"
                  className="flex items-center gap-1.5 rounded-lg bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20 dark:text-gold-300"
                >
                  <FaUser className="text-sm" />
                  <span className="hidden sm:inline">{t('nav.dashboard')}</span>
                </Link>
              )}
              <button
                onClick={logout}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              >
                {t('nav.logout')}
              </button>
            </>
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