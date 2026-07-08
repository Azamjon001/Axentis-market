// 🌍 HOC для автоматической локализации компонентов
// Оборачивает компонент и добавляет язык и переводы

import { useState, useEffect, ComponentType } from 'react';
import { getCurrentLanguage, useTranslation, type Language } from '../utils/translations';

export interface WithLocalizationProps {
  language: Language;
  t: ReturnType<typeof useTranslation>;
}

export function withLocalization<P extends object>(
  Component: ComponentType<P & WithLocalizationProps>
) {
  return function LocalizedComponent(props: P) {
    const [language, setLanguage] = useState<Language>(getCurrentLanguage());
    const t = useTranslation(language);

    useEffect(() => {
      const handleLanguageChange = (e: CustomEvent) => {
        setLanguage(e.detail);
      };

      window.addEventListener('languageChange', handleLanguageChange as EventListener);

      return () => {
        window.removeEventListener('languageChange', handleLanguageChange as EventListener);
      };
    }, []);

    return <Component {...props} language={language} t={t} />;
  };
}
