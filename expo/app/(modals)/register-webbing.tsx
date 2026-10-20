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
  isPhotoFileError,
  photoProgress,
  type LocalPhoto,
  type PhotoProgress,
} from '~/features/photos/photo-file';
import { PHOTO_SPECS } from '~/features/photos/pick-photo';
import { saveWebbingPhoto } from '~/features/webbing/photo-upload';
import {
  advanceRegistration,
  continueWithoutPhoto,
  initialRegistrationFlow,
  nextAutoLabel,
  type RegistrationFlowState,
} from '~/features/webbing/registration-flow';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { AlertTriangleIcon, CloudOffIcon } from 'lucide-react-native';
import { useId, useRef, useState, type ReactNode } from 'react';
import {
  Controller,
  FormProvider,
  useController,
  useFormContext,
  useFormState,
  useWatch,
  type UseFormReturn,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { v4 as uuid } from 'uuid';

import { useAuth } from '~/context/auth';
import { useOnlineStatus } from '~/context/react-query';
import {
  createWebbingPhotoDeps,
  setCachedWebbingPhoto,
} from '~/hooks/use-webbing-photo';
import { useWebbingPickerExperiment } from '~/hooks/use-webbing-picker-experiment';
import RegisterWebbingIllustration from '~/lib/icons/register-webbing';
import { cn } from '~/lib/utils';
import { requestReview } from '~/utils/request-review';

import { OnboardHeader, OnboardNavigator } from '~/components/onboard';
import { PhotoCover, type PhotoTransfer } from '~/components/photo-picker';
import { SafeAreaView } from '~/components/styled';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Text } from '~/components/ui/text';
import { Textarea } from '~/components/ui/textarea';
import { WebbingCatalogPicker } from '~/components/webbing-catalog-picker';
import {
  selectionName,
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
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
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
                transfer={registration.photoTransfer}
                onRetry={
                  registration.canRetryPhoto
                    ? registration.retryPhoto
                    : undefined
                }
                disabled={registration.isLocked}
              />
              <NoteField />
            </View>

            {!isOnline && <OfflineNotice />}
            {flow.phase === 'editing' && <SubmitError />}

            {/* Spacer to push paginator down */}
            <View className="flex-grow" />

            {registration.photoFailed ? (
              <PhotoFailedActions
                onUpload={
                  registration.canUploadNewPhoto
                    ? registration.retryPhoto
                    : undefined
                }
                onContinue={registration.continueWithoutPhoto}
              />
            ) : (
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
  photo: LocalPhoto | null;
  experiment: WebbingPickerExperiment;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [flow, setFlow] = useState<RegistrationFlowState>(
    initialRegistrationFlow,
  );
  // The photo the last upload was for, and how far it got.
  const [attempt, setAttempt] = useState<{
    photo: LocalPhoto;
    progress: PhotoProgress;
  } | null>(null);
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
    const webbing = await submit(values);
    if (webbing) {
      captureWebbingRegistered(captureGrowthEvent, experiment, {
        modelSource: values.catalogSnapshot ? 'catalog' : 'manual',
        hasPhoto: !!photo,
      });
      flushGrowthEvents();
    }
    return webbing;
  };

  const run = async (values: RegisterWebbingFormData | null) => {
    if (photo) setAttempt({ photo, progress: photoProgress('preparing') });
    const state = await advanceRegistration(
      flow,
      photo,
      {
        saveItem: () => saveItem(values),
        savePhoto: async ({ webbing, asset, pending }) => {
          const imagePath = await saveWebbingPhoto({
            webbingId: webbing.id,
            previousPath: webbing.image_path,
            asset,
            pending,
            onProgress: (progress) => setAttempt({ photo: asset, progress }),
            deps: createWebbingPhotoDeps(webbing.id, userId),
          });
          setCachedWebbingPhoto(queryClient, userId, webbing.id, imagePath);
          return imagePath;
        },
      },
      setFlow,
    );
    if (state.phase === 'completed') {
      if (photo) {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      }
      finish();
    } else if (state.photoError) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const photoFailed =
    flow.phase === 'savedPhotoFailed' ||
    flow.phase === 'photoCommitUnconfirmed';
  // Replacing the photo after a failure starts over from an idle field.
  const isAttempted = !!photo && attempt?.photo === photo;

  return {
    flow,
    photoTransfer: derivePhotoTransfer(
      flow,
      photo,
      isAttempted ? attempt.progress : null,
      t,
    ),
    /** Retry the same photo, when retrying can help. */
    canRetryPhoto:
      photoFailed &&
      isOnline &&
      isAttempted &&
      !!flow.photoError &&
      !isPhotoFileError(flow.photoError),
    /** A different photo was chosen after the failure. */
    canUploadNewPhoto: photoFailed && isOnline && !!photo && !isAttempted,
    /** Saving, uploading or done: the draft can no longer change. */
    isLocked:
      flow.phase === 'savingItem' ||
      flow.phase === 'uploadingPhoto' ||
      flow.phase === 'completed',
    photoFailed,
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

/** The photo field's state, read off the registration phase. */
function derivePhotoTransfer(
  flow: RegistrationFlowState,
  photo: LocalPhoto | null,
  progress: PhotoProgress | null,
  t: ReturnType<typeof useTranslation>['t'],
): PhotoTransfer {
  if (!photo) return { state: 'idle' };
  switch (flow.phase) {
    case 'savingItem':
      return { state: 'queued' };
    case 'uploadingPhoto':
      return {
        state: 'uploading',
        ...(progress ?? photoProgress('preparing')),
      };
    case 'savedPhotoFailed':
    case 'photoCommitUnconfirmed':
      if (!progress) return { state: 'idle' };
      return {
        state: 'failed',
        progress: progress.progress,
        message: t(
          `components.photo-picker.errors.${flow.photoError ?? 'upload-failed'}`,
        ),
      };
    case 'completed':
      return { state: 'saved' };
    default:
      return { state: 'idle' };
  }
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

/** The webbing is saved; offer to finish without the photo. */
function PhotoFailedActions({
  onUpload,
  onContinue,
}: {
  onUpload?: () => void;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-3">
      {onUpload ? (
        <Button className="w-full rounded-full" onPress={onUpload}>
          <Text>{t(`${translationKey}.photoPhase.uploadPhoto`)}</Text>
        </Button>
      ) : null}
      <Button
        variant="outline"
        className="w-full rounded-full"
        onPress={onContinue}
      >
        <Text>{t(`${translationKey}.photoPhase.continue`)}</Text>
      </Button>
      <Text variant="muted" className="text-center text-sm">
        {t(`${translationKey}.photoPhase.failedDescription`)}
      </Text>
    </View>
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
  // The label last filled in automatically; user edits are never replaced.
  const autoLabel = useRef<string | null>(null);

  const value: WebbingModelSelection | null = catalogSnapshot
    ? { source: 'catalog', snapshot: catalogSnapshot }
    : null;

  const handleChange = (selection: WebbingModelSelection | null) => {
    // The selection is copied into the draft; catalog refetches never replace it.
    setValue('catalogSnapshot', selection?.snapshot ?? null, {
      shouldValidate: true,
    });
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
      ) : (
        <Text variant="muted" className="text-sm">
          {t(`${translationKey}.selectModel.manualHint`)}
        </Text>
      )}
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
  transfer,
  onRetry,
  disabled,
}: {
  photo: LocalPhoto | null;
  onChange: (photo: LocalPhoto | null) => void;
  transfer: PhotoTransfer;
  onRetry?: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-2">
      <Label nativeID="photo">
        {t(`${translationKey}.photo.label`)}{' '}
        <Text variant="muted">{t('common.optional')}</Text>
      </Label>
      <PhotoCover
        spec={PHOTO_SPECS.webbing}
        value={photo}
        onChange={onChange}
        transfer={transfer}
        onRetry={onRetry}
        disabled={disabled}
        instructions={t(`${translationKey}.photo.instructions`)}
      />
    </View>
  );
}

// SlackData certification stays separate from the optional personal strength class.
function StrengthClassSelector() {
  const { t } = useTranslation();
  const { control } = useFormContext<RegisterWebbingFormData>();
  const { field } = useController({ control, name: 'strengthClass' });
  const catalogSnapshot = useWatch({ control, name: 'catalogSnapshot' });
  const catalogClass = catalogSnapshot?.isaClass ?? null;

  return (
    <View className="gap-2">
      <Label nativeID="strengthClass">
        {t(`${translationKey}.strengthClass.label`)}{' '}
        <Text variant="muted">{t('common.optional')}</Text>
      </Label>

      <View className="flex-row gap-2">
        {STRENGTH_CLASS_OPTIONS.map((option) => {
          const isSelected = field.value === option;
          return (
            <TouchableOpacity
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => field.onChange(isSelected ? undefined : option)}
              className={cn(
                'flex-1 py-3 rounded-lg border items-center justify-center',
                isSelected
                  ? getStrengthClassColor(option)
                  : 'border-border bg-muted/30',
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
        {t(`${translationKey}.strengthClass.personalHint`)}
      </Text>
      {catalogClass && (
        <Text variant="muted" className="text-sm">
          {t(`${translationKey}.strengthClass.catalogClass`, {
            value: catalogClass,
          })}
        </Text>
      )}
    </View>
  );
}
