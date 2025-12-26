import HighlineRetomada from '~/assets/images/highline-retomada.png';
import { Image as ExpoImage } from 'expo-image';
import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Dimensions, View } from 'react-native';

import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center bg-background p-6 gap-8">
        <View className="items-center gap-2">
          <Text variant="h1" className="text-center text-3xl">
            {t('app.+not-found.title')}
          </Text>
          <Text className="text-center text-muted-foreground text-lg">
            {t('app.+not-found.description')}
          </Text>
        </View>

        <ExpoImage
          source={HighlineRetomada}
          contentFit="cover"
          style={{ width: SCREEN_WIDTH, aspectRatio: 3259 / 2545 }}
        />

        <Link asChild href="/">
          <Button size="lg" className="w-full sm:w-auto">
            <Text>{t('app.+not-found.subtitle')}</Text>
          </Button>
        </Link>
      </View>
    </>
  );
}
