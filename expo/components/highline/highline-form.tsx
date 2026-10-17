import { zodResolver } from '@hookform/resolvers/zod';
import Mapbox from '@rnmapbox/maps';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  isPhotoFileError,
  PhotoError,
  photoProgress,
  preparePhotoUpload,
  type LocalPhoto,
} from '~/features/photos/photo-file';
import { PHOTO_SPECS } from '~/features/photos/pick-photo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Position } from 'geojson';
import i18next from 'i18next';
import { MapPinIcon } from 'lucide-react-native';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { useAuth } from '~/context/auth';
import { Highline, highlineKeyFactory } from '~/hooks/use-highline';
import { supabase } from '~/lib/supabase';
import { getR2PublicUrl, uploadToR2, deleteFromR2 } from '~/lib/r2';
import { requestReview } from '~/utils/request-review';

import SuccessAnimation from '~/components/animations/success-animation';
import {
  haversineDistance,
  positionToPostGISPoint,
} from '~/components/map/utils';
import {
  PhotoCover,
  photoErrorCode,
  photoErrorMessage,
  usePhotoTransfer,
} from '~/components/photo-picker';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Text } from '~/components/ui/text';
import { Textarea } from '~/components/ui/textarea';

/** The current cover, or a newly picked photo still to be uploaded. */
type HighlineImage =
  | { kind: 'stored'; uri: string }
  | ({ kind: 'local' } & LocalPhoto);

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
  image: z.custom<HighlineImage>().nullable(),
});

type FormSchema = z.infer<typeof formSchema>;

export const HighlineForm: React.FC<{ highline?: Highline }> = ({
  highline,
}) => {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const photo = usePhotoTransfer();
  const [newHighlineUUID, setNewHighlineUUID] = React.useState<string | null>(
    null,
  );
  const params = useLocalSearchParams<{
    anchorA?: string;
    anchorB?: string;
  }>();
  // Parse the anchors from route params
  const anchorA = params.anchorA ? JSON.parse(params.anchorA) : undefined;
  const anchorB = params.anchorB ? JSON.parse(params.anchorB) : undefined;

  const highlineForm = useForm<FormSchema>({
    mode: 'onTouched',
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: highline?.name || '',
      height: highline?.height || 0,
      length:
        highline?.length ||
        Number(
          haversineDistance(
            anchorA[1],
            anchorA[0],
            anchorB[1],
            anchorB[0],
          ).toFixed(),
        ),
      description: highline?.description || '',
      image: highline?.cover_image
        ? {
            kind: 'stored',
            uri: getR2PublicUrl('images', highline.cover_image),
          }
        : null,
    },
  });

  const mutation = useMutation<
    { newHighlineID: string },
    Error,
    FormSchema,
    { previousHighlines: Highline[] | undefined }
  >({
    onMutate: async (form) => {
      await queryClient.cancelQueries({ queryKey: highlineKeyFactory.list() });
      const previousHighlines = queryClient.getQueryData<Highline[]>(
        highlineKeyFactory.list(),
      );

      const isUpdate = !!highline;
      const optimisticHighline: Highline = {
        id: highline ? highline.id : uuidv4(),
        name: form.name,
        height: form.height,
        length: form.length,
        description: form.description || '',
        whatsapp_group_url: highline ? highline.whatsapp_group_url : '',
        cover_image: highline ? highline.cover_image : '',
        anchor_a_long: highline ? highline.anchor_a_long : anchorA[0],
        anchor_a_lat: highline ? highline.anchor_a_lat : anchorA[1],
        anchor_b_long: highline ? highline.anchor_b_long : anchorB[0],
        anchor_b_lat: highline ? highline.anchor_b_lat : anchorB[1],
        is_favorite: highline ? highline.is_favorite : false,
        status: highline ? highline.status : 'unrigged',
        created_at: highline ? highline.created_at : new Date().toISOString(),
        sector_id: highline ? highline.sector_id : 0,
        // The database generates the slug on insert.
        slug: highline ? highline.slug : '',
      };

      queryClient.setQueryData<Highline[]>(highlineKeyFactory.list(), (old) =>
        isUpdate
          ? old?.map((h) =>
              h.id === optimisticHighline.id ? optimisticHighline : h,
            )
          : old
            ? [...old, optimisticHighline]
            : [optimisticHighline],
      );

      return { previousHighlines };
    },
    mutationFn: async (formData: FormSchema) => {
      // If it's a new Highline, require anchor to be defined
      if (!highline && (!anchorA || !anchorB))
        throw new Error('Anchors not defined');
      const previousImageID = highline?.cover_image || null;
      // Upload a new photo first; the old cover is only deleted once the
      // row points at the new one.
      const uploadedID =
        formData.image?.kind === 'local'
          ? await uploadCover(formData.image, photo.report)
          : null;
      const imageID = uploadedID ?? (formData.image ? previousImageID : null);
      const discardUpload = () =>
        uploadedID
          ? deleteFromR2('images', uploadedID).catch(() => undefined)
          : undefined;

      // Update Highline
      if (highline?.id) {
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
          await discardUpload();
          throw new Error('Error when updating the highline');
        }
        if (previousImageID && previousImageID !== imageID) {
          await deleteFromR2('images', previousImageID).catch(() => undefined);
        }

        return { newHighlineID: updatedHighline.id };
      }

      // Create Highline
      const { data: newHighline, error } = await supabase
        .from('highline')
        .insert([
          {
            name: formData.name.trim(),
            height: formData.height,
            length: formData.length,
            description: formData.description,
            cover_image: imageID,
            anchor_a: positionToPostGISPoint(anchorA),
            anchor_b: positionToPostGISPoint(anchorB),
          },
        ])
        .select()
        .single();

      if (error || !newHighline) {
        await discardUpload();
        throw new Error('Error when creating the highline');
      }

      return { newHighlineID: newHighline.id };
    },
    onSuccess: async ({ newHighlineID }) => {
      photo.reset();
      setNewHighlineUUID(newHighlineID);

      queryClient.invalidateQueries({
        queryKey: highlineKeyFactory.list(profile?.id),
      });
      queryClient.invalidateQueries({
        queryKey: highlineKeyFactory.detail(newHighlineID, profile?.id),
      });
      queryClient.invalidateQueries({
        queryKey: highlineKeyFactory.favorite(newHighlineID),
      });

      await requestReview();
    },
    onError: (error, _newHighlineID, context) => {
      if (error instanceof PhotoError) photo.fail(photoErrorMessage(t, error));
      else photo.reset();
      if (context?.previousHighlines) {
        queryClient.setQueryData(
          highlineKeyFactory.list(),
          context.previousHighlines,
        );
      }
    },
  });

  const handleValidForm = (data: FormSchema) => {
    mutation.mutate(data);
  };

  const handleInvalidForm = () => {
    console.log('INVALID FORM');
  };

  const submit = highlineForm.handleSubmit(handleValidForm, handleInvalidForm);
  // Retrying a photo resubmits the form; a bad file needs a different photo.
  const canRetryPhoto =
    photo.transfer.state === 'failed' &&
    !isPhotoFileError(photoErrorCode(mutation.error));

  if (newHighlineUUID) {
    return <SuccessMessage id={newHighlineUUID} isUpdate={!!highline} />;
  }

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        paddingBottom: 32 + insets.bottom + insets.top, // pb-8 === 32px
      }}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={false}
    >
      <View className="flex flex-col gap-4">
        {/* Map Card if Highline is already registered and has coordinates */}
        {highline?.anchor_a_lat ? (
          <MapCard
            anchorA={[highline.anchor_a_long, highline.anchor_a_lat]}
            anchorB={[highline.anchor_b_long, highline.anchor_b_lat]}
            canChangeLocation={false}
          />
        ) : null}

        {/* Map Card if Highline is being registered */}
        {anchorA && anchorB ? (
          <MapCard anchorA={anchorA} anchorB={anchorB} canChangeLocation />
        ) : null}

        <View className="px-2 gap-4">
          <Controller
            control={highlineForm.control}
            name="name"
            render={({ field, fieldState }) => (
              <View className="gap-2">
                <Label nativeID="name">
                  {t('components.map.register-modal.name.label')}
                </Label>
                <Input
                  value={field.value}
                  onChangeText={field.onChange}
                  className={fieldState.error && 'border-destructive'}
                  aria-labelledby="name"
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
            control={highlineForm.control}
            name="height"
            render={({ field, fieldState }) => (
              <View className="gap-2">
                <Label nativeID="height">
                  {t('components.map.register-modal.height.label')}{' '}
                  <Text variant="muted">{t('common.optional')}</Text>
                </Label>
                <Input
                  value={field.value.toString()}
                  onChangeText={(text) => field.onChange(+text || 0)}
                  keyboardType="number-pad"
                  className={fieldState.error && 'border-destructive'}
                  aria-labelledby="height"
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
            control={highlineForm.control}
            name="length"
            render={({ field, fieldState }) => (
              <View className="gap-2">
                <Label nativeID="length">
                  {t('components.map.register-modal.length.label')}
                </Label>
                <Input
                  value={field.value.toString()}
                  onChangeText={(text) => field.onChange(+text || 0)}
                  contextMenuHidden={true}
                  editable={false}
                  keyboardType="number-pad"
                  className={fieldState.error && 'border-destructive'}
                  aria-labelledby="length"
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
            control={highlineForm.control}
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
                  {...field}
                  submitBehavior="blurAndSubmit"
                  onChangeText={(text) => field.onChange(text)}
                  value={field.value}
                  className={fieldState.error && 'border-destructive'}
                  aria-labelledby="description"
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
            control={highlineForm.control}
            name="image"
            render={({ field }) => (
              <View className="gap-2">
                <Label nativeID="image">
                  {t('components.map.register-modal.image.label')}{' '}
                  <Text variant="muted">{t('common.optional')}</Text>
                </Label>
                <PhotoCover
                  spec={PHOTO_SPECS.highlineCover}
                  value={field.value}
                  onChange={(picked) => {
                    photo.reset();
                    field.onChange(
                      picked ? { kind: 'local', ...picked } : null,
                    );
                  }}
                  transfer={photo.transfer}
                  onRetry={canRetryPhoto ? submit : undefined}
                  disabled={mutation.isPending}
                  instructions={t(
                    'components.map.register-modal.image.instructions',
                  )}
                />
              </View>
            )}
          />

          <Button onPress={submit} disabled={mutation.isPending}>
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

/** Validate and upload a picked cover; returns its new key. */
async function uploadCover(
  image: LocalPhoto,
  report: ReturnType<typeof usePhotoTransfer>['report'],
) {
  report(photoProgress('preparing'));
  const { body, contentType, extension } = await preparePhotoUpload(image);
  const key = `${uuidv4()}.${extension}`;
  report(photoProgress('sending'));
  try {
    await uploadToR2('images', key, body, contentType, (sent) =>
      report(photoProgress('sending', sent)),
    );
  } catch {
    throw new PhotoError('upload-failed', 'Photo could not be uploaded');
  }
  report(photoProgress('saving'));
  return key;
}

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
