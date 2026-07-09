import { useOrganization } from '@chooselife/ui';
import type { StartSubscriptionResponse } from '@packages/database/functions.types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '~/context/auth';
import { useMountEffect } from '~/hooks/use-mount-effect';
import { getManualPaymentRouteParams } from '~/lib/manual-payment';
import {
  fetchAddressByCep,
  fetchMembershipApplication,
  submitMembershipApplication,
  upsertMembershipApplicationDraft,
  type MembershipApplication,
} from '~/lib/membership-application';
import { queryKeys } from '~/lib/query-keys';
import { supabase } from '~/lib/supabase';

import {
  FooterCta,
  ProgressHeader,
  SuccessInterstitial,
} from '~/components/organizations/onboarding/controls';
import {
  createInitialForm,
  formToDraft,
  getFirstIncompleteStep,
  getStepErrors,
  isStepValid,
  maskCep,
  steps,
  unmask,
  type FormErrors,
  type FormField,
  type MembershipApplicationForm,
  type PlanType,
} from '~/components/organizations/onboarding/form';
import { StepFields } from '~/components/organizations/onboarding/step-fields';
import { Text } from '~/components/ui/text';

type SettledResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

const settle = <T,>(promise: Promise<T>): Promise<SettledResult<T>> =>
  promise.then(
    (value) => ({ ok: true, value }),
    (error: unknown) => ({ ok: false, error }),
  );

export default function OnboardingScreen() {
  const { session, sessionLoading, profile } = useAuth();
  const { accepted_terms_at, plan_type, slug } = useLocalSearchParams<{
    accepted_terms_at?: string;
    plan_type?: PlanType;
    slug: string;
  }>();
  const {
    data: organization,
    isLoading,
    isError,
  } = useOrganization(slug || '');
  const userId = session?.user.id;

  const applicationQuery = useQuery({
    queryKey: queryKeys.membershipApplication.byOrgUser(
      organization?.id,
      userId,
    ),
    queryFn: () => fetchMembershipApplication(organization!.id, userId!),
    enabled: Boolean(organization?.id && userId),
  });

  if (sessionLoading || isLoading || applicationQuery.isLoading) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center gap-3">
          <ActivityIndicator color="#18181B" />
          <Text className="text-zinc-500">Carregando cadastro...</Text>
        </View>
      </View>
    );
  }

  if (!session?.user) {
    return (
      <Redirect
        href={{
          pathname: '/(modals)/login',
          params: {
            redirect_to: `/organizations/${slug}/onboarding?plan_type=${plan_type ?? 'monthly'}`,
          },
        }}
      />
    );
  }

  if (!slug || isError || !organization) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center px-6">
          <Text className="text-zinc-950 text-xl font-bold text-center">
            Associação não encontrada.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <OnboardingWizard
      // Stable for the org+user session. Using application id remounted the
      // wizard on the first draft save and reset step/CTA state mid-flow.
      key={`${organization.id}-${userId}`}
      acceptedTermsAt={accepted_terms_at}
      application={applicationQuery.data ?? null}
      email={session.user.email}
      organizationId={organization.id}
      planType={plan_type ?? 'monthly'}
      profileBirthday={profile?.birthday}
      profileName={profile?.name}
      slug={slug}
      userId={session.user.id}
    />
  );
}

type OnboardingWizardProps = {
  acceptedTermsAt?: string;
  application: MembershipApplication | null;
  email?: string | null;
  organizationId: string;
  planType: PlanType;
  profileBirthday?: string | null;
  profileName?: string | null;
  slug: string;
  userId: string;
};

type OnboardingWorkflowProps = OnboardingWizardProps & {
  onScrollToTop: () => void;
};

function useOnboardingWizard({
  acceptedTermsAt,
  application,
  email,
  organizationId,
  planType,
  profileBirthday,
  profileName,
  onScrollToTop,
  slug,
  userId,
}: OnboardingWorkflowProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const initialForm = React.useMemo(
    () =>
      createInitialForm({
        acceptedTermsAt,
        application,
        email,
        profileBirthday,
        profileName,
      }),
    [acceptedTermsAt, application, email, profileBirthday, profileName],
  );
  const form = useForm<MembershipApplicationForm>({
    defaultValues: initialForm,
    mode: 'onChange',
  });
  const currentForm = useWatch({
    control: form.control,
    defaultValue: initialForm,
  }) as MembershipApplicationForm;
  const [step, setStep] = React.useState(() =>
    application?.status === 'submitted'
      ? steps.length - 1
      : application?.status === 'draft'
        ? getFirstIncompleteStep(initialForm)
        : 0,
  );
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [createdApplicationId, setCreatedApplicationId] = React.useState<
    string | undefined
  >();
  const [createdSubmittedId, setCreatedSubmittedId] = React.useState<
    string | undefined
  >();
  const applicationId = createdApplicationId ?? application?.id;
  const submittedApplicationId =
    createdSubmittedId ??
    (application?.status === 'submitted' ? application.id : undefined);
  const [savedVisible, setSavedVisible] = React.useState(false);
  const [cepLoading, setCepLoading] = React.useState(false);
  const [cepFailed, setCepFailed] = React.useState(false);
  // Bumps when ViaCEP fills address fields so GlassField remounts with new
  // native state (useNativeState only captures the initial value once).
  const [addressAutofillKey, setAddressAutofillKey] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [continuing, setContinuing] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const submittedIdRef = React.useRef(submittedApplicationId);
  const applicationStatusRef = React.useRef(application?.status);
  const errorsRef = React.useRef(errors);
  const stepRef = React.useRef(step);
  // Continuous stepper position: step + 1 pills' worth of fill.
  const progress = useSharedValue(step + 1);
  // 0 → 1 on every step change; drives the step slide-in deterministically so
  // an interrupted transition can never leave a residual horizontal offset.
  const stepTransition = useSharedValue(1);
  const stepDirection = useSharedValue(1);
  const stepAnimatedStyle = useAnimatedStyle(() => ({
    opacity: stepTransition.get(),
    transform: [
      { translateX: (1 - stepTransition.get()) * 32 * stepDirection.get() },
    ],
  }));
  const stepValid = isStepValid(currentForm, step);
  const applicationQueryKey = queryKeys.membershipApplication.byOrgUser(
    organizationId,
    userId,
  );

  submittedIdRef.current = submittedApplicationId;
  applicationStatusRef.current = application?.status;
  errorsRef.current = errors;
  stepRef.current = step;

  const getSubmittedApplicationId = React.useCallback(() => {
    const cachedApplication =
      queryClient.getQueryData<MembershipApplication | null>(
        applicationQueryKey,
      );

    return (
      submittedIdRef.current ??
      (cachedApplication?.status === 'submitted'
        ? cachedApplication.id
        : undefined) ??
      (applicationStatusRef.current === 'submitted'
        ? application?.id
        : undefined)
    );
  }, [application?.id, applicationQueryKey, queryClient]);

  const saveMutation = useMutation({
    mutationFn: async (nextForm: MembershipApplicationForm) =>
      upsertMembershipApplicationDraft(
        formToDraft(nextForm, organizationId, userId),
      ),
    onSuccess: async (data) => {
      setCreatedApplicationId(data.id);
      queryClient.setQueryData(applicationQueryKey, data);
      await queryClient.invalidateQueries({ queryKey: applicationQueryKey });
      setSavedVisible(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedVisible(false), 1500);
    },
  });

  const submitMutation = useMutation({
    mutationFn: submitMembershipApplication,
    onSuccess: async (data) => {
      setCreatedSubmittedId(data?.id ?? applicationId);
      await queryClient.invalidateQueries({
        queryKey: applicationQueryKey,
      });
    },
  });

  const startSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const { data: charge, error } =
        await supabase.functions.invoke<StartSubscriptionResponse>(
          'start-subscription',
          {
            body: {
              plan_type: planType,
              slug,
            },
          },
        );

      if (error) {
        const errorContext = error.context;
        if (errorContext && typeof errorContext.json === 'function') {
          const errorData = await errorContext.json();
          throw new Error(errorData?.error || error.message);
        }
        throw error;
      }

      if (!charge) {
        throw new Error('Invalid response from start-subscription function');
      }

      return {
        amount: 'amount' in charge ? charge.amount : undefined,
        paymentId: charge.paymentId,
      };
    },
    onSuccess: async (data) => {
      setSuccess(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.subscription.all,
      });
      setTimeout(() => {
        router.replace({
          pathname: '/payment',
          params: getManualPaymentRouteParams({
            amount: data.amount,
            paymentId: data.paymentId,
            paymentContext: 'new_member',
            slug,
          }),
        });
      }, 1600);
    },
  });

  const saveNow = React.useCallback(
    async (nextForm: MembershipApplicationForm) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      return saveMutation.mutateAsync(nextForm);
    },
    [saveMutation],
  );

  const scheduleSave = React.useCallback(
    (nextForm: MembershipApplicationForm) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveMutation.mutate(nextForm);
      }, 800);
    },
    [saveMutation],
  );

  useMountEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      `Passo ${step + 1} de ${steps.length}, ${steps[step].title}`,
    );

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  });

  const handleFormValuesChange = React.useEffectEvent(
    (
      values: Partial<MembershipApplicationForm>,
      { name }: { name?: string },
    ) => {
      if (!name) return;

      const next = values as MembershipApplicationForm;

      if (Object.keys(errorsRef.current).length > 0) {
        setErrors(getStepErrors(next, stepRef.current));
      }

      if (!getSubmittedApplicationId()) {
        scheduleSave(next);
      }
    },
  );

  // Subscribe once: Effect Events always read the current callbacks and state.
  // `subscribe` is react-hook-form's compiler-safe, non-rendering subscription
  // API; its legacy `watch(callback)` overload prevents React Compiler output.
  useMountEffect(() =>
    form.subscribe({
      formState: { values: true },
      callback: ({ values, name }) =>
        handleFormValuesChange(values, { name }),
    }),
  );

  const setField = <T extends FormField>(
    field: T,
    value: MembershipApplicationForm[T],
  ) => {
    form.setValue(field, value as never, {
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  const patchForm = (patch: Partial<MembershipApplicationForm>) => {
    (
      Object.entries(patch) as [
        FormField,
        MembershipApplicationForm[FormField],
      ][]
    ).forEach(([field, value]) => {
      form.setValue(field, value as never, {
        shouldDirty: true,
        shouldTouch: true,
      });
    });
  };

  const handleCepChange = (value: string) => {
    const nextPostalCode = maskCep(value);
    const nextDigits = unmask(nextPostalCode);
    const previousDigits = unmask(form.getValues('postal_code'));
    setField('postal_code', nextPostalCode);

    if (nextDigits.length === 8 && previousDigits.length !== 8) {
      setCepFailed(false);
      setCepLoading(true);
      fetchAddressByCep(nextDigits)
        .then((address) => {
          if (!address) {
            setCepFailed(true);
            return;
          }
          patchForm({
            address_line: address.address_line,
            city: address.city,
            state: address.state,
          });
          setAddressAutofillKey((key) => key + 1);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        })
        .catch(() => setCepFailed(true))
        .finally(() => setCepLoading(false));
    }
  };

  const goToStep = (nextStep: number, nextDirection: 'back' | 'forward') => {
    progress.set(
      withTiming(nextStep + 1, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      }),
    );
    stepDirection.set(nextDirection === 'forward' ? 1 : -1);
    stepTransition.set(0);
    stepTransition.set(
      withTiming(1, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      }),
    );
    setStep(nextStep);
    setErrors({});
    onScrollToTop();
    AccessibilityInfo.announceForAccessibility(
      `Passo ${nextStep + 1} de ${steps.length}, ${steps[nextStep].title}`,
    );
  };

  const handleBack = async () => {
    if (step === 0) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goToStep(step - 1, 'back');
  };

  const handleContinue = async () => {
    setErrorMessage(null);

    const values = form.getValues();
    const nextErrors = getStepErrors(values, step);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      onScrollToTop();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setContinuing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const saveErrorMessage =
      'Não foi possível salvar seu cadastro. Verifique a conexão e tente novamente.';

    const reportError = async (message: string) => {
      setErrorMessage(message);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setContinuing(false);
    };

    if (step < steps.length - 1) {
      if (!getSubmittedApplicationId()) {
        const saved = await settle(saveNow(values));
        if (!saved.ok) {
          await reportError(saveErrorMessage);
          return;
        }
      }
      goToStep(step + 1, 'forward');
      setContinuing(false);
      return;
    }

    if (!getSubmittedApplicationId()) {
      const saved = await settle(saveNow(values));
      if (!saved.ok) {
        await reportError(saveErrorMessage);
        return;
      }

      const submitted = await settle(
        submitMutation.mutateAsync(applicationId ?? saved.value.id),
      );
      if (!submitted.ok) {
        await reportError(saveErrorMessage);
        return;
      }

      setCreatedSubmittedId(
        submitted.value?.id ?? applicationId ?? saved.value.id,
      );
    }

    const payment = await settle(startSubscriptionMutation.mutateAsync());
    if (!payment.ok) {
      const message =
        payment.error instanceof Error
          ? payment.error.message ||
            'Não foi possível iniciar o pagamento. Tente novamente.'
          : 'Não foi possível iniciar o pagamento. Tente novamente.';
      await reportError(message);
      return;
    }

    setContinuing(false);
  };

  return {
    addressAutofillKey,
    cepFailed,
    cepLoading,
    continuing,
    errorMessage,
    errors,
    form,
    handleBack,
    handleCepChange,
    handleContinue,
    insets,
    progress,
    router,
    savedVisible,
    step,
    stepAnimatedStyle,
    stepValid,
    success,
  };
}

function OnboardingWizard(props: OnboardingWizardProps) {
  const scrollRef = React.useRef<ScrollView>(null);
  const scrollToTop = React.useCallback(() => {
    scrollRef.current?.scrollTo({ animated: true, y: 0 });
  }, []);
  const wizard = useOnboardingWizard({ ...props, onScrollToTop: scrollToTop });

  if (wizard.success) {
    return (
      <View className="flex-1 bg-white">
        <SuccessInterstitial />
      </View>
    );
  }

  return (
    <FormProvider {...wizard.form}>
      <View className="flex-1 bg-white">
        <ProgressHeader
          canGoBack={wizard.step > 0}
          currentStep={wizard.step}
          onBack={wizard.handleBack}
          onClose={() => wizard.router.replace('/(tabs)/organizations')}
          progress={wizard.progress}
          subtitle={steps[wizard.step].subtitle}
          title={steps[wizard.step].title}
          totalSteps={steps.length}
        />
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentInset={{
              bottom: wizard.insets.bottom,
              top: wizard.insets.top,
            }}
            contentContainerClassName="px-6 gap-5"
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'flex-end',
              paddingBottom: 112,
              paddingTop: 196,
            }}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={Keyboard.dismiss}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              key={`step-${wizard.step}`}
              className="gap-5"
              style={wizard.stepAnimatedStyle}
            >
              <StepFields
                addressAutofillKey={wizard.addressAutofillKey}
                cepFailed={wizard.cepFailed}
                cepLoading={wizard.cepLoading}
                errors={wizard.errors}
                onCepChange={wizard.handleCepChange}
                step={wizard.step}
              />
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
        {wizard.errorMessage ? (
          <Animated.Text
            entering={FadeIn.duration(180)}
            className="absolute left-6 right-6 text-red-600 text-sm text-center"
            style={{ bottom: wizard.insets.bottom + 86 }}
          >
            {wizard.errorMessage}
          </Animated.Text>
        ) : null}
        <FooterCta
          disabled={!wizard.stepValid}
          label={
            wizard.step === steps.length - 1
              ? 'Ir para o pagamento'
              : 'Continuar'
          }
          loading={wizard.continuing}
          onPress={wizard.handleContinue}
          saved={wizard.savedVisible && !wizard.continuing}
        />
      </View>
    </FormProvider>
  );
}
