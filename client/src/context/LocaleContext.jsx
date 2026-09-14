import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { en, ml } from '../lib/translations';

const LANG_KEY = 'al_lang';

function detectLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'ml' || saved === 'en') return saved;
  } catch {
    // ignore
  }
  if (typeof navigator !== 'undefined' && navigator.language && navigator.language.toLowerCase().startsWith('ml')) {
    return 'ml';
  }
  return 'en';
}

const LocaleContext = createContext({ lang: 'en', setLang: () => {}, t: (k) => k });

export function LocaleProvider({ children }) {
  const [lang, setLang] = useState(detectLang);

  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      // ignore
    }
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const value = useMemo(() => {
    const dict = lang === 'ml' ? ml : en;
    return {
      lang,
      setLang,
      t: (key) => {
        const parts = String(key).split('.');
        let node = dict;
        for (const p of parts) {
          if (!node || typeof node !== 'object' || !(p in node)) return key;
          node = node[p];
        }
        return typeof node === 'string' ? node : key;
      },
    };
  }, [lang]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);