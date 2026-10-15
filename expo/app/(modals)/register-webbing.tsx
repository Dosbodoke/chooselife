import {
  formatCatalogModelName,
  getStrengthClassColor,
  STRENGTH_CLASS_OPTIONS,
  useRegisterWebbing,
  type RegisterWebbingFormData,
  type WebbingCatalogSnapshot,
} from '@chooselife/ui';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useQueryClient } from '@tanstack/react-query';
import {
  captureGrowthEvent,
  flushGrowthEvents,
} from '~/features/growth/analytics';
import {
  captureWebbingRegistered,
  type WebbingPickerExperiment,
} from '~/features/growth/webbing-picker-layout';
import {
  getStaticPhotoType,
  saveWebbingPhoto,
  WebbingPhotoError,
  type PhotoAsset,
} from '~/features/webbing/photo-upload';
import {
  advanceRegistration,
  continueWithoutPhoto,
  initialRegistrationFlow,
  nextAutoLabel,
  type RegistrationFlowState,
} from '~/features/webbing/registration-flow';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
  AlertTriangleIcon,
  CameraIcon,
  CloudOffIcon,
  XIcon,
} from 'lucide-react-native';
import React, { useCallback, useId, useRef, useState } from 'react';
import {
  Control,
  Controller,
  useController,
  UseFormReturn,
  useWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { v4 as uuid } from 'uuid';

import { useAuth } from '~/context/auth';
import { useOnlineStatus } from '~/context/react-query';
import {
  createWebbingPhotoDeps,
  setCachedWebbingPhoto,
  WEBBING_PHOTO_PICKER_OPTIONS,
} from '~/hooks/use-webbing-photo';
import { useWebbingPickerExperiment } from '~/hooks/use-webbing-picker-experiment';
import RegisterWebbingIllustration from '~/lib/icons/register-webbing';
import { cn } from '~/lib/utils';
import { requestReview } from '~/utils/request-review';

import { OnboardHeader, OnboardNavigator } from '~/components/onboard';
import { SafeAreaView } from '~/components/styled';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Text } from '~/components/ui/text';
import { Textarea } from '~/components/ui/textarea';
import {
  SelectedCatalogDetails,
  WebbingCatalogPicker,
  type LegacyWebbingModel,
} from '~/components/webbing-catalog-picker';
import { WebbingInput } from '~/components/webbing-input';

const translationKey = 'app.(modals).register-webbing';
const ROOT_ERROR_CODES = [
  'draft-conflict',
  'unconfirmed',
  'lookup-failed',
  'offline',
];

export default function RegisterWebbing() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const { session, sessionLoading, isLoginPending } = useAuth();
  const handleLogin = useCallback(() => {
    router.push('/(modals)/login');
  }, [router]);

  const { form, submit } = useRegisterWebbing({ createRegistrationKey: uuid });
  const pickerExperiment = useWebbingPickerExperiment();
  const [selectedLegacy, setSelectedLegacy] =
    useState<LegacyWebbingModel | null>(null);
  const [photo, setPhoto] = useState<PhotoAsset | null>(null);
  const [flow, setFlow] = useState<RegistrationFlowState>(
    initialRegistrationFlow,
  );
  const finished = useRef(false);

  const rootError = form.formState.errors.root;
  const rootErrorType = String(rootError?.type ?? '');
  const submitError = rootError
    ? ROOT_ERROR_CODES.includes(rootErrorType)
      ? t(`${translationKey}.errors.${rootErrorType}`)
      : rootError.message
    : undefined;

  const finish = () => {
    // Navigate back and ask for a review exactly once.
    if (finished.current) return;
    finished.current = true;
    requestReview();
    router.back();
  };

  const run = async (values: RegisterWebbingFormData | null) => {
    const userId = session?.user.id;
    if (!userId) return;
    const state = await advanceRegistration(
      flow,
      photo,
      {
        saveItem: async () => {
          if (!values) return null;
          const webbing = await submit({
            ...values,
            // A legacy model's own class is shown locked, not saved as personal.
            strengthClass: selectedLegacy?.strength_class
              ? undefined
              : values.strengthClass,
          });
          if (webbing) {
            captureWebbingRegistered(captureGrowthEvent, pickerExperiment, {
              modelSource: values.catalogSnapshot
                ? 'catalog'
                : values.modelID
                  ? 'legacy'
                  : 'manual',
              hasPhoto: !!photo,
            });
            flushGrowthEvents();
          }
          return webbing;
        },
        savePhoto: async ({ webbing, asset, pendingPath }) => {
          const imagePath = await saveWebbingPhoto({
            webbingId: webbing.id,
            previousPath: webbing.image_path,
            asset,
            pendingPath,
            deps: createWebbingPhotoDeps(webbing.id, userId),
          });
          setCachedWebbingPhoto(queryClient, userId, webbing.id, imagePath);
          return imagePath;
        },
      },
      setFlow,
    );
    if (state.phase === 'completed') finish();
  };

  const handleFinish = () => {
    if (!isOnline) {
      form.setError('root', { type: 'offline', message: 'offline' });
      return;
    }
    void form.handleSubmit((values) => run(values))();
  };

  const busy = flow.phase === 'savingItem' || flow.phase === 'uploadingPhoto';
  const photoFailed =
    flow.phase === 'savedPhotoFailed' ||
    flow.phase === 'photoCommitUnconfirmed';

  if (sessionLoading || !session?.user.id) {
    return (
      <BottomSheetModalProvider>
        <SafeAreaView className="flex-1">
          <View className="flex-1 px-6 pt-3 pb-8 gap-6">
            <OnboardHeader total={1} selectedIndex={0} onBack={router.back} />

            <View className="h-52">
              <RegisterWebbingIllustration className="w-full h-full" />
            </View>

            <View>
              <Text variant="h3" className="text-left">
                {t('app.(modals).register-webbing.title')}
              </Text>
              <Text variant="muted" className="text-left">
                {t('app.(modals).register-webbing.description')}
              </Text>
            </View>

            {sessionLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator />
              </View>
            ) : (
              <>
                <Alert variant="warning">
                  <AlertIcon icon={AlertTriangleIcon} />
                  <AlertContent>
                    <AlertTitle>
                      {t('app.(modals).register-webbing.authRequired.title')}
                    </AlertTitle>
                    <AlertDescription>
                      {t(
                        'app.(modals).register-webbing.authRequired.description',
                      )}
                    </AlertDescription>
                  </AlertContent>
                </Alert>

                <View className="flex-grow" />

                <Button
                  className="w-full rounded-full"
                  disabled={isLoginPending}
                  onPress={handleLogin}
                >
                  <Text>
                    {t('app.(modals).register-webbing.authRequired.action')}
                  </Text>
                </Button>
              </>
            )}
          </View>
        </SafeAreaView>
      </BottomSheetModalProvider>
    );
  }

  return (
    <BottomSheetModalProvider>
      <SafeAreaView className="flex-1">
        <KeyboardAwareScrollView
          contentContainerClassName="px-6 pt-3 pb-8 gap-4"
          keyboardShouldPersistTaps="handled"
        >
          <OnboardHeader total={1} selectedIndex={0} onBack={router.back} />
          <PrefillForm
            form={form}
            selectedLegacy={selectedLegacy}
            onSelectedLegacyChange={setSelectedLegacy}
            photo={photo}
            onPhotoChange={setPhoto}
            photoLocked={busy || flow.phase === 'completed'}
            pickerExperiment={pickerExperiment}
          />

          {!isOnline && (
            <Alert variant="default">
              <AlertIcon icon={CloudOffIcon} />
              <AlertContent>
                <AlertDescription>
                  {t(`${translationKey}.errors.offline`)}
                </AlertDescription>
              </AlertContent>
            </Alert>
          )}

          {submitError && flow.phase === 'editing' ? (
            <Alert variant="destructive">
              <AlertIcon icon={AlertTriangleIcon} />
              <AlertContent>
                <AlertDescription>{submitError}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <View className="flex-grow">
            {/* Spacer to push paginator down */}
          </View>

          {photoFailed ? (
            <Alert variant="warning">
              <AlertIcon icon={AlertTriangleIcon} />
              <AlertContent className="gap-3">
                <AlertTitle>
                  {t(`${translationKey}.photoPhase.failedTitle`)}
                </AlertTitle>
                <AlertDescription>
                  {flow.photoError
                    ? `${t(`${translationKey}.photo.errors.${flow.photoError}`)} `
                    : ''}
                  {t(`${translationKey}.photoPhase.failedDescription`)}
                </AlertDescription>
                <Button
                  disabled={!isOnline || !photo}
                  onPress={() => void run(null)}
                >
                  <Text>{t(`${translationKey}.photoPhase.retryPhoto`)}</Text>
                </Button>
                <Button
                  variant="outline"
                  onPress={() => {
                    setFlow(continueWithoutPhoto(flow));
                    finish();
                  }}
                >
                  <Text>{t(`${translationKey}.photoPhase.continue`)}</Text>
                </Button>
              </AlertContent>
            </Alert>
          ) : (
            <>
              {flow.phase === 'uploadingPhoto' && (
                <View className="flex-row items-center justify-center gap-2">
                  <ActivityIndicator />
                  <Text className="text-sm text-muted-foreground">
                    {t(`${translationKey}.photoPhase.uploading`)}
                  </Text>
                </View>
              )}
              <OnboardNavigator
                total={1}
                selectedIndex={0}
                onIndexChange={() => {}} // There is only one step
                onFinish={handleFinish}
                goBack={router.back}
                isLoading={busy || flow.phase === 'completed'}
                finishLabel={t('app.(modals).register-webbing.finishLabel')}
                showBack={false}
              />
            </>
          )}
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </BottomSheetModalProvider>
  );
}

const PrefillForm: React.FC<{
  form: UseFormReturn<RegisterWebbingFormData>;
  selectedLegacy: LegacyWebbingModel | null;
  onSelectedLegacyChange: (model: LegacyWebbingModel | null) => void;
  photo: PhotoAsset | null;
  onPhotoChange: (photo: PhotoAsset | null) => void;
  photoLocked: boolean;
  pickerExperiment: WebbingPickerExperiment;
}> = ({
  form,
  selectedLegacy,
  onSelectedLegacyChange,
  photo,
  onPhotoChange,
  photoLocked,
  pickerExperiment,
}) => {
  const { t } = useTranslation();
  const labelId = useId();
  const [leftLoop, rightLoop, length, catalogSnapshot] = useWatch({
    control: form.control,
    name: ['leftLoop', 'rightLoop', 'length', 'catalogSnapshot'],
  });
  // The label last filled in automatically; user edits are never replaced.
  const autoLabel = useRef<string | null>(null);

  const applySelection = (
    snapshot: WebbingCatalogSnapshot | null,
    legacy: LegacyWebbingModel | null,
  ) => {
    // The selection is copied into the draft; catalog refetches never replace it.
    form.setValue('catalogSnapshot', snapshot, { shouldValidate: true });
    form.setValue('modelID', legacy ? legacy.id.toString() : '', {
      shouldValidate: true,
    });
    onSelectedLegacyChange(legacy);
    const suggestion = snapshot
      ? formatCatalogModelName(snapshot)
      : (legacy?.name ?? null);
    const nextLabel = nextAutoLabel(
      form.getValues('tagName'),
      autoLabel.current,
      suggestion,
    );
    if (nextLabel !== form.getValues('tagName')) {
      form.setValue('tagName', nextLabel, { shouldValidate: !!nextLabel });
    }
    autoLabel.current = suggestion;
  };

  return (
    <View className="gap-6">
      <View className="h-52">
        <RegisterWebbingIllustration className="w-full h-full" />
      </View>

      <View>
        <Text variant="h3" className="text-left">
          {t('app.(modals).register-webbing.title')}
        </Text>
        <Text variant="muted" className="text-left">
          {t('app.(modals).register-webbing.description')}
        </Text>
      </View>

      <WebbingInput
        leftLoop={leftLoop}
        rightLoop={rightLoop}
        length={length}
        onLeftLoopChange={(value) => form.setValue('leftLoop', value)}
        onRightLoopChange={(value) => form.setValue('rightLoop', value)}
        onLengthChange={(value) =>
          form.setValue('length', value, { shouldValidate: true })
        }
        error={form.formState.errors.length?.message ?? null}
      />

      <View className="gap-3">
        <WebbingCatalogPicker
          labelId={labelId}
          selectedSnapshot={catalogSnapshot ?? null}
          selectedLegacy={selectedLegacy}
          onSelectCatalog={(snapshot) => applySelection(snapshot, null)}
          onSelectLegacy={(model) => applySelection(null, model)}
          onClear={() => applySelection(null, null)}
          experiment={pickerExperiment}
        />
        {catalogSnapshot ? (
          <SelectedCatalogDetails snapshot={catalogSnapshot} />
        ) : !selectedLegacy ? (
          <Text variant="muted" className="text-sm">
            {t(`${translationKey}.selectModel.manualHint`)}
          </Text>
        ) : null}
      </View>

      <StrengthClassSelector
        control={form.control}
        legacyModel={selectedLegacy}
        catalogClass={catalogSnapshot?.isaClass ?? null}
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
              aria-labelledby="tagname"
            />
            {fieldState.error ? (
              <Text variant="small" className="text-destructive">
                {fieldState.error.message}
              </Text>
            ) : null}
          </View>
        )}
      />

      <PhotoField
        photo={photo}
        onChange={onPhotoChange}
        disabled={photoLocked}
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

// Personal photo for the physical item, uploaded after the item is saved.
const PhotoField: React.FC<{
  photo: PhotoAsset | null;
  onChange: (photo: PhotoAsset | null) => void;
  disabled: boolean;
}> = ({ photo, onChange, disabled }) => {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  const choose = async () => {
    if (disabled || isPicking) return;
    setIsPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        ...WEBBING_PHOTO_PICKER_OPTIONS,
        mediaTypes: [...WEBBING_PHOTO_PICKER_OPTIONS.mediaTypes],
        aspect: [...WEBBING_PHOTO_PICKER_OPTIONS.aspect],
      });
      // Cancelling keeps the previous selection and is not an error.
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        getStaticPhotoType(asset.mimeType);
        setError(null);
        onChange({
          uri: asset.uri,
          mimeType: asset.mimeType,
          fileSize: asset.fileSize,
        });
      }
    } catch (cause) {
      setError(
        t(
          `${translationKey}.photo.errors.${
            cause instanceof WebbingPhotoError ? cause.code : 'unreadable'
          }`,
        ),
      );
    }
    setIsPicking(false);
  };

  return (
    <View className="gap-2">
      <Label nativeID="photo">
        {t(`${translationKey}.photo.label`)}{' '}
        <Text variant="muted">{t('common.optional')}</Text>
      </Label>
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(
            `${translationKey}.photo.${photo ? 'change' : 'add'}`,
          )}
          accessibilityState={{ disabled, busy: isPicking }}
          disabled={disabled}
          onPress={() => void choose()}
          className="h-24 w-32 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30"
        >
          {photo ? (
            <Image
              source={{ uri: photo.uri }}
              contentFit="cover"
              style={{ width: '100%', height: '100%' }}
            />
          ) : isPicking ? (
            <ActivityIndicator />
          ) : (
            <>
              <Icon
                as={CameraIcon}
                size={22}
                className="text-muted-foreground"
              />
              <Text className="text-xs text-muted-foreground">
                {t(`${translationKey}.photo.add`)}
              </Text>
            </>
          )}
        </Pressable>
        {photo && !disabled && (
          <Button
            variant="ghost"
            size="sm"
            onPress={() => onChange(null)}
            accessibilityLabel={t(`${translationKey}.photo.remove`)}
          >
            <Icon as={XIcon} size={16} />
            <Text>{t(`${translationKey}.photo.remove`)}</Text>
          </Button>
        )}
      </View>
      {error ? (
        <Text variant="small" className="text-destructive">
          {error}
        </Text>
      ) : null}
    </View>
  );
};

// Personal strength class. A legacy model's own class is shown locked; a
// SlackData class is shown separately and never becomes a personal value.
const StrengthClassSelector: React.FC<{
  control: Control<RegisterWebbingFormData>;
  legacyModel: LegacyWebbingModel | null;
  catalogClass: string | null;
}> = ({ control, legacyModel, catalogClass }) => {
  const { t } = useTranslation();
  const { field } = useController({ control, name: 'strengthClass' });

  const lockedClass = legacyModel?.strength_class ?? null;
  const isLocked = !!lockedClass;
  const displayValue = isLocked ? lockedClass : field.value;
  const recommendedDays = legacyModel?.recommended_lifetime_days ?? null;

  return (
    <View className="gap-2">
      <Label nativeID="strengthClass">
        {t('app.(modals).register-webbing.strengthClass.label')}
        {!isLocked && (
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
              disabled={isLocked}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: isLocked }}
              onPress={() => field.onChange(isSelected ? undefined : option)}
              className={cn(
                'flex-1 py-3 rounded-lg border items-center justify-center',
                isSelected
                  ? getStrengthClassColor(option)
                  : 'border-border bg-muted/30',
                isLocked && !isSelected && 'opacity-40',
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

      <Text variant="muted" className="text-sm">
        {isLocked
          ? t('app.(modals).register-webbing.strengthClass.lockedHint')
          : t('app.(modals).register-webbing.strengthClass.personalHint')}
      </Text>
      {catalogClass && (
        <Text variant="muted" className="text-sm">
          {t('app.(modals).register-webbing.strengthClass.catalogClass', {
            value: catalogClass,
          })}
        </Text>
      )}

      {/* Only a legacy model carries a supported recommended lifetime */}
      {recommendedDays ? (
        <Text variant="muted" className="text-sm">
          {t('app.(modals).register-webbing.recommendedLifetime', {
            days: recommendedDays,
          })}
        </Text>
      ) : null}
    </View>
  );
};
