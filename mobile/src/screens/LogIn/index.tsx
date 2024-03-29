import { View, SafeAreaView, Text, StatusBar } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import { LogInScreenProps } from '@src/navigation/types';
import { useWarmUpBrowser } from '@src/hooks/useWarmUpBrowser';
import { ChooselifeSvg } from '@src/assets';

import LogInWithGoogle from './LogInWithGoogle';
import LogInWithApple from './LogInWithApple';
import LogInWithEmail from './LogInWithEmail';

const LogIn = ({ navigation }: LogInScreenProps) => {
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
        <View className="my-10 mx-auto h-44 w-44">
          <ChooselifeSvg />
        </View>
        <View className="mt-2 flex" style={{ rowGap: 8 }}>
          <LogInWithGoogle />
          <LogInWithApple />
        </View>
        <View className="my-5 flex flex-row items-center" style={{ columnGap: 15 }}>
          <View className="h-[1px] flex-1 bg-gray-400" />
          <Text className="text-gray-400">OU CONTINUE COM</Text>
          <View className="h-[1px] flex-1 bg-gray-400" />
        </View>
        <LogInWithEmail navigation={navigation} />
      </View>
    </KeyboardAwareScrollView>
  );
};

export default LogIn;
