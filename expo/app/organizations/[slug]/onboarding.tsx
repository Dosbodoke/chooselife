import { useOrganization } from '@chooselife/ui';
import type { StartSubscriptionResponse } from '@packages/database/functions.types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
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
  FadeInDown,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
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
  animatedLayout,
  FooterCta,
  GlassField,
  NativeSwitchRow,
  ProgressHeader,
  SelectCards,
  SelectChips,
  SuccessInterstitial,
} from '~/components/organizations/onboarding/controls';
import {
  bloodTypeOptions,
  createInitialForm,
  firstAidOptions,
  formToDraft,
  getFirstIncompleteStep,
  getStepErrors,
  highlineExperienceOptions,
  isStepValid,
  maritalStatusOptions,
  maskCep,
  maskCpf,
  maskDate,
  maskPhone,
  relationshipOptions,
  steps,
  unmask,
  type FormErrors,
  type FormField,
  type MembershipApplicationForm,
  type PlanType,
  type YesNoValue,
} from '~/components/organizations/onboarding/form';
import { Text } from '~/components/ui/text';

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
      key={applicationQuery.data?.id ?? 'new-application'}
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

function OnboardingWizard({
  acceptedTermsAt,
  application,
  email,
  organizationId,
  planType,
  profileBirthday,
  profileName,
  slug,
  userId,
}: {
  acceptedTermsAt?: string;
  application: MembershipApplication | null;
  email?: string | null;
  organizationId: string;
  planType: PlanType;
  profileBirthday?: string | null;
  profileName?: string | null;
  slug: string;
  userId: string;
}) {
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
  const [form, setForm] =
    React.useState<MembershipApplicationForm>(initialForm);
  const [step, setStep] = React.useState(() =>
    application?.status === 'submitted'
      ? steps.length - 1
      : application?.status === 'draft'
        ? getFirstIncompleteStep(initialForm)
        : 0,
  );
  const [direction, setDirection] = React.useState<'back' | 'forward'>(
    'forward',
  );
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [applicationId, setApplicationId] = React.useState(application?.id);
  const [submittedApplicationId, setSubmittedApplicationId] = React.useState(
    application?.status === 'submitted' ? application.id : undefined,
  );
  const [showResumeBanner, setShowResumeBanner] = React.useState(
    application?.status === 'draft',
  );
  const [savedVisible, setSavedVisible] = React.useState(false);
  const [cepLoading, setCepLoading] = React.useState(false);
  const [cepFailed, setCepFailed] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const scrollRef = React.useRef<ScrollView>(null);
  const progress = useSharedValue(1);
  const stepValid = isStepValid(form, step);
  const applicationQueryKey = queryKeys.membershipApplication.byOrgUser(
    organizationId,
    userId,
  );
  const getSubmittedApplicationId = () => {
    const cachedApplication =
      queryClient.getQueryData<MembershipApplication | null>(
        applicationQueryKey,
      );

    return (
      submittedApplicationId ??
      (cachedApplication?.status === 'submitted'
        ? cachedApplication.id
        : undefined) ??
      (application?.status === 'submitted' ? application.id : undefined)
    );
  };

  const saveMutation = useMutation({
    mutationFn: async (nextForm: MembershipApplicationForm) =>
      upsertMembershipApplicationDraft(
        formToDraft(nextForm, organizationId, userId),
      ),
    onSuccess: (data) => {
      setApplicationId(data.id);
      queryClient.setQueryData(applicationQueryKey, data);
      setSavedVisible(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedVisible(false), 1500);
    },
  });

  const submitMutation = useMutation({
    mutationFn: submitMembershipApplication,
    onSuccess: async (data) => {
      setSubmittedApplicationId(data?.id ?? applicationId);
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

  useMountEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      `Passo ${step + 1} de ${steps.length}, ${steps[step].title}`,
    );

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  });

  React.useEffect(() => {
    if (!showResumeBanner) return;

    const timer = setTimeout(() => {
      setShowResumeBanner(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [showResumeBanner]);

  const saveNow = async (nextForm: MembershipApplicationForm) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    return saveMutation.mutateAsync(nextForm);
  };

  const scheduleSave = (nextForm: MembershipApplicationForm) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveMutation.mutate(nextForm);
    }, 800);
  };

  const patchForm = (
    patch:
      | Partial<MembershipApplicationForm>
      | ((
          current: MembershipApplicationForm,
        ) => Partial<MembershipApplicationForm>),
    options: { save?: boolean } = { save: true },
  ) => {
    setForm((current) => {
      const resolved = typeof patch === 'function' ? patch(current) : patch;
      const next = { ...current, ...resolved };

      if (options.save && !getSubmittedApplicationId()) scheduleSave(next);
      if (Object.keys(errors).length > 0) {
        setErrors(getStepErrors(next, step));
      }

      return next;
    });
  };

  const setField = <T extends FormField>(
    field: T,
    value: MembershipApplicationForm[T],
  ) => {
    patchForm({ [field]: value } as Partial<MembershipApplicationForm>);
  };

  const handleCepChange = (value: string) => {
    const nextPostalCode = maskCep(value);
    const nextDigits = unmask(nextPostalCode);
    const previousDigits = unmask(form.postal_code);
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
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        })
        .catch(() => setCepFailed(true))
        .finally(() => setCepLoading(false));
    }
  };

  const restart = () => {
    const next = createInitialForm({
      acceptedTermsAt: form.accepted_terms_at ?? acceptedTermsAt,
      application: null,
      email,
      profileBirthday,
      profileName,
    });
    setForm(next);
    setErrors({});
    setStep(0);
    setDirection('back');
    setShowResumeBanner(false);
    scheduleSave(next);
  };

  const goToStep = (nextStep: number, nextDirection: 'back' | 'forward') => {
    setDirection(nextDirection);
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
    setStep(nextStep);
    setErrors({});
    scrollRef.current?.scrollTo({ animated: true, y: 0 });
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

    const nextErrors = getStepErrors(form, step);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      scrollRef.current?.scrollTo({ animated: true, y: 0 });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    let stage: 'payment' | 'save' = 'save';

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (step < steps.length - 1) {
        if (!getSubmittedApplicationId()) {
          await saveNow(form);
        }
        goToStep(step + 1, 'forward');
        return;
      }

      const existingSubmittedId = getSubmittedApplicationId();

      if (!existingSubmittedId) {
        const saved = await saveNow(form);
        const submitted = await submitMutation.mutateAsync(
          applicationId ?? saved.id,
        );
        setSubmittedApplicationId(submitted?.id ?? applicationId ?? saved.id);
      }

      stage = 'payment';
      await startSubscriptionMutation.mutateAsync();
    } catch (error) {
      const message =
        stage === 'payment'
          ? error instanceof Error
            ? error.message ||
              'Não foi possível iniciar o pagamento. Tente novamente.'
            : 'Não foi possível iniciar o pagamento. Tente novamente.'
          : 'Não foi possível salvar seu cadastro. Verifique a conexão e tente novamente.';

      setErrorMessage(message);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  if (success) {
    return (
      <View className="flex-1 bg-white">
        <SuccessInterstitial />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <ProgressHeader
        canGoBack={step > 0}
        currentStep={step}
        onBack={handleBack}
        onClose={() => router.replace('/(tabs)/organizations')}
        onDismissResume={() => setShowResumeBanner(false)}
        onRestartResume={restart}
        progress={progress}
        savedVisible={savedVisible}
        showResumeBanner={showResumeBanner}
        subtitle={steps[step].subtitle}
        title={steps[step].title}
        totalSteps={steps.length}
      />
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="px-6 gap-5"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'flex-end',
            paddingBottom: insets.bottom + 112,
            paddingTop: insets.top + 196,
          }}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            key={`step-${step}`}
            entering={
              direction === 'forward'
                ? SlideInRight.duration(250)
                : SlideInLeft.duration(250)
            }
            exiting={
              direction === 'forward'
                ? SlideOutLeft.duration(200)
                : SlideOutRight.duration(200)
            }
            className="gap-5"
          >
            <StepFields
              cepFailed={cepFailed}
              cepLoading={cepLoading}
              errors={errors}
              form={form}
              onCepChange={handleCepChange}
              setField={setField}
              step={step}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      {errorMessage ? (
        <Animated.Text
          entering={FadeIn.duration(180)}
          className="absolute left-6 right-6 text-red-600 text-sm text-center"
          style={{ bottom: insets.bottom + 86 }}
        >
          {errorMessage}
        </Animated.Text>
      ) : null}
      <FooterCta
        disabled={!stepValid}
        label={step === steps.length - 1 ? 'Ir para o pagamento' : 'Continuar'}
        loading={
          saveMutation.isPending ||
          submitMutation.isPending ||
          startSubscriptionMutation.isPending
        }
        onPress={handleContinue}
      />
    </View>
  );
}

function StepFields({
  cepFailed,
  cepLoading,
  errors,
  form,
  onCepChange,
  setField,
  step,
}: {
  cepFailed: boolean;
  cepLoading: boolean;
  errors: FormErrors;
  form: MembershipApplicationForm;
  onCepChange: (value: string) => void;
  setField: <T extends FormField>(
    field: T,
    value: MembershipApplicationForm[T],
  ) => void;
  step: number;
}) {
  const wrap = (index: number, children: React.ReactNode) => (
    <Animated.View
      key={index}
      entering={FadeInDown.delay(250 + index * 60).duration(300)}
      layout={animatedLayout}
    >
      {children}
    </Animated.View>
  );

  if (step === 0) {
    return (
      <View className="gap-4">
        {wrap(
          0,
          <GlassField
            accessibilityLabel="Nome completo"
            error={errors.full_name}
            label="Nome completo"
            onChangeText={(value) => setField('full_name', value)}
            required
            textContentType="name"
            value={form.full_name}
          />,
        )}
        {wrap(
          1,
          <GlassField
            accessibilityLabel="Data de nascimento"
            error={errors.birth_date}
            keyboardType="number-pad"
            label="Data de nascimento"
            onChangeText={(value) => setField('birth_date', maskDate(value))}
            placeholder="DD/MM/AAAA"
            required
            value={form.birth_date}
          />,
        )}
        {wrap(
          2,
          <GlassField
            accessibilityLabel="Local de nascimento"
            label="Local de nascimento"
            onChangeText={(value) => setField('birthplace', value)}
            placeholder="Cidade e Estado"
            value={form.birthplace}
          />,
        )}
        {wrap(
          3,
          <GlassField
            accessibilityLabel="Nacionalidade"
            label="Nacionalidade"
            onChangeText={(value) => setField('nationality', value)}
            value={form.nationality}
          />,
        )}
        {wrap(
          4,
          <SelectChips
            error={errors.marital_status}
            label="Estado civil"
            onChange={(value) => setField('marital_status', value)}
            options={maritalStatusOptions}
            required
            value={form.marital_status}
          />,
        )}
        {wrap(
          5,
          <GlassField
            accessibilityLabel="Profissão"
            error={errors.profession}
            label="Profissão"
            onChangeText={(value) => setField('profession', value)}
            required
            value={form.profession}
          />,
        )}
      </View>
    );
  }

  if (step === 1) {
    return (
      <View className="gap-4">
        {wrap(
          0,
          <GlassField
            accessibilityLabel="CPF"
            error={errors.cpf}
            keyboardType="number-pad"
            label="CPF"
            onChangeText={(value) => setField('cpf', maskCpf(value))}
            required
            value={form.cpf}
          />,
        )}
        {wrap(
          1,
          <GlassField
            accessibilityLabel="RG ou CIN"
            label="RG/CIN"
            onChangeText={(value) => setField('id_document_number', value)}
            value={form.id_document_number}
          />,
        )}
        {wrap(
          2,
          <GlassField
            accessibilityLabel="Órgão expedidor"
            autoCapitalize="characters"
            error={errors.id_document_issuer}
            label="Órgão expedidor"
            onChangeText={(value) => setField('id_document_issuer', value)}
            required
            value={form.id_document_issuer}
          />,
        )}
      </View>
    );
  }

  if (step === 2) {
    return (
      <View className="gap-4">
        {wrap(
          0,
          <GlassField
            accessibilityLabel="CEP"
            error={errors.postal_code}
            keyboardType="number-pad"
            label="CEP"
            onChangeText={onCepChange}
            required
            rightSlot={
              cepLoading ? <ActivityIndicator color="#6D28D9" /> : null
            }
            value={form.postal_code}
          />,
        )}
        {cepFailed ? (
          <Text className="text-amber-700 text-xs">
            CEP não encontrado — preencha manualmente
          </Text>
        ) : null}
        {wrap(
          1,
          <GlassField
            accessibilityLabel="Endereço"
            label="Endereço"
            onChangeText={(value) => setField('address_line', value)}
            placeholder="Rua, número, bairro"
            value={form.address_line}
          />,
        )}
        {wrap(
          2,
          <GlassField
            accessibilityLabel="Cidade"
            error={errors.city}
            label="Cidade"
            onChangeText={(value) => setField('city', value)}
            required
            value={form.city}
          />,
        )}
        {wrap(
          3,
          <GlassField
            accessibilityLabel="UF"
            autoCapitalize="characters"
            error={errors.state}
            label="UF"
            onChangeText={(value) =>
              setField('state', value.slice(0, 2).toUpperCase())
            }
            required
            value={form.state}
          />,
        )}
        {wrap(
          4,
          <GlassField
            accessibilityLabel="E-mail"
            autoCapitalize="none"
            error={errors.email}
            keyboardType="email-address"
            label="E-mail"
            onChangeText={(value) => setField('email', value)}
            required
            textContentType="emailAddress"
            value={form.email}
          />,
        )}
        {wrap(
          5,
          <GlassField
            accessibilityLabel="Celular"
            error={errors.phone}
            keyboardType="number-pad"
            label="Celular"
            onChangeText={(value) => setField('phone', maskPhone(value))}
            value={form.phone}
          />,
        )}
      </View>
    );
  }

  if (step === 3) {
    return (
      <View className="gap-4">
        {wrap(
          0,
          <SelectChips
            columns={4}
            label="Tipo sanguíneo"
            onChange={(value) => setField('blood_type', value)}
            options={bloodTypeOptions}
            value={form.blood_type}
          />,
        )}
        {wrap(
          1,
          <SwitchQuestion
            choice={form.allergies_choice}
            description="Alergias a medicamentos, alimentos ou picadas."
            error={errors.allergies_choice}
            label="Alergias"
            onChange={(choice) => setField('allergies_choice', choice)}
          />,
        )}
        {form.allergies_choice === 'yes'
          ? wrap(
              2,
              <GlassField
                accessibilityLabel="Descrição das alergias"
                error={errors.allergies}
                label="Descreva"
                multiline
                onChangeText={(value) => setField('allergies', value)}
                placeholder="Descreva..."
                required
                value={form.allergies}
              />,
            )
          : null}
        {wrap(
          3,
          <SwitchQuestion
            choice={form.dietary_choice}
            error={errors.dietary_choice}
            label="Restrição alimentar"
            onChange={(choice) => setField('dietary_choice', choice)}
          />,
        )}
        {form.dietary_choice === 'yes'
          ? wrap(
              4,
              <GlassField
                accessibilityLabel="Descrição da restrição alimentar"
                error={errors.dietary_restrictions}
                label="Descreva"
                multiline
                onChangeText={(value) =>
                  setField('dietary_restrictions', value)
                }
                placeholder="Descreva..."
                required
                value={form.dietary_restrictions}
              />,
            )
          : null}
      </View>
    );
  }

  if (step === 4) {
    return (
      <View className="gap-4">
        {wrap(
          0,
          <View className="gap-3">
            <Text className="text-zinc-500 text-xs font-medium">
              Nível de highline <Text className="text-red-600">*</Text>
            </Text>
            <SelectCards
              error={errors.highline_experience}
              onChange={(value) => setField('highline_experience', value)}
              options={highlineExperienceOptions}
              value={form.highline_experience}
            />
          </View>,
        )}
        {wrap(
          1,
          <NativeSwitchRow
            error={errors.has_rescue_course}
            label="Curso de resgate"
            description="Ative se você já fez um curso de resgate."
            onChange={(value) => setField('has_rescue_course', value)}
            value={form.has_rescue_course}
          />,
        )}
        {wrap(
          2,
          <View className="gap-3">
            <Text className="text-zinc-500 text-xs font-medium">
              Primeiros socorros <Text className="text-red-600">*</Text>
            </Text>
            <SelectCards
              error={errors.first_aid_course}
              onChange={(value) => setField('first_aid_course', value)}
              options={firstAidOptions}
              value={form.first_aid_course}
            />
          </View>,
        )}
      </View>
    );
  }

  return (
    <View className="gap-4">
      {wrap(
        0,
        <GlassField
          accessibilityLabel="Nome do contato de emergência"
          error={errors.emergency_contact_name}
          label="Nome"
          onChangeText={(value) => setField('emergency_contact_name', value)}
          required
          textContentType="name"
          value={form.emergency_contact_name}
        />,
      )}
      {wrap(
        1,
        <SelectChips
          error={errors.emergency_contact_relationship}
          label="Parentesco"
          onChange={(value) =>
            setField('emergency_contact_relationship', value)
          }
          options={relationshipOptions}
          required
          value={form.emergency_contact_relationship}
        />,
      )}
      {wrap(
        2,
        <GlassField
          accessibilityLabel="Telefone do contato de emergência"
          error={errors.emergency_contact_phone}
          keyboardType="number-pad"
          label="Telefone"
          onChangeText={(value) =>
            setField('emergency_contact_phone', maskPhone(value))
          }
          required
          value={form.emergency_contact_phone}
        />,
      )}
    </View>
  );
}

function SwitchQuestion({
  choice,
  description,
  error,
  label,
  onChange,
}: {
  choice: YesNoValue;
  description?: string;
  error?: string;
  label: string;
  onChange: (value: YesNoValue) => void;
}) {
  return (
    <NativeSwitchRow
      description={description}
      error={error}
      label={label}
      onChange={(value) => onChange(value ? 'yes' : 'no')}
      value={choice === 'yes'}
    />
  );
}
