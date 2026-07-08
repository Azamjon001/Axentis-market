import { useState, useEffect } from 'react';
import { getCurrentLanguage, type Language } from '../utils/translations';

/**
 * Returns the current UI language and re-renders when the user switches it
 * (the app dispatches a `languageChange` CustomEvent with the new language in
 * `detail`). Use for components that show their own bilingual labels.
 */
export function useUiLang(): Language {
  const [lang, setLang] = useState<Language>(getCurrentLanguage());
  useEffect(() => {
    const onLang = (e: any) => setLang(e.detail);
    window.addEventListener('languageChange', onLang as EventListener);
    return () => window.removeEventListener('languageChange', onLang as EventListener);
  }, []);
  return lang;
}
