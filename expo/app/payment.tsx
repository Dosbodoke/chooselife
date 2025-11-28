import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, CheckCircle2, Copy } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { LucideIcon } from '~/lib/icons/lucide-icon';
import { queryKeys } from '~/lib/query-keys';
import { supabase } from '~/lib/supabase';

import { BgBlob } from '~/components/bg-blog';

export default function PaymentScreen() {
  const router = useRouter();
  const { qrCodeImage, pixCopyPaste, chargeId, paymentContext } =
    useLocalSearchParams<{
      qrCodeImage: string;
      pixCopyPaste: string;
      chargeId: string;
      paymentContext: 'new_member' | 'subscription_renewal';
    }>();
  const queryClient = useQueryClient();
  const [paymentStatus, setPaymentStatus] = React.useState<
    'PENDING' | 'SUCCESS' | 'FAILED'
  >('PENDING');

  React.useEffect(() => {
    if (!chargeId) return;

    const channel = supabase
      .channel(`payment-status:${chargeId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payments',
          filter: `abacate_pay_charge_id=eq.${chargeId}`,
        },
        (payload) => {
          if (payload.new.status === 'succeeded') {
            setPaymentStatus('SUCCESS');
            queryClient.invalidateQueries({
              queryKey: queryKeys.subscription.all,
            });
            setTimeout(() => {
              if (router.canGoBack()) router.back();
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
  }, [chargeId, router, queryClient]);

  if (paymentStatus === 'SUCCESS') {
    return (
      <BgBlob>
        <View className="flex-1 justify-center items-center gap-4">
          <Animated.View entering={ZoomIn}>
            <CheckCircle2 size={64} color="#10B981" />
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

  if (!qrCodeImage || !pixCopyPaste) {
    return (
      <BgBlob>
        <View className="flex-1 justify-center items-center">
          <Text className="text-white">
            Error: Missing payment information.
          </Text>
        </View>
      </BgBlob>
    );
  }

  return (
    <BgBlob>
      <View className="flex-1 pt-16">
        {/* Header * */}
        <View className="items-center mb-8">
          <Animated.View
            entering={FadeInDown.delay(300).duration(300)}
            className="bg-emerald-500/20 backdrop-blur-xl rounded-full p-4 mb-4 border-2 border-emerald-400/30"
          >
            <LucideIcon
              name="HandCoins"
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

        {/* QR Code */}
        <Animated.View
          entering={FadeInDown.delay(700).duration(500)}
          className="items-center mb-8"
        >
          <View className="bg-white p-6 rounded-3xl shadow-2xl">
            <ExpoImage
              source={{ uri: qrCodeImage }}
              style={{ width: 220, height: 220 }}
            />
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeIn.delay(900).duration(300)}
          className="items-center mb-6 px-4"
        >
          <CopyCode code={pixCopyPaste} />
        </Animated.View>
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
            <Check size={18} color="#10B981" />
            <Text className="text-emerald-400 text-sm font-semibold tracking-wide">
              Copiado!
            </Text>
          </>
        ) : (
          <>
            <Copy size={18} color="#FFFFFF" />
            <Text className="text-white/90 text-sm font-semibold tracking-wide">
              Copiar PIX
            </Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};
