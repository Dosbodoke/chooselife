import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import i18next from 'i18next';
import React from 'react';
import { Controller, FieldErrors, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Keyboard, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { z } from 'zod';

import { useAuth } from '~/context/auth';
import { supabase } from '~/lib/supabase';
import { transformTimeStringToSeconds } from '~/utils';

import SuccessAnimation from '~/components/animations/success-animation';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import NumberPicker from '~/components/ui/number-picker';
import { Text } from '~/components/ui/text';
import { Textarea } from '~/components/ui/textarea';
import { H1, Muted, Small } from '~/components/ui/typography';

const formSchema = z.object({
  cadenas: z.number().nonnegative(),
  full_lines: z.number().nonnegative(),
  distance: z.coerce
    .number({
      required_error: i18next.t(
        'app.highline.register.fields.distance.errors.required',
      ),
      invalid_type_error: i18next.t(
        'app.highline.register.fields.distance.errors.invalid_type',
      ),
    })
    .positive(
      i18next.t('app.highline.register.fields.distance.errors.positive'),
    ),
  time: z
    .string()
    .optional()
    .refine(
      (value) =>
        value === undefined ||
        value === '' ||
        /^([0-9]|[0-5][0-9]):[0-5][0-9]$/.test(value),
      i18next.t('app.highline.register.fields.time.errors.invalid_format'),
    ),
  witness: z
    .string()
    .refine(
      (w) => /^(?=.*@[^,\s]+,.*@[^,\s]+).*$/.test(w),
      i18next.t('app.highline.register.fields.witness.errors.invalid_format'),
    ),
  comment: z.string(),
});

type FormSchema = z.infer<typeof formSchema>;

const RegisterHighline = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  if (!profile) {
    router.push('/(modals)/login');
  }

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cadenas: 0,
      full_lines: 0,
      distance: 0,
      time: '',
      witness: '',
      comment: '',
    },
  });

  const formMutation = useMutation({
    mutationFn: async (formData: FormSchema) => {
      if (!id) throw new Error('No highline ID provided');
      if (!profile?.username) throw new Error("User doesn't have a profile");
      const response = await supabase.from('entry').insert({
        highline_id: id,
        instagram: profile.username,
        cadenas: formData.cadenas,
        full_lines: formData.full_lines,
        distance_walked: formData.distance,
        crossing_time: formData.time
          ? transformTimeStringToSeconds(formData.time)
          : null,
        comment: formData.comment,
        witness: formData.witness?.replace(' ', '').split(','),
        is_highliner: true, // TODO: Remove this field from database
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entry'] });
    },
  });

  function onValid(data: FormSchema) {
    formMutation.mutate(data);
  }

  function onInvalid(errors: FieldErrors<FormSchema>) {
    console.log({ errors });
  }

  return (
    <KeyboardAwareScrollView
      contentContainerClassName="gap-4 p-4 pb-8"
      keyboardShouldPersistTaps="handled"
    >
      {formMutation.isSuccess ? (
        <View className="items-center gap-8">
          <View>
            <H1 className="text-center">
              {t('app.highline.register.success.title')}
            </H1>
            <Text className="text-3xl text-center">
              {t('app.highline.register.success.subtitle')}
            </Text>
          </View>
          <View className="h-52 items-center justify-center">
            <SuccessAnimation />
          </View>
          <Text className="text-center w-3/4">
            {t('app.highline.register.success.message')}
          </Text>
          <Link
            href={{
              pathname: '/highline/[id]',
              params: { id: id },
            }}
            replace
            asChild
          >
            <Button>
              <Text>{t('app.highline.register.success.button')}</Text>
            </Button>
          </Link>
        </View>
      ) : (
        <>
          <Controller
            control={form.control}
            name="cadenas"
            render={({ field }) => (
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Label nativeID="entry-cadenas">
                    {t('app.highline.register.fields.cadenas.label')}
                  </Label>
                  <Muted>
                    {t('app.highline.register.fields.cadenas.description')}
                  </Muted>
                </View>
                <NumberPicker value={field.value} onChange={field.onChange} />
              </View>
            )}
          />

          <Controller
            control={form.control}
            name="full_lines"
            render={({ field }) => (
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Label nativeID="entry-full_lines">
                    {t('app.highline.register.fields.full_lines.label')}
                  </Label>
                  <Muted>
                    {t('app.highline.register.fields.full_lines.description')}
                  </Muted>
                </View>
                <NumberPicker value={field.value} onChange={field.onChange} />
              </View>
            )}
          />

          <Controller
            control={form.control}
            name="distance"
            render={({ field, fieldState }) => (
              <View className="gap-2">
                <View>
                  <Label nativeID="entry-distance">
                    {t('app.highline.register.fields.distance.label')}
                  </Label>
                  <Muted>
                    {t('app.highline.register.fields.distance.description')}
                  </Muted>
                </View>
                <Input
                  aria-labelledby="entry-distance"
                  keyboardType="number-pad"
                  className={fieldState.error && 'border-destructive'}
                  onChangeText={(text) => field.onChange(+text || 0)}
                  value={field.value?.toString()}
                />
                {fieldState.error ? (
                  <Small className="text-destructive">
                    {fieldState.error.message}
                  </Small>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={form.control}
            name="time"
            render={({ field, fieldState }) => (
              <View className="gap-2">
                <View>
                  <Label nativeID="entry-time">
                    {t('app.highline.register.fields.time.label')}{' '}
                    <Muted>
                      {t('app.highline.register.fields.time.optional')}
                    </Muted>
                  </Label>
                  <Muted>
                    {t('app.highline.register.fields.time.description')}
                  </Muted>
                </View>
                <Input
                  placeholder={t(
                    'app.highline.register.fields.time.placeholder',
                  )}
                  aria-labelledby="entry-time"
                  keyboardType="numbers-and-punctuation"
                  className={fieldState.error && 'border-destructive'}
                  onChangeText={field.onChange}
                  value={field.value}
                />
                {fieldState.error ? (
                  <Small className="text-destructive">
                    {fieldState.error.message}
                  </Small>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={form.control}
            name="witness"
            render={({ field, fieldState }) => (
              <View className="gap-2">
                <View>
                  <Label nativeID="entry-witness">
                    {t('app.highline.register.fields.witness.label')}
                  </Label>
                  <Muted>
                    {t('app.highline.register.fields.witness.description')}
                  </Muted>
                </View>
                <Input
                  placeholder={t(
                    'app.highline.register.fields.witness.placeholder',
                  )}
                  aria-labelledby="entry-witness"
                  className={fieldState.error && 'border-destructive'}
                  onChangeText={field.onChange}
                  value={field.value}
                />
                {fieldState.error ? (
                  <Small className="text-destructive">
                    {fieldState.error.message}
                  </Small>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={form.control}
            name="comment"
            render={({ field, fieldState }) => (
              <View className="gap-2">
                <Label nativeID="entry-comment">
                  {t('app.highline.register.fields.comment.label')}
                  <Muted>
                    {t('app.highline.register.fields.comment.optional')}
                  </Muted>
                </Label>
                <Textarea
                  keyboardType="default"
                  returnKeyType="done"
                  placeholder={t(
                    'app.highline.register.fields.comment.placeholder',
                  )}
                  aria-labelledby="entry-comment"
                  className={fieldState.error && 'border-destructive'}
                  onChangeText={field.onChange}
                  value={field.value}
                  submitBehavior="blurAndSubmit"
                  onSubmitEditing={() => {
                    Keyboard.dismiss();
                  }}
                />
                {fieldState.error ? (
                  <Small className="text-destructive">
                    {fieldState.error.message}
                  </Small>
                ) : null}
              </View>
            )}
          />

          <Button
            onPress={form.handleSubmit(onValid, onInvalid)}
            disabled={formMutation.isPending}
          >
            <Text>
              {formMutation.isPending
                ? t('app.highline.register.buttons.submit.loading')
                : t('app.highline.register.buttons.submit.default')}
            </Text>
          </Button>
        </>
      )}
    </KeyboardAwareScrollView>
  );
};

export default RegisterHighline;
