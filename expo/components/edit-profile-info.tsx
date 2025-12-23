import i18next from 'i18next';
import React from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, TextInput, View } from 'react-native';
import DatePicker from 'react-native-date-picker';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { z } from 'zod';

import { useI18n } from '~/context/i18n';
import { cn } from '~/lib/utils';
import { date18YearsAgo } from '~/utils';

import { Text } from '~/components/ui/text';
import { Textarea } from '~/components/ui/textarea';

import { AvatarUploader, SupabaseAvatar } from './supabase-avatar';

export const profileInfoSchema = z.object({
  name: z.string().min(1, i18next.t('app.setProfile.errors.nameRequired')),
  profilePicture: z.string().optional(),
  description: z.string().optional(),
  birthday: z.string().optional(),
});
export type ProfileInfoSchema = z.infer<typeof profileInfoSchema>;

// Custom DateInput component for better UX
const DateInput: React.FC<{
  value?: string;
  onPress: () => void;
  placeholder: string;
  label: string;
  error?: string;
  optional?: boolean;
}> = ({ value, onPress, placeholder, label, error, optional }) => {
  const { t } = useTranslation();
  const { locale } = useI18n();
  const displayValue = value ? new Date(value).toLocaleDateString(locale) : '';

  return (
    <View className="w-full gap-2">
      <View className="flex-row items-center">
        <Text className="text-sm font-medium text-foreground">{label}</Text>
        {optional && <Text variant="muted">{t('common.optional')}</Text>}
      </View>

      <Pressable
        onPress={onPress}
        className={cn(
          'border rounded-md px-3 py-3 bg-background min-h-[44px] justify-center',
          error ? 'border-red-500' : 'border-border',
          'active:bg-muted/50', // Visual feedback on press
        )}
      >
        <Text
          className={cn(
            'text-base',
            displayValue ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {displayValue || placeholder}
        </Text>
      </Pressable>

      {error && (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <Text className="text-red-500 text-sm mt-1">{error}</Text>
        </Animated.View>
      )}
    </View>
  );
};

export const ProfileInfoForm: React.FC<{
  form: UseFormReturn<ProfileInfoSchema>;
}> = ({ form }) => {
  const { t } = useTranslation();
  const [showDatePicker, setShowDatePicker] = React.useState(false);

  const handleDateChange = (date: Date) => {
    setShowDatePicker(false);
    if (date) {
      form.setValue('birthday', date.toISOString().split('T')[0]); // YYYY-MM-DD format
    }
  };

  return (
    <View className="justify-center items-center gap-4 w-full">
      <Controller
        control={form.control}
        name="profilePicture"
        render={({ field: { value, onChange } }) => (
          <View className="relative w-full items-center mb-6">
            <View className="relative overflow-hidden size-32">
              <SupabaseAvatar URL={value} />
            </View>
            <View className="absolute bottom-0 translate-y-1/2 left-0 right-0 items-center">
              <AvatarUploader onUpload={onChange} className="shadow p-[1px]" />
            </View>
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
              returnKeyType="done"
              className={cn(
                error?.message ? 'border-red-500' : 'border-muted-foreground',
                'text-lg text-foreground border-b-hairline pb-1 min-w-48',
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
        render={({ field: { value }, fieldState: { error } }) => (
          <>
            <DateInput
              value={value}
              onPress={() => setShowDatePicker(true)}
              label={t('app.setProfile.ProfileInfoForm.birthdayLabel')}
              placeholder={t('app.setProfile.ProfileInfoForm.selectDate')}
              error={error?.message}
              optional
            />
            <DatePicker
              modal
              open={showDatePicker}
              mode="date"
              locale="pt-BR"
              date={value ? new Date(value) : new Date(date18YearsAgo())}
              maximumDate={new Date()}
              onConfirm={(date) => {
                setShowDatePicker(false);
                handleDateChange(date);
              }}
              onCancel={() => {
                setShowDatePicker(false);
              }}
              timeZoneOffsetInMinutes={0} // https://github.com/henninghall/react-native-date-picker/issues/841
            />
          </>
        )}
      />

      <Controller
        control={form.control}
        name="description"
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <Textarea
            value={value}
            keyboardType="default"
            returnKeyType="done"
            placeholder={t(
              'app.setProfile.ProfileInfoForm.descriptionPlaceholder',
            )}
            submitBehavior="blurAndSubmit"
            className={cn('w-full', error && 'border-destructive')}
            onSubmitEditing={() => Keyboard.dismiss()}
            onChangeText={onChange}
          />
        )}
      />
    </View>
  );
};
