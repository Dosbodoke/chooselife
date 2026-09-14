import DateTimePicker from '@expo/ui/community/datetime-picker';
import i18next from 'i18next';
import React from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

/** Parse YYYY-MM-DD as a UTC calendar date (avoids local TZ day shifts). */
function parseDateOnly(value: string): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject impossible calendar dates (e.g. 2024-02-31 rolls over).
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Format a Date as YYYY-MM-DD in UTC. */
function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** UTC calendar "today" at midnight — safe for max-date bounds with timeZoneName="UTC". */
function utcToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** Keep selection inside [min, max] so SwiftUI DatePicker never throws. */
function clampDate(date: Date, min?: Date, max?: Date): Date {
  let next = date;
  if (min && next.getTime() < min.getTime()) next = min;
  if (max && next.getTime() > max.getTime()) next = max;
  return next;
}

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
  const parsed = value ? parseDateOnly(value) : null;
  const displayValue = parsed
    ? parsed.toLocaleDateString(locale, { timeZone: 'UTC' })
    : '';

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

/** Modal date picker so the native control is not clipped by sheets/scroll views. */
const DatePickerModal: React.FC<{
  value: Date;
  maximumDate?: Date;
  minimumDate?: Date;
  locale?: string;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
}> = ({
  value,
  maximumDate,
  minimumDate,
  locale = 'pt-BR',
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Mounted only while open, so draft starts from the current form value.
  const [draftDate, setDraftDate] = React.useState(() =>
    clampDate(value, minimumDate, maximumDate),
  );

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      // Cover floating overlays (e.g. Tools FAB) that sit above normal sheets.
      presentationStyle={
        Platform.OS === 'ios' ? 'overFullScreen' : undefined
      }
      onRequestClose={onCancel}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          className="flex-1"
          onPress={onCancel}
        />
        <View
          className="rounded-t-2xl bg-background px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <View className="mb-2 flex-row items-center justify-between">
            <Pressable
              onPress={onCancel}
              hitSlop={12}
              className="px-2 py-2 active:opacity-60"
            >
              <Text className="text-base text-muted-foreground">
                {t('common.cancel')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                onConfirm(clampDate(draftDate, minimumDate, maximumDate))
              }
              hitSlop={12}
              className="px-2 py-2 active:opacity-60"
            >
              <Text className="text-base font-semibold text-primary">
                {t('common.confirm')}
              </Text>
            </Pressable>
          </View>

          <View className="w-full items-center overflow-hidden">
            <DateTimePicker
              mode="date"
              locale={locale}
              display="spinner"
              // Always inline inside our modal — Android "dialog" would stack a second surface.
              presentation="inline"
              value={draftDate}
              maximumDate={maximumDate}
              minimumDate={minimumDate}
              timeZoneName="UTC"
              style={styles.picker}
              onValueChange={(_event, selectedDate) => {
                if (selectedDate && !Number.isNaN(selectedDate.getTime())) {
                  setDraftDate(
                    clampDate(selectedDate, minimumDate, maximumDate),
                  );
                }
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  picker: {
    width: '100%',
    alignSelf: 'center',
    minHeight: 216,
  },
});

export const ProfileInfoForm: React.FC<{
  form: UseFormReturn<ProfileInfoSchema>;
  layout?: 'onboarding' | 'sheet';
}> = ({ form, layout = 'onboarding' }) => {
  const { t } = useTranslation();
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const isSheetLayout = layout === 'sheet';
  const birthdayValue = form.watch('birthday');
  // Empty string is a valid RHF default — never pass it to the native picker.
  const maxDate = utcToday();
  const pickerValue = clampDate(
    parseDateOnly(birthdayValue || date18YearsAgo()) ??
      parseDateOnly(date18YearsAgo())!,
    undefined,
    maxDate,
  );

  const handleDateConfirm = (date: Date) => {
    form.setValue('birthday', formatDateOnly(clampDate(date, undefined, maxDate)));
    setShowDatePicker(false);
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
          <DateInput
            value={value}
            onPress={() => setShowDatePicker(true)}
            label={t('app.setProfile.ProfileInfoForm.birthdayLabel')}
            placeholder={t('app.setProfile.ProfileInfoForm.selectDate')}
            error={error?.message}
            optional
          />
        )}
      />

      {showDatePicker && (
        <DatePickerModal
          value={pickerValue}
          maximumDate={maxDate}
          locale="pt-BR"
          onCancel={() => setShowDatePicker(false)}
          onConfirm={handleDateConfirm}
        />
      )}

      <Controller
        control={form.control}
        name="description"
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
};
