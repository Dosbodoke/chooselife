import { zodResolver } from '@hookform/resolvers/zod';
import { PostgrestError } from '@supabase/supabase-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Controller, useForm, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Keyboard, TextInput, TouchableOpacity, View } from 'react-native';
import DatePicker from 'react-native-date-picker';
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

import { LanguageSwitcher } from '~/components/language-switcher';
import { OnboardNavigator, OnboardPaginator } from '~/components/onboard';
import { AvatarUploader, SupabaseAvatar } from '~/components/supabase-avatar';
import { Input } from '~/components/ui/input';
import { Text } from '~/components/ui/text';
import { Textarea } from '~/components/ui/textarea';
import { H2, H3, Muted } from '~/components/ui/typography';

// Define TypeScript type based on Zod schema
type ProfileFormData = {
  username: string;
  name: string;
  profilePicture?: string;
  description?: string;
  birthday?: string;
};

export default function SetProfile() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const colorSchema = useColorScheme();
  const router = useRouter();
  const { session, profile } = useAuth();
  const [isValidating, setIsValidating] = useState(false);
  const [index, setIndex] = useState(0);

  // Create Zod schema using translation strings for error messages.
  const profileSchema = useMemo(
    () =>
      z.object({
        username: z
          .string()
          .trim()
          .min(3, t('app.setProfile.errors.usernameValidation')),
        name: z.string().min(1, t('app.setProfile.errors.nameRequired')),
        profilePicture: z.string().optional(),
        description: z.string().optional(),
        birthday: z.string().optional(),
      }),
    [t],
  );

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

      // Check if the username is available
      if (error && error.code !== 'PGRST116') {
        console.log('ERROR VALIDATING');
        console.error('Error checking username:', error);
        form.setError('username', {
          message: t('app.setProfile.errors.usernameCheckError'),
        });
        return false;
      } else if (data) {
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
    <ProfileInfoForm key="profileInfo" form={form} />,
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
                  'text-foreground placeholder:text-muted-foreground border-b-hairline',
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

const ProfileInfoForm = ({
  form,
}: {
  form: UseFormReturn<ProfileFormData>;
}) => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const date18YearsAgo = new Date();
  date18YearsAgo.setFullYear(date18YearsAgo.getFullYear() - 18);

  const handleDateChange = (date: Date) => {
    setShowDatePicker(false);
    if (date) {
      form.setValue('birthday', date.toISOString().split('T')[0]); // YYYY-MM-DD format
    }
  };

  return (
    <View className="gap-4">
      <View>
        <H3 className="text-center">
          {t('app.setProfile.ProfileInfoForm.title')}
        </H3>
        <Muted className="text-center">
          {t('app.setProfile.ProfileInfoForm.subtitle')}
        </Muted>
      </View>

      <View className="gap-4">
        <Controller
          control={form.control}
          name="profilePicture"
          render={({ field: { value, onChange } }) => (
            <View className="flex-row gap-4 items-end">
              <SupabaseAvatar size={16} URL={value} />
              <AvatarUploader onUpload={onChange} />
            </View>
          )}
        />

        <Controller
          control={form.control}
          name="name"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <View>
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder={t(
                  'app.setProfile.ProfileInfoForm.inputPlaceholderName',
                )}
                autoCapitalize="none"
                returnKeyType="done"
                className={cn(
                  error?.message ? 'border-red-500' : 'border-muted-foreground',
                  'text-foreground placeholder:text-muted-foreground border-b-hairline',
                )}
              />
              {error && (
                <Animated.View entering={FadeIn} exiting={FadeOut}>
                  <Text className="text-red-500">{error.message}</Text>
                </Animated.View>
              )}
            </View>
          )}
        />

        <Controller
          control={form.control}
          name="birthday"
          render={({ field: { value } }) => (
            <View className="gap-2">
              <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                <Input
                  label={t('app.setProfile.ProfileInfoForm.birthdayLabel')}
                  editable={false}
                  value={
                    value
                      ? new Date(value).toLocaleDateString('pt-BR')
                      : t('app.setProfile.ProfileInfoForm.selectDate')
                  }
                  placeholder={t('app.setProfile.ProfileInfoForm.selectDate')}
                />
              </TouchableOpacity>
              <DatePicker
                modal
                open={showDatePicker}
                mode="date"
                locale="pt-BR"
                date={value ? new Date(value) : date18YearsAgo}
                maximumDate={new Date()}
                onConfirm={(date) => {
                  setShowDatePicker(false);
                  handleDateChange(date);
                }}
                onCancel={() => {
                  setShowDatePicker(false);
                }}
                timeZoneOffsetInMinutes={0} // https://github.com/henninghall/react-native-date-picker/issues/841
                theme={colorScheme.colorScheme}
              />
            </View>
          )}
        />

        <Controller
          control={form.control}
          name="description"
          render={({ field: { onChange }, fieldState: { error } }) => (
            <Textarea
              keyboardType="default"
              returnKeyType="done"
              placeholder={t(
                'app.setProfile.ProfileInfoForm.descriptionPlaceholder',
              )}
              submitBehavior="blurAndSubmit"
              className={error && 'border-destructive'}
              onSubmitEditing={() => Keyboard.dismiss()}
              onChangeText={onChange}
            />
          )}
        />
      </View>
    </View>
  );
};
