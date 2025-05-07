import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, View } from 'react-native';
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

import { useAuth, type LoginMethod, type OAuthMethod } from '~/context/auth';
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

const _layoutTransition = LinearTransition.springify()
  .damping(80)
  .stiffness(200);
const AnimatedButton = Animated.createAnimatedComponent(Button);
const AnimatedText = Animated.createAnimatedComponent(Text);

const Page = () => {
  return (
    <SafeAreaView className="flex-1">
      <KeyboardAwareScrollView
        contentContainerClassName="px-6 pt-3 pb-8 gap-4"
        keyboardShouldPersistTaps="handled"
      >
        <LogoSection />
        <View>
          <OAuthButtons />
          <MethodSeparator />
          <EmailSection />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const LogoSection = () => {
  const { t } = useTranslation();
  return (
    <View className="items-center gap-2 pt-8">
      <ChooselifeIcon width={96} height={96} className="fill-foreground" />
      <Text className="text-center">
        {t('app.(modals).login.logoSubtitle')}
      </Text>
    </View>
  );
};

const OAuthButtons: React.FC = () => {
  const { t } = useTranslation();
  const { redirect_to } = useLocalSearchParams<{ redirect_to?: string }>();
  const { performOAuth, lastLoginMethod, isLoginPending } = useAuth();
  const { colorScheme } = useColorScheme();

  const handleLogin = async (method: OAuthMethod) => {
    await performOAuth({ method, redirectTo: redirect_to });
  };

  return (
    <View className="gap-2">
      {lastLoginMethod ? (
        <View className="flex-row items-center gap-2 justify-center">
          <GreenDot />
          <Text className="text-sm text-muted-foreground">
            {t('app.(modals).login.oauth.lastUsed')}
          </Text>
        </View>
      ) : null}

      {Platform.OS === 'ios' ? (
        <Button
          onPress={() => handleLogin('apple')}
          variant="outline"
          disabled={isLoginPending}
          className="flex-row gap-3 items-center"
        >
          <View className="h-6 w-6">
            <AppleIcon fill={colorScheme === 'dark' ? '#FFFFFF' : '#000000'} />
          </View>
          <Text className="text-primary">
            {t('app.(modals).login.oauth.continueApple')}
          </Text>
          {lastLoginMethod === 'apple' ? <GreenDot pulse /> : null}
        </Button>
      ) : null}
      <Button
        onPress={() => handleLogin('google')}
        variant="outline"
        disabled={isLoginPending}
        className="relative flex-row gap-3 items-center"
      >
        <View className="h-6 w-6">
          <GoogleIcon />
        </View>
        <Text className="text-primary">
          {t('app.(modals).login.oauth.continueGoogle')}
        </Text>
        {lastLoginMethod === 'google' ? <GreenDot pulse /> : null}
      </Button>
    </View>
  );
};

type AuthTabs = 'login' | 'signup';
const EmailSection: React.FC = () => {
  const { t } = useTranslation();
  const { redirect_to } = useLocalSearchParams<{ redirect_to?: string }>();
  const { signUp, login, lastLoginMethod, isLoginPending } = useAuth();
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
        tabLabel: t('app.(modals).login.email.tabLogin'),
      },
      {
        id: 'signup',
        tabLabel: t('app.(modals).login.email.tabSignup'),
      },
    ],
    [t],
  );

  const handleLogin = async () => {
    try {
      setLoading(true);
      if (z.string().email().safeParse(email).success === false) {
        setError(t('app.(modals).login.email.invalidEmail'));
        return;
      }
      const response = await login({
        email,
        password,
        redirectTo: redirect_to,
      });
      if (!response.success) {
        setError(response.errorMessage || '');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await signUp({
        email,
        password,
        confirmPassword,
        redirectTo: redirect_to,
      });
      if (!response.success) {
        setError(
          response.errorMessage || t('app.(modals).login.email.signupFailed'),
        );
      }
    } finally {
      setLoading(false);
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
                placeholder={t('app.(modals).login.email.emailPlaceholder')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                aria-labelledby="inputLabel"
                aria-errormessage="inputError"
              />
              <PasswordInput
                id="password"
                placeholder={t('app.(modals).login.email.passwordPlaceholder')}
                value={password}
                onChangeText={setPassword}
              />
            </>
          ) : (
            <>
              <Input
                placeholder={t('app.(modals).login.email.emailPlaceholder')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                aria-labelledby="inputLabel"
                aria-errormessage="inputError"
              />
              <PasswordInput
                id="password"
                placeholder={t('app.(modals).login.email.passwordPlaceholder')}
                value={password}
                onChangeText={setPassword}
              />
              <PasswordInput
                id="confirm-password"
                placeholder={t(
                  'app.(modals).login.email.confirmPasswordPlaceholder',
                )}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </>
          )}
        </View>
      </Tabs>

      {error && (
        <Animated.View
          layout={_layoutTransition}
          entering={FadeInDown.springify().damping(80).stiffness(200)}
          exiting={FadeOutUp.springify().damping(80).stiffness(200)}
        >
          <Text className="text-red-500 text-center">{error}</Text>
        </Animated.View>
      )}

      <AnimatedAuthButton
        onPress={tab === 'login' ? handleLogin : handleSignup}
        label={
          tab === 'login'
            ? t('app.(modals).login.email.loginButton')
            : t('app.(modals).login.email.signupButton')
        }
        lastLoginMethod={lastLoginMethod}
        isLoading={loading}
        disabled={isLoginPending}
      />
    </View>
  );
};

const MethodSeparator = () => {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-3 my-6">
      <Separator className="flex-1" />
      <Text className="text-sm text-muted-foreground">
        {t('app.(modals).login.separator')}
      </Text>
      <Separator className="flex-1" />
    </View>
  );
};

const AnimatedAuthButton: React.FC<{
  isLoading: boolean;
  onPress: () => void;
  label: string;
  lastLoginMethod?: LoginMethod | null;
  disabled?: boolean;
}> = ({ isLoading, onPress, label, lastLoginMethod, disabled }) => {
  const { t } = useTranslation();
  return (
    <AnimatedButton
      className="flex-1"
      variant="default"
      onPress={onPress}
      disabled={disabled || isLoading}
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
      {label === t('app.(modals).login.email.loginButton') &&
      lastLoginMethod === 'email' ? (
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
      -1,
      false,
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
            width: 8, // Equivalent to Tailwind's "w-2"
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
