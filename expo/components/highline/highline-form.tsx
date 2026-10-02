import { zodResolver } from '@hookform/resolvers/zod';
import Mapbox from '@rnmapbox/maps';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  removeStagedHighlineImage,
  stageHighlineImage,
} from '~/features/highline-registration/image-storage';
import type {
  AnchorPosition,
  QueuedHighlineSubmission,
  RegistrationForm,
  RegistrationImage,
} from '~/features/highline-registration/state';
import { useRegistrationState } from '~/features/highline-registration/state/store';
import {
  createSubmissionIdentifiers,
  serializeSubmissionVariables,
  submitHighlineRegistrationMutationKey,
  type SerializedSubmissionVariables,
  type SubmissionResult,
} from '~/features/highline-registration/submission';
import { submitHighlineRegistrationOnline } from '~/features/highline-registration/submission-runtime';
import { decode } from 'base64-arraybuffer';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Position } from 'geojson';
import i18next from 'i18next';
import { MapPinIcon, UploadIcon, XIcon } from 'lucide-react-native';
import React, { memo } from 'react';
import {
  Controller,
  useForm,
  type Control,
  type DefaultValues,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { useAuth } from '~/context/auth';
import { useOnlineStatus } from '~/context/react-query';
import { Highline, highlineKeyFactory } from '~/hooks/use-highline';
import { useMountEffect } from '~/hooks/use-mount-effect';
import { deleteFromR2, getR2PublicUrl, uploadToR2 } from '~/lib/r2';
import { supabase } from '~/lib/supabase';
import { cn } from '~/lib/utils';
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE } from '~/utils/constants';
import { requestReview } from '~/utils/request-review';

import SuccessAnimation from '~/components/animations/success-animation';
import { haversineDistance } from '~/components/map/utils';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Text } from '~/components/ui/text';
import { Textarea } from '~/components/ui/textarea';

const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, i18next.t('components.map.register-modal.name.min')),
  height: z.coerce
    .number({
      required_error: i18next.t(
        'components.map.register-modal.height.required',
      ),
      invalid_type_error: i18next.t(
        'components.map.register-modal.height.invalid',
      ),
    })
    .positive(i18next.t('components.map.register-modal.height.positive')),
  length: z.coerce
    .number({
      required_error: i18next.t(
        'components.map.register-modal.length.required',
      ),
      invalid_type_error: i18next.t(
        'components.map.register-modal.length.invalid',
      ),
    })
    .positive(i18next.t('components.map.register-modal.length.positive')),
  description: z.string().optional(),
  image: z
    .custom<ImagePicker.ImagePickerAsset>()
    .nullable()
    .refine((file) => {
      if (!file || !file.base64) return true; // If not base64 it's an image that is already uploaded

      return file.fileSize ? file.fileSize <= MAX_FILE_SIZE : true;
    }, i18next.t('components.map.register-modal.image.maxSize'))
    .refine((file) => {
      if (!file || !file.base64) return true; // If not base64 it's an image that is already uploaded

      return file.mimeType
        ? ACCEPTED_IMAGE_TYPES.includes(file.mimeType)
        : false;
    }, i18next.t('components.map.register-modal.image.accepted')),
});

type FormSchema = z.infer<typeof formSchema>;

export const HighlineForm: React.FC<{ highline?: Highline }> = ({
  highline,
}) => {
  const { profile, session, sessionLoading } = useAuth();

  if (sessionLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  const ownerId = session?.user.id ?? profile?.id;
  if (!ownerId) return <RegistrationAuthGate />;

  return (
    <HighlineFormForOwner key={ownerId} highline={highline} ownerId={ownerId} />
  );
};

const RegistrationAuthGate: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center gap-4 px-6">
      <Text variant="h3" className="text-center">
        {t('app.(modals).register-webbing.authRequired.title')}
      </Text>
      <Button onPress={() => router.push('/(modals)/login')}>
        <Text>{t('app.(modals).register-webbing.authRequired.action')}</Text>
      </Button>
    </View>
  );
};

const HighlineFormForOwner: React.FC<{
  highline?: Highline;
  ownerId: string;
}> = ({ highline, ownerId }) => {
  const registration = useRegistrationState(ownerId);

  if (!registration.isLoaded) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <LoadedHighlineForm
      key={`${ownerId}:${highline?.id ?? 'new'}`}
      highline={highline}
      ownerId={ownerId}
      registration={registration}
    />
  );
};

type RegistrationHandle = ReturnType<typeof useRegistrationState>;

/**
 * Anchors for a new registration: the durable draft wins over the route
 * params (which only seed a draft from a legacy deep link). Edits of an
 * existing highline have no draft anchors.
 */
function useFormAnchors(
  highline: Highline | undefined,
  registration: RegistrationHandle,
) {
  const params = useLocalSearchParams<{
    anchorA?: string;
    anchorB?: string;
    draftId?: string;
  }>();
  const routeAnchorA = parseAnchorParam(params.anchorA);
  const routeAnchorB = parseAnchorParam(params.anchorB);

  if (highline) {
    return {
      draftId: params.draftId,
      routeAnchorA,
      routeAnchorB,
      activeDraft: null,
      anchorA: undefined,
      anchorB: undefined,
    };
  }

  const activeDraft = registration.state.activeDraft;
  return {
    draftId: params.draftId,
    routeAnchorA,
    routeAnchorB,
    activeDraft,
    anchorA: activeDraft?.anchorA ?? routeAnchorA,
    anchorB: activeDraft?.anchorB ?? routeAnchorB,
  };
}

function defaultFormValues({
  highline,
  draftForm,
  anchorA,
  anchorB,
}: {
  highline?: Highline;
  draftForm?: RegistrationForm | null;
  anchorA?: AnchorPosition;
  anchorB?: AnchorPosition;
}): DefaultValues<FormSchema> {
  if (highline) {
    return {
      name: highline.name ?? '',
      height: highline.height ?? 0,
      length: highline.length ?? 0,
      description: highline.description ?? '',
      image: highline.cover_image
        ? { uri: getR2PublicUrl('images', highline.cover_image) }
        : null,
    };
  }

  return {
    name: draftForm?.name ?? '',
    height: draftForm?.height ?? 0,
    length: draftForm?.length ?? anchorDistance(anchorA, anchorB),
    description: draftForm?.description ?? '',
    image: registrationImageToPicker(draftForm?.image ?? null),
  };
}

function anchorDistance(anchorA?: AnchorPosition, anchorB?: AnchorPosition) {
  if (!anchorA || !anchorB) return 0;
  return Number(
    haversineDistance(anchorA[1], anchorA[0], anchorB[1], anchorB[0]).toFixed(),
  );
}

function useHighlineUpdateMutation({
  highline,
  ownerId,
  isOnline,
  onUpdated,
}: {
  highline?: Highline;
  ownerId: string;
  isOnline: boolean;
  onUpdated: (highlineId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<
    { newHighlineID: string },
    Error,
    FormSchema,
    { previousHighlines: Highline[] | undefined }
  >({
    onMutate: async (form) => {
      if (!highline) return { previousHighlines: undefined };

      await queryClient.cancelQueries({ queryKey: highlineKeyFactory.list() });
      const previousHighlines = queryClient.getQueryData<Highline[]>(
        highlineKeyFactory.list(),
      );
      const optimisticHighline: Highline = {
        ...highline,
        name: form.name,
        height: form.height,
        length: form.length,
        description: form.description || '',
      };

      queryClient.setQueryData<Highline[]>(highlineKeyFactory.list(), (old) =>
        old?.map((item) =>
          item.id === optimisticHighline.id ? optimisticHighline : item,
        ),
      );

      return { previousHighlines };
    },
    mutationFn: async (formData: FormSchema) => {
      if (!highline?.id)
        throw new Error('Cannot update an unregistered highline');
      if (!isOnline)
        throw new Error(t('components.map.register-modal.offlineEdit'));

      let imageID: string | null = highline.cover_image || null;
      let shouldDeleteExisting = false;

      if (formData.image && formData.image.base64 && formData.image.mimeType) {
        if (imageID) shouldDeleteExisting = true;
        imageID = createImageKey(formData.image.mimeType);
        await uploadToR2(
          'images',
          imageID,
          decode(formData.image.base64),
          formData.image.mimeType,
        );
      }

      if (highline.cover_image && shouldDeleteExisting) {
        await deleteFromR2('images', highline.cover_image);
      }

      const { data: updatedHighline, error } = await supabase
        .from('highline')
        .update({
          name: formData.name.trim(),
          height: formData.height,
          length: formData.length,
          description: formData.description,
          cover_image: imageID,
        })
        .eq('id', highline.id)
        .select()
        .single();

      if (error || !updatedHighline) {
        throw new Error('Error when updating the highline');
      }

      return { newHighlineID: updatedHighline.id };
    },
    onSuccess: async ({ newHighlineID }) => {
      onUpdated(newHighlineID);
      await queryClient.invalidateQueries({
        queryKey: highlineKeyFactory.list(ownerId),
      });
      await queryClient.invalidateQueries({
        queryKey: highlineKeyFactory.detail(newHighlineID, ownerId),
      });
      await queryClient.invalidateQueries({
        queryKey: highlineKeyFactory.favorite(newHighlineID),
      });
      await requestReview();
    },
    onError: (_, _form, context) => {
      if (context?.previousHighlines) {
        queryClient.setQueryData(
          highlineKeyFactory.list(),
          context.previousHighlines,
        );
      }
    },
  });
}

/**
 * Durable, offline-first registration: the draft is written to the outbox
 * before React Query sees it, so a crash or restart can replay the exact same
 * submission.
 */
function useQueueHighlineRegistration({
  ownerId,
  store,
  draftId,
  routeAnchorA,
  routeAnchorB,
}: {
  ownerId: string;
  store: RegistrationHandle['store'];
  draftId?: string;
  routeAnchorA?: AnchorPosition;
  routeAnchorB?: AnchorPosition;
}) {
  // Cache invalidation for this key lives in the global MutationCache
  // `onSuccess` (context/react-query.tsx): it must also run for submissions
  // replayed after a restart, when no component is mounted, and only after the
  // outbox entry is acknowledged.
  // react-doctor-disable-next-line react-doctor/query-mutation-missing-invalidation
  const submissionMutation = useMutation<
    SubmissionResult,
    Error,
    SerializedSubmissionVariables
  >({
    mutationKey: submitHighlineRegistrationMutationKey,
    mutationFn: submitHighlineRegistrationOnline,
  });

  const ensureRegistrationDraft = React.useCallback(async () => {
    let state = await store.load();
    if (!state.activeDraft) {
      state = await store.dispatch({ type: 'start', draftId });
    }

    let draft = state.activeDraft;
    if (!draft) return state;

    if (!draft.anchorA && routeAnchorA && draft.stage === 'place-a') {
      state = await store.dispatch({ type: 'place-a', position: routeAnchorA });
    }
    draft = state.activeDraft;
    if (!draft) return state;
    if (
      !draft.anchorB &&
      routeAnchorB &&
      draft.anchorA &&
      draft.stage === 'place-b'
    ) {
      state = await store.dispatch({ type: 'place-b', position: routeAnchorB });
    }
    draft = state.activeDraft;
    if (draft?.anchorA && draft.anchorB && draft.stage !== 'review') {
      state = await store.dispatch({ type: 'review' });
    }
    return state;
  }, [draftId, store, routeAnchorA, routeAnchorB]);

  /** Resolves to an error message, or `null` once the submission is queued. */
  const queueRegistration = async (
    data: FormSchema,
  ): Promise<string | null> => {
    let image = data.image;
    if (image && !pickerImageId(image)) {
      const staged = await stageHighlineImage(image);
      image = registrationImageToPicker(staged);
    }

    await ensureRegistrationDraft();
    const form: RegistrationForm = {
      name: data.name,
      height: data.height,
      length: data.length,
      description: data.description ?? '',
      image: pickerToRegistrationImage(image),
    };
    await store.dispatch({ type: 'update-form', form });

    const draft = store.getState().activeDraft;
    if (!draft?.anchorA || !draft.anchorB || draft.stage !== 'review') {
      return 'Please choose both highline anchors before submitting.';
    }

    const submissionId = `submission-${draft.draftId}`;
    const seed: QueuedHighlineSubmission = {
      submissionId,
      sourceDraftId: draft.draftId,
      ownerId,
      status: 'pending',
      anchorA: draft.anchorA,
      anchorB: draft.anchorB,
      form: draft.form,
      highlineId: null,
      imageId: null,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      submittedAt: null,
      attemptCount: 0,
      lastAttemptAt: null,
      nextAttemptAt: null,
      lastError: null,
    };
    const identifiers = createSubmissionIdentifiers(seed);

    // The reducer persists these IDs as part of the queue transition. Only
    // after that write completes do we hand variables to React Query, so a
    // crash cannot leave a replay needing to invent a different key.
    await store.dispatch({
      type: 'queue',
      submissionId,
      highlineId: identifiers.highlineId,
      imageId: identifiers.imageId,
    });
    const queued = store
      .getState()
      .submissions.find((item) => item.submissionId === submissionId);
    if (!queued) {
      return 'The submission could not be saved for retry.';
    }

    submissionMutation.mutate(serializeSubmissionVariables(queued));
    return null;
  };

  return {
    ensureRegistrationDraft,
    queueRegistration,
    isPending: submissionMutation.isPending,
  };
}

/**
 * New registrations stage the picked image on device so the draft survives a
 * restart; edits keep the picker asset in memory until submit.
 */
function useDraftImageChange({
  highline,
  registration,
  persistForm,
  onError,
}: {
  highline?: Highline;
  registration: RegistrationHandle;
  persistForm: (form: Partial<RegistrationForm>) => void;
  onError: (message: string) => void;
}) {
  return React.useCallback(
    async (
      image: ImagePicker.ImagePickerAsset | null,
      onChange: (value: ImagePicker.ImagePickerAsset | null) => void,
    ) => {
      if (highline) {
        onChange(image);
        return;
      }

      const previousImage = registration.state.activeDraft?.form.image ?? null;
      if (!image) {
        onChange(null);
        void removeStagedHighlineImage(previousImage);
        persistForm({ image: null });
        return;
      }

      try {
        const staged = await stageHighlineImage(image);
        onChange(registrationImageToPicker(staged));
        await registration.store.dispatch({
          type: 'update-form',
          form: { image: staged },
        });
        if (previousImage && previousImage.localUri !== staged.localUri) {
          await removeStagedHighlineImage(previousImage);
        }
      } catch (error) {
        onError(
          error instanceof Error
            ? error.message
            : 'The selected image could not be saved on this device.',
        );
      }
    },
    [
      highline,
      onError,
      persistForm,
      registration.state.activeDraft,
      registration.store,
    ],
  );
}

const LoadedHighlineForm: React.FC<{
  highline?: Highline;
  ownerId: string;
  registration: RegistrationHandle;
}> = ({ highline, ownerId, registration }) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const [newHighlineUUID, setNewHighlineUUID] = React.useState<string | null>(
    null,
  );
  const [submissionError, setSubmissionError] = React.useState<string | null>(
    null,
  );
  const { draftId, routeAnchorA, routeAnchorB, activeDraft, anchorA, anchorB } =
    useFormAnchors(highline, registration);

  const highlineForm = useForm<FormSchema>({
    mode: 'onTouched',
    resolver: zodResolver(formSchema),
    defaultValues: defaultFormValues({
      highline,
      draftForm: activeDraft?.form,
      anchorA,
      anchorB,
    }),
  });

  const updateMutation = useHighlineUpdateMutation({
    highline,
    ownerId,
    isOnline,
    onUpdated: setNewHighlineUUID,
  });

  const { ensureRegistrationDraft, queueRegistration, isPending } =
    useQueueHighlineRegistration({
      ownerId,
      store: registration.store,
      draftId,
      routeAnchorA,
      routeAnchorB,
    });

  const persistForm = React.useCallback(
    (form: Partial<RegistrationForm>) => {
      if (highline) return;
      void registration.store.dispatch({ type: 'update-form', form });
    },
    [highline, registration.store],
  );

  const handleImageChange = useDraftImageChange({
    highline,
    registration,
    persistForm,
    onError: setSubmissionError,
  });

  useMountEffect(() => {
    if (!highline) void ensureRegistrationDraft();
  });

  const handleValidForm = async (data: FormSchema) => {
    if (highline) {
      if (!isOnline) {
        setSubmissionError(t('components.map.register-modal.offlineEdit'));
        return;
      }
      updateMutation.mutate(data);
      return;
    }

    setSubmissionError(null);
    try {
      const error = await queueRegistration(data);
      if (error) {
        setSubmissionError(error);
        return;
      }

      // The draft/outbox is durable now. Return to the live map immediately;
      // the shared registration store renders the pending line while React
      // Query retries in the background, including after a restart.
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : 'The submission could not be saved for retry.',
      );
    }
  };

  const handleInvalidForm = () => {
    setSubmissionError(null);
  };

  if (newHighlineUUID) {
    return <SuccessMessage id={newHighlineUUID} isUpdate={!!highline} />;
  }

  const isEditingOffline = Boolean(highline && !isOnline);

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        paddingBottom: 32 + insets.bottom + insets.top,
      }}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={false}
    >
      <View className="flex flex-col gap-4">
        {highline?.anchor_a_lat ? (
          <MapCard
            anchorA={[highline.anchor_a_long, highline.anchor_a_lat]}
            anchorB={[highline.anchor_b_long, highline.anchor_b_lat]}
            canChangeLocation={false}
          />
        ) : null}

        {anchorA && anchorB ? (
          <MapCard anchorA={anchorA} anchorB={anchorB} canChangeLocation />
        ) : null}

        <View className="px-2 gap-4">
          <HighlineFormFields
            control={highlineForm.control}
            persistForm={persistForm}
            onImageChange={handleImageChange}
          />

          {submissionError ? (
            <Text className="text-destructive">{submissionError}</Text>
          ) : null}

          {isEditingOffline ? (
            <Text className="text-center text-sm text-amber-700">
              {t('components.map.register-modal.offlineEdit')}
            </Text>
          ) : null}

          <Button
            onPress={highlineForm.handleSubmit(
              handleValidForm,
              handleInvalidForm,
            )}
            disabled={updateMutation.isPending || isPending || isEditingOffline}
          >
            <Text>
              {t(
                `components.map.register-modal.${highline ? 'update' : 'create'}`,
              )}
            </Text>
          </Button>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
};

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? (
    <Text variant="small" className="text-destructive">
      {message}
    </Text>
  ) : null;

const HighlineFormFields: React.FC<{
  control: Control<FormSchema>;
  persistForm: (form: Partial<RegistrationForm>) => void;
  onImageChange: (
    image: ImagePicker.ImagePickerAsset | null,
    onChange: (value: ImagePicker.ImagePickerAsset | null) => void,
  ) => Promise<void>;
}> = ({ control, persistForm, onImageChange }) => {
  const { t } = useTranslation();

  return (
    <>
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <View className="gap-2">
            <Label nativeID="name">
              {t('components.map.register-modal.name.label')}
            </Label>
            <Input
              value={field.value}
              onChangeText={(value) => {
                field.onChange(value);
                persistForm({ name: value });
              }}
              className={fieldState.error && 'border-destructive'}
              aria-labelledby="name"
            />
            <FieldError message={fieldState.error?.message} />
          </View>
        )}
      />

      <Controller
        control={control}
        name="height"
        render={({ field, fieldState }) => (
          <View className="gap-2">
            <Label nativeID="height">
              {t('components.map.register-modal.height.label')}{' '}
              <Text variant="muted">{t('common.optional')}</Text>
            </Label>
            <Input
              value={field.value.toString()}
              onChangeText={(text) => {
                const value = +text || 0;
                field.onChange(value);
                persistForm({ height: value });
              }}
              keyboardType="number-pad"
              className={fieldState.error && 'border-destructive'}
              aria-labelledby="height"
            />
            <FieldError message={fieldState.error?.message} />
          </View>
        )}
      />

      <Controller
        control={control}
        name="length"
        render={({ field, fieldState }) => (
          <View className="gap-2">
            <Label nativeID="length">
              {t('components.map.register-modal.length.label')}
            </Label>
            <Input
              value={field.value.toString()}
              onChangeText={(text) => {
                const value = +text || 0;
                field.onChange(value);
                persistForm({ length: value });
              }}
              contextMenuHidden={true}
              editable={false}
              keyboardType="number-pad"
              className={fieldState.error && 'border-destructive'}
              aria-labelledby="length"
            />
            <FieldError message={fieldState.error?.message} />
          </View>
        )}
      />

      <Controller
        control={control}
        name="description"
        render={({ field, fieldState }) => (
          <View className="gap-2">
            <Label nativeID="description">
              {t('components.map.register-modal.description.label')}{' '}
              <Text variant="muted">{t('common.optional')}</Text>
            </Label>
            <Textarea
              keyboardType="default"
              returnKeyType="done"
              placeholder={t(
                'components.map.register-modal.description.placeholder',
              )}
              submitBehavior="blurAndSubmit"
              onChangeText={(value) => {
                field.onChange(value);
                persistForm({ description: value });
              }}
              value={field.value}
              className={fieldState.error && 'border-destructive'}
              aria-labelledby="description"
            />
            <FieldError message={fieldState.error?.message} />
          </View>
        )}
      />

      <Controller
        control={control}
        name="image"
        render={({ field, fieldState }) => (
          <View className="w-full">
            <HighlineImageUploader
              value={field.value}
              onChange={(value) => void onImageChange(value, field.onChange)}
              hasError={!!fieldState.error}
            />
            {fieldState.error ? (
              <Text className="text-destructive text-sm mt-1">
                {fieldState.error.message}
              </Text>
            ) : null}
          </View>
        )}
      />
    </>
  );
};

function parseAnchorParam(
  value: string | undefined,
): AnchorPosition | undefined {
  if (!value) return undefined;

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      Array.isArray(parsed) &&
      parsed.length >= 2 &&
      typeof parsed[0] === 'number' &&
      typeof parsed[1] === 'number' &&
      Number.isFinite(parsed[0]) &&
      Number.isFinite(parsed[1])
    ) {
      return [parsed[0], parsed[1]];
    }
  } catch {
    // A malformed legacy deep link simply falls back to the durable draft.
  }

  return undefined;
}

function pickerImageId(image: ImagePicker.ImagePickerAsset): string | null {
  const value = (
    image as ImagePicker.ImagePickerAsset & {
      imageId?: unknown;
    }
  ).imageId;
  return typeof value === 'string' && value ? value : null;
}

function pickerToRegistrationImage(
  image: ImagePicker.ImagePickerAsset | null,
): RegistrationImage | null {
  if (!image) return null;

  const imageId = pickerImageId(image);
  if (!imageId) return null;

  return {
    imageId,
    localUri: image.uri,
    mimeType: image.mimeType ?? null,
    fileName: image.fileName ?? null,
    fileSize: image.fileSize ?? null,
    width: image.width ?? null,
    height: image.height ?? null,
    base64: null,
    remoteKey: null,
  };
}

function registrationImageToPicker(
  image: RegistrationImage | null,
): ImagePicker.ImagePickerAsset | null {
  if (!image) return null;

  return {
    assetId: null,
    uri: image.localUri,
    width: image.width ?? 0,
    height: image.height ?? 0,
    fileName: image.fileName ?? undefined,
    fileSize: image.fileSize ?? undefined,
    type: 'image',
    mimeType: image.mimeType ?? undefined,
    base64: undefined,
    duration: null,
    exif: null,
    pairedVideoAsset: null,
    imageId: image.imageId,
  } as ImagePicker.ImagePickerAsset;
}

function createImageKey(mimeType: string): string {
  const extension = mimeType.split('/')[1] || 'jpg';
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  const id = cryptoApi?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${id}.${extension}`;
}

const SuccessMessage: React.FC<{ id: string; isUpdate: boolean }> = ({
  id,
  isUpdate,
}) => {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View className="h-full w-full justify-center items-center gap-8">
      <View>
        <Text variant="h1" className="text-center">
          {t('components.map.register-modal.success.title')}
        </Text>
        <Text className="text-3xl text-center">
          {t('components.map.register-modal.success.subtitle')}
        </Text>
      </View>
      <View className="h-52 items-center justify-center">
        <SuccessAnimation />
      </View>
      <Text className="text-center w-3/4">
        {t(
          `components.map.register-modal.success.${isUpdate ? 'messageUpdated' : 'messageCreated'}`,
        )}
      </Text>
      <Button
        onPress={() => {
          // First navigate to the home screen to clear the stack
          router.replace('/(tabs)');

          // Then navigate to the highline details
          // Use setTimeout to ensure the first navigation completes
          setTimeout(() => {
            router.push({
              pathname: '/highline/[id]',
              params: { id: id },
            });
          }, 100);
        }}
      >
        <Text>{t('components.map.register-modal.success.button')}</Text>
      </Button>
    </View>
  );
};

const HighlineImageUploader = memo(
  ({
    value,
    onChange,
    hasError,
  }: {
    value: ImagePicker.ImagePickerAsset | null;
    onChange: (image: ImagePicker.ImagePickerAsset | null) => void;
    hasError?: boolean;
  }) => {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = React.useState(false);

    const handleImageSelection = React.useCallback(async () => {
      try {
        setIsLoading(true);
        Haptics.selectionAsync();

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.7,
          aspect: [16, 9],
          selectionLimit: 1,
          base64: true,
        });

        if (!result.canceled) {
          const selectedImage = result.assets[0];

          // Validate file size
          if (
            selectedImage.fileSize &&
            selectedImage.fileSize > MAX_FILE_SIZE
          ) {
            console.warn('File too large');
            // You might want to show an error message here
            return;
          }

          // Validate file type
          if (
            selectedImage.mimeType &&
            !ACCEPTED_IMAGE_TYPES.includes(selectedImage.mimeType)
          ) {
            console.warn('Invalid file type');
            // You might want to show an error message here
            return;
          }

          onChange(selectedImage);
        }
      } catch (error) {
        console.error('Image picker error:', error);
      } finally {
        setIsLoading(false);
      }
    }, [onChange]);

    const handleRemoveImage = React.useCallback(() => {
      Haptics.selectionAsync();
      onChange(null);
    }, [onChange]);

    return (
      <View
        className={cn(
          'flex items-center justify-center border border-border rounded-lg w-full bg-background overflow-hidden',
          hasError ? 'border-destructive' : null,
        )}
        style={{
          height: (Dimensions.get('window').width * 9) / 16, // Fixed height based on 16:9 aspect ratio
        }}
      >
        {value ? (
          <>
            <Image
              source={{ uri: (value as ImagePicker.ImagePickerAsset).uri }}
              contentFit="cover"
              alt="Image of the Highline"
              style={{ width: '100%', height: '100%' }}
              className="rounded-lg"
            />
            <TouchableOpacity
              onPress={handleRemoveImage}
              className="absolute top-2 right-2 p-2 bg-black/50 rounded-full"
            >
              <Icon as={XIcon} className="text-white size-4" />
            </TouchableOpacity>
          </>
        ) : (
          <View className="flex items-center justify-center p-4">
            <TouchableOpacity
              onPress={handleImageSelection}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <View className="p-3 items-center justify-center rounded-md bg-muted">
                <Icon
                  as={UploadIcon}
                  className="text-muted-foreground size-8"
                />
              </View>
              <Text className="text-lg text-center text-primary">
                {t('components.map.register-modal.image.label')}
              </Text>
              <Text className="text-sm text-center text-muted-foreground">
                {t('components.map.register-modal.image.instructions')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  },
);

const AnchorPin: React.FC<{
  anchor: Position;
  id: 'anchorA' | 'anchorB';
}> = ({ anchor, id }) => {
  return (
    <Mapbox.PointAnnotation
      id={id}
      coordinate={anchor}
      draggable
      anchor={{ y: 1, x: 0.5 }}
    >
      <Icon as={MapPinIcon} className="size-9 text-black fill-red-500" />
    </Mapbox.PointAnnotation>
  );
};

const LineSourceLayer: React.FC<{
  anchorA: Position;
  anchorB: Position;
}> = React.memo(({ anchorA, anchorB }) => {
  return (
    <Mapbox.ShapeSource
      id="lineSource"
      shape={{
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [anchorA, anchorB],
        },
        properties: {},
      }}
    >
      <Mapbox.LineLayer
        id="lineLayer"
        style={{
          lineWidth: 3,
          lineColor: '#000000',
          lineDasharray: [2, 2],
        }}
      />
    </Mapbox.ShapeSource>
  );
});

export const MapCard = ({
  anchorA,
  anchorB,
  canChangeLocation,
}: {
  anchorA: Position;
  anchorB: Position;
  canChangeLocation: boolean;
}) => {
  const router = useRouter();
  return (
    <View className="relative">
      <Mapbox.MapView
        scrollEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        zoomEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        style={{
          width: '100%',
          height: 200,
        }}
      >
        <Mapbox.Camera
          bounds={{
            ne: [
              Math.max(anchorA[0], anchorB[0]),
              Math.max(anchorA[1], anchorB[1]),
            ],
            sw: [
              Math.min(anchorA[0], anchorB[0]),
              Math.min(anchorA[1], anchorB[1]),
            ],
            paddingLeft: 50,
            paddingRight: 50,
            paddingTop: 100,
            paddingBottom: 50,
          }}
          animationMode="none"
          animationDuration={0}
        />

        <AnchorPin id="anchorA" anchor={anchorA} />
        <AnchorPin id="anchorB" anchor={anchorB} />

        <LineSourceLayer anchorA={anchorA} anchorB={anchorB} />
      </Mapbox.MapView>

      {canChangeLocation && (
        <View className="absolute bottom-4 w-full items-center">
          <TouchableOpacity
            className="bg-background rounded-3xl py-2 px-6 shadow-xl"
            onPress={() => {
              router.back();
            }}
          >
            <Text className="text-primary">Ajustar ancoragem</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};
