import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '~/components/ui/text';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View>
        <Text>{t('app.+not-found.title')}</Text>
        <Link href="/">
          <Text>{t('app.+not-found.subtitle')}</Text>
        </Link>
      </View>
    </>
  );
}
