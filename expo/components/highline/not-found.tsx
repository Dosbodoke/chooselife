import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, View } from 'react-native';

import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { H2 } from '~/components/ui/typography';

const HighlineNotFound: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();

  const canGoBack = router.canGoBack();

  return (
    <SafeAreaView className="flex-1">
      <View className="flex items-center justify-center h-full gap-4">
        <H2>{t('components.highline.not-found.title')}</H2>
        <Button
          onPress={() => {
            if (canGoBack) {
              router.back();
            }
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
