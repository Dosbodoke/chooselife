import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNetInfo } from '@react-native-community/netinfo';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import i18next from 'i18next';
import React, { useEffect } from 'react';
import { Controller, FieldErrors, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Keyboard, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { useAuth } from '~/context/auth';
import { useHighline } from '~/hooks/use-highline';
import {
  leaderboardKeys,
  type TLeaderboardType,
} from '~/hooks/use-leaderboard';
import { supabase } from '~/lib/supabase';
import { transformTimeStringToSeconds } from '~/utils';
import { requestReview } from '~/utils/request-review';

import SuccessAnimation from '~/components/animations/success-animation';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import NumberPicker from '~/components/ui/number-picker';
import { Text } from '~/components/ui/text';
import { Textarea } from '~/components/ui/textarea';
import { H1, Muted, Small } from '~/components/ui/typography';
import { UserPicker } from '~/components/user-picker';

const formSchema = z.object({
  username: z
    .string()
    .trim()
    .startsWith(
      '@',
      i18next.t(
        'app.highline.register.fields.instagram.errors.must_start_with',
      ),
    )
    .min(
      3,
      i18next.t('app.highline.register.fields.instagram.errors.min_length'),
    ),
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
  witness: z.string().array(),
  comment: z.string(),
});

type FormSchema = z.infer<typeof formSchema>;

export default function RegisterWalk() {
  const insets = useSafeAreaInsets();
  const { isConnected } = useNetInfo();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { highline } = useHighline({ id });
  const queryClient = useQueryClient();

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: profile?.username || '',
      cadenas: 0,
      full_lines: 0,
      distance: 0,
      time: '',
      witness: [],
      comment: '',
    },
  });

  const formMutation = useMutation({
    mutationFn: async (formData: FormSchema) => {
      if (!id) throw new Error('No highline ID provided');

      const response = await supabase.from('entry').insert({
        highline_id: id,
        instagram: formData.username.trim(),
        cadenas: formData.cadenas,
        full_lines: formData.full_lines,
        distance_walked: formData.distance,
        crossing_time: formData.time
          ? transformTimeStringToSeconds(formData.time)
          : null,
        comment: formData.comment,
        witness: formData.witness,
        is_highliner: true, // TODO: Remove this field from database
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches for affected leaderboards
      await Promise.all([
        // Cancel queries for all relevant leaderboard types
        queryClient.cancelQueries({
          queryKey: leaderboardKeys.list({
            type: 'cadenas',
            highlinesID: [id],
          }),
        }),
        queryClient.cancelQueries({
          queryKey: leaderboardKeys.list({
            type: 'distance',
            highlinesID: [id],
          }),
        }),
        queryClient.cancelQueries({
          queryKey: leaderboardKeys.list({
            type: 'fullLine',
            highlinesID: [id],
          }),
        }),
        queryClient.cancelQueries({
          queryKey: leaderboardKeys.list({
            type: 'speedline',
            highlinesID: [id],
          }),
        }),
      ]);

      // Snapshot the previous values for each leaderboard type
      const previousData = {
        cadenas: queryClient.getQueryData(
          leaderboardKeys.list({ type: 'cadenas', highlinesID: [id] }),
        ),
        distance: queryClient.getQueryData(
          leaderboardKeys.list({ type: 'distance', highlinesID: [id] }),
        ),
        fullLine: queryClient.getQueryData(
          leaderboardKeys.list({ type: 'fullLine', highlinesID: [id] }),
        ),
        speedline: queryClient.getQueryData(
          leaderboardKeys.list({ type: 'speedline', highlinesID: [id] }),
        ),
      };

      // Create an optimistic entry
      const optimisticEntry = {
        ...variables,
        id: `temp-${Date.now()}`, // Temporary ID to identify this entry
      };

      // Return a context object with the previous data and the optimistic entry
      return { previousData, optimisticEntry };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, roll back to the previous values
      if (context?.previousData) {
        const { previousData } = context;

        // Restore previous data for each leaderboard type
        Object.entries(previousData).forEach(([type, data]) => {
          if (data) {
            queryClient.setQueryData(
              leaderboardKeys.list({
                type: type as TLeaderboardType,
                highlinesID: [id],
              }),
              data,
            );
          }
        });
      }
      // Log the error or show a toast notification
      console.error('Error submitting entry:', err);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({
        queryKey: leaderboardKeys.list({
          type: 'cadenas',
          highlinesID: [id],
        }),
      });
      queryClient.invalidateQueries({
        queryKey: leaderboardKeys.list({
          type: 'distance',
          highlinesID: [id],
        }),
      });
      queryClient.invalidateQueries({
        queryKey: leaderboardKeys.list({
          type: 'fullLine',
          highlinesID: [id],
        }),
      });
      queryClient.invalidateQueries({
        queryKey: leaderboardKeys.list({
          type: 'speedline',
          highlinesID: [id],
        }),
      });

      await requestReview();
    },
    networkMode: 'offlineFirst', // This ensures the mutation is triggered regardless of network status
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  function onValid(data: FormSchema) {
    formMutation.mutate(data);
  }

  function onInvalid(errors: FieldErrors<FormSchema>) {
    console.log({ errors });
  }

  // When user change "cadena" or "full line" automatically increase the distance walked
  const [watchCadenas, watchFullLines] = form.watch(['cadenas', 'full_lines']);
  useEffect(() => {
    if (!highline) return;
    const totalLeaps = watchCadenas + watchFullLines * 2;
    const totalDistance = highline.length * totalLeaps;
    if (totalDistance) form.setValue('distance', totalDistance);
  }, [watchCadenas, watchFullLines, highline?.length, form]);

  return (
    <KeyboardAwareScrollView
      contentContainerClassName="gap-4 p-4"
      contentContainerStyle={{
        flexGrow: 1,
        paddingBottom: 32 + insets.bottom + insets.top, // pb-8 === 32px
      }}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={false}
    >
      {formMutation.isSuccess ? (
        <SuccessCard offline={false} />
      ) : formMutation.isPending && !isConnected ? (
        <SuccessCard offline />
      ) : (
        <BottomSheetModalProvider>
          <Controller
            control={form.control}
            name="username"
            render={({ field, fieldState }) => (
              <View className="gap-2">
                <View>
                  <Label nativeID="username">
                    {t('app.highline.register.fields.instagram.label')}
                  </Label>
                  <Muted>
                    {t('app.highline.register.fields.instagram.description')}
                  </Muted>
                </View>
                <Input
                  placeholder="@choosen"
                  aria-labelledby="username"
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
                  returnKeyType="done"
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
                    <Muted>{t('common.optional')}</Muted>
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
                    {t('app.highline.register.fields.witness.label')}{' '}
                    <Muted>{t('common.optional')}</Muted>
                  </Label>
                  <Muted>
                    {t('app.highline.register.fields.witness.description')}
                  </Muted>
                </View>
                <UserPicker
                  defaultValue={field.value}
                  onValueChange={field.onChange}
                  placeholder={t(
                    'app.highline.register.fields.witness.placeholder',
                  )}
                  canPickNonUser
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
                  {t('app.highline.register.fields.comment.label')}{' '}
                  <Muted>{t('common.optional')}</Muted>
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
        </BottomSheetModalProvider>
      )}
    </KeyboardAwareScrollView>
  );
}

const SuccessCard: React.FC<{ offline: boolean }> = ({ offline }) => {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View className="items-center gap-8">
      <View>
        <H1 className="text-center">
          {t('app.highline.register.success.title')}
        </H1>
        <Text className="text-3xl text-center">🆑 🆑 🆑 🆑 🆑</Text>
      </View>
      <View className="h-52 items-center justify-center">
        <SuccessAnimation />
      </View>
      <Text className="text-center w-3/4">
        {t(
          `app.highline.register.success.${offline ? 'offlineMessage' : 'message'}`,
        )}
      </Text>
      <Button
        onPress={() => {
          router.back();
        }}
      >
        <Text>{t('app.highline.register.success.button')}</Text>
      </Button>
    </View>
  );
};
