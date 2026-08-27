import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckIcon, CopyIcon, XIcon } from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-qr-code';

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
  } = useLocalSearchParams<{
    amount?: string;
    currency?: string;
    obligationId?: string;
    paymentContext?: 'new_member' | 'subscription_renewal';
    slug?: string;
  }>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const routeAmountInCents = Number(amount);
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
  const obligationInstructions = obligationInstructionsQuery.data;
  const amountInCents =
    obligationInstructions?.amount ??
    (Number.isFinite(routeAmountInCents) ? routeAmountInCents : null);
  const currency = obligationInstructions?.currency ?? routeCurrency ?? 'BRL';
  const formattedAmount =
    amountInCents === null
      ? null
      : new Intl.NumberFormat('pt-BR', {
          currency,
          minimumFractionDigits: 2,
          style: 'currency',
        }).format(amountInCents / 100);
  const manualPixCopyPaste = obligationInstructions?.pix_copy_paste ?? '';
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
    }
  };

  const isFetchingPaymentInstructions = obligationInstructionsQuery.isFetching;

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

  if (obligationInstructionsQuery.isLoading) {
    return (
      <PaymentState onClose={handleClose}>
        <ActivityIndicator color="#FFFFFF" />
        <Text className="text-white/80">Carregando pagamento...</Text>
      </PaymentState>
    );
  }

  if (!obligationId || !hasManualPixInstructions) {
    const unavailableTitle = isSettledObligation
      ? 'Pagamento já confirmado'
      : 'Pagamento indisponível';
    const unavailableMessage = isSettledObligation
      ? 'Esta cobrança já foi confirmada pela associação.'
      : isVoidedObligation
        ? 'Esta cobrança não está mais disponível. Feche esta tela e tente novamente pelo aplicativo.'
        : 'O PIX da associação ainda não foi configurado no aplicativo.';
    const canRetryInstructions =
      Boolean(obligationId) && !isSettledObligation && !isVoidedObligation;

    return (
      <PaymentState onClose={handleClose}>
        <Text className="text-white text-3xl font-bold text-center leading-9">
          {unavailableTitle}
        </Text>
        <Text className="text-white/65 text-[15px] text-center leading-6">
          {unavailableMessage}
        </Text>
        {obligationInstructionsQuery.isError ? (
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
      onClose={handleClose}
      onClaimPayment={handleClaimPayment}
      paymentContext={paymentContext}
      subtitle={paymentSubtitle}
      title={paymentTitle}
    />
  );
}

function ManualPixPayment({
  canClaimPayment,
  claimDecisionReason,
  claimPayerName,
  claimPayerType,
  claimStatus,
  claimingPayment,
  claimPaymentError,
  formattedAmount,
  insets,
  manualPixCopyPaste,
  onClose,
  onClaimPayment,
  obligationStatus,
  paymentContext,
  subtitle,
  title,
}: {
  canClaimPayment: boolean;
  claimDecisionReason: string | null;
  claimPayerName: string | null;
  claimPayerType: PaymentClaimPayerType | null;
  claimStatus: PaymentClaimStatus | null;
  claimingPayment: boolean;
  claimPaymentError: boolean;
  formattedAmount: string | null;
  insets: ReturnType<typeof useSafeAreaInsets>;
  manualPixCopyPaste: string;
  onClose: () => void;
  onClaimPayment: (input: {
    payerName: string;
    payerType: PaymentClaimPayerType;
  }) => void;
  obligationStatus: ObligationInstructions['status'] | null;
  paymentContext?: 'new_member' | 'subscription_renewal';
  subtitle: string;
  title: string;
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
        </Animated.View>
      </ScrollView>
    </BgBlob>
  );
}

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
