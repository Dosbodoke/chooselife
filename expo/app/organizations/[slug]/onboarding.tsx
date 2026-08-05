import { useOrganization } from '@chooselife/ui';
import type { StartSubscriptionResponse } from '@packages/database/functions.types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
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
  FocusedHeader,
  FooterCta,
  ReviewList,
  SuccessInterstitial,
} from '~/components/organizations/onboarding/controls';
import {
  createInitialForm,
  formToDraft,
  getAnswerLabel,
  getFirstIncompleteIndex,
  getQuestionError,
  getReviewRows,
  maskCep,
  questions,
  unmask,
  type FormField,
  type MembershipApplicationForm,
  type PlanType,
} from '~/components/organizations/onboarding/form';
import { QuestionCard } from '~/components/organizations/onboarding/question-card';
import { Text } from '~/components/ui/text';

type SettledResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

const settle = <T,>(promise: Promise<T>): Promise<SettledResult<T>> =>
  promise.then(
    (value) => ({ ok: true, value }),
    (error: unknown) => ({ ok: false, error }),
  );

const errorHaptic = () =>
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
    () => undefined,
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
      // wizard on the first draft save and reset question/CTA state mid-flow.
      key={`${organization.id}-${userId}`}
      acceptedTermsAt={accepted_terms_at}
      application={applicationQuery.data ?? null}
      email={session.user.email}
      organizationId={organization.id}
      phone={session.user.phone}
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
  phone?: string | null;
  planType: PlanType;
  profileBirthday?: string | null;
  profileName?: string | null;
  slug: string;
  userId: string;
};

function OnboardingWizard({
  acceptedTermsAt,
  application,
  email,
  organizationId,
  phone,
  planType,
  profileBirthday,
  profileName,
  slug,
  userId,
}: OnboardingWizardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);

  const [initialForm] = useState<MembershipApplicationForm>(() =>
    createInitialForm({
      acceptedTermsAt,
      application,
      email,
      phone,
      profileBirthday,
      profileName,
    }),
  );
  const [form, setForm] = useState(initialForm);
  const [index, setIndex] = useState(() =>
    application?.status === 'submitted'
      ? questions.length
      : application?.status === 'draft'
        ? getFirstIncompleteIndex(initialForm)
        : 0,
  );
  const reviewing = index === questions.length;
  const question = reviewing ? null : questions[index];

  // Set by a failed Continue; every field on the step then shows its error.
  const [showErrors, setShowErrors] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [returnToReview, setReturnToReview] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepFailed, setCepFailed] = useState(false);
  // Bumped when ViaCEP fills the address fields, so they remount with the new
  // value — native text state is only captured on mount.
  const [autofillKey, setAutofillKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdApplicationId, setCreatedApplicationId] = useState<
    string | undefined
  >();
  const [createdSubmittedId, setCreatedSubmittedId] = useState<
    string | undefined
  >();
  const submitLockRef = useRef(false);
  const lastCepLookupRef = useRef<string | null>(null);

  const applicationId = createdApplicationId ?? application?.id;
  const applicationQueryKey = queryKeys.membershipApplication.byOrgUser(
    organizationId,
    userId,
  );

  const progress = useSharedValue((index + 1) / (questions.length + 1));
  // 0 → 1 on every question change; drives the slide-in deterministically so an
  // interrupted transition can never leave a residual horizontal offset.
  const transition = useSharedValue(1);
  const direction = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: transition.get(),
    transform: [{ translateX: (1 - transition.get()) * 28 * direction.get() }],
  }));

  useMountEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      reviewing
        ? 'Revisão do cadastro'
        : `Pergunta ${index + 1} de ${questions.length}`,
    );
  });

  const goToIndex = (next: number, movement: 'back' | 'forward') => {
    const total = questions.length;
    const target = Math.max(0, Math.min(next, total));

    progress.set(
      withTiming((target + 1) / (total + 1), {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      }),
    );
    direction.set(movement === 'forward' ? 1 : -1);
    transition.set(0);
    transition.set(
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
    );

    setIndex(target);
    setShowErrors(false);
    setErrorMessage(null);
    scrollRef.current?.scrollTo({ animated: false, y: 0 });
    AccessibilityInfo.announceForAccessibility(
      target === total
        ? 'Revisão do cadastro'
        : `Pergunta ${target + 1} de ${total}`,
    );
  };

  const handleCepChange = (value: unknown) => {
    const nextPostalCode = maskCep(typeof value === 'string' ? value : '');
    const digits = unmask(nextPostalCode);
    setForm((current) => ({ ...current, postal_code: nextPostalCode }));
    setShowErrors(false);

    if (digits.length !== 8 || lastCepLookupRef.current === digits) return;

    lastCepLookupRef.current = digits;
    setCepFailed(false);
    setCepLoading(true);
    fetchAddressByCep(digits)
      .then((address) => {
        if (!address) {
          setCepFailed(true);
          return;
        }
        setForm((current) => ({
          ...current,
          address_line: address.address_line,
          city: address.city,
          state: address.state,
        }));
        setAutofillKey((key) => key + 1);
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => undefined);
      })
      .catch(() => setCepFailed(true))
      .finally(() => setCepLoading(false));
  };

  const setField = (field: FormField, value: unknown) => {
    // The CEP drives the rest of the address, so it owns its own handler.
    if (field === 'postal_code') {
      handleCepChange(value);
      return;
    }
    setForm((current) => ({ ...current, [field]: value }));
    setShowErrors(false);
  };

  const handleBack = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );

    if (returnToReview) {
      setReturnToReview(false);
      goToIndex(questions.length, 'forward');
      return;
    }

    goToIndex(index - 1, 'back');
  };

  const handleAdvance = () => {
    if (!question) return;

    const error = getQuestionError(form, question);
    if (error) {
      setShowErrors(true);
      AccessibilityInfo.announceForAccessibility(error);
      errorHaptic();
      return;
    }

    Keyboard.dismiss();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );

    if (returnToReview) {
      setReturnToReview(false);
      goToIndex(questions.length, 'forward');
      return;
    }

    goToIndex(index + 1, 'forward');
  };

  const handleEdit = (target: number) => {
    setReturnToReview(true);
    goToIndex(target, 'back');
  };

  const saveMutation = useMutation({
    mutationFn: async (nextForm: MembershipApplicationForm) =>
      upsertMembershipApplicationDraft(
        formToDraft(nextForm, organizationId, userId),
      ),
    onSuccess: (data) => {
      setCreatedApplicationId(data.id);
      queryClient.setQueryData(applicationQueryKey, data);
    },
    retry: 1,
  });

  const submitMutation = useMutation({
    mutationFn: submitMembershipApplication,
    onSuccess: (data) => {
      setCreatedSubmittedId(data?.id ?? applicationId);
      void queryClient.invalidateQueries({ queryKey: applicationQueryKey });
    },
  });

  const startSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const { data: charge, error } =
        await supabase.functions.invoke<StartSubscriptionResponse>(
          'start-subscription',
          {
            body: { plan_type: planType, slug },
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
    onSuccess: (data) => {
      setSuccess(true);
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => undefined);
      void queryClient.invalidateQueries({
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
    // The function reuses an existing pending manual payment, so retrying once
    // is safe when the first response is lost to a transient network failure.
    retry: 1,
    retryDelay: 500,
  });


  const submittedApplicationId =
    createdSubmittedId ??
    (application?.status === 'submitted' ? application.id : undefined);

  const getSubmittedApplicationId = () => {
    const cachedApplication =
      queryClient.getQueryData<MembershipApplication | null>(
        applicationQueryKey,
      );

    return (
      submittedApplicationId ??
      (cachedApplication?.status === 'submitted'
        ? cachedApplication.id
        : undefined)
    );
  };

  const handleSubmit = async () => {
    if (submitLockRef.current) return;

    const incompleteIndex = getFirstIncompleteIndex(form);
    if (incompleteIndex < questions.length) {
      errorHaptic();
      // `handleEdit` clears the banner, so the message is set afterwards.
      handleEdit(incompleteIndex);
      setErrorMessage('Faltam respostas. Vamos voltar para completá-las.');
      return;
    }

    if (!form.accepted_terms_at) {
      setErrorMessage(
        'Não encontramos o aceite dos termos. Feche o cadastro e confirme os termos novamente.',
      );
      errorHaptic();
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    setErrorMessage(null);

    const fail = (message: string) => {
      setErrorMessage(message);
      setSubmitting(false);
      submitLockRef.current = false;
      errorHaptic();
    };

    if (!getSubmittedApplicationId()) {
      const saved = await settle(saveMutation.mutateAsync(form));
      if (!saved.ok) {
        console.error('Error saving membership application:', saved.error);
        fail(
          'Não foi possível salvar seu cadastro. Verifique a conexão e tente novamente.',
        );
        return;
      }

      const submitted = await settle(
        submitMutation.mutateAsync(applicationId ?? saved.value.id),
      );
      if (!submitted.ok) {
        // A lost response can happen after the RPC committed. Re-read the
        // application before telling the user to retry a completed submit.
        const reconciled = await settle(
          fetchMembershipApplication(organizationId, userId),
        );
        if (!reconciled.ok || reconciled.value?.status !== 'submitted') {
          console.error(
            'Error submitting membership application:',
            submitted.error,
          );
          fail(
            'Não foi possível concluir seu cadastro. Verifique a conexão e tente novamente.',
          );
          return;
        }

        setCreatedSubmittedId(reconciled.value.id);
        queryClient.setQueryData(applicationQueryKey, reconciled.value);
      } else {
        setCreatedSubmittedId(
          submitted.value?.id ?? applicationId ?? saved.value.id,
        );
      }
    }

    const payment = await settle(startSubscriptionMutation.mutateAsync());
    if (!payment.ok) {
      console.error('Error starting membership payment:', payment.error);
      fail(
        'Seu cadastro foi concluído, mas não foi possível iniciar o pagamento. Tente novamente.',
      );
      return;
    }

    setSubmitting(false);
    submitLockRef.current = false;
  };

  if (success) {
    return (
      <View className="flex-1 bg-white">
        <SuccessInterstitial />
      </View>
    );
  }

  // A step with a single optional field (blood type) offers to skip instead.
  const skippable =
    question?.fields.length === 1 &&
    question.fields[0].optional === true &&
    !getAnswerLabel(form, question.fields[0]);

  return (
    <View className="flex-1 bg-white">
      <FocusedHeader
        onBack={handleBack}
        onClose={() => router.replace('/(tabs)/organizations')}
        progress={progress}
        sectionLabel={reviewing ? 'Revisão' : (question?.section ?? '')}
        showBack={index > 0 || returnToReview}
      />
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'flex-start',
            paddingBottom: 32,
            paddingHorizontal: 24,
            paddingTop: 28,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            key={reviewing ? 'review' : `question-${question?.id}`}
            style={cardStyle}
          >
            {reviewing ? (
              <View>
                <Text className="text-blue-600 text-xs font-extrabold tracking-widest mb-3">
                  CONFIRA ANTES DE ENVIAR
                </Text>
                <Text
                  accessibilityRole="header"
                  className="text-zinc-950 text-3xl font-extrabold leading-9"
                >
                  Está tudo certo?
                </Text>
                <Text className="text-zinc-500 text-base leading-6 mt-2.5">
                  Toque em uma resposta para corrigir. Seu cadastro é enviado
                  uma única vez, na confirmação.
                </Text>
                <ReviewList
                  items={getReviewRows(form)}
                  onEdit={handleEdit}
                />
              </View>
            ) : question ? (
              <QuestionCard
                autofillKey={autofillKey}
                cepFailed={cepFailed}
                cepLoading={cepLoading}
                counterLabel={`PERGUNTA ${index + 1} DE ${questions.length}`}
                form={form}
                onChange={setField}
                onSubmitEditing={handleAdvance}
                question={question}
                showErrors={showErrors}
              />
            ) : null}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      {errorMessage ? (
        <Animated.Text
          entering={FadeIn.duration(180)}
          className="px-6 pb-2 text-red-600 text-sm text-center"
        >
          {errorMessage}
        </Animated.Text>
      ) : null}
      <FooterCta
        label={
          reviewing
            ? 'Confirmar e ir para o pagamento'
            : returnToReview
              ? 'Salvar e voltar à revisão'
              : skippable
                ? 'Pular'
                : 'Continuar'
        }
        loading={submitting}
        onPress={reviewing ? handleSubmit : handleAdvance}
      />
    </View>
  );
}
