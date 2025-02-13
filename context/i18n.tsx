import * as Localization from 'expo-localization';
import AsyncStorage from 'expo-sqlite/kv-store';
import i18next from 'i18next';
import { createContext, useContext, useEffect, useState } from 'react';

interface I18nContextType {
  locale: string | null;
  setLocale: (locale: string) => Promise<void>;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<string | null>(null);

  const updateLocale = async (locale: string) => {
    await AsyncStorage.setItem('chooselife_locale', locale);
    i18next.changeLanguage(locale);
    setLocale(locale);
  };

  useEffect(() => {
    if (locale) return;
    const loadLocales = async () => {
      const storedLocale = await AsyncStorage.getItem('chooselife_locale');
      if (storedLocale) {
        setLocale(storedLocale);
      } else {
        const locale = Localization.getLocales()?.[0].languageTag;
        setLocale(locale);
      }
    };
    loadLocales();
  }, [locale]);

  return (
    <I18nContext.Provider
      value={{
        setLocale: async (locale: string) => await updateLocale(locale),
        locale,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

// Custom hook to use the i18n context
export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
