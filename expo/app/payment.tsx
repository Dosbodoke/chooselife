import { useQueryClient } from '@tanstack/react-query';
import localImage from '~/assets/images/slac-pricing-bg.jpeg';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, CheckCircle2, Copy } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LucideIcon } from '~/lib/icons/lucide-icon';
import { queryKeys } from '~/lib/query-keys';
import { supabase } from '~/lib/supabase';

const WithBgBlob = ({ children }: { children: React.ReactNode }) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="relative flex-1 bg-black px-4"
      style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}
    >
      <Animated.View
        style={StyleSheet.absoluteFill}
        entering={FadeInUp.duration(1000)}
      >
        <ExpoImage
          source={localImage}
          style={StyleSheet.absoluteFill}
          blurRadius={50}
          contentFit="cover"
          contentPosition="center"
        />
      </Animated.View>
      {children}
    </View>
  );
};

export default function PaymentScreen() {
  const router = useRouter();
  const { qrCodeImage, pixCopyPaste, chargeId } = useLocalSearchParams<{
    qrCodeImage: string;
    pixCopyPaste: string;
    chargeId: string;
  }>();
  const [copied, setCopied] = React.useState(false);
  const queryClient = useQueryClient();
  const [paymentStatus, setPaymentStatus] = React.useState('PENDING'); // PENDING, SUCCESS, FAILED

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

  const handleCopy = async () => {
    if (pixCopyPaste) {
      await Clipboard.setStringAsync(pixCopyPaste);

      // Adiciona o feedback tátil aqui
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (paymentStatus === 'SUCCESS') {
    return (
      <WithBgBlob>
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
            Você agora é um membro.
          </Animated.Text>
        </View>
      </WithBgBlob>
    );
  }

  if (paymentStatus === 'FAILED') {
    return (
      <WithBgBlob>
        <View className="flex-1 justify-center items-center gap-4">
          <Animated.Text className="text-white text-2xl font-bold">
            Pagamento falhou
          </Animated.Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-white underline">Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </WithBgBlob>
    );
  }

  if (!qrCodeImage || !pixCopyPaste) {
    return (
      <WithBgBlob>
        <View className="flex-1 justify-center items-center">
          <Text className="text-white">
            Error: Missing payment information.
          </Text>
        </View>
      </WithBgBlob>
    );
  }

  return (
    <WithBgBlob>
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
            className="text-3xl font-bold text-black text-center mb-2"
          >
            Finalize seu cadastro
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(500).duration(300)}
            className="text-black text-center text-xl leading-6"
          >
            Realize o pagamento para{'\n'}
            se tornar membro oficial
          </Animated.Text>
        </View>

        {/* QR Code */}
        <Animated.View
          entering={ZoomIn.delay(700).duration(500)}
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
        </Animated.View>
      </View>
    </WithBgBlob>
  );
}
