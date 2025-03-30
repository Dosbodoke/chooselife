import { zodResolver } from '@hookform/resolvers/zod';
import { PostgrestError } from '@supabase/supabase-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import i18next from 'i18next';
import React, { useState } from 'react';
import { Controller, useForm, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  FadeIn,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { useAuth } from '~/context/auth';
import { type Profile } from '~/hooks/use-profile';
import HighlineIllustration from '~/lib/icons/highline-illustration';
import { supabase } from '~/lib/supabase';
import { useColorScheme } from '~/lib/useColorScheme';
import { cn } from '~/lib/utils';
import { date18YearsAgo } from '~/utils';

import {
  ProfileInfoForm,
  profileInfoSchema,
  type ProfileInfoSchema,
} from '~/components/edit-profile-info';
import { LanguageSwitcher } from '~/components/language-switcher';
import { OnboardNavigator, OnboardPaginator } from '~/components/onboard';
import { Text } from '~/components/ui/text';
import { H2, H3, Muted } from '~/components/ui/typography';

const profileSchema = profileInfoSchema.extend({
  username: z
    .string()
    .trim()
    .min(3, i18next.t('app.setProfile.errors.usernameValidation')),
});
type ProfileFormData = z.infer<typeof profileSchema>;

export default function SetProfile() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const colorSchema = useColorScheme();
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
      birthday: profile?.birthday || date18YearsAgo(),
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      if (!session) throw Error('No session found');
      const { data: profileData, error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          username: `@${data.username}`,
          name: data.name,
          profile_picture: data.profilePicture,
          description: data.description,
          birthday: data.birthday,
        })
        .select()
        .single();

      if (upsertError) {
        throw upsertError;
      }
      return profileData;
    },
    onSuccess: (profileData: Profile) => {
      queryClient.setQueryData<Profile>(
        ['profile', profileData.id],
        profileData,
      );
      router.replace('/(tabs)');
    },
    onError: (error) => {
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

      const username = form.getValues('username');
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', `@${username.trim()}`)
        .single();

      if (error) {
        // No row for username, it's free
        if (error.code === 'PGRST116') {
          form.setError('username', {
            message: t('app.setProfile.errors.usernameCheckError'),
          });
          return true;
        } else {
          console.error('Error checking username:', error);
          return false;
        }
      }

      if (data) {
        form.clearErrors('username');
        form.setError('username', {
          message: t('app.setProfile.errors.usernameTaken'),
        });
        return false;
      }

      return true;
    } finally {
      setIsValidating(false);
    }
  };

  const steps = [
    <LanguageSwitcher key="LanguageSwitcher" />,
    <UsernameForm key="username" form={form} />,
    <View key="profileInfo" className="p-4">
      <ProfileInfoForm
        // @ts-expect-error Info form doesn't have username
        form={form as UseFormReturn<ProfileInfoSchema>}
      />
    </View>,
    // <PrefferedTheme key="theme" />,
  ];

  const handleNextStep = async (newStep: number) => {
    // Move back
    if (newStep >= 0 && newStep < index) {
      setIndex((prevIndex) => prevIndex - 1);
      return;
    }

    // Validate the username in the first step
    if (index === 1) {
      const isUsernameValid = await validateUsername();
      if (!isUsernameValid) return;
    }

    // Manually trigger the validation of a required field
    if (index === 2) {
      const validName = await form.trigger('name');
      if (!validName) return;
    }

    // Move forward
    if (index < steps.length - 1) {
      setIndex((prevIndex) => prevIndex + 1);
    }
  };

  return (
    <SafeAreaView className="flex-1 min-h-screen bg-background">
      <KeyboardAwareScrollView
        contentContainerClassName="flex-1 px-6 py-8 gap-4"
        keyboardShouldPersistTaps="handled"
      >
        <H2 className="text-center border-0">{t('app.setProfile.title')}</H2>
        <HighlineIllustration
          mode={colorSchema.colorScheme}
          className="w-full h-auto"
        />

        <Animated.View
          key={`step-${index}`}
          entering={FadeInRight}
          exiting={FadeOutLeft}
        >
          {steps[index]}
        </Animated.View>

        <View className="mt-auto gap-2">
          <OnboardPaginator total={steps.length} selectedIndex={index} />

          <OnboardNavigator
            total={steps.length}
            selectedIndex={index}
            onIndexChange={handleNextStep}
            onFinish={form.handleSubmit((data) => mutation.mutate(data))}
            isLoading={mutation.isPending || isValidating}
          />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const UsernameForm = ({ form }: { form: UseFormReturn<ProfileFormData> }) => {
  const { t } = useTranslation();

  return (
    <View className="gap-4">
      <View>
        <H3 className="text-center">
          {t('app.setProfile.UsernameForm.title')}
        </H3>
        <Muted className="text-center">
          {t('app.setProfile.UsernameForm.subtitle')}
        </Muted>
      </View>

      <Controller
        control={form.control}
        name="username"
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <View className="gap-2">
            <View className="flex-row items-center justify-center gap-1 my-4">
              <Text className="text-muted-foreground font-semibold text-3xl">
                @
              </Text>
              <TextInput
                value={value}
                onChangeText={(text) => onChange(text.trim())}
                placeholder={t('app.setProfile.UsernameForm.inputPlaceholder')}
                autoCapitalize="none"
                returnKeyType="done"
                className={cn(
                  error?.message ? 'border-red-500' : 'border-muted-foreground',
                  'text-foreground border-b-hairline min-w-32',
                )}
              />
            </View>
            {error && (
              <Animated.View
                entering={FadeIn}
                exiting={FadeOut}
                className="mb-4"
              >
                <Text className="text-red-500 text-center">
                  {error.message}
                </Text>
              </Animated.View>
            )}
          </View>
        )}
      />
    </View>
  );
};
