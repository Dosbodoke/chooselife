import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useI18n } from '~/context/i18n';

export const LanguageSwitcher = ({ onSwitch }: { onSwitch?: () => void }) => {
  const { setLocale, locale } = useI18n();

  const handleSwitch = (locale: 'en' | 'pt') => {
    setLocale(locale);
    onSwitch?.();
  };

  return (
    <View className="justify-center items-center gap-4 p-4 w-full">
      <TouchableOpacity className="w-full" onPress={() => handleSwitch('en')}>
        <View
          className={`flex-row items-center p-3 rounded-full border-2 ${
            locale === 'en'
              ? 'border-blue-500 bg-blue-100'
              : 'border-border bg-muted'
          }`}
        >
          <Text className="text-2xl mr-2">🇺🇸</Text>
          <Text
            className={`text-lg ${
              locale === 'en' ? 'text-blue-700' : 'text-gray-700'
            }`}
          >
            English
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity className="w-full" onPress={() => handleSwitch('pt')}>
        <View
          className={`flex-row items-center p-3 rounded-full border-2 ${
            locale === 'pt'
              ? 'border-green-500 bg-green-100'
              : 'border-border bg-muted'
          }`}
        >
          <Text className="text-2xl mr-2">🇧🇷</Text>
          <Text
            className={`text-lg ${
              locale === 'pt' ? 'text-green-700' : 'text-gray-700'
            }`}
          >
            Português
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};
