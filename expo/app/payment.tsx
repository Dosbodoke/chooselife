import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CheckCircle2Icon,
  CheckIcon,
  CopyIcon,
  HandCoinsIcon,
  XIcon,
} from 'lucide-react-native';
import React from 'react';
import QRCode from 'react-qr-code';
import { Pressable, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '~/context/auth';
import { queryKeys } from '~/lib/query-keys';
import { MANUAL_PAYMENT_PIX_COPY_PASTE } from '~/lib/manual-payment';
import { supabase } from '~/lib/supabase';

import { BgBlob } from '~/components/bg-blog';
import { Icon } from '~/components/ui/icon';

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
  const [paymentStatus, setPaymentStatus] = React.useState<
    'PENDING' | 'SUCCESS' | 'FAILED'
  >('PENDING');
  const amountInCents = Number(amount);
  const formattedAmount = Number.isFinite(amountInCents)
    ? `R$ ${(amountInCents / 100).toFixed(2)}`
    : null;
  const hasManualPixInstructions = Boolean(MANUAL_PAYMENT_PIX_COPY_PASTE);

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  React.useEffect(() => {
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
            setPaymentStatus('SUCCESS');
            queryClient.invalidateQueries({
              queryKey: queryKeys.subscription.all,
            });
            if (slug && profile?.id) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.organizations.isMember(slug, profile.id),
              });
              queryClient.invalidateQueries({
                queryKey: queryKeys.organizations.memberCount(slug),
              });
            }
            setTimeout(() => {
              if (paymentContext === 'new_member') {
                router.navigate('/(tabs)/organizations');
              } else {
                handleClose();
              }
            }, 3000);
          } else if (payload.new.status === 'failed') {
            setPaymentStatus('FAILED');
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [paymentId, router, queryClient, slug, profile?.id, paymentContext]);

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
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-white underline">Tentar novamente</Text>
          </TouchableOpacity>
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
        </View>
      </BgBlob>
    );
  }

  return (
    <BgBlob>
      <CloseButton onClose={handleClose} />
      <View className="flex-1 pt-16">
        {/* Header * */}
        <View className="items-center mb-8">
          <Animated.View
            entering={FadeInDown.delay(300).duration(300)}
            className="bg-emerald-500/20 backdrop-blur-xl rounded-full p-4 mb-4 border-2 border-emerald-400/30"
          >
            <Icon
              as={HandCoinsIcon}
              size={32}
              className="text-emerald-500"
            />
          </Animated.View>
          <Animated.Text
            entering={FadeInDown.delay(400).duration(300)}
            className="text-3xl font-bold text-white text-center mb-2"
          >
            {paymentContext === 'subscription_renewal'
              ? 'Pague sua mensalidade'
              : 'Finalize seu cadastro'}
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(500).duration(300)}
            className="text-white text-center text-xl leading-6"
          >
            {paymentContext === 'subscription_renewal'
              ? 'Realize o pagamento para ficar em dia com a Associação'
              : 'Realize o pagamento para se tornar membro oficial'}
          </Animated.Text>
        </View>

        <>
          {/* QR Code */}
          <Animated.View
            entering={FadeInDown.delay(700).duration(500)}
            className="items-center mb-8"
          >
            <View className="bg-white p-6 rounded-3xl shadow-2xl">
              <QRCode
                value={MANUAL_PAYMENT_PIX_COPY_PASTE}
                size={220}
                level="M"
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeIn.delay(900).duration(300)}
            className="items-center mb-6 px-4"
          >
            <CopyCode code={MANUAL_PAYMENT_PIX_COPY_PASTE} />
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
              Após pagar, a confirmação será feita manualmente pela associação.
              Esta tela atualiza quando o pagamento for aprovado.
            </Text>
            <Text className="text-white/50 text-center text-xs leading-4">
              Solicitação: {paymentId}
            </Text>
          </Animated.View>
        </>
      </View>
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
    <TouchableOpacity
      onPress={handleCopy}
      activeOpacity={0.8}
      className={`bg-white/10 backdrop-blur-xl px-6 py-3 rounded-full border ${
        copied ? 'border-emerald-400/50' : 'border-transparent'
      }`}
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
    </TouchableOpacity>
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
