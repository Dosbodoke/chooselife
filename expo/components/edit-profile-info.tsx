import i18next from 'i18next';
import React from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
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
      <View className="flex-row items-center gap-1">
        <Text className="text-sm font-medium text-foreground">{label}</Text>
        {optional && (
          <Text className="text-sm text-muted-foreground">
            {t('common.optional')}
          </Text>
        )}
      </View>

      <Pressable
        onPress={onPress}
        className={cn(
          'border rounded-md px-3 py-3 bg-background min-h-11 justify-center',
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
  layout?: 'onboarding' | 'sheet';
}> = ({ form, layout = 'onboarding' }) => {
  const { t } = useTranslation();
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const isSheetLayout = layout === 'sheet';

  const handleDateChange = (date: Date) => {
    setShowDatePicker(false);
    if (date) {
      form.setValue('birthday', date.toISOString().split('T')[0]); // YYYY-MM-DD format
    }
  };

  return (
    <View className="w-full gap-4 items-start">
      <Controller
        control={form.control}
        name="profilePicture"
        render={({ field: { value, onChange } }) => (
          <View className="w-full flex-row items-center gap-4">
            <View
              className={cn(
                'relative overflow-hidden rounded-full',
                isSheetLayout ? 'size-20' : 'size-24',
              )}
            >
              <SupabaseAvatar URL={value} />
            </View>
            <AvatarUploader
              onUpload={onChange}
              className={cn('px-4 py-2', !isSheetLayout && 'shadow')}
            />
          </View>
        )}
      />

      <Controller
        control={form.control}
        name="name"
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <View className="w-full items-start">
            <TextInput
              value={value}
              onChangeText={onChange}
              placeholder={t(
                'app.setProfile.ProfileInfoForm.inputPlaceholderName',
              )}
              returnKeyType="done"
              style={{
                fontSize: isSheetLayout ? 20 : 24,
                borderBottomWidth: StyleSheet.hairlineWidth,
              }}
              className={cn(
                error?.message ? 'border-red-500' : 'border-muted-foreground',
                'text-foreground pb-2 w-full text-left',
              )}
            />
            {error && (
              <Animated.View entering={FadeIn} exiting={FadeOut}>
                <Text className="text-red-500 text-left">{error.message}</Text>
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
