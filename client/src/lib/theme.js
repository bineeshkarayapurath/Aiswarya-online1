import clubConfig from '../config/clubConfig';

const org = clubConfig.organization;
const brand = clubConfig.branding;
const colors = clubConfig.themeColors;

/**
 * Applies white-label branding at boot:
 *  - document <title>, meta description and favicon
 *  - CSS custom properties (--primary-*, --accent-*, --dark-*...) so raw-CSS
 *    surfaces (index.css) and any `var(...)` consumers re-theme instantly
 *    from clubConfig without a rebuild.
 */
export function applyClubTheme() {
  const root = document.documentElement;

  // <head> branding
  document.title = `${org.fullName} — Reg No: ${org.regNo}`;
  meta('name', 'description', `${org.fullName} — Reg No: ${org.regNo}`);
  setFavicon(brand.favicon);

  // Primary family
  Object.entries(colors.primary).forEach(([shade, value]) => root.style.setProperty(`--primary-${shade}`, value));
  // Accent family
  const accents = { ...colors.accent };
  const accentDefault = accents.DEFAULT || accents[500] || '#b8860b';
  root.style.setProperty('--accent', accentDefault);
  Object.entries(accents)
    .filter(([shade]) => shade !== 'DEFAULT')
    .forEach(([shade, value]) => root.style.setProperty(`--accent-${shade}`, value));
  root.style.setProperty('--accent-500', accents[500] || accentDefault);

  // Dark surfaces
  Object.entries(colors.dark).forEach(([k, v]) => root.style.setProperty(`--dark-${k}`, v));

  // PDF inks (consumed by client-side print previews)
  Object.entries(colors.pdf).forEach(([k, v]) => root.style.setProperty(`--pdf-${k}`, v));
  root.style.setProperty('--qr-fg', colors.qr || colors.primary[900]);
}

function meta(attr, name, content) {
  let el = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setFavicon(href) {
  let link = document.head.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/png';
  link.href = href;
}

export { clubConfig };
export default clubConfig;