import {
  getStrengthClassColor,
  STRENGTH_CLASS_OPTIONS,
  useRegisterWebbing,
  type RegisterWebbingFormData,
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
  type WebbingPhotoErrorCode,
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
import { useId, useRef, useState, type ReactNode } from 'react';
import {
  Controller,
  FormProvider,
  useController,
  useFormContext,
  useFormState,
  useWatch,
  type Control,
  type UseFormReturn,
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
import { WebbingCatalogPicker } from '~/components/webbing-catalog-picker';
import {
  selectionName,
  useLegacyWebbingModels,
  type WebbingModelSelection,
} from '~/components/webbing-catalog-picker/model-selection';
import { SelectedCatalogDetails } from '~/components/webbing-catalog-specs';
import { WebbingInput } from '~/components/webbing-input';

const translationKey = 'app.(modals).register-webbing';
const ROOT_ERROR_CODES = new Set([
  'draft-conflict',
  'unconfirmed',
  'lookup-failed',
  'offline',
]);

type RegisterWebbingForm = UseFormReturn<RegisterWebbingFormData>;

export default function RegisterWebbing() {
  const { session, sessionLoading } = useAuth();
  const userId = session?.user.id;

  if (sessionLoading) {
    return (
      <SignedOutScreen>
        <View className="items-center py-8">
          <ActivityIndicator />
        </View>
      </SignedOutScreen>
    );
  }
  if (!userId) {
    return (
      <SignedOutScreen>
        <SignInRequired />
      </SignedOutScreen>
    );
  }
  return <RegistrationForm userId={userId} />;
}

function SignedOutScreen({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 px-6 pt-3 pb-8 gap-6">
        <OnboardHeader total={1} selectedIndex={0} onBack={router.back} />
        <RegistrationIntro />
        {children}
      </View>
    </SafeAreaView>
  );
}

function SignInRequired() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isLoginPending } = useAuth();

  return (
    <>
      <Alert variant="warning">
        <AlertIcon icon={AlertTriangleIcon} />
        <AlertContent>
          <AlertTitle>{t(`${translationKey}.authRequired.title`)}</AlertTitle>
          <AlertDescription>
            {t(`${translationKey}.authRequired.description`)}
          </AlertDescription>
        </AlertContent>
      </Alert>

      <View className="flex-grow" />

      <Button
        className="w-full rounded-full"
        disabled={isLoginPending}
        onPress={() => router.push('/(modals)/login')}
      >
        <Text>{t(`${translationKey}.authRequired.action`)}</Text>
      </Button>
    </>
  );
}

function RegistrationIntro() {
  const { t } = useTranslation();
  return (
    <>
      <View className="h-52">
        <RegisterWebbingIllustration className="w-full h-full" />
      </View>
      <View>
        <Text variant="h3" className="text-left">
          {t(`${translationKey}.title`)}
        </Text>
        <Text variant="muted" className="text-left">
          {t(`${translationKey}.description`)}
        </Text>
      </View>
    </>
  );
}

function RegistrationForm({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const { form, submit } = useRegisterWebbing({ createRegistrationKey: uuid });
  const experiment = useWebbingPickerExperiment();
  const [photo, setPhoto] = useState<PhotoAsset | null>(null);
  const registration = useRegistration({
    userId,
    form,
    submit,
    photo,
    experiment,
  });
  const { flow } = registration;

  return (
    <FormProvider {...form}>
      <BottomSheetModalProvider>
        <SafeAreaView className="flex-1">
          <KeyboardAwareScrollView
            contentContainerClassName="px-6 pt-3 pb-8 gap-4"
            keyboardShouldPersistTaps="handled"
          >
            <OnboardHeader total={1} selectedIndex={0} onBack={router.back} />
            <View className="gap-6">
              <RegistrationIntro />
              <LengthField />
              <ModelField experiment={experiment} />
              <StrengthClassSelector />
              <TagNameField />
              <PhotoField
                photo={photo}
                onChange={setPhoto}
                disabled={registration.isLocked}
              />
              <NoteField />
            </View>

            {!isOnline && <OfflineNotice />}
            {flow.phase === 'editing' && <SubmitError />}

            {/* Spacer to push paginator down */}
            <View className="flex-grow" />

            {registration.photoFailed ? (
              <PhotoFailedAlert
                error={flow.photoError}
                canRetry={isOnline && !!photo}
                onRetry={registration.retryPhoto}
                onContinue={registration.continueWithoutPhoto}
              />
            ) : (
              <>
                {flow.phase === 'uploadingPhoto' && <PhotoUploading />}
                <OnboardNavigator
                  total={1}
                  selectedIndex={0}
                  onIndexChange={() => {}} // There is only one step
                  onFinish={registration.submit}
                  goBack={router.back}
                  isLoading={registration.isLocked}
                  finishLabel={t(`${translationKey}.finishLabel`)}
                  showBack={false}
                />
              </>
            )}
          </KeyboardAwareScrollView>
        </SafeAreaView>
      </BottomSheetModalProvider>
    </FormProvider>
  );
}

/** Save the item, then its photo, then leave; each phase is recoverable. */
function useRegistration({
  userId,
  form,
  submit,
  photo,
  experiment,
}: {
  userId: string;
  form: RegisterWebbingForm;
  submit: ReturnType<typeof useRegisterWebbing>['submit'];
  photo: PhotoAsset | null;
  experiment: WebbingPickerExperiment;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const selectedLegacy = useSelectedLegacyModel(form.control);
  const [flow, setFlow] = useState<RegistrationFlowState>(
    initialRegistrationFlow,
  );
  const finished = useRef(false);

  const finish = () => {
    // Navigate back and ask for a review exactly once.
    if (finished.current) return;
    finished.current = true;
    requestReview();
    router.back();
  };

  const saveItem = async (values: RegisterWebbingFormData | null) => {
    if (!values) return null;
    const webbing = await submit({
      ...values,
      // A legacy model's own class is shown locked, not saved as personal.
      strengthClass: selectedLegacy?.strength_class
        ? undefined
        : values.strengthClass,
    });
    if (webbing) {
      captureWebbingRegistered(captureGrowthEvent, experiment, {
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
  };

  const run = async (values: RegisterWebbingFormData | null) => {
    const state = await advanceRegistration(
      flow,
      photo,
      {
        saveItem: () => saveItem(values),
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

  return {
    flow,
    /** Saving, uploading or done: the draft can no longer change. */
    isLocked:
      flow.phase === 'savingItem' ||
      flow.phase === 'uploadingPhoto' ||
      flow.phase === 'completed',
    photoFailed:
      flow.phase === 'savedPhotoFailed' ||
      flow.phase === 'photoCommitUnconfirmed',
    submit: () => {
      if (!isOnline) {
        form.setError('root', { type: 'offline', message: 'offline' });
        return;
      }
      void form.handleSubmit((values) => run(values))();
    },
    retryPhoto: () => void run(null),
    continueWithoutPhoto: () => {
      setFlow(continueWithoutPhoto(flow));
      finish();
    },
  };
}

/** The selected legacy model, derived from the draft's `modelID`. */
function useSelectedLegacyModel(control: Control<RegisterWebbingFormData>) {
  const modelID = useWatch({ control, name: 'modelID' });
  const { data } = useLegacyWebbingModels();
  if (!modelID) return null;
  return data?.find((model) => String(model.id) === modelID) ?? null;
}

function OfflineNotice() {
  const { t } = useTranslation();
  return (
    <Alert variant="default">
      <AlertIcon icon={CloudOffIcon} />
      <AlertContent>
        <AlertDescription>
          {t(`${translationKey}.errors.offline`)}
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

function SubmitError() {
  const { t } = useTranslation();
  const { errors } = useFormState<RegisterWebbingFormData>();
  const rootError = errors.root;
  if (!rootError) return null;

  const type = String(rootError.type ?? '');
  const message = ROOT_ERROR_CODES.has(type)
    ? t(`${translationKey}.errors.${type}`)
    : rootError.message;
  if (!message) return null;

  return (
    <Alert variant="destructive">
      <AlertIcon icon={AlertTriangleIcon} />
      <AlertContent>
        <AlertDescription>{message}</AlertDescription>
      </AlertContent>
    </Alert>
  );
}

function PhotoUploading() {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center justify-center gap-2">
      <ActivityIndicator />
      <Text className="text-sm text-muted-foreground">
        {t(`${translationKey}.photoPhase.uploading`)}
      </Text>
    </View>
  );
}

function PhotoFailedAlert({
  error,
  canRetry,
  onRetry,
  onContinue,
}: {
  error: WebbingPhotoErrorCode | null;
  canRetry: boolean;
  onRetry: () => void;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Alert variant="warning">
      <AlertIcon icon={AlertTriangleIcon} />
      <AlertContent className="gap-3">
        <AlertTitle>{t(`${translationKey}.photoPhase.failedTitle`)}</AlertTitle>
        <AlertDescription>
          {error ? `${t(`${translationKey}.photo.errors.${error}`)} ` : ''}
          {t(`${translationKey}.photoPhase.failedDescription`)}
        </AlertDescription>
        <Button disabled={!canRetry} onPress={onRetry}>
          <Text>{t(`${translationKey}.photoPhase.retryPhoto`)}</Text>
        </Button>
        <Button variant="outline" onPress={onContinue}>
          <Text>{t(`${translationKey}.photoPhase.continue`)}</Text>
        </Button>
      </AlertContent>
    </Alert>
  );
}

function LengthField() {
  const { control, setValue } = useFormContext<RegisterWebbingFormData>();
  const [leftLoop, rightLoop, length] = useWatch({
    control,
    name: ['leftLoop', 'rightLoop', 'length'],
  });
  const { errors } = useFormState({ control, name: 'length' });

  return (
    <WebbingInput
      leftLoop={leftLoop}
      rightLoop={rightLoop}
      length={length}
      onLeftLoopChange={(value) => setValue('leftLoop', value)}
      onRightLoopChange={(value) => setValue('rightLoop', value)}
      onLengthChange={(value) =>
        setValue('length', value, { shouldValidate: true })
      }
      error={errors.length?.message ?? null}
    />
  );
}

function ModelField({ experiment }: { experiment: WebbingPickerExperiment }) {
  const { t } = useTranslation();
  const labelId = useId();
  const { control, setValue, getValues } =
    useFormContext<RegisterWebbingFormData>();
  const catalogSnapshot = useWatch({ control, name: 'catalogSnapshot' });
  const selectedLegacy = useSelectedLegacyModel(control);
  // The label last filled in automatically; user edits are never replaced.
  const autoLabel = useRef<string | null>(null);

  const value: WebbingModelSelection | null = catalogSnapshot
    ? { source: 'catalog', snapshot: catalogSnapshot }
    : selectedLegacy
      ? { source: 'legacy', model: selectedLegacy }
      : null;

  const handleChange = (selection: WebbingModelSelection | null) => {
    // The selection is copied into the draft; catalog refetches never replace it.
    setValue(
      'catalogSnapshot',
      selection?.source === 'catalog' ? selection.snapshot : null,
      { shouldValidate: true },
    );
    setValue(
      'modelID',
      selection?.source === 'legacy' ? String(selection.model.id) : '',
      { shouldValidate: true },
    );
    const suggestion = selection ? selectionName(selection) : null;
    const tagName = getValues('tagName');
    const nextLabel = nextAutoLabel(tagName, autoLabel.current, suggestion);
    if (nextLabel !== tagName) {
      setValue('tagName', nextLabel, { shouldValidate: !!nextLabel });
    }
    autoLabel.current = suggestion;
  };

  return (
    <View className="gap-3">
      <WebbingCatalogPicker
        labelId={labelId}
        value={value}
        onChange={handleChange}
        experiment={experiment}
      />
      {catalogSnapshot ? (
        <SelectedCatalogDetails snapshot={catalogSnapshot} />
      ) : !selectedLegacy ? (
        <Text variant="muted" className="text-sm">
          {t(`${translationKey}.selectModel.manualHint`)}
        </Text>
      ) : null}
    </View>
  );
}

function TagNameField() {
  const { t } = useTranslation();
  const { control } = useFormContext<RegisterWebbingFormData>();
  return (
    <Controller
      control={control}
      name="tagName"
      render={({ field, fieldState }) => (
        <View className="gap-2">
          <Label nativeID="tagname">
            {t(`${translationKey}.tagName.label`)}
          </Label>
          <Input
            value={field.value}
            onChangeText={field.onChange}
            placeholder={t(`${translationKey}.tagName.placeholder`)}
            className={fieldState.error && 'border-destructive'}
            aria-labelledby="tagname"
          />
          <FieldError message={fieldState.error?.message} />
        </View>
      )}
    />
  );
}

function NoteField() {
  const { t } = useTranslation();
  const { control } = useFormContext<RegisterWebbingFormData>();
  return (
    <Controller
      control={control}
      name="note"
      render={({ field, fieldState }) => (
        <View className="gap-2">
          <Label nativeID="note">
            {t(`${translationKey}.note.label`)}{' '}
            <Text variant="muted">{t('common.optional')}</Text>
          </Label>
          <Textarea
            keyboardType="default"
            returnKeyType="done"
            placeholder={t(`${translationKey}.note.placeholder`)}
            {...field}
            submitBehavior="blurAndSubmit"
            onChangeText={(text) => field.onChange(text)}
            value={field.value}
            className={fieldState.error && 'border-destructive'}
            aria-labelledby="note"
          />
          <FieldError message={fieldState.error?.message} />
        </View>
      )}
    />
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text variant="small" className="text-destructive">
      {message}
    </Text>
  );
}

// Personal photo for the physical item, uploaded after the item is saved.
function PhotoField({
  photo,
  onChange,
  disabled,
}: {
  photo: PhotoAsset | null;
  onChange: (photo: PhotoAsset | null) => void;
  disabled: boolean;
}) {
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
      const asset = result.canceled ? undefined : result.assets[0];
      if (asset) {
        // Throws for formats we can't store.
        getStaticPhotoType(asset.mimeType);
        setError(null);
        onChange({
          uri: asset.uri,
          mimeType: asset.mimeType,
          fileSize: asset.fileSize,
        });
      }
    } catch (cause) {
      const code =
        cause instanceof WebbingPhotoError ? cause.code : 'unreadable';
      setError(t(`${translationKey}.photo.errors.${code}`));
    }
    // Not `finally`: React Compiler can't compile it yet.
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
          <PhotoPreview photo={photo} isPicking={isPicking} />
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
      <FieldError message={error ?? undefined} />
    </View>
  );
}

function PhotoPreview({
  photo,
  isPicking,
}: {
  photo: PhotoAsset | null;
  isPicking: boolean;
}) {
  const { t } = useTranslation();
  if (photo) {
    return (
      <Image
        source={{ uri: photo.uri }}
        contentFit="cover"
        style={{ width: '100%', height: '100%' }}
      />
    );
  }
  if (isPicking) return <ActivityIndicator />;
  return (
    <>
      <Icon as={CameraIcon} size={22} className="text-muted-foreground" />
      <Text className="text-xs text-muted-foreground">
        {t(`${translationKey}.photo.add`)}
      </Text>
    </>
  );
}

// Personal strength class. A legacy model's own class is shown locked; a
// SlackData class is shown separately and never becomes a personal value.
function StrengthClassSelector() {
  const { t } = useTranslation();
  const { control } = useFormContext<RegisterWebbingFormData>();
  const { field } = useController({ control, name: 'strengthClass' });
  const catalogSnapshot = useWatch({ control, name: 'catalogSnapshot' });
  const legacyModel = useSelectedLegacyModel(control);

  const lockedClass = legacyModel?.strength_class ?? null;
  const isLocked = !!lockedClass;
  const displayValue = isLocked ? lockedClass : field.value;
  const catalogClass = catalogSnapshot?.isaClass ?? null;
  const recommendedDays = legacyModel?.recommended_lifetime_days ?? null;

  return (
    <View className="gap-2">
      <Label nativeID="strengthClass">
        {t(`${translationKey}.strengthClass.label`)}
        {!isLocked && (
          <>
            {' '}
            <Text variant="muted">{t('common.optional')}</Text>
          </>
        )}
      </Label>

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
        {t(
          `${translationKey}.strengthClass.${isLocked ? 'lockedHint' : 'personalHint'}`,
        )}
      </Text>
      {catalogClass && (
        <Text variant="muted" className="text-sm">
          {t(`${translationKey}.strengthClass.catalogClass`, {
            value: catalogClass,
          })}
        </Text>
      )}

      {/* Only a legacy model carries a supported recommended lifetime */}
      {recommendedDays ? (
        <Text variant="muted" className="text-sm">
          {t(`${translationKey}.recommendedLifetime`, {
            days: recommendedDays,
          })}
        </Text>
      ) : null}
    </View>
  );
}
