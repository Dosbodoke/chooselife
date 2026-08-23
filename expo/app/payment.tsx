import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CheckCircle2Icon,
  CheckIcon,
  CopyIcon,
  XIcon,
} from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-qr-code';

import { useAuth } from '~/context/auth';
import { useMountEffect } from '~/hooks/use-mount-effect';
import {
  getPaymentClaimValidationError,
  normalizePaymentPayerName,
  type PaymentClaimPayerType,
  type PaymentClaimStatus,
} from '~/lib/payment-claim';
import { queryKeys } from '~/lib/query-keys';
import { supabase } from '~/lib/supabase';

import { BgBlob } from '~/components/bg-blog';
import { Icon } from '~/components/ui/icon';

type PaymentInstructions = {
  amount: number | null;
  pix_copy_paste: string | null;
  status: 'pending' | 'succeeded' | 'failed' | null;
  user_marked_paid_at: string | null;
};

type ObligationInstructions = {
  amount: number;
  available_at: string;
  claim_created_at: string | null;
  claim_decision_reason: string | null;
  claim_id: string | null;
  claim_status: PaymentClaimStatus | null;
  currency: string;
  obligation_id: string;
  payer_name: string | null;
  payer_type: PaymentClaimPayerType | null;
  payment_method: string;
  pix_copy_paste: string;
  plan_type: 'monthly' | 'annual';
  purpose: 'initial_admission' | 'recurring';
  status:
    'scheduled' | 'available' | 'under_review' | 'overdue' | 'settled' | 'void';
  available_on: string;
  due_on: string;
  period_key: string;
};

function PaymentState({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <BgBlob>
      <CloseButton onClose={onClose} />
      <View className="flex-1 justify-center items-center gap-3 px-6">
        {children}
      </View>
    </BgBlob>
  );
}

function PaymentSuccessState({
  onClose,
  paymentContext,
}: {
  onClose: () => void;
  paymentContext?: 'new_member' | 'subscription_renewal';
}) {
  return (
    <PaymentState onClose={onClose}>
      <Animated.View entering={ZoomIn}>
        <Icon as={CheckCircle2Icon} size={64} color="#10B981" />
      </Animated.View>
      <Animated.Text
        entering={FadeIn.delay(200)}
        className="text-white text-3xl font-bold text-center leading-9"
      >
        Pagamento confirmado!
      </Animated.Text>
      <Animated.Text
        entering={FadeIn.delay(400)}
        className="text-white/65 text-[15px] text-center leading-6"
      >
        {paymentContext === 'subscription_renewal'
          ? 'Você está em dia com a Associação!'
          : 'Bem-vindo(a)! Você agora é membro oficial da Associação.'}
      </Animated.Text>
    </PaymentState>
  );
}

const paymentInstructionsQueryKey = (paymentId: string | undefined) =>
  ['payment-instructions', paymentId] as const;

const paymentObligationInstructionsQueryKey = (
  obligationId: string | undefined,
) => ['payment-obligation-instructions', obligationId] as const;

export default function PaymentScreen() {
  const router = useRouter();
  const {
    amount,
    currency: routeCurrency,
    obligationId,
    paymentContext,
    paymentId,
    slug,
  } = useLocalSearchParams<{
    amount?: string;
    currency?: string;
    obligationId?: string;
    paymentContext?: 'new_member' | 'subscription_renewal';
    paymentId?: string;
    slug?: string;
  }>();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [paymentStatus, setPaymentStatus] = React.useState<
    'PENDING' | 'SUCCESS' | 'FAILED'
  >('PENDING');
  const routeAmountInCents = Number(amount);
  const paymentInstructionsQuery = useQuery({
    queryKey: paymentInstructionsQueryKey(paymentId),
    queryFn: async (): Promise<PaymentInstructions> => {
      if (!paymentId) {
        return {
          amount: null,
          pix_copy_paste: null,
          status: null,
          user_marked_paid_at: null,
        };
      }

      const { data, error } = await supabase.rpc(
        'get_manual_payment_instructions',
        { p_payment_id: paymentId },
      );

      if (error) throw error;

      return (
        data?.[0] ?? {
          amount: null,
          pix_copy_paste: null,
          status: null,
          user_marked_paid_at: null,
        }
      );
    },
    enabled: Boolean(paymentId && !obligationId),
  });
  const obligationInstructionsQuery = useQuery({
    queryKey: paymentObligationInstructionsQueryKey(obligationId),
    queryFn: async (): Promise<ObligationInstructions | null> => {
      if (!obligationId) return null;

      const { data, error } = await supabase.rpc(
        'get_payment_obligation_instructions',
        { p_obligation_id: obligationId },
      );

      if (error) throw error;

      return (data?.[0] as ObligationInstructions | undefined) ?? null;
    },
    enabled: Boolean(obligationId),
  });
  const paymentInstructions = paymentInstructionsQuery.data;
  const obligationInstructions = obligationInstructionsQuery.data;
  const amountInCents = obligationId
    ? (obligationInstructions?.amount ?? null)
    : (paymentInstructions?.amount ??
      (Number.isFinite(routeAmountInCents) ? routeAmountInCents : null));
  const currency = obligationInstructions?.currency ?? routeCurrency ?? 'BRL';
  const formattedAmount =
    amountInCents === null
      ? null
      : new Intl.NumberFormat('pt-BR', {
          currency,
          minimumFractionDigits: 2,
          style: 'currency',
        }).format(amountInCents / 100);
  const manualPixCopyPaste = obligationId
    ? (obligationInstructions?.pix_copy_paste ?? '')
    : (paymentInstructions?.pix_copy_paste ?? '');
  const isSettledObligation = obligationInstructions?.status === 'settled';
  const isVoidedObligation = obligationInstructions?.status === 'void';
  const hasManualPixInstructions =
    Boolean(manualPixCopyPaste) && !isSettledObligation && !isVoidedObligation;
  const claimStatus = obligationInstructions?.claim_status ?? null;
  const canClaimPayment = Boolean(
    obligationId &&
    (obligationInstructions?.status === 'available' ||
      obligationInstructions?.status === 'overdue') &&
    (claimStatus === null || claimStatus === 'rejected'),
  );

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleRetryPaymentInstructions = () => {
    if (obligationId) {
      void obligationInstructionsQuery.refetch();
    } else if (paymentId) {
      void paymentInstructionsQuery.refetch();
    }
  };

  const isFetchingPaymentInstructions = obligationId
    ? obligationInstructionsQuery.isFetching
    : paymentInstructionsQuery.isFetching;

  const userMarkedPaidAt = obligationId
    ? null
    : (paymentInstructions?.user_marked_paid_at ?? null);

  const claimPaymentMutation = useMutation({
    mutationFn: async ({
      payerName,
      payerType,
    }: {
      payerName: string;
      payerType: PaymentClaimPayerType;
    }) => {
      if (!obligationId) throw new Error('obligationId is required.');

      const claimArgs = {
        p_obligation_id: obligationId,
        p_paid_by_applicant: payerType === 'applicant',
        p_payer_name:
          payerType === 'applicant'
            ? undefined
            : normalizePaymentPayerName(payerName),
      };
      const { data, error } =
        obligationInstructions?.purpose === 'recurring'
          ? await supabase.rpc('claim_recurring_payment', claimArgs)
          : await supabase.rpc('claim_initial_payment', claimArgs);

      if (error) throw error;

      const claim = data?.[0];
      if (!claim) throw new Error('The payment claim response was empty.');

      return claim;
    },
    onSuccess: async (claim) => {
      queryClient.setQueryData<ObligationInstructions | null>(
        paymentObligationInstructionsQueryKey(obligationId),
        (current) =>
          current
            ? {
                ...current,
                claim_created_at: claim.claim_created_at,
                claim_decision_reason: null,
                claim_id: claim.claim_id,
                claim_status: claim.claim_status,
                payer_name: claim.payer_name,
                payer_type: claim.payer_type,
              }
            : current,
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await queryClient.invalidateQueries({
        queryKey: paymentObligationInstructionsQueryKey(obligationId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.membershipBilling.all,
      });
    },
    onError: (error) => {
      console.error('Failed to claim payment:', error);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async () => {
      if (!paymentId || obligationId) {
        throw new Error('paymentId is required.');
      }

      const { data, error } = await supabase.rpc(
        'mark_manual_payment_paid_by_user',
        { p_payment_id: paymentId },
      );

      if (error) throw error;

      return {
        user_marked_paid_at:
          data?.[0]?.user_marked_paid_at ?? new Date().toISOString(),
      };
    },
    onSuccess: async (data) => {
      queryClient.setQueryData<PaymentInstructions>(
        paymentInstructionsQueryKey(paymentId),
        (current) => ({
          amount: current?.amount ?? amountInCents,
          pix_copy_paste: current?.pix_copy_paste ?? null,
          status: current?.status ?? 'pending',
          user_marked_paid_at: data.user_marked_paid_at,
        }),
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.subscription.all,
      });
      if (slug && profile?.id) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.paymentReview.byOrgUser(slug, profile.id),
        });
      }

      if (paymentContext === 'new_member') {
        router.replace('/(tabs)/organizations');
      } else {
        handleClose();
      }
    },
    onError: (error) => {
      console.error('Failed to mark payment as paid by user:', error);
    },
  });

  const handleMarkPaid = async () => {
    if (
      !paymentId ||
      obligationId ||
      markPaidMutation.isPending ||
      userMarkedPaidAt
    ) {
      return;
    }

    markPaidMutation.mutate();
  };

  const handleClaimPayment = ({
    payerName,
    payerType,
  }: {
    payerName: string;
    payerType: PaymentClaimPayerType;
  }) => {
    const validationError = getPaymentClaimValidationError({
      payerName,
      payerType,
    });

    if (validationError) return;

    claimPaymentMutation.mutate({ payerName, payerType });
  };

  const paymentTitle =
    paymentContext === 'subscription_renewal'
      ? 'Pague sua mensalidade'
      : 'Finalize seu cadastro';
  const paymentSubtitle =
    paymentContext === 'subscription_renewal'
      ? 'Realize o pagamento para ficar em dia com a Associação'
      : 'Realize o pagamento para se tornar membro oficial';

  if (paymentStatus === 'SUCCESS') {
    return (
      <PaymentSuccessState
        onClose={handleClose}
        paymentContext={paymentContext}
      />
    );
  }

  if (paymentStatus === 'FAILED') {
    return (
      <PaymentState onClose={handleClose}>
        <Text className="text-white text-3xl font-bold text-center leading-9">
          Pagamento falhou
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="active:opacity-70 mt-2"
        >
          <Text className="text-white underline">Tentar novamente</Text>
        </Pressable>
      </PaymentState>
    );
  }

  if (
    paymentInstructionsQuery.isLoading ||
    obligationInstructionsQuery.isLoading
  ) {
    return (
      <PaymentState onClose={handleClose}>
        <ActivityIndicator color="#FFFFFF" />
        <Text className="text-white/80">Carregando pagamento...</Text>
      </PaymentState>
    );
  }

  if ((!paymentId && !obligationId) || !hasManualPixInstructions) {
    const unavailableTitle = isSettledObligation
      ? 'Pagamento já confirmado'
      : 'Pagamento indisponível';
    const unavailableMessage = isSettledObligation
      ? 'Esta cobrança já foi confirmada pela associação.'
      : isVoidedObligation
        ? 'Esta cobrança não está mais disponível. Feche esta tela e tente novamente pelo aplicativo.'
        : 'O PIX da associação ainda não foi configurado no aplicativo.';
    const canRetryInstructions =
      Boolean(paymentId || obligationId) &&
      !isSettledObligation &&
      !isVoidedObligation;

    return (
      <PaymentState onClose={handleClose}>
        <Text className="text-white text-3xl font-bold text-center leading-9">
          {unavailableTitle}
        </Text>
        <Text className="text-white/65 text-[15px] text-center leading-6">
          {unavailableMessage}
        </Text>
        {paymentInstructionsQuery.isError ||
        obligationInstructionsQuery.isError ? (
          <Text className="text-white/50 text-center text-sm">
            Não foi possível carregar os dados do pagamento.
          </Text>
        ) : null}
        {formattedAmount ? (
          <Text className="text-white/50 text-center text-sm">
            Valor solicitado: {formattedAmount}
          </Text>
        ) : null}
        {canRetryInstructions ? (
          <Pressable
            accessibilityRole="button"
            onPress={handleRetryPaymentInstructions}
            disabled={isFetchingPaymentInstructions}
            className="rounded-full bg-white px-6 py-3 mt-2"
            style={({ pressed }) => ({
              opacity: isFetchingPaymentInstructions ? 0.6 : pressed ? 0.85 : 1,
            })}
          >
            {isFetchingPaymentInstructions ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="text-black font-semibold">Tentar novamente</Text>
            )}
          </Pressable>
        ) : null}
      </PaymentState>
    );
  }

  return (
    <ManualPixPayment
      formattedAmount={formattedAmount}
      insets={insets}
      manualPixCopyPaste={manualPixCopyPaste}
      canClaimPayment={canClaimPayment}
      claimDecisionReason={
        obligationInstructions?.claim_decision_reason ?? null
      }
      claimPayerName={obligationInstructions?.payer_name ?? null}
      claimPayerType={obligationInstructions?.payer_type ?? null}
      claimStatus={claimStatus}
      claimingPayment={claimPaymentMutation.isPending}
      claimPaymentError={claimPaymentMutation.isError}
      obligationStatus={obligationInstructions?.status ?? null}
      markPaidError={markPaidMutation.isError}
      markingPaid={markPaidMutation.isPending}
      canReportPayment={Boolean(paymentId && !obligationId)}
      onClose={handleClose}
      onClaimPayment={handleClaimPayment}
      onMarkPaid={handleMarkPaid}
      onPaymentFailed={() => setPaymentStatus('FAILED')}
      onPaymentSucceeded={() => setPaymentStatus('SUCCESS')}
      paymentContext={paymentContext}
      obligationId={obligationId}
      paymentId={paymentId}
      profileId={profile?.id}
      queryClient={queryClient}
      slug={slug}
      subtitle={paymentSubtitle}
      title={paymentTitle}
      userMarkedPaidAt={userMarkedPaidAt}
    />
  );
}

function ManualPixPayment({
  canClaimPayment,
  canReportPayment,
  claimDecisionReason,
  claimPayerName,
  claimPayerType,
  claimStatus,
  claimingPayment,
  claimPaymentError,
  formattedAmount,
  insets,
  manualPixCopyPaste,
  markPaidError,
  markingPaid,
  onClose,
  onClaimPayment,
  onMarkPaid,
  onPaymentFailed,
  onPaymentSucceeded,
  obligationId,
  obligationStatus,
  paymentContext,
  paymentId,
  profileId,
  queryClient,
  slug,
  subtitle,
  title,
  userMarkedPaidAt,
}: {
  canClaimPayment: boolean;
  canReportPayment: boolean;
  claimDecisionReason: string | null;
  claimPayerName: string | null;
  claimPayerType: PaymentClaimPayerType | null;
  claimStatus: PaymentClaimStatus | null;
  claimingPayment: boolean;
  claimPaymentError: boolean;
  formattedAmount: string | null;
  insets: ReturnType<typeof useSafeAreaInsets>;
  manualPixCopyPaste: string;
  markPaidError: boolean;
  markingPaid: boolean;
  onClose: () => void;
  onClaimPayment: (input: {
    payerName: string;
    payerType: PaymentClaimPayerType;
  }) => void;
  onMarkPaid: () => void;
  onPaymentFailed: () => void;
  onPaymentSucceeded: () => void;
  obligationId?: string;
  obligationStatus: ObligationInstructions['status'] | null;
  paymentContext?: 'new_member' | 'subscription_renewal';
  paymentId?: string;
  profileId?: string;
  queryClient: ReturnType<typeof useQueryClient>;
  slug?: string;
  subtitle: string;
  title: string;
  userMarkedPaidAt: string | null;
}) {
  const [payerType, setPayerType] =
    React.useState<PaymentClaimPayerType>('applicant');
  const [payerName, setPayerName] = React.useState('');
  const [showPayerError, setShowPayerError] = React.useState(false);
  const payerValidationError = getPaymentClaimValidationError({
    payerName,
    payerType,
  });
  const isClaimUnderReview = claimStatus === 'under_review';
  const isClaimRejected = claimStatus === 'rejected';

  const handleClaimPress = () => {
    setShowPayerError(true);
    if (payerValidationError) return;

    onClaimPayment({ payerName, payerType });
  };

  return (
    <BgBlob>
      <PaymentStatusSubscription
        key={`${paymentId ?? ''}:${obligationId ?? ''}:${slug ?? ''}:${profileId ?? ''}:${paymentContext ?? ''}`}
        paymentContext={paymentContext}
        paymentId={paymentId}
        profileId={profileId}
        queryClient={queryClient}
        slug={slug}
        onClose={onClose}
        onFailed={onPaymentFailed}
        onSucceeded={onPaymentSucceeded}
      />
      <CloseButton onClose={onClose} />
      <ScrollView
        className="flex-1"
        contentInset={{ bottom: insets.bottom, top: insets.top }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 32,
          paddingTop: 56,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center px-6 mb-7">
          <Animated.Text
            accessibilityRole="header"
            entering={FadeInDown.delay(300).duration(300)}
            className="text-white text-[32px] font-bold text-center leading-9 mb-2"
          >
            {title}
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(400).duration(300)}
            className="text-white/65 text-[15px] text-center leading-6"
          >
            {subtitle}
          </Animated.Text>
        </View>
        <Animated.View
          entering={FadeInDown.delay(550).duration(450)}
          className="items-center mb-4"
        >
          <View className="bg-white p-5 rounded-3xl shadow-2xl">
            <QRCode value={manualPixCopyPaste} size={220} level="M" />
          </View>
        </Animated.View>
        <Animated.View
          entering={FadeIn.delay(700).duration(300)}
          className="items-center mb-5 px-6"
        >
          <CopyCode code={manualPixCopyPaste} />
        </Animated.View>
        <Animated.View
          entering={FadeIn.delay(800).duration(300)}
          className="mx-6 rounded-2xl border border-white/15 bg-white/10 px-5 py-4 gap-1.5 mb-6"
        >
          {formattedAmount ? (
            <Text className="text-white text-center text-3xl font-bold tabular-nums tracking-tight">
              {formattedAmount}
            </Text>
          ) : null}
          <Text className="text-white/50 text-center text-xs font-medium">
            {paymentContext === 'subscription_renewal'
              ? 'Mensalidade'
              : 'Associação'}
          </Text>
          <Text className="text-white/65 text-center text-sm leading-5 mt-1">
            {obligationStatus === 'void'
              ? 'Esta cobrança não está mais disponível.'
              : isClaimUnderReview
                ? 'Seu aviso de pagamento está em análise. A associação conferirá o PIX manualmente.'
                : canClaimPayment
                  ? 'Depois de pagar, confirme quem fez o PIX para enviar o aviso à associação.'
                  : canReportPayment
                    ? 'Depois de pagar, toque em "Já paguei". A equipe confere o PIX e aprova sua assinatura manualmente.'
                    : claimStatus === 'approved' ||
                        obligationStatus === 'settled'
                      ? 'Este pagamento já foi confirmado pela associação.'
                      : 'Depois de pagar, a associação confere o PIX e conclui a confirmação manualmente.'}
          </Text>
        </Animated.View>
        <Animated.View
          entering={FadeIn.delay(900).duration(300)}
          className="mx-6 gap-3 mt-auto"
        >
          {canClaimPayment ? (
            <View className="rounded-2xl border border-white/15 bg-white/10 p-4 gap-3">
              <Text className="text-white text-base font-semibold">
                Quem fez o PIX?
              </Text>
              <View className="flex-row gap-2">
                {(
                  [
                    ['applicant', 'Eu fiz o PIX'],
                    ['other', 'Outra pessoa fez'],
                  ] as const
                ).map(([option, label]) => {
                  const selected = payerType === option;

                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setPayerType(option);
                        setShowPayerError(false);
                      }}
                      className={`flex-1 rounded-xl border px-3 py-3 ${selected ? 'border-white bg-white' : 'border-white/20 bg-white/5'}`}
                    >
                      <Text
                        className={`text-center text-sm font-semibold ${selected ? 'text-black' : 'text-white/75'}`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {payerType === 'other' ? (
                <TextInput
                  accessibilityLabel="Nome de quem fez o PIX"
                  autoCapitalize="words"
                  onChangeText={(value) => {
                    setPayerName(value);
                    setShowPayerError(false);
                  }}
                  placeholder="Nome de quem fez o PIX"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  style={{
                    borderColor: 'rgba(255,255,255,0.2)',
                    borderRadius: 12,
                    borderWidth: 1,
                    color: '#FFFFFF',
                    fontSize: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                  value={payerName}
                />
              ) : null}
              {showPayerError && payerValidationError ? (
                <Text
                  accessibilityLiveRegion="polite"
                  className="text-red-200 text-sm leading-5"
                >
                  {payerValidationError === 'payer_name_required'
                    ? 'Informe o nome de quem fez o PIX.'
                    : 'O nome deve ter no máximo 120 caracteres.'}
                </Text>
              ) : null}
              {isClaimRejected && claimDecisionReason ? (
                <Text className="text-amber-100/80 text-sm leading-5">
                  Motivo da última análise: {claimDecisionReason}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={handleClaimPress}
                disabled={claimingPayment}
                className="rounded-full bg-white py-4 items-center justify-center"
                style={({ pressed }) => ({
                  opacity: claimingPayment ? 0.6 : pressed ? 0.85 : 1,
                })}
              >
                {claimingPayment ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text className="text-black text-[17px] font-bold">
                    {isClaimRejected
                      ? 'Enviar nova confirmação'
                      : 'Já fiz o PIX'}
                  </Text>
                )}
              </Pressable>
              {claimPaymentError ? (
                <Text className="text-red-200 text-center text-sm leading-5">
                  Não foi possível registrar o aviso agora. Tente novamente.
                </Text>
              ) : null}
            </View>
          ) : isClaimUnderReview ? (
            <View className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 p-4 gap-2">
              <Text className="text-emerald-100 text-base font-semibold text-center">
                Pagamento em análise
              </Text>
              <Text className="text-white/70 text-center text-sm leading-5">
                Seu aviso foi registrado. A associação vai conferir o PIX e
                retornar com a decisão.
              </Text>
              <Text className="text-white/50 text-center text-sm leading-5">
                Pagador:{' '}
                {claimPayerType === 'other'
                  ? claimPayerName || 'Outra pessoa'
                  : 'Você'}
              </Text>
            </View>
          ) : canReportPayment ? (
            <Pressable
              onPress={onMarkPaid}
              disabled={markingPaid || Boolean(userMarkedPaidAt)}
              className={`rounded-full py-4 items-center justify-center ${userMarkedPaidAt ? 'bg-emerald-500/20' : 'bg-white'}`}
              style={({ pressed }) => ({
                opacity:
                  markingPaid || userMarkedPaidAt
                    ? undefined
                    : pressed
                      ? 0.85
                      : 1,
              })}
            >
              {markingPaid ? (
                <ActivityIndicator color="#000" />
              ) : (
                <View className="flex-row items-center gap-2">
                  {userMarkedPaidAt ? (
                    <Icon as={CheckIcon} size={18} color="#34D399" />
                  ) : null}
                  <Text
                    className={`text-[17px] font-bold ${userMarkedPaidAt ? 'text-emerald-300' : 'text-black'}`}
                  >
                    {userMarkedPaidAt ? 'Pagamento informado' : 'Já paguei'}
                  </Text>
                </View>
              )}
            </Pressable>
          ) : obligationStatus === 'void' ? (
            <Text className="text-white/65 text-center text-sm leading-5">
              Esta cobrança não está mais disponível. Feche esta tela e tente
              novamente pelo aplicativo.
            </Text>
          ) : (
            <Text className="text-white/65 text-center text-sm leading-5">
              {claimStatus === 'approved' || obligationStatus === 'settled'
                ? 'Este pagamento já foi confirmado pela associação.'
                : 'Depois de pagar, a associação receberá sua solicitação para conferir o PIX e concluir a confirmação.'}
            </Text>
          )}
          {canReportPayment && userMarkedPaidAt ? (
            <Text className="text-white/50 text-center text-sm leading-5">
              Recebemos seu aviso. A associação vai conferir o pagamento e
              aprovar manualmente sua assinatura.
            </Text>
          ) : null}
          {canReportPayment && markPaidError ? (
            <Text className="text-red-200 text-center text-sm leading-5">
              Não foi possível avisar a associação agora. Tente novamente.
            </Text>
          ) : null}
        </Animated.View>
      </ScrollView>
    </BgBlob>
  );
}

const PaymentStatusSubscription = ({
  paymentContext,
  paymentId,
  profileId,
  queryClient,
  slug,
  onClose,
  onFailed,
  onSucceeded,
}: {
  paymentContext?: 'new_member' | 'subscription_renewal';
  paymentId?: string;
  profileId?: string;
  queryClient: ReturnType<typeof useQueryClient>;
  slug?: string;
  onClose: () => void;
  onFailed: () => void;
  onSucceeded: () => void;
}) => {
  const router = useRouter();

  useMountEffect(() => {
    if (!paymentId) return;

    const channel = supabase
      .channel(`payment-status:${paymentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payments',
          filter: `id=eq.${paymentId}`,
        },
        (payload) => {
          if (payload.new.status === 'succeeded') {
            onSucceeded();
            queryClient.invalidateQueries({
              queryKey: queryKeys.subscription.all,
            });
            queryClient.invalidateQueries({
              queryKey: queryKeys.membershipBilling.all,
            });
            if (slug && profileId) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.paymentReview.byOrgUser(slug, profileId),
              });
              queryClient.invalidateQueries({
                queryKey: queryKeys.organizations.isMember(slug, profileId),
              });
              queryClient.invalidateQueries({
                queryKey: queryKeys.organizations.memberCount(slug),
              });
            }
            setTimeout(() => {
              if (paymentContext === 'new_member') {
                router.navigate('/(tabs)/organizations');
              } else {
                onClose();
              }
            }, 3000);
          } else if (payload.new.status === 'failed') {
            onFailed();
          }

          if (typeof payload.new.user_marked_paid_at === 'string') {
            queryClient.setQueryData<PaymentInstructions>(
              paymentInstructionsQueryKey(paymentId),
              (current) => ({
                amount: current?.amount ?? null,
                pix_copy_paste: current?.pix_copy_paste ?? null,
                status: current?.status ?? null,
                user_marked_paid_at: payload.new.user_marked_paid_at,
              }),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  });

  return null;
};

const CopyCode = ({ code }: { code: string }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (code) {
      await Clipboard.setStringAsync(code);

      // Adiciona o feedback tátil aqui
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Pressable
      onPress={handleCopy}
      className={`bg-white/10 backdrop-blur-xl px-6 py-3 rounded-full border ${
        copied ? 'border-emerald-400/50' : 'border-transparent'
      }`}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <View className="flex-row items-center gap-2">
        {copied ? (
          <>
            <Icon as={CheckIcon} size={18} color="#10B981" />
            <Text className="text-emerald-400 text-sm font-semibold tracking-wide">
              Copiado!
            </Text>
          </>
        ) : (
          <>
            <Icon as={CopyIcon} size={18} color="#FFFFFF" />
            <Text className="text-white/90 text-sm font-semibold tracking-wide">
              Copiar PIX
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
};

/** Dismiss control — never shares a row with the content title. */
const CloseButton = ({ onClose }: { onClose: () => void }) => {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      onPress={onClose}
      accessibilityLabel="Fechar"
      className="absolute right-5 z-50 h-11 w-11 items-center justify-center rounded-full bg-white"
      style={{ top: insets.top + 8 }}
      hitSlop={8}
    >
      <Icon as={XIcon} size={20} color="#18181B" />
    </Pressable>
  );
};
