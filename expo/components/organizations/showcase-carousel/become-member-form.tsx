import { ENABLE_MEMBERSHIP_REGISTRATION } from '@chooselife/ui';
import type { StartSubscriptionResponse } from '@packages/database/functions.types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
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
import { getManualPaymentRouteParams } from '~/lib/manual-payment';
import {
  fetchMembershipApplication,
  type MembershipApplication,
} from '~/lib/membership-application';
import { queryKeys } from '~/lib/query-keys';
import { getR2PublicUrl } from '~/lib/r2';
import { supabase } from '~/lib/supabase';
import { formatCurrency } from '~/utils';
import { _layoutAnimation } from '~/utils/constants';
import { Tables } from '~/utils/database.types';

import { BgBlob } from '~/components/bg-blog';
import { Text } from '~/components/ui/text';

type PlanType = 'monthly' | 'annual';

export function BecomeMemberForm({
  scrollY,
  itemIndex,
  itemHeight,
  membershipApplication,
  org,
}: {
  scrollY: SharedValue<number>;
  itemIndex: number;
  itemHeight: number;
  membershipApplication: MembershipApplication | null;
  org: Tables<'organizations'>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = React.useState<PlanType | null>(null);
  const [isFocused, setIsFocused] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
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
        amount: 'amount' in charge ? charge.amount : undefined,
        paymentId: charge.paymentId,
      };
    },
    onSuccess: (data) => {
      router.push({
        pathname: '/payment',
        params: getManualPaymentRouteParams({
          amount: data.amount,
          paymentId: data.paymentId,
          paymentContext: 'new_member',
          slug: org.slug,
        }),
      });
    },
    onError: (error) => {
      console.error('Error starting subscription:', error);
      setErrorMessage(
        'Não foi possível iniciar a inscrição. Tente novamente mais tarde.',
      );
    },
  });

  const handleOpenEstatuto = async () => {
    const url = getR2PublicUrl('documents', 'estatuto-slac.pdf');
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir o estatuto.');
    }
  };

  const handleAgreeTerms = async () => {
    if (!selectedPlan || !session?.user) return;

    const queryKey = queryKeys.membershipApplication.byOrgUser(
      org.id,
      session.user.id,
    );
    const application =
      queryClient.getQueryData<MembershipApplication | null>(queryKey) ??
      membershipApplication ??
      (await queryClient.fetchQuery({
        queryKey,
        queryFn: () => fetchMembershipApplication(org.id, session.user.id),
      }));

    if (application?.status === 'submitted') {
      mutation.mutate({ plan_type: selectedPlan });
      return;
    }

    router.push({
      pathname: '/organizations/[slug]/onboarding',
      params: {
        accepted_terms_at: new Date().toISOString(),
        plan_type: selectedPlan,
        slug: org.slug,
      },
    });
  };

  const handleSubmit = () => {
    if (!selectedPlan) return;

    if (!session?.user) {
      router.push({
        pathname: '/(modals)/login',
        params: { redirect_to: `/organizations/${org.slug}/member` },
      });
      return;
    }

    Alert.alert(
      'Termos de Adesão',
      'Ao assinar este instrumento, declaro estar ciente do inteiro teor do estatuto social da associação, bem como dos direitos e dos deveres impostos aos membros desta instituição.\n\nPor fim, comprometo-me a honrar, em dia, com todas as parcelas pecuniárias por mim devidas a esta instituição, sob pena de justo desligamento da associação.',
      [
        {
          text: 'Ver Estatuto',
          onPress: () => handleOpenEstatuto(),
        },
        {
          text: 'Cancelar',
          style: 'destructive',
        },
        {
          isPreferred: true,
          text: 'Concordar',
          onPress: () => {
            handleAgreeTerms().catch((error) => {
              console.error('Error checking membership application:', error);
              setErrorMessage(
                'Não foi possível verificar seu cadastro. Tente novamente.',
              );
            });
          },
        },
      ],
      {
        cancelable: true,
        userInterfaceStyle: 'dark',
      },
    );
  };

  if (!isFocused) return null;

  return (
    <BgBlob>
      <Animated.View
        key={`plan-${isFocused}`}
        entering={isFocused ? FadeIn.duration(300) : undefined}
        className="gap-10 flex-1 justify-center px-5"
      >
        {/* Hero Section */}
        <View className="items-center mb-2">
          <Animated.Text
            entering={FadeInDown.delay(200).duration(400)}
            className="text-white text-4xl font-black text-center mb-4 leading-[44px]"
          >
            Faça parte{'\n'}da comunidade
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(350).duration(400)}
            className="text-white/80 text-center text-base max-w-md leading-6 font-medium px-4"
          >
            Cada membro fortalece o slackline brasileiro e apoia a preservação
            dos nossos espaços naturais
          </Animated.Text>
        </View>

        {!ENABLE_MEMBERSHIP_REGISTRATION ? (
          <Animated.View
            entering={FadeInDown.delay(300).duration(400)}
            className="bg-white/10 backdrop-blur-xl p-8 rounded-2xl border border-white/20 items-center mt-8"
          >
            <Text className="text-white text-2xl font-bold text-center mb-4">
              Inscrições em Breve
            </Text>
            <Text className="text-white/80 text-center text-lg leading-6">
              O sistema de membros estará disponível em breve. Não se preocupe,
              ativaremos essa função automaticamente para você!
            </Text>
          </Animated.View>
        ) : (
          <>
            {/* Plan Cards - Simplified */}
            <View className="gap-4">
              {/* Monthly Plan */}
              <Animated.View entering={FadeInDown.delay(300).duration(400)}>
                <Pressable
                  onPress={() => {
                    setSelectedPlan('monthly');
                    setErrorMessage(null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  disabled={mutation.isPending}
                  className={`bg-white/10 backdrop-blur-xl p-5 rounded-2xl border-2 ${
                    selectedPlan === 'monthly'
                      ? 'border-white'
                      : 'border-white/20'
                  }`}
                >
                  <View className="flex-row justify-between items-center">
                    <View className="flex-1">
                      <Text className="text-white text-xl font-bold">
                        Mensal
                      </Text>
                      <Text className="text-white/60 text-sm">Flexível</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-white text-3xl font-bold">
                        {formatCurrency(org.monthly_price_amount)}
                      </Text>
                      <Text className="text-white/70 text-xs">/mês</Text>
                    </View>
                  </View>
                </Pressable>
              </Animated.View>

              {/* Annual Plan */}
              <Animated.View entering={FadeInDown.delay(400).duration(400)}>
                <Pressable
                  onPress={() => {
                    setSelectedPlan('annual');
                    setErrorMessage(null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  disabled={mutation.isPending}
                  className={`bg-white/10 backdrop-blur-xl p-5 rounded-2xl border-2 ${
                    selectedPlan === 'annual'
                      ? 'border-emerald-400'
                      : 'border-white/20'
                  } relative`}
                >
                  <View className="flex-row justify-between items-center">
                    <View className="flex-1">
                      <Text className="text-white text-xl font-bold">
                        Anual
                      </Text>
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
                </Pressable>
              </Animated.View>
            </View>

            <View className="gap-4">
              {errorMessage && (
                <Animated.View
                  entering={FadeIn.duration(300)}
                  className="bg-red-500/80 p-4 rounded-lg"
                >
                  <Text className="text-white text-center font-bold">
                    {errorMessage}
                  </Text>
                </Animated.View>
              )}
              {/* CTA Button */}
              <Animated.View
                entering={FadeInDown.delay(500).duration(400)}
                layout={_layoutAnimation}
              >
                <Pressable
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
                </Pressable>
              </Animated.View>

              {/* Footer Note */}
              <Animated.View
                entering={FadeIn.delay(600).duration(500)}
                layout={_layoutAnimation}
                className="items-center"
              >
                <Text className="text-white/50 text-center text-sm leading-5 max-w-xs">
                  Ao clicar nesse botão você deve realizar o primeiro pagamento
                  para se tornar membro.
                </Text>
                <Pressable onPress={handleOpenEstatuto}>
                  <Text className="text-white/70 text-center text-sm mt-2 underline">
                    Ver Estatuto da Associação
                  </Text>
                </Pressable>
              </Animated.View>
            </View>
          </>
        )}
      </Animated.View>
    </BgBlob>
  );
}
