import { Host, TextInput, useNativeState } from '@expo/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { PostgrestError } from '@supabase/supabase-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import i18next from 'i18next';
import React, { useState } from 'react';
import { useController, useForm, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  FadeIn,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
} from 'react-native-reanimated';
import { z } from 'zod';

import { useAuth } from '~/context/auth';
import { type Profile } from '~/hooks/use-profile';
import { supabase } from '~/lib/supabase';
import { cn } from '~/lib/utils';

import {
  ProfileInfoForm,
  profileInfoSchema,
  type ProfileInfoSchema,
} from '~/components/edit-profile-info';
import { LanguageSwitcher } from '~/components/language-switcher';
import { OnboardHeader, OnboardNavigator } from '~/components/onboard';
import { SafeAreaView } from '~/components/styled';
import { Text } from '~/components/ui/text';

const usernameRegex = /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{3,30}$/;

const normalizeUsernameInput = (value: string) =>
  value.trim().replace(/^@+/, '').toLowerCase();

const toStoredUsername = (value: string) => `@${normalizeUsernameInput(value)}`;

const profileSchema = profileInfoSchema.extend({
  username: z
    .string()
    .transform(normalizeUsernameInput)
    .refine((value) => usernameRegex.test(value), {
      message: i18next.t('app.setProfile.errors.usernameValidation'),
    }),
});
type ProfileFormData = z.infer<typeof profileSchema>;

export default function SetProfile() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { session, profile } = useAuth();
  const [isValidating, setIsValidating] = useState(false);
  const [index, setIndex] = useState(0);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues: {
      username: '',
      name: profile?.name || '',
      profilePicture: profile?.profile_picture || undefined,
      description: profile?.description || '',
      birthday: profile?.birthday || '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      if (!session) throw Error('No session found');
      const { data: profileData, error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          username: toStoredUsername(data.username),
          name: data.name,
          profile_picture: data.profilePicture,
          description: data.description,
          birthday: data.birthday || null,
        })
        .select()
        .single();

      if (upsertError) {
        throw upsertError;
      }
      return profileData;
    },
    onSuccess: (profileData: Profile) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.setQueryData<Profile>(
        ['profile', profileData.id],
        profileData,
      );
      router.replace('/(tabs)');
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.log({ error });
      if ((error as PostgrestError).code === '23505') {
        form.setError('username', {
          message: t('app.setProfile.errors.usernameTaken'),
        });
      } else {
        form.setError('root', {
          message: t('app.setProfile.errors.saveProfile'),
        });
      }
    },
  });

  const validateUsername = async () => {
    try {
      setIsValidating(true);
      const valid = await form.trigger('username');
      if (!valid) return false;

      const username = toStoredUsername(form.getValues('username'));
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .maybeSingle();

      if (error) {
        console.error('Error checking username:', error);
        form.setError('username', {
          message: t('app.setProfile.errors.usernameCheckError'),
        });
        return false;
      }

      if (data) {
        form.clearErrors('username');
        form.setError('username', {
          message: t('app.setProfile.errors.usernameTaken'),
        });
        return false;
      }

      form.clearErrors('username');
      return true;
    } finally {
      setIsValidating(false);
    }
  };

  const steps = [
    <LanguageStep key="language" />,
    <UsernameStep key="username" form={form} />,
    <ProfileInfoStep key="profileInfo" form={form} />,
  ];

  const handleNextStep = async (newStep: number) => {
    // Move back
    if (newStep >= 0 && newStep < index) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIndex((prevIndex) => prevIndex - 1);
      return;
    }

    // Validate the username in the first step
    if (index === 1) {
      const isUsernameValid = await validateUsername();
      if (!isUsernameValid) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
    }

    // Manually trigger the validation of a required field
    if (index === 2) {
      const validName = await form.trigger('name');
      if (!validName) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
    }

    // Move forward
    if (index < steps.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIndex((prevIndex) => prevIndex + 1);
    }
  };

  return (
    <SafeAreaView className="flex-1 min-h-screen bg-background">
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <OnboardHeader
          total={steps.length}
          selectedIndex={index}
          onBack={index > 0 ? () => handleNextStep(index - 1) : undefined}
        />
        <Animated.View
          key={`step-${index}`}
          entering={FadeInRight}
          exiting={FadeOutLeft}
        >
          {steps[index]}
        </Animated.View>

        <View className="mt-auto gap-4">
          <OnboardNavigator
            total={steps.length}
            selectedIndex={index}
            onIndexChange={handleNextStep}
            onFinish={form.handleSubmit((data) => mutation.mutate(data))}
            isLoading={mutation.isPending || isValidating}
            showBack={false}
          />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const StepHeader = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) => (
  <View>
    <Text variant="h3" className="text-left">
      {title}
    </Text>
    <Text variant="muted" className="text-left">
      {subtitle}
    </Text>
  </View>
);

const LanguageStep = () => {
  const { t } = useTranslation();

  return (
    <View className="gap-4">
      <StepHeader
        title={t('app.setProfile.LanguageStep.title')}
        subtitle={t('app.setProfile.LanguageStep.subtitle')}
      />
      <LanguageSwitcher />
    </View>
  );
};

const UsernameStep = ({ form }: { form: UseFormReturn<ProfileFormData> }) => {
  const { t } = useTranslation();

  return (
    <View className="gap-4">
      <StepHeader
        title={t('app.setProfile.UsernameForm.title')}
        subtitle={t('app.setProfile.UsernameForm.subtitle')}
      />

      <UsernameInput form={form} />
    </View>
  );
};

const ProfileInfoStep = ({
  form,
}: {
  form: UseFormReturn<ProfileFormData>;
}) => {
  const { t } = useTranslation();

  return (
    <View className="gap-4">
      <StepHeader
        title={t('app.setProfile.ProfileInfoForm.title')}
        subtitle={t('app.setProfile.ProfileInfoForm.subtitle')}
      />
      <ProfileInfoForm
        // @ts-expect-error Info form doesn't have username
        form={form as UseFormReturn<ProfileInfoSchema>}
        layout="onboarding"
      />
    </View>
  );
};

const UsernameInput = ({ form }: { form: UseFormReturn<ProfileFormData> }) => {
  const { t } = useTranslation();
  const {
    field: { value, onChange, onBlur },
    fieldState: { error },
  } = useController({
    control: form.control,
    name: 'username',
  });
  const inputValue = useNativeState(value ?? '');

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-start gap-2 my-4">
        <Text className="text-muted-foreground font-semibold text-4xl">@</Text>
        <View
          className={cn(
            error?.message ? 'border-red-500' : 'border-muted-foreground',
            'min-w-0 flex-1 border-b-hairline',
          )}
        >
          <Host matchContents={{ vertical: true }}>
            <TextInput
              value={inputValue}
              onChangeText={(text) => {
                const normalizedValue = normalizeUsernameInput(text);
                inputValue.value = normalizedValue;
                onChange(normalizedValue);
              }}
              onBlur={onBlur}
              placeholder={t('app.setProfile.UsernameForm.inputPlaceholder')}
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              style={{
                paddingBottom: 8,
                paddingTop: 4,
              }}
              textStyle={{
                fontSize: 32,
                fontWeight: '400',
                lineHeight: 38,
              }}
            />
          </Host>
        </View>
      </View>
      {error && (
        <Animated.View entering={FadeIn} exiting={FadeOut} className="mb-4">
          <Text className="text-red-500 text-left">{error.message}</Text>
        </Animated.View>
      )}
    </View>
  );
};
