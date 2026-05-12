import translationEn from '~/i18n/locales/en-US/translation.json';
import translationPt from '~/i18n/locales/pt-BR/translation.json';
import * as Localization from 'expo-localization';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from 'expo-sqlite/kv-store';
import i18next from 'i18next';
import React from 'react';
import { initReactI18next } from 'react-i18next';

import { useMountEffect } from '~/hooks/use-mount-effect';

import { type Locales } from '../../packages/database';

export const resources = {
  pt: { translation: translationPt },
  en: { translation: translationEn },
} as const;

interface I18nContextType {
  locale: Locales;
  setLocale: (locale: Locales) => Promise<void>;
}

const STORAGE_KEY = 'chooselife_locale';

const FALLBACK_LNG: Locales = 'pt';

const I18nContext = React.createContext<I18nContextType | undefined>(undefined);

let i18nInitPromise: Promise<void> | null = null;

function isSupportedLocale(
  locale: string | null | undefined,
): locale is Locales {
  return locale === 'pt' || locale === 'en';
}

async function getInitialLocale(): Promise<Locales> {
  const storedLocale = await AsyncStorage.getItem(STORAGE_KEY);

  if (isSupportedLocale(storedLocale)) {
    return storedLocale;
  }

  const phoneLocale = Localization.getLocales()?.[0]?.languageCode;

  if (isSupportedLocale(phoneLocale)) {
    return phoneLocale;
  }

  return FALLBACK_LNG;
}

async function ensureI18nInitialized(locale: Locales) {
  if (!i18nInitPromise) {
    i18nInitPromise = i18next
      .use(initReactI18next)
      .init({
        lng: locale,
        resources,
        fallbackLng: FALLBACK_LNG,
        interpolation: {
          escapeValue: false,
        },
        compatibilityJSON: 'v4',
      })
      .then(() => undefined);
  }

  await i18nInitPromise;

  if (i18next.language !== locale) {
    await i18next.changeLanguage(locale);
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = React.useState<Locales | null>(null);

  useMountEffect(() => {
    let isActive = true;

    async function bootstrapI18n() {
      try {
        const initialLocale = await getInitialLocale();

        await ensureI18nInitialized(initialLocale);

        if (isActive) {
          setLanguage(initialLocale);
        }
      } catch (error) {
        console.error('Failed to initialize i18n:', error);

        try {
          await ensureI18nInitialized(FALLBACK_LNG);

          if (isActive) {
            setLanguage(FALLBACK_LNG);
          }
        } catch (fallbackError) {
          console.error('Failed to initialize fallback i18n:', fallbackError);
        }
      } finally {
        await SplashScreen.hideAsync().catch(() => undefined);
      }
    }

    void bootstrapI18n();

    return () => {
      isActive = false;
    };
  });

  const updateLocale = React.useCallback(async (locale: Locales) => {
    await i18next.changeLanguage(locale);
    await AsyncStorage.setItem(STORAGE_KEY, locale);
    setLanguage(locale);
  }, []);

  const value = React.useMemo<I18nContextType>(
    () => ({
      locale: language ?? FALLBACK_LNG,
      setLocale: updateLocale,
    }),
    [language, updateLocale],
  );

  if (!language) {
    return null;
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = React.useContext(I18nContext);

  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }

  return context;
}
