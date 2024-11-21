import { useRouter } from 'expo-router';
import { SafeAreaView, View } from 'react-native';

import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { H2 } from '~/components/ui/typography';

const HighlineNotFound: React.FC = () => {
  const router = useRouter();

  const canGoBack = router.canGoBack();

  return (
    <SafeAreaView className="flex-1">
      <View className="flex items-center justify-center h-full gap-4">
        <H2>Highline não existe</H2>
        <Button
          onPress={() => {
            if (canGoBack) {
              router.back();
            }
          }}
        >
          <Text>{canGoBack ? 'Voltar' : 'Ir para página inicial'}</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
};

export { HighlineNotFound };
