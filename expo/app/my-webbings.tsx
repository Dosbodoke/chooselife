import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '~/context/auth';
import { useOnlineStatus } from '~/context/react-query';

import { SafeAreaOfflineView } from '~/components/offline-banner';
import { MyWebbings } from '~/components/settings/my-webbing';
import { FAB } from '~/components/ui/fab';

export default function MyWebbingsScreen() {
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const { profile } = useAuth();
  const isOnline = useOnlineStatus();
  return (
    <SafeAreaOfflineView
      edges={['left', 'right']}
      className="flex-1 bg-gray-100"
      offlineBannerCoversStatusBar={false}
    >
      <Stack.Screen
        options={{
          title: t('components.settings.my-webbing.title'),
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#f3f4f6' },
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="p-4"
        contentContainerStyle={{ paddingBottom: bottom + 100 }}
      >
        <MyWebbings />
      </ScrollView>
      <FAB
        label={t('app.(modals).register-webbing.title')}
        href="/(modals)/register-webbing"
        visible={!!profile && isOnline}
      />
    </SafeAreaOfflineView>
  );
}
