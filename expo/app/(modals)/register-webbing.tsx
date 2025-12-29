import {
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  ChevronDownIcon,
  PackagePlusIcon,
  TorusIcon,
} from 'lucide-react-native';
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
import { Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { useAuth } from '~/context/auth';
import { useWebbingsKeyFactory } from '~/hooks/use-webbings';
import RegisterWebbingIllustration from '~/lib/icons/register-webbing';
import { supabase } from '~/lib/supabase';
import { cn } from '~/lib/utils';
import { Tables } from '~/utils/database.types';
import { requestReview } from '~/utils/request-review';

import { OnboardNavigator } from '~/components/onboard';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';
import { Textarea } from '~/components/ui/textarea';
import { WebbingInput, webbingSchema } from '~/components/webbing-input';

import {
  STRENGTH_CLASS_OPTIONS,
  getRecommendedLifetimeDays,
  getWeaveColor,
  getMaterialColor,
  getMaterialIconColor,
  getStrengthClassColor,
} from '@chooselife/ui';

// Extend your existing webbing schema with fields for model and strength class
const registerWebbingSchema = webbingSchema.extend({
  modelID: z.string().optional(),
  note: z.string(),
  tagName: z.string().min(1),
  strengthClass: z.enum(STRENGTH_CLASS_OPTIONS).optional(),
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
      strengthClass: undefined,
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
          // Only save strength_class if no model is selected (custom webbing)
          strength_class: data.modelID ? undefined : data.strengthClass,
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
    <BottomSheetModalProvider>
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
    </BottomSheetModalProvider>
  );
}

const PrefillForm: React.FC<{
  form: UseFormReturn<TRegisterWebbingSchema>;
}> = ({ form }) => {
  const { t } = useTranslation();
  const [leftLoop, rightLoop, length, modelID] = useWatch({
    control: form.control,
    name: ['leftLoop', 'rightLoop', 'length', 'modelID'],
  });

  // Fetch models to get the selected model's strength class
  const { data: models } = useQuery({
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

  // Get selected model's strength class
  const selectedModel = models?.find((m) => m.id.toString() === modelID);
  const modelStrengthClass = (selectedModel as { strength_class?: string } | undefined)?.strength_class ?? null;

  return (
    <View className="gap-6">
      <View className="h-52">
        <RegisterWebbingIllustration className="w-full h-full" />
      </View>

      <View>
        <Text variant="h3" className="text-center">
          {t('app.(modals).register-webbing.title')}
        </Text>
        <Text variant="muted" className="text-center">
          {t('app.(modals).register-webbing.description')}
        </Text>
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
      <StrengthClassSelector 
        control={form.control} 
        modelStrengthClass={modelStrengthClass}
      />

      <Controller
        control={form.control}
        name="tagName"
        render={({ field, fieldState }) => (
          <View className="gap-2">
            <Label nativeID="tagname">
              {t('app.(modals).register-webbing.tagName.label')}
            </Label>
            <Input
              value={field.value}
              onChangeText={field.onChange}
              placeholder={t(
                'app.(modals).register-webbing.tagName.placeholder',
              )}
              className={fieldState.error && 'border-destructive'}
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
        name="note"
        render={({ field, fieldState }) => (
          <View className="gap-2">
            <Label nativeID="note">
              {t('app.(modals).register-webbing.note.label')}{' '}
              <Text variant="muted">{t('common.optional')}</Text>
            </Label>
            <Textarea
              keyboardType="default"
              returnKeyType="done"
              placeholder={t('app.(modals).register-webbing.note.placeholder')}
              {...field}
              submitBehavior="blurAndSubmit"
              onChangeText={(text) => field.onChange(text)}
              value={field.value}
              className={fieldState.error && 'border-destructive'}
              aria-labelledby="note"
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
  );
};



// Strength class selector component
const StrengthClassSelector: React.FC<{
  control: Control<TRegisterWebbingSchema>;
  modelStrengthClass: string | null;
}> = ({ control, modelStrengthClass }) => {
  const { t } = useTranslation();
  const { field } = useController({ control, name: 'strengthClass' });

  // Use model's strength class when available, otherwise use form field value
  const hasModel = !!modelStrengthClass;
  const displayValue = hasModel ? modelStrengthClass : field.value;
  const recommendedDays = getRecommendedLifetimeDays((displayValue as 'A+' | 'A' | 'B' | 'C') ?? null);

  return (
    <View className="gap-2">
      <Label nativeID="strengthClass">
        {t('app.(modals).register-webbing.strengthClass.label')}
        {!hasModel && (
          <>
            {' '}
            <Text variant="muted">{t('common.optional')}</Text>
          </>
        )}
      </Label>
      
      {/* Strength class buttons */}
      <View className="flex-row gap-2">
        {STRENGTH_CLASS_OPTIONS.map((option) => {
          const isSelected = displayValue === option;
          return (
            <TouchableOpacity
              key={option}
              disabled={hasModel}
              onPress={() => field.onChange(isSelected ? undefined : option)}
              className={cn(
                'flex-1 py-3 rounded-lg border items-center justify-center',
                isSelected
                  ? getStrengthClassColor(option)
                  : 'border-border bg-muted/30',
                hasModel && !isSelected && 'opacity-40',
              )}
            >
              <Text
                className={cn(
                  'font-bold text-lg',
                  isSelected ? '' : 'text-muted-foreground',
                )}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Recommended lifetime info */}
      {recommendedDays && (
        <Text variant="muted" className="text-sm">
          {t('app.(modals).register-webbing.recommendedLifetime', {
            days: recommendedDays,
          })}
        </Text>
      )}
    </View>
  );
};

// Grid layout constants - 2 columns
const screenWidth = Dimensions.get('window').width;
const numColumns = 2;
const horizontalPadding = 32; // p-4 on each side
const gap = 12;
const availableSpace = screenWidth - horizontalPadding - (numColumns - 1) * gap;
const itemWidth = availableSpace / numColumns;

const EmptyState = () => {
  const { t } = useTranslation();
  return (
    <View className="items-center justify-center py-10 gap-4">
      <Icon as={PackagePlusIcon} size={48} className="text-muted-foreground" />
      <Text className="text-center text-lg font-medium">
        {t('app.(modals).register-webbing.selectModel.emptyState.title')}
      </Text>
      <Text className="text-center text-muted-foreground mb-4">
        {t('app.(modals).register-webbing.selectModel.emptyState.description')}
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

  // Custom backdrop that blocks all touch gestures from propagating to parent modal
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => {
      const CustomBackdrop = () => {
        const animatedStyle = useAnimatedStyle(() => ({
          opacity: interpolate(props.animatedIndex.value, [-1, 0], [0, 0.5]),
        }));

        // Pan gesture that captures swipes but does nothing - prevents propagation
        const panGesture = Gesture.Pan();

        // Tap gesture to close the modal
        const closeModal = () => bottomSheetModalRef.current?.close();
        const tapGesture = Gesture.Tap().onEnd(() => {
          scheduleOnRN(closeModal);
        });

        // Compose gestures - pan takes priority to block swipes
        const composedGesture = Gesture.Race(panGesture, tapGesture);

        return (
          <GestureDetector gesture={composedGesture}>
            <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: 'black' },
                animatedStyle,
              ]}
            />
          </GestureDetector>
        );
      };

      return <CustomBackdrop />;
    },
    [],
  );

  const renderWebbingImage = useCallback(
    (model: Tables<'webbing_model'>, size: 'sm' | 'lg') => {
      const dimensions = size === 'sm' ? 'h-10 w-10' : 'h-20 w-20';
      const iconSize = size === 'sm' ? 20 : 40;
      const borderRadius = size === 'sm' ? 'rounded-lg' : 'rounded-xl';

      if (model.image_url) {
        return (
          <View
            className={`relative ${dimensions} overflow-hidden ${borderRadius} border border-border bg-muted`}
          >
            <Image
              source={{
                uri: supabase.storage
                  .from('webbings')
                  .getPublicUrl(model.image_url).data.publicUrl,
              }}
              contentFit="cover"
              alt={`${model.name}`}
              style={{ width: '100%', height: '100%' }}
            />
          </View>
        );
      }

      // Fallback with styled background and icon
      return (
        <View
          className={`${dimensions} flex items-center justify-center ${borderRadius} border border-border bg-muted/50`}
        >
          <Icon
            as={TorusIcon}
            size={iconSize}
            className={getMaterialIconColor(model.material)}
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
        <Icon as={ChevronDownIcon} className="text-foreground" />
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
            width: itemWidth,
          }}
          className={cn(
            'flex flex-col items-center p-4 rounded-2xl border',
            isSelected
              ? 'border-primary bg-primary/5'
              : 'border-border bg-muted/30',
          )}
        >
          {/* Webbing image */}
          {renderWebbingImage(item, 'lg')}

          {/* Details */}
          <View className="flex flex-col items-center gap-2 w-full mt-3">
            <Text
              className="font-semibold text-foreground text-sm text-center"
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <View className="flex flex-row flex-wrap justify-center gap-1.5">
              <View
                className={cn(
                  'rounded-full px-2.5 py-0.5',
                  getMaterialColor(item.material),
                )}
              >
                <Text className="text-xs font-medium capitalize">
                  {item.material}
                </Text>
              </View>
              <View
                className={cn(
                  'rounded-full px-2.5 py-0.5',
                  getWeaveColor(item.weave),
                )}
              >
                <Text className="text-xs font-medium capitalize">
                  {item.weave}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [modelIDField.value, renderWebbingImage, handleSelect],
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
            snapPoints={['70%']}
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={{ backgroundColor: '#ccc', width: 40 }}
            enableDynamicSizing={false}
            activeOffsetY={[-10, 10]}
            failOffsetX={[-5, 5]}
            backgroundStyle={{ backgroundColor: '#ffffff' }}
          >
            <View className="flex-1 px-4 pb-4">
              {/* Header */}
              <View className="pb-4 border-b border-border mb-4">
                <Text className="text-xl font-bold text-center text-foreground">
                  {t('app.(modals).register-webbing.selectModel.label')}
                </Text>
              </View>

              {/* Grid */}
              <BottomSheetScrollView
                contentContainerStyle={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: gap,
                  paddingBottom: 80,
                }}
              >
                {models ? (
                  models.map((item) => renderModelItem(item))
                ) : (
                  <EmptyState />
                )}
              </BottomSheetScrollView>

              {/* Clear button */}
              {modelIDField.value && (
                <View className="absolute bottom-4 left-4 right-4">
                  <Button
                    variant="outline"
                    onPress={() => handleSelect(null)}
                    className="bg-background"
                  >
                    <Text>
                      {t('app.(modals).register-webbing.selectModel.clear')}
                    </Text>
                  </Button>
                </View>
              )}
            </View>
          </BottomSheetModal>
        </>
      )}
    </View>
  );
};
