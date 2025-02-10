import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from 'expo-sqlite/kv-store';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  interpolate,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { useAuth } from '~/context/auth';
import { AppleIcon } from '~/lib/icons/Apple';
import ChooselifeIcon from '~/lib/icons/chooselife-icon';
import { GoogleIcon } from '~/lib/icons/Google';
import { useColorScheme } from '~/lib/useColorScheme';
import { cn } from '~/lib/utils';

import { Button, buttonTextVariants } from '~/components/ui/button';
import { Input, PasswordInput } from '~/components/ui/input';
import { Separator } from '~/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Text } from '~/components/ui/text';

type LastUsedLoginMethod = 'apple' | 'google' | 'email';

const _layoutTransition = LinearTransition.springify()
  .damping(80)
  .stiffness(200);
const AnimatedButton = Animated.createAnimatedComponent(Button);
const AnimatedText = Animated.createAnimatedComponent(Text);

const Page = () => {
  const [lastLoginMethod, setLastLoginMethod] =
    useState<LastUsedLoginMethod | null>(null);

  const saveLoginMethod = async (method: LastUsedLoginMethod) => {
    try {
      await AsyncStorage.setItem('lastLoginMethod', method);
    } catch (error) {
      console.error('Failed to save the login method:', error);
    }
  };

  const loadLastLoginMethod = async () => {
    try {
      const method = await AsyncStorage.getItem('lastLoginMethod');
      setLastLoginMethod(method as LastUsedLoginMethod);
    } catch (error) {
      console.error('Failed to load the login method:', error);
    }
  };

  useEffect(() => {
    loadLastLoginMethod();
  }, []);

  return (
    <SafeAreaView className="flex-1">
      <KeyboardAwareScrollView
        contentContainerClassName="px-6 pt-3 pb-8 gap-4"
        keyboardShouldPersistTaps="handled"
      >
        <LogoSection />
        <View>
          <OAuthButtons
            lastLoginMethod={lastLoginMethod}
            saveLoginMethod={saveLoginMethod}
          />
          <MethodSeparator />
          <EmailSection
            lastLoginMethod={lastLoginMethod}
            saveLoginMethod={saveLoginMethod}
          />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const LogoSection = () => {
  return (
    <View className="items-center gap-2 pt-8">
      <ChooselifeIcon width={96} height={96} className="fill-foreground" />
      <Text className="text-center">
        O único aplicativo feito para Highliners
      </Text>
    </View>
  );
};

const OAuthButtons = ({
  lastLoginMethod,
  saveLoginMethod,
}: {
  lastLoginMethod: LastUsedLoginMethod | null;
  saveLoginMethod: (method: LastUsedLoginMethod) => Promise<void>;
}) => {
  const { redirect_to } = useLocalSearchParams<{ redirect_to?: string }>();
  const { performOAuth } = useAuth();
  const router = useRouter();
  const { colorScheme } = useColorScheme();

  const handleLogin = async (method: 'apple' | 'google') => {
    const { success } = await performOAuth(method);
    if (success) {
      await saveLoginMethod(method);
      if (redirect_to) {
        // TODO: Make a route path validarot
        // @ts-expect-error redirect_to can't be typed as it's a search parameter
        router.replace(redirect_to);
        return;
      }
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    }
  };

  return (
    <View className="gap-2">
      {lastLoginMethod ? (
        <View className="flex-row items-center gap-2 justify-center">
          <GreenDot />
          <Text className="text-sm text-muted-foreground">
            Utilizado por último
          </Text>
        </View>
      ) : null}

      <Button
        onPress={() => handleLogin('apple')}
        variant="outline"
        className="flex-row gap-3 items-center"
      >
        <View className="h-6 w-6">
          <AppleIcon fill={colorScheme === 'dark' ? '#FFFFFF' : '#000000'} />
        </View>
        <Text className="text-primary">Continuar com Apple</Text>
        {lastLoginMethod === 'apple' ? <GreenDot pulse /> : null}
      </Button>
      <Button
        onPress={() => handleLogin('google')}
        variant="outline"
        className="relative flex-row gap-3 items-center"
      >
        <View className="h-6 w-6">
          <GoogleIcon />
        </View>
        <Text className="text-primary">Continuar com Google</Text>
        {lastLoginMethod === 'google' ? <GreenDot pulse /> : null}
      </Button>
    </View>
  );
};

type AuthTabs = 'login' | 'signup';

const EmailSection: React.FC<{
  lastLoginMethod: LastUsedLoginMethod | null;
  saveLoginMethod: (method: LastUsedLoginMethod) => Promise<void>;
}> = ({ lastLoginMethod, saveLoginMethod }) => {
  const { redirect_to } = useLocalSearchParams<{ redirect_to?: string }>();
  const router = useRouter();
  const { signUp, login } = useAuth();
  const [tab, setTab] = useState<AuthTabs>('login');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const tabs = useMemo(
    () => [
      {
        id: 'login',
        tabLabel: 'Entrar com email',
      },
      {
        id: 'signup',
        tabLabel: 'Criar conta',
      },
    ],
    [lastLoginMethod],
  );

  const handleLogin = async () => {
    try {
      setLoading(true);
      if (z.string().email().safeParse(email).success === false) {
        setError('Email invalido');
        return;
      }
      const response = await login(email, password);

      if (response.success) {
        await saveLoginMethod('email');

        if (redirect_to) {
          // @ts-expect-error redirect_to search param
          router.replace(redirect_to);
          return;
        }
        router.back();
      } else {
        setError(response.errorMessage || '');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (z.string().email().safeParse(email).success === false) {
      setError('Email invalido');
      return;
    }
    if (password !== confirmPassword) {
      setError('Senhas não são iguais.');
      return;
    }
    const response = await signUp(email, password);
    if (response.success) {
      if (redirect_to) {
        // @ts-expect-error redirect_to search parameter
        router.replace(redirect_to);
        return;
      }
      router.back();
    } else {
      setError(
        response.errorMessage || 'Falha ao criar conta, contate o suporte',
      );
    }
  };

  return (
    <View className="gap-4">
      <Tabs
        className="flex-1"
        value={tab}
        onValueChange={(val) => setTab(val as AuthTabs)}
      >
        <TabsList className="flex-row">
          {tabs.map((tabItem) => (
            <TabsTrigger
              key={tabItem.id}
              className="rounded-lg flex-1"
              value={tabItem.id as AuthTabs}
            >
              <Text>{tabItem.tabLabel}</Text>
            </TabsTrigger>
          ))}
        </TabsList>
        <View className="mt-6 gap-2">
          {tab === 'login' ? (
            <>
              <Input
                placeholder="Seu email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                aria-labelledby="inputLabel"
                aria-errormessage="inputError"
              />
              <PasswordInput
                id="password"
                placeholder="Sua senha"
                value={password}
                onChangeText={setPassword}
              />
            </>
          ) : (
            <>
              <Input
                placeholder="Seu email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                aria-labelledby="inputLabel"
                aria-errormessage="inputError"
              />
              <PasswordInput
                id="password"
                placeholder="Sua senha"
                value={password}
                onChangeText={setPassword}
              />
              <PasswordInput
                id="confirm-password"
                placeholder="Confirmar senha"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </>
          )}
        </View>
      </Tabs>

      <AnimatedAuthButton
        isLoading={loading}
        onPress={tab === 'login' ? handleLogin : handleSignup}
        label={tab === 'login' ? 'Entrar' : 'Criar'}
        lastLoginMethod={lastLoginMethod}
      />

      {error && (
        <Animated.View
          layout={_layoutTransition}
          entering={FadeInDown.springify().damping(80).stiffness(200)}
          exiting={FadeOutUp.springify().damping(80).stiffness(200)}
        >
          <Text className="text-red-500 text-center">{error}</Text>
        </Animated.View>
      )}
    </View>
  );
};

const MethodSeparator = () => {
  return (
    <View className="flex-row items-center gap-3 my-6">
      <Separator className="flex-1" />
      <Text className="text-sm text-muted-foreground">ou</Text>
      <Separator className="flex-1" />
    </View>
  );
};

const AnimatedAuthButton: React.FC<{
  isLoading: boolean;
  onPress: () => void;
  label: 'Entrar' | 'Criar';
  lastLoginMethod?: LastUsedLoginMethod | null;
}> = ({ isLoading, onPress, label, lastLoginMethod }) => {
  return (
    <AnimatedButton
      className="flex-1"
      variant="default"
      onPress={onPress}
      disabled={isLoading}
      layout={_layoutTransition}
    >
      {isLoading ? (
        <Animated.View
          entering={FadeInDown.springify().damping(80).stiffness(200)}
          exiting={FadeOutUp.springify().damping(80).stiffness(200)}
        >
          <ActivityIndicator
            className={cn(buttonTextVariants({ variant: 'default' }))}
          />
        </Animated.View>
      ) : (
        <AnimatedText
          key={label}
          className={cn(buttonTextVariants({ variant: 'default' }))}
          entering={FadeInDown.springify().damping(80).stiffness(200)}
          exiting={FadeOutUp.springify().damping(80).stiffness(200)}
        >
          {label}
        </AnimatedText>
      )}
      {label === 'Entrar' && lastLoginMethod === 'email' ? (
        <GreenDot pulse />
      ) : null}
    </AnimatedButton>
  );
};

const GreenDot: React.FC<{ pulse?: boolean }> = ({ pulse }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // -1 indicates infinite repeats.
      false, // No reverse needed since we want a one-way animation.
    );
  }, [progress]);

  const pulseStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [1, 2]);
    const opacity = interpolate(progress.value, [0, 1], [1, 0]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  if (!pulse) {
    return <View className="w-2 h-2 rounded-full bg-green-500" />;
  }

  return (
    <View className="absolute right-4 top-1/2 translate-y-1/2 items-center justify-center">
      {/* The animated pulse layer */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 8, // Equivalent to Tailwind's "w-2" (assuming 1 unit = 4px)
            height: 8, // Equivalent to Tailwind's "h-2"
            borderRadius: 4, // Fully rounded circle
            backgroundColor: '#22C55E', // Tailwind's "bg-green-500"
          },
          pulseStyle,
        ]}
      />

      {/* The static central green dot */}
      <View className="w-2 h-2 rounded-full bg-green-500" />
    </View>
  );
};

export default Page;
