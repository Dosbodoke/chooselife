import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center gap-4">
        <Text className="text-2xl font-medium">
          {t('app.+not-found.title')}
        </Text>
        <Link asChild href="/">
          <Button>
            <Text>{t('app.+not-found.subtitle')}</Text>
          </Button>
        </Link>
      </View>
    </>
  );
}
