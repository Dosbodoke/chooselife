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
import QRCode from 'react-qr-code';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '~/context/auth';
import { useMountEffect } from '~/hooks/use-mount-effect';
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

const paymentInstructionsQueryKey = (paymentId: string | undefined) =>
  ['payment-instructions', paymentId] as const;

export default function PaymentScreen() {
  const router = useRouter();
  const { amount, paymentId, paymentContext, slug } = useLocalSearchParams<{
    amount?: string;
    paymentId: string;
    paymentContext?: 'new_member' | 'subscription_renewal';
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
    enabled: Boolean(paymentId),
  });
  const paymentInstructions = paymentInstructionsQuery.data;
  const amountInCents =
    paymentInstructions?.amount ??
    (Number.isFinite(routeAmountInCents) ? routeAmountInCents : null);
  const formattedAmount = amountInCents
    ? `R$ ${(amountInCents / 100).toFixed(2)}`
    : null;
  const manualPixCopyPaste = paymentInstructions?.pix_copy_paste ?? '';
  const hasManualPixInstructions = Boolean(manualPixCopyPaste);

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const userMarkedPaidAt =
    paymentInstructions?.user_marked_paid_at ?? null;

  const markPaidMutation = useMutation({
    mutationFn: async () => {
      if (!paymentId) {
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
    if (!paymentId || markPaidMutation.isPending || userMarkedPaidAt) return;

    markPaidMutation.mutate();
  };

  if (paymentStatus === 'SUCCESS') {
    return (
      <BgBlob>
        <CloseButton onClose={handleClose} />
        <View className="flex-1 justify-center items-center gap-4">
          <Animated.View entering={ZoomIn}>
            <Icon as={CheckCircle2Icon} size={64} color="#10B981" />
          </Animated.View>
          <Animated.Text
            entering={FadeIn.delay(200)}
            className="text-white text-2xl font-bold"
          >
            Pagamento confirmado!
          </Animated.Text>
          <Animated.Text
            entering={FadeIn.delay(400)}
            className="text-white/80 text-lg text-center"
          >
            {paymentContext === 'subscription_renewal'
              ? 'Você está em dia com a Associação!'
              : 'Bem-vindo(a)! Você agora é membro oficial da Associação.'}
          </Animated.Text>
        </View>
      </BgBlob>
    );
  }

  if (paymentStatus === 'FAILED') {
    return (
      <BgBlob>
        <CloseButton onClose={handleClose} />
        <View className="flex-1 justify-center items-center gap-4">
          <Animated.Text className="text-white text-2xl font-bold">
            Pagamento falhou
          </Animated.Text>
          <Pressable
            onPress={() => router.back()}
            className="active:opacity-70"
          >
            <Text className="text-white underline">Tentar novamente</Text>
          </Pressable>
        </View>
      </BgBlob>
    );
  }

  if (paymentInstructionsQuery.isLoading) {
    return (
      <BgBlob>
        <CloseButton onClose={handleClose} />
        <View className="flex-1 justify-center items-center gap-4">
          <ActivityIndicator color="#FFFFFF" />
          <Text className="text-white/80">Carregando pagamento...</Text>
        </View>
      </BgBlob>
    );
  }

  if (!paymentId || !hasManualPixInstructions) {
    return (
      <BgBlob>
        <CloseButton onClose={handleClose} />
        <View className="flex-1 justify-center items-center px-6 gap-3">
          <Text className="text-white text-2xl font-bold text-center">
            Pagamento indisponível
          </Text>
          <Text className="text-white/80 text-center leading-6">
            O PIX da associação ainda não foi configurado no aplicativo.
          </Text>
          {paymentInstructionsQuery.isError ? (
            <Text className="text-white/60 text-center text-sm">
              Não foi possível carregar os dados do pagamento.
            </Text>
          ) : null}
          {formattedAmount ? (
            <Text className="text-white/60 text-center text-sm">
              Valor solicitado: {formattedAmount}
            </Text>
          ) : null}
        </View>
      </BgBlob>
    );
  }

  return (
    <BgBlob>
      <PaymentStatusSubscription
        key={`${paymentId}:${slug ?? ''}:${profile?.id ?? ''}:${
          paymentContext ?? ''
        }`}
        paymentContext={paymentContext}
        paymentId={paymentId}
        profileId={profile?.id}
        queryClient={queryClient}
        slug={slug}
        onClose={handleClose}
        onFailed={() => setPaymentStatus('FAILED')}
        onSucceeded={() => setPaymentStatus('SUCCESS')}
      />
      <CloseButton onClose={handleClose} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="pt-20"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center mb-6 px-6">
          <Animated.Text
            entering={FadeInDown.delay(400).duration(300)}
            className="text-3xl font-bold text-white text-center mb-2 leading-9"
          >
            {paymentContext === 'subscription_renewal'
              ? 'Pague sua mensalidade'
              : 'Finalize seu cadastro'}
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(500).duration(300)}
            className="text-white/90 text-center text-lg leading-6"
          >
            {paymentContext === 'subscription_renewal'
              ? 'Realize o pagamento para ficar em dia com a Associação'
              : 'Realize o pagamento para se tornar membro oficial'}
          </Animated.Text>
        </View>

        <>
          <Animated.View
            entering={FadeInDown.delay(700).duration(500)}
            className="items-center mb-5"
          >
            <View className="bg-white p-5 rounded-3xl shadow-2xl">
              <QRCode
                value={manualPixCopyPaste}
                size={200}
                level="M"
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeIn.delay(900).duration(300)}
            className="items-center mb-5 px-4"
          >
            <CopyCode code={manualPixCopyPaste} />
          </Animated.View>

          <Animated.View
            entering={FadeIn.delay(1000).duration(300)}
            className="mx-6 rounded-2xl border border-white/15 bg-white/10 px-5 py-4 gap-2"
          >
            {formattedAmount ? (
              <Text className="text-white text-center text-lg font-bold">
                Valor: {formattedAmount}
              </Text>
            ) : null}
            <Text className="text-white/80 text-center text-sm leading-5">
              Depois de pagar, toque em "Já paguei". A equipe confere o PIX e
              aprova sua assinatura manualmente.
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeIn.delay(1100).duration(300)}
            className="mx-6 mt-4 gap-3"
          >
            <Pressable
              onPress={handleMarkPaid}
              disabled={markPaidMutation.isPending || Boolean(userMarkedPaidAt)}
              className={`rounded-full py-4 items-center justify-center ${
                userMarkedPaidAt ? 'bg-emerald-500/20' : 'bg-white'
              }`}
              style={({ pressed }) => ({
                opacity:
                  markPaidMutation.isPending || userMarkedPaidAt
                    ? undefined
                    : pressed
                      ? 0.85
                      : 1,
              })}
            >
              {markPaidMutation.isPending ? (
                <ActivityIndicator color="#000" />
              ) : (
                <View className="flex-row items-center gap-2">
                  {userMarkedPaidAt ? (
                    <Icon as={CheckIcon} size={18} color="#34D399" />
                  ) : null}
                  <Text
                    className={`text-lg font-bold ${
                      userMarkedPaidAt ? 'text-emerald-300' : 'text-black'
                    }`}
                  >
                    {userMarkedPaidAt ? 'Pagamento informado' : 'Já paguei'}
                  </Text>
                </View>
              )}
            </Pressable>

            {userMarkedPaidAt ? (
              <Text className="text-white/70 text-center text-sm leading-5">
                Recebemos seu aviso. A associação vai conferir o pagamento e
                aprovar manualmente sua assinatura.
              </Text>
            ) : null}

            {markPaidMutation.isError ? (
              <Text className="text-red-200 text-center text-sm leading-5">
                Não foi possível avisar a associação agora. Tente novamente.
              </Text>
            ) : null}
          </Animated.View>
        </>
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
            if (slug && profileId) {
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

const CloseButton = ({ onClose }: { onClose: () => void }) => {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      onPress={onClose}
      className="absolute right-6 p-2.5 rounded-full bg-background/80 z-50"
      style={{
        top: insets.top + 12,
      }}
      hitSlop={12}
    >
      <Icon as={XIcon} size={20} className="fill-muted" />
    </Pressable>
  );
};
