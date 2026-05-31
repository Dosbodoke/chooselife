import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNetInfo } from '@react-native-community/netinfo';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import HighlineWalkImage from '~/assets/images/highline-walk.webp';
import { BlurView } from 'expo-blur';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { shareAsync } from 'expo-sharing';
import i18next from 'i18next';
import React, { useRef, useState } from 'react';
import { Controller, FieldErrors, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Keyboard, Platform, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { useAuth } from '~/context/auth';
import { useHighline } from '~/hooks/use-highline';
import {
  leaderboardKeys,
  type TLeaderboardType,
} from '~/hooks/use-leaderboard';
import {
  invalidateHighlineWalkLeaderboards,
  registerHighlineWalk,
  registerHighlineWalkMutationKey,
  type RegisterHighlineWalkVariables,
} from '~/features/highline/register-walk';
import { requestReview } from '~/utils/request-review';

import SuccessAnimation from '~/components/animations/success-animation';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import NumberPicker from '~/components/ui/number-picker';
import { Text } from '~/components/ui/text';
import { Textarea } from '~/components/ui/textarea';
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
    .nonnegative(
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
    mutationKey: registerHighlineWalkMutationKey,
    mutationFn: registerHighlineWalk,
    meta: {
      persistOfflineMutation: true,
    },
    onMutate: async (variables) => {
      await Promise.all([
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

      const optimisticEntry = {
        ...variables,
        id: `temp-${Date.now()}`,
      };

      return { previousData, optimisticEntry };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        const { previousData } = context;
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
      console.error('Error submitting entry:', err);
    },
    onSuccess: async (_data, variables) => {
      invalidateHighlineWalkLeaderboards(queryClient, variables.highlineId);
      await requestReview();
    },
    networkMode: 'offlineFirst',
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  function onValid(data: FormSchema) {
    if (!id) {
      return;
    }

    formMutation.mutate({
      entryId: uuidv4(),
      highlineId: id,
      formData: data,
    } satisfies RegisterHighlineWalkVariables);
  }

  function onInvalid(errors: FieldErrors<FormSchema>) {
    console.log({ errors });
  }

  const syncDistanceFromPasses = ({
    cadenas = form.getValues('cadenas'),
    fullLines = form.getValues('full_lines'),
  }: {
    cadenas?: number;
    fullLines?: number;
  }) => {
    if (!highline) return;

    const totalLeaps = cadenas + fullLines * 2;
    const totalDistance = highline.length * totalLeaps;

    form.setValue('distance', totalDistance, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const formData = form.getValues();
  const footerBottomInset = Platform.OS === 'ios' ? insets.bottom : 0;

  if (formMutation.isSuccess) {
    return <SuccessCard offline={false} data={formData} />;
  }

  if (formMutation.isPending && !isConnected) {
    return <SuccessCard offline data={formData} />;
  }

  return (
    <BottomSheetModalProvider>
      <View className="flex-1 bg-background">
        <View className="items-center px-4 pt-3 pb-2">
          <View className="h-1.5 w-10 rounded-full bg-gray-300" />
        </View>

        <KeyboardAwareScrollView
          contentContainerClassName="px-4 pb-6"
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: 8,
          }}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
        >
          <View className="gap-4">
            <Controller
              control={form.control}
              name="username"
              render={({ field, fieldState }) => (
                <View className="gap-2">
                  <View>
                    <Label nativeID="username">
                      {t('app.highline.register.fields.instagram.label')}
                    </Label>
                    <Text variant="muted">
                      {t('app.highline.register.fields.instagram.description')}
                    </Text>
                  </View>
                  <Input
                    placeholder="@choosen"
                    aria-labelledby="username"
                    className={fieldState.error && 'border-destructive'}
                    onChangeText={field.onChange}
                    value={field.value}
                  />
                  {fieldState.error ? (
                    <Text variant="small" className="text-destructive">
                      {fieldState.error.message}
                    </Text>
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
                    <Text variant="muted">
                      {t('app.highline.register.fields.cadenas.description')}
                    </Text>
                  </View>
                  <NumberPicker
                    value={field.value}
                    onChange={(cadenas) => {
                      field.onChange(cadenas);
                      syncDistanceFromPasses({ cadenas });
                    }}
                  />
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
                    <Text variant="muted">
                      {t('app.highline.register.fields.full_lines.description')}
                    </Text>
                  </View>
                  <NumberPicker
                    value={field.value}
                    onChange={(fullLines) => {
                      field.onChange(fullLines);
                      syncDistanceFromPasses({ fullLines });
                    }}
                  />
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
                    <Text variant="muted">
                      {t('app.highline.register.fields.distance.description')}
                    </Text>
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
                    <Text variant="small" className="text-destructive">
                      {fieldState.error.message}
                    </Text>
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
                      <Text variant="muted">{t('common.optional')}</Text>
                    </Label>
                    <Text variant="muted">
                      {t('app.highline.register.fields.time.description')}
                    </Text>
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
                    <Text variant="small" className="text-destructive">
                      {fieldState.error.message}
                    </Text>
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
                      <Text variant="muted">{t('common.optional')}</Text>
                    </Label>
                    <Text variant="muted">
                      {t('app.highline.register.fields.witness.description')}
                    </Text>
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
                    <Text variant="small" className="text-destructive">
                      {fieldState.error.message}
                    </Text>
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
                    <Text variant="muted">{t('common.optional')}</Text>
                  </Label>
                  <Textarea
                    keyboardType="default"
                    returnKeyType="default"
                    placeholder={t(
                      'app.highline.register.fields.comment.placeholder',
                    )}
                    aria-labelledby="entry-comment"
                    className={fieldState.error && 'border-destructive'}
                    onChangeText={field.onChange}
                    value={field.value}
                    // Keep Enter as newline for multiline text instead of submitting.
                    submitBehavior="newline"
                    onSubmitEditing={() => {
                      Keyboard.dismiss();
                    }}
                  />
                  {fieldState.error ? (
                    <Text variant="small" className="text-destructive">
                      {fieldState.error.message}
                    </Text>
                  ) : null}
                </View>
              )}
            />
          </View>
        </KeyboardAwareScrollView>

        <View
          className="border-t border-gray-100 bg-white px-4 pt-3"
          style={{ paddingBottom: footerBottomInset + 16 }}
        >
          <Button
            className="w-full rounded-3xl"
            onPress={form.handleSubmit(onValid, onInvalid)}
            disabled={formMutation.isPending}
          >
            <Text>
              {formMutation.isPending
                ? t('app.highline.register.buttons.submit.loading')
                : t('app.highline.register.buttons.submit.default')}
            </Text>
          </Button>
        </View>
      </View>
    </BottomSheetModalProvider>
  );
}

interface SuccessCardProps {
  offline: boolean;
  data: FormSchema;
}

const SuccessCard: React.FC<SuccessCardProps> = ({ offline, data }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const shareableContentRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  const onShare = async () => {
    try {
      setIsSharing(true);
      const uri = await captureRef(shareableContentRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      await shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: t('app.highline.register.success.share_dialog_title'),
        UTI: 'public.png',
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      {/* Shareable Content */}
      <View
        ref={shareableContentRef}
        collapsable={false}
        className="absolute inset-0"
      >
        <ExpoImage
          source={HighlineWalkImage}
          style={{ position: 'absolute', top: 0, right: 0, left: 0, bottom: 0 }}
          contentFit="cover"
        />

        <View
          className="flex-1 justify-center px-6"
          style={{
            paddingTop: insets.top,
            paddingBottom: insets.bottom + 120, // Space for bottom buttons
          }}
        >
          <View className="overflow-hidden rounded-3xl border border-white/20">
            <BlurView
              intensity={Platform.OS === 'android' ? 100 : 40}
              tint="dark"
            >
              <View className="items-center p-6 gap-6">
                <View className="items-center gap-2">
                  <Text className="text-white font-bold text-3xl tracking-wider text-center">
                    {t('app.highline.register.success.title') || 'NICE SEND!'}
                  </Text>
                </View>

                <View className="h-40 w-40 items-center justify-center bg-white/10 rounded-full">
                  <SuccessAnimation />
                </View>

                <View className="flex-row w-full justify-around border-t border-white/10 pt-4">
                  <View className="items-center">
                    <Text className="text-2xl font-bold text-white">
                      {data.distance}
                      <Text className="text-base font-normal text-white/60">
                        m
                      </Text>
                    </Text>
                    <Text className="text-xs text-white/50 uppercase">
                      {t('app.highline.register.success.distance_label')}
                    </Text>
                  </View>

                  {data.time ? (
                    <View className="items-center">
                      <Text className="text-2xl font-bold text-white">
                        {data.time}
                      </Text>
                      <Text className="text-xs text-white/50 uppercase">
                        {t('app.highline.register.success.time_label')}
                      </Text>
                    </View>
                  ) : null}

                  <View className="items-center">
                    <Text className="text-2xl font-bold text-white">
                      {data.cadenas + data.full_lines > 0
                        ? data.cadenas + data.full_lines
                        : 1}
                    </Text>
                    <Text className="text-xs text-white/50 uppercase">
                      {t('app.highline.register.success.count_label')}
                    </Text>
                  </View>
                </View>

                <Text className="text-center text-white/80 leading-5 text-sm px-4">
                  {t(
                    `app.highline.register.success.${offline ? 'offlineMessage' : 'message'}`,
                  )}
                </Text>
              </View>
            </BlurView>
          </View>
        </View>
      </View>

      {/* Buttons (not part of the shared image) */}
      <View
        className="absolute bottom-0 left-0 right-0 px-6 pb-5"
        style={{ paddingBottom: insets.bottom + 20 }}
      >
        <View className="w-full gap-3">
          <Button
            className="w-full bg-white active:bg-white/90"
            onPress={() => router.back()}
          >
            <Text className="text-black font-semibold">
              {t('app.highline.register.success.button')}
            </Text>
          </Button>

          <Button
            variant="outline"
            className="w-full border-white/20 active:bg-white/10 bg-transparent"
            onPress={onShare}
            disabled={isSharing}
          >
            {isSharing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-white font-semibold">
                {t('app.highline.register.success.share_button')}
              </Text>
            )}
          </Button>
        </View>
      </View>
    </View>
  );
};
