import type { StartSubscriptionResponse } from '@packages/database/functions.types';
import * as Sentry from '@sentry/react-native';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  SharedValue,
  useAnimatedReaction,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useAuth } from '~/context/auth';
import { supabase } from '~/lib/supabase';
import { formatCurrency } from '~/utils';
import { Tables } from '~/utils/database-generated.types';

import { BgBlob } from '~/components/bg-blog';
import { Text } from '~/components/ui/text';

type PlanType = 'monthly' | 'annual';

export function BecomeMemberForm({
  scrollY,
  itemIndex,
  itemHeight,
  org,
}: {
  scrollY: SharedValue<number>;
  itemIndex: number;
  itemHeight: number;
  org: Tables<'organizations'>;
}) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = React.useState<PlanType | null>(null);
  const [isFocused, setIsFocused] = React.useState(false);
  const { session } = useAuth();

  useAnimatedReaction(
    () => {
      return Math.round(scrollY.value / itemHeight) === itemIndex;
    },
    (focused, prevFocused) => {
      if (focused !== prevFocused) {
        scheduleOnRN(setIsFocused, focused);
      }
    },
    [],
  );

  const annualDiscountPercentage =
    org.monthly_price_amount && org.annual_price_amount
      ? Math.round(
          ((org.monthly_price_amount * 12 - org.annual_price_amount) /
            (org.monthly_price_amount * 12)) *
            100,
        )
      : 0;

  const mutation = useMutation({
    mutationFn: async (values: { plan_type: PlanType }) => {
      const { data: charge, error } =
        await supabase.functions.invoke<StartSubscriptionResponse>(
          'start-subscription',
          {
            body: {
              plan_type: values.plan_type,
              slug: org.slug,
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
        pixCopyPaste: charge.brCode,
        qrCodeImage: charge.brCodeBase64,
        chargeId: charge.id,
      };
    },
    onSuccess: (data) => {
      router.push({
        pathname: '/payment',
        params: {
          qrCodeImage: data.qrCodeImage,
          pixCopyPaste: data.pixCopyPaste,
          chargeId: data.chargeId,
          paymentContext: 'new_member',
        },
      });
    },
    onError: (error) => {
      console.error('Error starting subscription:', error);
    },
  });

  const handleOpenEstatuto = () => {
    const { data } = supabase.storage
      .from('documents')
      .getPublicUrl('estatuto-slac.pdf');
    if (data?.publicUrl) {
      Linking.openURL(data.publicUrl);
    } else {
      const error = new Error(
        'Could not get public URL for estatuto-slac.pdf',
      );
      Sentry.captureException(error);
      Alert.alert(
        'Erro',
        'Não foi possível abrir o estatuto. Tente novamente mais tarde.',
      );
    }
  }

  const handleSubmit = () => {
    if (!selectedPlan) return;

    if (!session?.user) {
      router.push(`/(modals)/login?redirect_to=/organizations`);
      return;
    }

    Alert.alert(
      'Termos de Adesão',
      'Ao assinar este instrumento, declaro estar ciente do inteiro teor do estatuto social da associação, bem como dos direitos e dos deveres impostos aos membros desta instituição.\n\nPor fim, comprometo-me a honrar, em dia, com todas as parcelas pecuniárias por mim devidas a esta instituição, sob pena de justo desligamento da associação.',
      [
        {
          text: "Ver Estatuto",
          onPress: () => handleOpenEstatuto()
        },
        {
          text: 'Cancelar',
          style: 'destructive',
        },
        {
          isPreferred: true,
          text: 'Concordar',
          onPress: () => mutation.mutate({ plan_type: selectedPlan }),
        },
      ],
      {
        cancelable: true,
        userInterfaceStyle: "dark"
      }
    );
  };

  if (!isFocused) return null;

  return (
    <BgBlob>
      <Animated.View
        key={`plan-${isFocused}`}
        entering={isFocused ? FadeIn.duration(300) : undefined}
        className="gap-12 flex-1 justify-center px-2"
      >
        {/* Hero Section */}
        <View className="items-center mb-2">
          <Animated.Text
            entering={FadeInDown.delay(200).duration(400)}
            className="text-white text-5xl font-black text-center mb-4 leading-tight"
          >
            Faça parte{'\n'}da comunidade
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(350).duration(400)}
            className="text-white/90 text-center text-lg max-w-md leading-7 font-medium"
          >
            Cada membro fortalece o slackline brasileiro e apoia a preservação
            dos nossos espaços naturais
          </Animated.Text>
        </View>

        {/* Plan Cards - Simplified */}
        <View className="gap-6">
          {/* Monthly Plan */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <TouchableOpacity
              onPress={() => {
                setSelectedPlan('monthly');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              disabled={mutation.isPending}
              activeOpacity={0.8}
              className={`bg-white/10 backdrop-blur-xl p-5 rounded-2xl border-2 ${
                selectedPlan === 'monthly' ? 'border-white' : 'border-white/20'
              }`}
            >
              <View className="flex-row justify-between items-center">
                <View className="flex-1">
                  <Text className="text-white text-xl font-bold">Mensal</Text>
                  <Text className="text-white/60 text-sm">Flexível</Text>
                </View>
                <View className="items-end">
                  <Text className="text-white text-3xl font-bold">
                    {formatCurrency(org.monthly_price_amount)}
                  </Text>
                  <Text className="text-white/70 text-xs">/mês</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Annual Plan */}
          <Animated.View entering={FadeInDown.delay(400).duration(400)}>
            <TouchableOpacity
              onPress={() => {
                setSelectedPlan('annual');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              disabled={mutation.isPending}
              activeOpacity={0.8}
              className={`bg-white/10 backdrop-blur-xl p-5 rounded-2xl border-2 ${
                selectedPlan === 'annual'
                  ? 'border-emerald-400'
                  : 'border-white/20'
              } relative`}
            >
              <View className="flex-row justify-between items-center">
                <View className="flex-1">
                  <Text className="text-white text-xl font-bold">Anual</Text>
                  {!!annualDiscountPercentage && (
                    <Text className="text-emerald-300 text-sm font-medium">
                      Economia de {annualDiscountPercentage}%
                    </Text>
                  )}
                </View>
                <View className="items-end">
                  <Text className="text-white text-3xl font-bold">
                    {formatCurrency(org.annual_price_amount)}
                  </Text>
                  <Text className="text-white/70 text-xs">/ano</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View className="gap-4">
          {/* CTA Button */}
          <Animated.View entering={FadeInDown.delay(500).duration(400)}>
            <TouchableOpacity
              onPress={() => {
                handleSubmit();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              disabled={!selectedPlan || mutation.isPending}
              className="bg-white rounded-full py-5 items-center justify-center shadow-2xl disabled:opacity-50"
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text className="text-black text-xl font-bold">
                  Tornar-me membro
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Footer Note */}
          <Animated.View
            entering={FadeIn.delay(600).duration(500)}
            className="items-center"
          >
            <Text className="text-white/50 text-center text-sm leading-5 max-w-xs">
              Ao clicar nesse botão você deve realizar o primeiro pagamento para
              se tornar membro.
            </Text>
            <TouchableOpacity
              onPress={() => handleOpenEstatuto}
            >
              <Text className="text-white/70 text-center text-sm mt-2 underline">
                Ver Estatuto da Associação
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    </BgBlob>
  );
}
