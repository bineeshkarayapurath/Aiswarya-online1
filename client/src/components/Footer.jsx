import { CLUB, featureEnabled } from '../lib/club';
import useClubContact from '../lib/useClubContact';
import { useLocale } from '../context/LocaleContext';
import { FaPhoneAlt, FaEnvelope, FaMapMarkerAlt, FaFacebook, FaInstagram, FaWhatsapp, FaYoutube } from 'react-icons/fa';

const SOCIAL_KEYS = [
  'mapsUrl',
  'facebookUrl',
  'instagramUrl',
  'whatsappUrl',
  'youtubeUrl',
];

export default function Footer() {
  // Official address, email, club phone and the current President/Secretary
  // numbers all come from the server's ClubSettings (useClubContact), so this
  // footer can never print a stale copy.
  const contact = useClubContact();
  const social = SOCIAL_KEYS.reduce((acc, k) => ({ ...acc, [k]: contact[k] }), {});
  const { t } = useLocale();

  const has = (v) => Boolean(v && String(v).trim());

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
            {featureEnabled('enableBookRequests') && (
              <li><a href="/book-festival" className="hover:text-gold">{t('footer.bookFestival')}</a></li>
            )}
            {featureEnabled('enablePolls') && (
              <li><a href="/polls" className="hover:text-gold">{t('footer.polls')}</a></li>
            )}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="mb-4 text-sm font-bold text-gold">{t('footer.contactUs')}</h4>
          <ul className="space-y-2.5 text-sm text-emerald-200">
            {has(contact.address) && (
              <li className="flex gap-2">
                <FaMapMarkerAlt className="mt-0.5 shrink-0" /> <span>{contact.address}</span>
              </li>
            )}
            {has(contact.phoneNumber) && (
              <li>
                <a href={`tel:${contact.phoneNumber}`} className="flex items-center gap-2 hover:text-gold">
                  <FaPhoneAlt /> {contact.phoneNumber}
                </a>
              </li>
            )}
            {/* Officer numbers are resolved from whoever currently holds the post,
                so they follow a change of President / Secretary on their own. */}
            {has(contact.presidentPhone) && (
              <li className="text-xs">
                <a href={`tel:${contact.presidentPhone}`} className="flex items-center gap-2 hover:text-gold">
                  <FaPhoneAlt className="text-[10px]" /> President: {contact.presidentPhone}
                </a>
              </li>
            )}
            {has(contact.secretaryPhone) && (
              <li className="text-xs">
                <a href={`tel:${contact.secretaryPhone}`} className="flex items-center gap-2 hover:text-gold">
                  <FaPhoneAlt className="text-[10px]" /> Secretary: {contact.secretaryPhone}
                </a>
              </li>
            )}
            {has(contact.emailAddress) && (
              <li>
                <a href={`mailto:${contact.emailAddress}`} className="flex items-center gap-2 hover:text-gold">
                  <FaEnvelope /> {contact.emailAddress}
                </a>
              </li>
            )}
            {has(social.whatsappUrl) && (
              <li>
                <a
                  href={social.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-gold"
                >
                  <FaWhatsapp /> {t('footer.whatsappGroup')}
                </a>
              </li>
            )}
            {has(social.mapsUrl) && (
              <li>
                <a
                  href={social.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-gold"
                >
                  <FaMapMarkerAlt /> {t('footer.findUsOnMaps')}
                </a>
              </li>
            )}
          </ul>
          {has(social.facebookUrl) || has(social.instagramUrl) || has(social.whatsappUrl) || has(social.youtubeUrl) ? (
            <div className="mt-4 flex gap-3 text-lg text-emerald-300">
              {has(social.facebookUrl) && (
                <a href={social.facebookUrl} target="_blank" rel="noreferrer" className="hover:text-gold"><FaFacebook /></a>
              )}
              {has(social.instagramUrl) && (
                <a href={social.instagramUrl} target="_blank" rel="noreferrer" className="hover:text-gold"><FaInstagram /></a>
              )}
              {has(social.whatsappUrl) && (
                <a href={social.whatsappUrl} target="_blank" rel="noreferrer" className="hover:text-gold"><FaWhatsapp /></a>
              )}
              {has(social.youtubeUrl) && (
                <a href={social.youtubeUrl} target="_blank" rel="noreferrer" className="hover:text-gold"><FaYoutube /></a>
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