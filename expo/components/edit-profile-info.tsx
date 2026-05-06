import DateTimePicker from '@expo/ui/datetimepicker';
import i18next from 'i18next';
import React from 'react';
import { Controller, type Path, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { z } from 'zod';

import { useI18n } from '~/context/i18n';
import { cn } from '~/lib/utils';

import { Text } from '~/components/ui/text';
import { Textarea } from '~/components/ui/textarea';

import { AvatarUploader, SupabaseAvatar } from './supabase-avatar';

function isIsoBirthday(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isCalendarDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isFutureDate(year: number, month: number, day: number) {
  const today = new Date();

  return (
    Date.UTC(year, month - 1, day) >
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  );
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function formatDateForStorage(date: Date) {
  const year =
    Platform.OS === 'android' ? date.getUTCFullYear() : date.getFullYear();
  const month =
    Platform.OS === 'android' ? date.getUTCMonth() + 1 : date.getMonth() + 1;
  const day = Platform.OS === 'android' ? date.getUTCDate() : date.getDate();

  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

function dateFromIso(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (Platform.OS === 'android') {
    return new Date(Date.UTC(year, month - 1, day));
  }
  return new Date(year, month - 1, day, 12);
}

function getDefaultBirthdayDate() {
  const today = new Date();
  return new Date(
    today.getFullYear() - 18,
    today.getMonth(),
    today.getDate(),
    12,
  );
}

function isValidBirthdayValue(value?: string) {
  if (!value) return true;
  if (!isIsoBirthday(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  return isCalendarDate(year, month, day) && !isFutureDate(year, month, day);
}

const birthdayRequiredMessage = i18next.t(
  'app.setProfile.errors.birthdayRequired',
);
const birthdayValidationMessage = i18next.t(
  'app.setProfile.errors.birthdayValidation',
);

const optionalBirthdaySchema = z
  .string()
  .optional()
  .refine((value) => !value || isValidBirthdayValue(value), {
    message: birthdayValidationMessage,
  });

export const optionalProfileInfoSchema = z.object({
  name: z.string().min(1, i18next.t('app.setProfile.errors.nameRequired')),
  profilePicture: z.string().optional(),
  description: z.string().optional(),
  birthday: optionalBirthdaySchema,
});

export const profileInfoSchema = optionalProfileInfoSchema.extend({
  birthday: z
    .string({
      required_error: birthdayRequiredMessage,
      invalid_type_error: birthdayRequiredMessage,
    })
    .min(1, birthdayRequiredMessage)
    .refine((value) => isValidBirthdayValue(value), {
      message: birthdayValidationMessage,
    }),
});

export type OptionalProfileInfoSchema = z.infer<
  typeof optionalProfileInfoSchema
>;
export type ProfileInfoSchema = z.infer<typeof profileInfoSchema>;

const BirthdayInput: React.FC<{
  value?: string;
  onChange: (value: string) => void;
  label: string;
  error?: string;
  layout?: 'onboarding' | 'sheet';
}> = ({ value, onChange, label, error, layout = 'onboarding' }) => {
  const { locale } = useI18n();
  const isSheetLayout = layout === 'sheet';
  const pickerDate =
    value && isIsoBirthday(value)
      ? dateFromIso(value)
      : getDefaultBirthdayDate();

  return (
    <View className="w-full gap-2">
      <Text className="text-sm font-medium text-foreground">{label}</Text>

      <View className={cn('overflow-hidden', isSheetLayout ? 'py-1' : 'py-2')}>
        <DateTimePicker
          value={pickerDate}
          onValueChange={(_, selectedDate) => {
            onChange(formatDateForStorage(selectedDate));
          }}
          mode="date"
          display={Platform.OS === 'android' ? 'default' : 'spinner'}
          presentation="inline"
          maximumDate={new Date()}
          locale={locale === 'pt' ? 'pt_BR' : 'en_US'}
          timeZoneName={Intl.DateTimeFormat().resolvedOptions().timeZone}
          style={{ width: '100%' }}
        />
      </View>

      {error && (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <Text className="text-red-500 text-sm mt-1">{error}</Text>
        </Animated.View>
      )}
    </View>
  );
};

type ProfileInfoFormValues = OptionalProfileInfoSchema;

type ProfileInfoFormProps<TFormValues extends ProfileInfoFormValues> = {
  form: UseFormReturn<TFormValues>;
  layout?: 'onboarding' | 'sheet';
};

export function ProfileInfoForm<TFormValues extends ProfileInfoFormValues>({
  form,
  layout = 'onboarding',
}: ProfileInfoFormProps<TFormValues>) {
  const { t } = useTranslation();
  const isSheetLayout = layout === 'sheet';

  return (
    <View className="w-full gap-4 items-start">
      <Controller
        control={form.control}
        name={'profilePicture' as Path<TFormValues>}
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
        name={'name' as Path<TFormValues>}
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
        name={'birthday' as Path<TFormValues>}
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <BirthdayInput
            value={value}
            onChange={onChange}
            label={t('app.setProfile.ProfileInfoForm.birthdayLabel')}
            error={error?.message}
            layout={layout}
          />
        )}
      />

      <Controller
        control={form.control}
        name={'description' as Path<TFormValues>}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <Textarea
            value={value}
            keyboardType="default"
            placeholder={t(
              'app.setProfile.ProfileInfoForm.descriptionPlaceholder',
            )}
            // Keep Enter as newline for multiline text instead of submitting.
            submitBehavior="newline"
            className={cn('w-full', error && 'border-destructive')}
            onChangeText={onChange}
          />
        )}
      />
    </View>
  );
}
