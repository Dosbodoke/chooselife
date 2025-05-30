import translationEn from '~/i18n/locales/en-US/translation.json';
import translationPt from '~/i18n/locales/pt-BR/translation.json';
import * as Localization from 'expo-localization';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from 'expo-sqlite/kv-store';
import i18next from 'i18next';
import React from 'react';
import { initReactI18next } from 'react-i18next';

import type { Locales } from '~/utils/database.types';

export const resources = {
  pt: { translation: translationPt },
  en: { translation: translationEn },
} as const;

interface I18nContextType {
  locale: Locales;
  setLocale: (locale: Locales) => Promise<void>;
}

const FALLBACK_LNG: Locales = 'pt';

const I18nContext = React.createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [languageLoaded, setLanguageLoaded] = React.useState(false);
  const [language, setLanguage] = React.useState<Locales | null>(null);

  React.useEffect(() => {
    const getSystemLanguageAndSet = async () => {
      const storedLocale = (await AsyncStorage.getItem(
        'chooselife_locale',
      )) as Locales;
      const phoneLocale = (Localization.getLocales()?.[0]?.languageCode ??
        FALLBACK_LNG) as Locales;
      setLanguage(storedLocale ? storedLocale : phoneLocale);
    };

    getSystemLanguageAndSet();
  }, []);

  React.useEffect(() => {
    if (!language || languageLoaded) return;
    i18next.use(initReactI18next).init({
      lng: language,
      resources,
      fallbackLng: FALLBACK_LNG,
      interpolation: {
        escapeValue: false,
      },
      compatibilityJSON: 'v4',
    });
    setLanguageLoaded(true);
  }, [language, languageLoaded]);

  React.useEffect(() => {
    if (languageLoaded) {
      SplashScreen.hideAsync();
    }
  }, [language, languageLoaded]);

  const updateLocale = async (locale: Locales) => {
    await i18next.changeLanguage(locale);
    await AsyncStorage.setItem('chooselife_locale', locale);
    setLanguage(locale);
  };

  if (!languageLoaded) {
    return null;
  }

  return (
    <I18nContext.Provider
      value={{
        setLocale: async (locale) => await updateLocale(locale),
        locale: language || FALLBACK_LNG,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

// Custom hook to use the i18n context
export function useI18n() {
  const context = React.useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
