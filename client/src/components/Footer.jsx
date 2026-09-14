import { useEffect, useState } from 'react';
import api from '../api/client';
import { CLUB, featureEnabled, clubConfig } from '../lib/club';
import { useLocale } from '../context/LocaleContext';
import { FaPhoneAlt, FaEnvelope, FaMapMarkerAlt, FaFacebook, FaInstagram, FaWhatsapp, FaYoutube } from 'react-icons/fa';

// Contact/social defaults come from the master config; live values from the
// server's ClubSettings (GET /api/public/settings) override them.
const EMPTY = {
  phoneNumber: clubConfig.organization.phone,
  emailAddress: clubConfig.organization.email,
  mapsUrl: clubConfig.organization.social.mapsUrl,
  facebookUrl: clubConfig.organization.social.facebookUrl,
  instagramUrl: clubConfig.organization.social.instagramUrl,
  whatsappUrl: clubConfig.organization.social.whatsappUrl,
  youtubeUrl: clubConfig.organization.social.youtubeUrl,
};

export default function Footer() {
  const [settings, setSettings] = useState(EMPTY);
  const { t } = useLocale();

  useEffect(() => {
    let mounted = true;
    api
      .get('/public/settings')
      .then((r) => r.data)
      .then((data) => {
        if (mounted) setSettings({ ...EMPTY, ...(data.settings || {}) });
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const has = (url) => Boolean(url && String(url).trim());

  return (
    <footer className="mt-auto border-t border-slate-200 bg-emerald-900 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <img
              src={CLUB.logo}
              alt="Logo"
              className="h-14 w-14 rounded-full border-2 border-gold bg-white object-contain"
            />
            <div>
              <p className="text-sm font-bold leading-tight">{CLUB.name}</p>
              <p className="text-xs text-gold">Reg No: {CLUB.regNo}</p>
            </div>
          </div>
          <p className="break-words text-xs text-emerald-200">{t('footer.tagline')}</p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="mb-4 text-sm font-bold text-gold">{t('footer.quickLinks')}</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="/register" className="hover:text-gold">{t('footer.becomeMember')}</a></li>
            <li><a href="/member-login" className="hover:text-gold">{t('footer.memberLogin')}</a></li>
            {featureEnabled('enableCatalog') && (
              <li><a href="/#catalog" className="hover:text-gold">{t('footer.bookCatalog')}</a></li>
            )}
            {featureEnabled('enablePrograms') && (
              <li><a href="/#events" className="hover:text-gold">{t('footer.upcomingEvents')}</a></li>
            )}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="mb-4 text-sm font-bold text-gold">{t('footer.contactUs')}</h4>
          <ul className="space-y-2.5 text-sm text-emerald-200">
            {has(settings.phoneNumber) && (
              <li>
                <a href={`tel:${settings.phoneNumber}`} className="flex items-center gap-2 hover:text-gold">
                  <FaPhoneAlt /> {settings.phoneNumber}
                </a>
              </li>
            )}
            {has(settings.emailAddress) && (
              <li>
                <a href={`mailto:${settings.emailAddress}`} className="flex items-center gap-2 hover:text-gold">
                  <FaEnvelope /> {settings.emailAddress}
                </a>
              </li>
            )}
            {has(settings.whatsappUrl) && (
              <li>
                <a
                  href={settings.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-gold"
                >
                  <FaWhatsapp /> {t('footer.whatsappGroup')}
                </a>
              </li>
            )}
            {has(settings.mapsUrl) && (
              <li>
                <a
                  href={settings.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-gold"
                >
                  <FaMapMarkerAlt /> {t('footer.findUsOnMaps')}
                </a>
              </li>
            )}
          </ul>
          {has(settings.facebookUrl) || has(settings.instagramUrl) || has(settings.whatsappUrl) || has(settings.youtubeUrl) ? (
            <div className="mt-4 flex gap-3 text-lg text-emerald-300">
              {has(settings.facebookUrl) && (
                <a href={settings.facebookUrl} target="_blank" rel="noreferrer" className="hover:text-gold"><FaFacebook /></a>
              )}
              {has(settings.instagramUrl) && (
                <a href={settings.instagramUrl} target="_blank" rel="noreferrer" className="hover:text-gold"><FaInstagram /></a>
              )}
              {has(settings.whatsappUrl) && (
                <a href={settings.whatsappUrl} target="_blank" rel="noreferrer" className="hover:text-gold"><FaWhatsapp /></a>
              )}
              {has(settings.youtubeUrl) && (
                <a href={settings.youtubeUrl} target="_blank" rel="noreferrer" className="hover:text-gold"><FaYoutube /></a>
              )}
            </div>
          ) : null}
        </div>

        {/* About */}
        <div>
          <h4 className="mb-4 text-sm font-bold text-gold">{t('footer.aboutClub')}</h4>
          <p className="break-words text-xs leading-relaxed text-emerald-200">
            {t('footer.aboutText')}
          </p>
        </div>
      </div>

      <div className="border-t border-emerald-800 text-center text-[11px] text-emerald-400">
        <p className="py-4">
          &copy; {new Date().getFullYear()} {CLUB.name}, {CLUB.place} &middot;{' '}
          {CLUB.regNo}. {t('footer.rights')}
        </p>
      </div>
    </footer>
  );
}