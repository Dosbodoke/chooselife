import i18next from 'i18next';
import React from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Keyboard, TextInput, View } from 'react-native';
import DatePicker from 'react-native-date-picker';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { z } from 'zod';

import { cn } from '~/lib/utils';
import { date18YearsAgo } from '~/utils';

import { Input } from '~/components/ui/input';
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
            <View className="overflow-hidden size-32">
              <SupabaseAvatar profileID={value} />
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
            <Input
              onPress={() => setShowDatePicker(true)}
              label={t('app.setProfile.ProfileInfoForm.birthdayLabel')}
              editable={false}
              value={value ? new Date(value).toLocaleDateString('pt-BR') : ''}
              className={cn(
                'border border-input bg-background text-foreground w-full',
                error?.message ? 'border-red-500' : 'border-border',
              )}
              placeholderClassName="text-muted-foreground"
              placeholder={t('app.setProfile.ProfileInfoForm.selectDate')}
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
