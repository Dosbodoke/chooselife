import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetScrollView,
  useBottomSheetInternal,
} from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Link, useRouter } from 'expo-router';
import { Position } from 'geojson';
import i18next from 'i18next';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  TextInput,
  TouchableOpacity,
  View,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
} from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { LucideIcon } from '~/lib/icons/lucide-icon';
import { supabase } from '~/lib/supabase';
import { cn } from '~/lib/utils';

import SuccessAnimation from '~/components/animations/success-animation';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { H1 } from '~/components/ui/typography';

import { Input, type InputProps } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { haversineDistance, positionToPostGISPoint } from './utils';

const MAX_FILE_SIZE = 6 * 1024 * 1024;
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

export const RegisterHighlineModal: React.FC<{
  anchorA: Position;
  anchorB: Position;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}> = ({ anchorA, anchorB, open, setOpen }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const bottomSheetRef = React.useRef<BottomSheet>(null);
  const [newHighlineUUID, setNewHighlineUUID] = React.useState<string | null>(
    null,
  );

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

  const mutation = useMutation<string, Error, FormSchema>({
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
    onError: (e) => {
      console.log(e.message);
    },
    onSuccess: (data) => {
      setNewHighlineUUID(data);
    },
  });

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={open ? 0 : -1}
      onClose={() => {
        if (mutation.isSuccess) {
          router.replace('/');
        }
        setOpen(false);
      }}
      enablePanDownToClose
      enableDynamicSizing={true}
      backdropComponent={renderBackdrop}
      maxDynamicContentSize={Dimensions.get('window').height * 0.9}
      onChange={() => {
        Haptics.selectionAsync();
      }}
      handleIndicatorStyle={{
        backgroundColor: '#71717A',
      }}
      handleStyle={{
        backgroundColor: '#FFF',
      }}
      style={{
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 4,
        shadowOffset: { width: 1, height: 1 },
      }}
    >
      <BottomSheetScrollView contentContainerClassName="p-4 pb-8 gap-4">
        {newHighlineUUID ? (
          <SuccessMessage id={newHighlineUUID} />
        ) : (
          <>
            <Controller
              control={highlineForm.control}
              name="name"
              render={({ field, fieldState }) => (
                <BottomSheetInput
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
                <BottomSheetInput
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
                <BottomSheetInput
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
                <BottomSheetTextArea
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
                <View
                  className={cn(
                    'flex items-center justify-center border border-border rounded-lg w-full aspect-video bg-background overflow-hidden',
                    fieldState.error ? 'border-destructive' : null,
                  )}
                >
                  {field.value ? (
                    <Image
                      source={{ uri: field.value.uri }}
                      contentFit="cover"
                      alt="Image of the Highline"
                      style={{ width: '100%', height: '100%' }}
                      className="rounded-lg"
                    />
                  ) : (
                    <View className="flex items-center justify-center p-4">
                      <TouchableOpacity
                        onPress={async () => {
                          const result =
                            await ImagePicker.launchImageLibraryAsync({
                              mediaTypes: 'images',
                              allowsEditing: true,
                              quality: 1,
                              aspect: [16, 9],
                              selectionLimit: 1,
                              base64: true,
                            });
                          if (!result.canceled) {
                            field.onChange(result.assets[0]);
                          }
                        }}
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
                          {t(
                            'components.map.register-modal.image.instructions',
                          )}
                        </Text>
                      </TouchableOpacity>
                    </View>
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
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
};

const SuccessMessage: React.FC<{ id: string }> = ({ id }) => {
  const { t } = useTranslation();
  return (
    <View className="items-center gap-8">
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
      <Link
        href={{
          pathname: '/highline/[id]',
          params: { id: id },
        }}
        replace
        asChild
      >
        <Button>
          <Text>{t('components.map.register-modal.success.button')}</Text>
        </Button>
      </Link>
    </View>
  );
};

const BottomSheetInput = React.forwardRef<TextInput, InputProps>(
  ({ onFocus, onBlur, ...rest }, ref) => {
    const { shouldHandleKeyboardEvents } = useBottomSheetInternal();

    //#region callbacks
    const handleOnFocus = React.useCallback(
      (args: NativeSyntheticEvent<TextInputFocusEventData>) => {
        shouldHandleKeyboardEvents.value = true;
        if (onFocus) {
          onFocus(args);
        }
      },
      [onFocus, shouldHandleKeyboardEvents],
    );
    const handleOnBlur = React.useCallback(
      (args: NativeSyntheticEvent<TextInputFocusEventData>) => {
        shouldHandleKeyboardEvents.value = false;
        if (onBlur) {
          onBlur(args);
        }
      },
      [onBlur, shouldHandleKeyboardEvents],
    );
    //#endregion

    //#region effects
    React.useEffect(() => {
      return () => {
        // Reset the flag on unmount
        shouldHandleKeyboardEvents.value = false;
      };
    }, [shouldHandleKeyboardEvents]);
    //#endregion
    return (
      <Input
        ref={ref}
        onFocus={handleOnFocus}
        onBlur={handleOnBlur}
        {...rest}
      />
    );
  },
);

const BottomSheetTextArea = React.forwardRef<TextInput, InputProps>(
  ({ onFocus, onBlur, ...rest }, ref) => {
    //#region hooks
    const { shouldHandleKeyboardEvents } = useBottomSheetInternal();
    //#endregion

    //#region callbacks
    const handleOnFocus = React.useCallback(
      (args: NativeSyntheticEvent<TextInputFocusEventData>) => {
        shouldHandleKeyboardEvents.value = true;
        if (onFocus) {
          onFocus(args);
        }
      },
      [onFocus, shouldHandleKeyboardEvents],
    );
    const handleOnBlur = React.useCallback(
      (args: NativeSyntheticEvent<TextInputFocusEventData>) => {
        shouldHandleKeyboardEvents.value = false;
        if (onBlur) {
          onBlur(args);
        }
      },
      [onBlur, shouldHandleKeyboardEvents],
    );
    //#endregion

    //#region effects
    React.useEffect(() => {
      return () => {
        // Reset the flag on unmount
        shouldHandleKeyboardEvents.value = false;
      };
    }, [shouldHandleKeyboardEvents]);
    //#endregion
    return (
      <Textarea
        ref={ref}
        onFocus={handleOnFocus}
        onBlur={handleOnBlur}
        {...rest}
      />
    );
  },
);
