import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CheckCircle2Icon,
  CheckIcon,
  CopyIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  HandCoinsIcon,
  XIcon,
} from 'lucide-react-native';
import React from 'react';
import { Linking, Pressable, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '~/context/auth';
import { queryKeys } from '~/lib/query-keys';
import { supabase } from '~/lib/supabase';

import { BgBlob } from '~/components/bg-blog';
import { Icon } from '~/components/ui/icon';

export default function PaymentScreen() {
  const router = useRouter();
  const { checkoutUrl, qrCodeImage, pixCopyPaste, paymentId, paymentContext, slug } =
    useLocalSearchParams<{
      checkoutUrl?: string;
      qrCodeImage: string;
      pixCopyPaste: string;
      paymentId: string;
      paymentContext?: 'new_member' | 'subscription_renewal';
      slug?: string;
    }>();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [paymentStatus, setPaymentStatus] = React.useState<
    'PENDING' | 'SUCCESS' | 'FAILED'
  >('PENDING');
  const didOpenCheckout = React.useRef(false);

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

  const openCheckout = React.useCallback(async () => {
    if (!checkoutUrl) return;

    try {
      await Linking.openURL(checkoutUrl);
    } catch (error) {
      console.error('Error opening Stripe Checkout:', error);
      setPaymentStatus('FAILED');
    }
  }, [checkoutUrl]);

  React.useEffect(() => {
    if (!checkoutUrl || didOpenCheckout.current) return;
    didOpenCheckout.current = true;
    void openCheckout();
  }, [checkoutUrl, openCheckout]);

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

  if (!checkoutUrl && (!qrCodeImage || !pixCopyPaste)) {
    return (
      <BgBlob>
        <CloseButton onClose={handleClose} />
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
      <CloseButton onClose={handleClose} />
      <View className="flex-1 pt-16">
        {/* Header * */}
        <View className="items-center mb-8">
          <Animated.View
            entering={FadeInDown.delay(300).duration(300)}
            className="bg-emerald-500/20 backdrop-blur-xl rounded-full p-4 mb-4 border-2 border-emerald-400/30"
          >
            <Icon
              as={checkoutUrl ? CreditCardIcon : HandCoinsIcon}
              size={32}
              className="text-emerald-500"
            />
          </Animated.View>
          <Animated.Text
            entering={FadeInDown.delay(400).duration(300)}
            className="text-3xl font-bold text-white text-center mb-2"
          >
            {checkoutUrl
              ? 'Concluir pagamento'
              : paymentContext === 'subscription_renewal'
              ? 'Pague sua mensalidade'
              : 'Finalize seu cadastro'}
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(500).duration(300)}
            className="text-white text-center text-xl leading-6"
          >
            {checkoutUrl
              ? 'Finalize o pagamento no Stripe. Esta tela será atualizada automaticamente.'
              : paymentContext === 'subscription_renewal'
              ? 'Realize o pagamento para ficar em dia com a Associação'
              : 'Realize o pagamento para se tornar membro oficial'}
          </Animated.Text>
        </View>

        {checkoutUrl ? (
          <Animated.View
            entering={FadeInDown.delay(700).duration(500)}
            className="items-center mb-8 px-6 gap-5"
          >
            <TouchableOpacity
              onPress={openCheckout}
              activeOpacity={0.85}
              className="h-14 min-h-14 rounded-full bg-white px-6 flex-row items-center justify-center gap-2"
            >
              <Text className="text-black text-base font-bold text-center">
                Abrir pagamento
              </Text>
              <Icon as={ExternalLinkIcon} size={18} color="#000000" />
            </TouchableOpacity>
            <Text className="text-white/70 text-center text-sm leading-5">
              Aguardando confirmação do Stripe.
            </Text>
          </Animated.View>
        ) : (
          <>
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
          </>
        )}
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
