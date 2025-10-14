import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useId, useMemo, useRef } from 'react';
import {
  Control,
  Controller,
  FieldErrors,
  SubmitHandler,
  useController,
  useForm,
  UseFormReturn,
  useWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Dimensions, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { useAuth } from '~/context/auth';
import { useWebbingsKeyFactory } from '~/hooks/use-webbings';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import RegisterWebbingIllustration from '~/lib/icons/register-webbing';
import { supabase } from '~/lib/supabase';
import { cn } from '~/lib/utils';
import { Tables } from '~/utils/database.types';
import { requestReview } from '~/utils/request-review';

import { OnboardNavigator } from '~/components/onboard';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Separator } from '~/components/ui/separator';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';
import { Textarea } from '~/components/ui/textarea';
import { H3, Muted } from '~/components/ui/typography';
import { WebbingInput, webbingSchema } from '~/components/webbing-input';

// Extend your existing webbing schema with a "model" field.
const registerWebbingSchema = webbingSchema.extend({
  modelID: z.string().optional(),
  note: z.string(),
  tagName: z.string().min(1),
});
type TRegisterWebbingSchema = z.infer<typeof registerWebbingSchema>;

export default function RegisterWebbing() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const router = useRouter();
  const form = useForm<TRegisterWebbingSchema>({
    resolver: zodResolver(registerWebbingSchema),
    mode: 'onChange',
    defaultValues: {
      modelID: '',
      note: '',
      tagName: '',
      length: '',
      leftLoop: false,
      rightLoop: false,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: TRegisterWebbingSchema) => {
      if (!profile) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('webbing')
        .insert({
          model: data.modelID ? +data.modelID : undefined,
          description: data.note,
          tag_name: data.tagName,
          user_id: profile.id,
          left_loop: data.leftLoop,
          right_loop: data.rightLoop,
          length: +data.length,
        })
        .single();

      if (error) throw error;
    },
    onSuccess: () => {
      requestReview();
      queryClient.invalidateQueries({
        queryKey: useWebbingsKeyFactory.webbings(),
      });
      router.back();
    },
  });

  const onSubmit: SubmitHandler<TRegisterWebbingSchema> = async (data) => {
    await mutation.mutateAsync(data);
  };

  const onError = (e: FieldErrors<TRegisterWebbingSchema>) => {
    console.log({ e });
  };

  return (
    <SafeAreaView className="flex-1">
      <KeyboardAwareScrollView
        contentContainerClassName="px-6 pt-3 pb-8 gap-4"
        keyboardShouldPersistTaps="handled"
      >
        <PrefillForm form={form} />

        <View className="flex-grow">{/* Spacer to push paginator down */}</View>

        <OnboardNavigator
          total={1}
          selectedIndex={0}
          onIndexChange={() => {}} // There is only one step
          onFinish={form.handleSubmit(onSubmit, onError)}
          goBack={router.back}
          isLoading={mutation.isPending}
          finishLabel={t('app.(modals).register-webbing.finishLabel')}
        />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const PrefillForm: React.FC<{
  form: UseFormReturn<TRegisterWebbingSchema>;
}> = ({ form }) => {
  const { t } = useTranslation();
  const [leftLoop, rightLoop, length] = useWatch({
    control: form.control,
    name: ['leftLoop', 'rightLoop', 'length'],
  });

  return (
    <View className="gap-6">
      <View className="h-52">
        <RegisterWebbingIllustration className="w-full h-full" />
      </View>

      <View>
        <H3 className="text-center">
          {t('app.(modals).register-webbing.title')}
        </H3>
        <Muted className="text-center">
          {t('app.(modals).register-webbing.description')}
        </Muted>
      </View>

      <WebbingInput
        leftLoop={leftLoop}
        rightLoop={rightLoop}
        length={length}
        onLeftLoopChange={(value) => form.setValue('leftLoop', value)}
        onRightLoopChange={(value) => form.setValue('rightLoop', value)}
        onLengthChange={(value) => form.setValue('length', value)}
        error={form.formState.errors.length?.message ?? null}
      />
      <SelectModel control={form.control} />

      <Controller
        control={form.control}
        name="tagName"
        render={({ field, fieldState }) => (
          <Input
            value={field.value}
            onChangeText={field.onChange}
            label={t('app.(modals).register-webbing.tagName.label')}
            placeholder={t('app.(modals).register-webbing.tagName.placeholder')}
            className={fieldState.error && 'border-destructive'}
          />
        )}
      />

      <Controller
        control={form.control}
        name="note"
        render={({ field, fieldState }) => (
          <Textarea
            keyboardType="default"
            returnKeyType="done"
            placeholder={t('app.(modals).register-webbing.note.placeholder')}
            {...field}
            submitBehavior="blurAndSubmit"
            onChangeText={(text) => field.onChange(text)}
            value={field.value}
            label={t('app.(modals).register-webbing.note.label')}
            className={fieldState.error && 'border-destructive'}
          />
        )}
      />
    </View>
  );
};

// Helper function to get color for weave badge
const getWeaveColor = (weave: string) => {
  const colorMap: Record<string, string> = {
    flat: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
    tubular: 'bg-rose-100 text-rose-800 hover:bg-rose-100',
  };

  return colorMap[weave] || '';
};

// Helper function to get background color for material (used for fallback)
const getMaterialColor = (material: string) => {
  const colorMap: Record<string, string> = {
    nylon: 'bg-blue-50',
    dyneema: 'bg-green-50',
    polyester: 'bg-purple-50',
  };

  return colorMap[material] || 'bg-gray-50';
};

const screenWidth = Dimensions.get('window').width;
const numColumns = 3;
const gap = 10;

const availableSpace = screenWidth - (numColumns - 1) * gap;
const itemSize = availableSpace / numColumns;

const EmptyState = () => {
  const { t } = useTranslation();
  return (
    <View className="items-center justify-center py-10 gap-4">
      <LucideIcon
        name="PackagePlus"
        size={48}
        className="text-muted-foreground"
      />
      <Text className="text-center text-lg font-medium">
        {t('app.(modals).register-webbing.selectModel.emptyState.title')}
      </Text>
      <Text className="text-center text-muted-foreground mb-4">
        {t(
          'app.(modals).register-webbing.selectModel.emptyState.description',
        )}
      </Text>
    </View>
  );
};

const SelectModel: React.FC<{ control: Control<TRegisterWebbingSchema> }> = ({
  control,
}) => {
  const { t } = useTranslation();
  const { field: modelIDField } = useController({
    control,
    name: 'modelID',
  });
  const { field: tagNameField } = useController({
    control,
    name: 'tagName',
  });
  const id = useId();
  const { isLoading, data: models } = useQuery({
    queryKey: ['webbingModels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webbing_model')
        .select('*')
        .order('name');

      if (error) throw error;

      return data;
    },
  });
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const handleSelect = useCallback(
    (selectedWebbing: Tables<'webbing_model'> | null) => {
      modelIDField.onChange(
        selectedWebbing ? selectedWebbing.id.toString() : '',
      );
      // Update the label with the webbing name
      tagNameField.onChange(selectedWebbing?.name ?? '');
      bottomSheetModalRef.current?.close();
    },
    [],
  );

  const handleOpenPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    [],
  );

  const renderWebbingImage = useCallback(
    (model: Tables<'webbing_model'>, size: 'sm' | 'lg') => {
      const dimensions = size === 'sm' ? 'h-8 w-8' : 'h-16 w-16';
      const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-8 w-8';

      if (model.image_url) {
        return (
          <View
            className={`relative ${dimensions} overflow-hidden rounded-md border`}
          >
            <Image
              source={{
                uri: supabase.storage
                  .from('webbings')
                  .getPublicUrl(model.image_url).data.publicUrl,
              }}
              contentFit="cover"
              alt={`Imagem da fita ${model.name}`}
              style={{ width: '100%', height: '100%' }}
              className="object-cover"
            />
          </View>
        );
      }

      // Fallback with styled background and icon
      return (
        <View
          className={`${dimensions} flex items-center justify-center rounded-md border ${getMaterialColor(model.material)}`}
        >
          <LucideIcon
            name="Torus"
            className={`${iconSize} ${
              model.material === 'nylon'
                ? 'text-blue-500'
                : model.material === 'dyneema'
                  ? 'text-green-500'
                  : 'text-purple-500'
            }`}
          />
        </View>
      );
    },
    [],
  );

  // Memoize the selector button to prevent re-renders
  const SelectorButton = useMemo(() => {
    const selectedModel = models?.find(
      (m) => m.id.toString() === modelIDField.value,
    );

    return (
      <TouchableOpacity
        id={id}
        onPress={handleOpenPress}
        className="flex-row justify-between items-center px-4 py-3 rounded-md border border-input bg-background"
      >
        {selectedModel ? (
          <View className="flex flex-row items-center gap-3">
            {renderWebbingImage(selectedModel, 'sm')}
            <Text className="text-primary">{selectedModel.name}</Text>
          </View>
        ) : (
          <Text className="text-muted-foreground">
            {t('app.(modals).register-webbing.selectModel.placeholder')}
          </Text>
        )}
        <LucideIcon name="ChevronDown" className="text-foreground" />
      </TouchableOpacity>
    );
  }, [id, handleOpenPress, renderWebbingImage, modelIDField.value, t]);

  const renderModelItem = useCallback(
    (item: Tables<'webbing_model'>) => {
      const isSelected = item.id.toString() === modelIDField.value;

      return (
        <TouchableOpacity
          key={item.id}
          onPress={() => handleSelect(item)}
          style={{
            height: itemSize,
            width: itemSize,
            margin: gap / 2,
          }}
          className={cn(
            'flex flex-col items-center p-3 rounded-md text-center transition-colors',
            isSelected ? 'bg-primary/20' : 'hover:bg-muted',
          )}
        >
          {/* Webbing image - 1:1 aspect ratio */}
          {renderWebbingImage(item, 'lg')}

          {/* Details */}
          <View className="flex flex-col items-center gap-1.5 w-full mt-2">
            <Text className="font-medium text-foreground text-sm line-clamp-1">
              {item.name}
            </Text>
            <View className="flex flex-row flex-wrap justify-center gap-1">
              <View
                className={cn(
                  'rounded px-1.5 py-0',
                  getMaterialColor(item.material),
                )}
              >
                <Text className="text-xs">
                  {item.material}
                  {/* {t(`material.${item.material}`)} */}
                </Text>
              </View>
              <View
                className={cn('rounded px-1.5 py-0', getWeaveColor(item.weave))}
              >
                <Text className="text-xs">
                  {item.weave}
                  {/* {t(`weave.${item.weave}`)} */}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [modelIDField.value, renderWebbingImage, t],
  );



  const ModelsList = (
    <>
      <BottomSheetScrollView>
        {models ? models.map((item) => renderModelItem(item)) : <EmptyState />}
      </BottomSheetScrollView>
      <Separator className="my-3" />
      <Button
        variant="ghost"
        onPress={() => handleSelect(null)}
        className="mt-2"
      >
        <Text>{t('app.(modals).register-webbing.selectModel.clear')}</Text>
      </Button>
    </>
  );

  const BottomSheetContent = (
    <BottomSheetScrollView className="flex-1 p-4">
      <Text className="text-lg font-semibold text-center mb-4">
        {t('app.(modals).register-webbing.selectModel.label')}
      </Text>

      {ModelsList}
    </BottomSheetScrollView>
  );

  return (
    <View className="gap-2 w-full">
      <Label htmlFor={id} nativeID={id}>
        {t('app.(modals).register-webbing.selectModel.label')}
      </Label>

      {isLoading ? (
        <Skeleton className="w-full h-12 rounded-md" />
      ) : (
        <>
          {SelectorButton}

          <BottomSheetModal
            ref={bottomSheetModalRef}
            snapPoints={['60%']}
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={{ backgroundColor: '#999' }}
            enableDynamicSizing={false}
          >
            {BottomSheetContent}
          </BottomSheetModal>
        </>
      )}
    </View>
  );
};
