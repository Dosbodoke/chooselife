import { zodResolver } from '@hookform/resolvers/zod';
import Mapbox from '@rnmapbox/maps';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Position } from 'geojson';
import i18next from 'i18next';
import React, { memo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Dimensions, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { useAuth } from '~/context/auth';
import { Highline, highlineKeyFactory } from '~/hooks/use-highline';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { supabase } from '~/lib/supabase';
import { cn } from '~/lib/utils';
import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE } from '~/utils/constants';
import { requestReview } from '~/utils/request-review';

import SuccessAnimation from '~/components/animations/success-animation';
import {
  haversineDistance,
  positionToPostGISPoint,
} from '~/components/map/utils';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Text } from '~/components/ui/text';
import { Textarea } from '~/components/ui/textarea';
import { H1 } from '~/components/ui/typography';

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
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
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
            uri: supabase.storage
              .from('images')
              .getPublicUrl(highline.cover_image).data.publicUrl,
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
        cover_image: highline ? highline.cover_image : '',
        anchor_a_long: highline ? highline.anchor_a_long : anchorA[0],
        anchor_a_lat: highline ? highline.anchor_a_lat : anchorA[1],
        anchor_b_long: highline ? highline.anchor_b_long : anchorB[0],
        anchor_b_lat: highline ? highline.anchor_b_lat : anchorB[1],
        is_favorite: highline ? highline.is_favorite : false,
        status: highline ? highline.status : 'unrigged',
        created_at: highline ? highline.created_at : new Date().toISOString(),
        sector_id: highline ? highline.sector_id : 0,
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
      let imageID: string | null = highline?.cover_image || null;
      let shouldDeleteExisting = false;

      // Upload new image if provided (converted to base64)
      if (formData.image && formData.image.base64 && formData.image.mimeType) {
        // If there is already an image for this highline and the user is uploading a new one,
        if (imageID) shouldDeleteExisting = true;
        const extension = formData.image.mimeType.split('/')[1];
        imageID = `${uuidv4()}.${extension}`;
        const { error } = await supabase.storage
          .from('images')
          .upload(imageID, decode(formData.image.base64), {
            contentType: formData.image.mimeType,
          });
        if (error) throw new Error("Couldn't upload the image");
      }

      // Update Highline
      if (highline?.id) {
        // Delete old image
        if (highline.cover_image && shouldDeleteExisting) {
          await supabase.storage.from('images').remove([highline.cover_image!]);
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
        throw new Error('Error when creating the highline');
      }

      return { newHighlineID: newHighline.id };
    },
    onSuccess: async ({ newHighlineID }) => {
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
    onError: (_, _newHighlineID, context) => {
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
              <Input
                value={field.value}
                onChangeText={field.onChange}
                label={t('components.map.register-modal.name.label')}
                className={fieldState.error && 'border-destructive'}
              />
            )}
          />

          <Controller
            control={highlineForm.control}
            name="height"
            render={({ field, fieldState }) => (
              <Input
                value={field.value.toString()}
                onChangeText={(text) => field.onChange(+text || 0)}
                label={t('components.map.register-modal.height.label')}
                keyboardType="number-pad"
                className={fieldState.error && 'border-destructive'}
              />
            )}
          />

          <Controller
            control={highlineForm.control}
            name="length"
            render={({ field, fieldState }) => (
              <Input
                value={field.value.toString()}
                onChangeText={(text) => field.onChange(+text || 0)}
                label={t('components.map.register-modal.length.label')}
                contextMenuHidden={true}
                editable={false}
                keyboardType="number-pad"
                className={fieldState.error && 'border-destructive'}
              />
            )}
          />

          <Controller
            control={highlineForm.control}
            name="description"
            render={({ field, fieldState }) => (
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
                label={t('components.map.register-modal.description.label')}
                className={fieldState.error && 'border-destructive'}
              />
            )}
          />

          <Controller
            control={highlineForm.control}
            name="image"
            render={({ field, fieldState }) => (
              <View className="w-full">
                <HighlineImageUploader
                  value={field.value}
                  onChange={field.onChange}
                  hasError={!!fieldState.error}
                />
                {fieldState.error && (
                  <Text className="text-destructive text-sm mt-1">
                    {fieldState.error.message}
                  </Text>
                )}
              </View>
            )}
          />

          <Button
            onPress={highlineForm.handleSubmit(
              handleValidForm,
              handleInvalidForm,
            )}
            disabled={mutation.isPending}
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

const SuccessMessage: React.FC<{ id: string; isUpdate: boolean }> = ({
  id,
  isUpdate,
}) => {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View className="h-full w-full justify-center items-center gap-8">
      <View>
        <H1 className="text-center">
          {t('components.map.register-modal.success.title')}
        </H1>
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
              <LucideIcon name="X" className="text-white size-4" />
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
                <LucideIcon
                  name="Upload"
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
      <LucideIcon name="MapPin" className="size-9 text-black fill-red-500" />
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
