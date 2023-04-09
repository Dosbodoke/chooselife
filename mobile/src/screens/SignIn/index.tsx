import { View, SafeAreaView, Text, StatusBar } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

// import { useAuth } from '@src/contexts/auth';
import { useWarmUpBrowser } from '@src/hooks/useWarmUpBrowser';

import LogInWithGoogle from './LogInWithGoogle';
import LogInWithApple from './LogInWithApple';
import LogInWithEmail from './LogInWithEmail';

const SignIn = () => {
  // Warm up the android browser to improve UX
  // https://docs.expo.dev/guides/authentication/#improving-user-experience
  useWarmUpBrowser();

  return (
    <KeyboardAwareScrollView
      showsVerticalScrollIndicator={false}
      extraHeight={140}
      className="flex flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <SafeAreaView />
      <View className="mx-2">
        <Text className="my-10 text-center text-2xl font-bold">Bem vindo Highliner!</Text>
        <View className="mt-2 flex" style={{ rowGap: 8 }}>
          <LogInWithGoogle />
          <LogInWithApple />
        </View>
        <View className="mt-3 flex flex-row items-center" style={{ columnGap: 15 }}>
          <View className="h-[1px] flex-1 bg-gray-400" />
          <Text className="text-gray-400">ou</Text>
          <View className="h-[1px] flex-1 bg-gray-400" />
        </View>
        <LogInWithEmail />
      </View>
    </KeyboardAwareScrollView>
  );
};

export default SignIn;
