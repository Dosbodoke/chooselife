import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

const HighlineNotFound: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();

  const canGoBack = router.canGoBack();

  return (
    <SafeAreaView className="flex-1">
      <View className="flex items-center justify-center h-full gap-4">
        <Text variant="h2">{t('components.highline.not-found.title')}</Text>
        <Button
          onPress={() => {
            if (canGoBack) {
              router.back();
            }
            router.replace('/');
          }}
        >
          <Text>
            {canGoBack
              ? t('components.highline.not-found.goBack')
              : t('components.highline.not-found.goHome')}
          </Text>
        </Button>
      </View>
    </SafeAreaView>
  );
};

export { HighlineNotFound };
