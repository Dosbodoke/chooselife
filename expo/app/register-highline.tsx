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
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { Highline, highlineKeyFactory } from '~/hooks/use-highline';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { supabase } from '~/lib/supabase';
import { cn } from '~/lib/utils';
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

const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6MB
const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const formSchema = z.object({
  name: z.string().min(3, i18next.t('components.map.register-modal.name.min')),
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
    .refine(
      (file) =>
        !file || (file.fileSize ? file.fileSize <= MAX_FILE_SIZE : true),
      i18next.t('components.map.register-modal.image.maxSize'), // "Tamanho máximo do arquivo é 6MB"
    )
    .refine(
      (file) =>
        !file ||
        (file.mimeType ? ACCEPTED_IMAGE_TYPES.includes(file.mimeType) : false),
      i18next.t('components.map.register-modal.image.accepted'), // "Formatos aceitos são: .jpg, .jpeg, .png e .webp"
    ),
});

type FormSchema = z.infer<typeof formSchema>;

const RegisterHighlineScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [newHighlineUUID, setNewHighlineUUID] = React.useState<string | null>(
    null,
  );
  const params = useLocalSearchParams<{
    anchorA: string;
    anchorB: string;
  }>();

  // Parse the anchors from route params
  const anchorA = JSON.parse(params.anchorA);
  const anchorB = JSON.parse(params.anchorB);

  const highlineForm = useForm<FormSchema>({
    mode: 'onTouched',
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      height: 0,
      length: Number(
        haversineDistance(
          anchorA[1],
          anchorA[0],
          anchorB[1],
          anchorB[0],
        ).toFixed(),
      ),
      image: null,
      description: '',
    },
  });

  const mutation = useMutation<
    string,
    Error,
    FormSchema,
    { previousHighlines: Highline[] | undefined }
  >({
    mutationFn: async ({ name, height, length, description, image }) => {
      if (!anchorA || !anchorB) throw new Error('Anchors not defined');

      // Upload image if provided (converted to base64)
      let imageID: string | null = null;
      if (image && image.base64 && image.mimeType) {
        const extension = image.mimeType.split('/')[1];
        imageID = `${uuidv4()}.${extension}`;
        const { error } = await supabase.storage
          .from('images')
          .upload(imageID, decode(image.base64), {
            contentType: image.mimeType,
          });
        if (error) throw new Error("Couldn't upload the image");
      }

      const { data: highline, error } = await supabase
        .from('highline')
        .insert([
          {
            name,
            height,
            length,
            description,
            cover_image: imageID,
            anchor_a: positionToPostGISPoint(anchorA),
            anchor_b: positionToPostGISPoint(anchorB),
          },
        ])
        .select()
        .single();

      if (error || !highline) {
        throw new Error('Error when creating the highline');
      }

      return highline.id;
    },
    onMutate: async (form) => {
      await queryClient.cancelQueries({ queryKey: highlineKeyFactory.list() });
      const previousHighlines = queryClient.getQueryData<Highline[]>(
        highlineKeyFactory.list(),
      );

      const optimisticHighline: Highline = {
        id: uuidv4(),
        name: form.name,
        height: form.height,
        length: form.length,
        description: form.description || '',
        cover_image: '',
        anchor_a_long: anchorA[0],
        anchor_a_lat: anchorA[1],
        anchor_b_long: anchorB[0],
        anchor_b_lat: anchorB[1],
        is_favorite: false,
        status: 'unrigged',
        created_at: new Date().toISOString(),
        sector_id: 0,
      };

      queryClient.setQueryData<Highline[]>(highlineKeyFactory.list(), (old) =>
        old ? [...old, optimisticHighline] : [optimisticHighline],
      );

      return { previousHighlines };
    },
    onSuccess: async (newHighlineID) => {
      setNewHighlineUUID(newHighlineID);
      queryClient.invalidateQueries({ queryKey: highlineKeyFactory.list() });
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: highlineKeyFactory.list() });
    },
  });

  if (newHighlineUUID) {
    return <SuccessMessage id={newHighlineUUID} />;
  }

  return (
    <KeyboardAwareScrollView
      contentContainerClassName="min-h-screen"
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={false}
    >
      <MapCard anchorA={anchorA} anchorB={anchorB} />

      <View className="px-2 gap-4 mt-4">
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
            (data) => mutation.mutate(data),
            () => {
              console.log('Error submiting');
            },
          )}
          disabled={mutation.isPending}
        >
          <Text>{t('components.map.register-modal.submit')}</Text>
        </Button>
      </View>
    </KeyboardAwareScrollView>
  );
};

const SuccessMessage: React.FC<{ id: string }> = ({ id }) => {
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
        {t('components.map.register-modal.success.message')}
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
          <React.Fragment>
            <Image
              source={{ uri: value.uri }}
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
          </React.Fragment>
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

export default RegisterHighlineScreen;

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

const MapCard = ({
  anchorA,
  anchorB,
}: {
  anchorA: Position;
  anchorB: Position;
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
    </View>
  );
};
