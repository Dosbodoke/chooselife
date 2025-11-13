import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle,
  Clock,
  History,
  RefreshCw,
  Shield,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react-native';
import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, TouchableOpacity, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  LinearTransition,
  ZoomIn,
} from 'react-native-reanimated';

import { useAuth } from '~/context/auth';
import { PixIcon } from '~/lib/icons/pix';
import { supabase } from '~/lib/supabase';
import { cn } from '~/lib/utils';
import { Tables } from '~/utils/database.types';

import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

const fetchSubscriptionData = async (
  organizationId: string,
  userId: string,
) => {
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (subError) {
    throw new Error('Could not fetch subscription.');
  }

  if (!subscription) {
    return { subscription: null, payments: [] };
  }

  const { data: payments, error: invError } = await supabase
    .from('payments')
    .select('*')
    .eq('subscription_id', subscription.id)
    .order('created_at', { ascending: false });

  if (invError) {
    throw new Error('Could not fetch payments.');
  }

  return { subscription, payments };
};

const generatePixChargeFn = async (paymentId: string) => {
  const { data, error } = await supabase.functions.invoke(
    'create-abacate-pay-charge',
    {
      body: { paymentId },
    },
  );

  if (error) throw error;
  return data;
};

const PaymentStatusBadge = ({ status }: { status: string }) => {
  const statusConfig = {
    approved: {
      icon: <CheckCircle className="text-green-600" size={16} />,
      text: 'Aprovado',
      bg: 'bg-green-50',
      textClass: 'text-green-700',
      border: 'border-green-200',
    },
    succeeded: {
      icon: <CheckCircle className="text-green-600" size={16} />,
      text: 'Pago',
      bg: 'bg-green-50',
      textClass: 'text-green-700',
      border: 'border-green-200',
    },
    pending: {
      icon: <Clock className="text-amber-600" size={16} />,
      text: 'Pendente',
      bg: 'bg-amber-50',
      textClass: 'text-amber-700',
      border: 'border-amber-200',
    },
    failed: {
      icon: <XCircle className="text-red-600" size={16} />,
      text: 'Falhou',
      bg: 'bg-red-50',
      textClass: 'text-red-700',
      border: 'border-red-200',
    },
    canceled: {
      icon: <XCircle className="text-gray-600" size={16} />,
      text: 'Cancelado',
      bg: 'bg-gray-50',
      textClass: 'text-gray-700',
      border: 'border-gray-200',
    },
    overdue: {
      icon: <AlertCircle className="text-red-600" size={16} />,
      text: 'Vencido',
      bg: 'bg-red-50',
      textClass: 'text-red-700',
      border: 'border-red-200',
    },
    default: {
      icon: <AlertCircle className="text-gray-600" size={16} />,
      text: 'Desconhecido',
      bg: 'bg-gray-50',
      textClass: 'text-gray-700',
      border: 'border-gray-200',
    },
  };

  const config =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.default;

  return (
    <Animated.View
      entering={ZoomIn.springify()}
      layout={LinearTransition.springify()}
      className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${config.bg} border ${config.border}`}
    >
      {config.icon}
      <Text className={`text-xs font-bold ${config.textClass}`}>
        {config.text}
      </Text>
    </Animated.View>
  );
};

const MembershipStatusBadge = ({
  status,
  isActive,
}: {
  status: string;
  isActive: boolean;
}) => {
  const baseStyle = 'flex-row items-center gap-2 rounded-full px-4 py-2 border';

  if (isActive) {
    return (
      <Animated.View
        entering={FadeIn.springify()}
        layout={LinearTransition.springify()}
        className={cn(baseStyle, 'bg-green-50 border-green-200')}
      >
        <CheckCircle className="text-green-600" size={18} />
        <Text className="text-green-700 font-bold text-sm">Ativo</Text>
      </Animated.View>
    );
  }

  if (status === 'pending_payment') {
    return (
      <Animated.View
        entering={FadeIn.springify()}
        layout={LinearTransition.springify()}
        className={cn(baseStyle, 'bg-amber-50 border-amber-200')}
      >
        <Clock className="text-amber-600" size={18} />
        <Text className="text-amber-700 font-bold text-sm">Pendente</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.springify()}
      layout={LinearTransition.springify()}
      className={cn(baseStyle, 'bg-gray-50 border-gray-200')}
    >
      <XCircle className="text-gray-600" size={18} />
      <Text className="text-gray-700 font-bold text-sm">Inativo</Text>
    </Animated.View>
  );
};

const PendingPaymentAlert = ({
  amount,
  onPayPress,
  isPaying,
}: {
  amount: number;
  onPayPress: () => void;
  isPaying: boolean;
}) => (
  <Animated.View
    entering={FadeInDown.springify()}
    exiting={FadeOut}
    layout={LinearTransition.springify()}
    className="bg-amber-50 border border-amber-200 rounded-xl p-4 gap-4 items-start"
  >
    <View className="flex flex-row gap-4">
      <Clock className="text-amber-600 mt-0.5" size={24} />
      <View className="flex-1 gap-1">
        <Text className="text-amber-800 font-bold">Pagamento Pendente</Text>
        <Text className="text-amber-700">
          Conclua seu pagamento para ativar sua assinatura!
        </Text>
      </View>
    </View>

    <Button
      onPress={onPayPress}
      disabled={isPaying}
      className="w-full flex flex-row rounded-xl py-4 gap-2"
    >
      {isPaying ? (
        <ActivityIndicator color="white" size="small" />
      ) : (
        <Text className="text-white font-bold">
          PAGAR AGORA • R$ {(amount / 100).toFixed(2)}
        </Text>
      )}
    </Button>
  </Animated.View>
);

export const Subscription = ({
  organization,
}: {
  organization: Tables<'organizations'>;
}) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile } = useAuth();

  // Bottom Sheet configs
  const historySheetRef = useRef<BottomSheetModal>(null);
  const historySnapPoints = ['30%', '90%'];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['subscription', organization.id, profile?.id],
    queryFn: () => fetchSubscriptionData(organization.id, profile!.id),
    enabled: !!organization.id && !!profile?.id,
  });

  const pixMutation = useMutation({
    mutationFn: generatePixChargeFn,
    onSuccess: (data) => {
      router.push({
        pathname: '/payment',
        params: {
          qrCodeImage: data.qrCodeImage,
          pixCopyPaste: data.pixCopyPaste,
          chargeId: data.chargeId,
        },
      });
    },
    onError: (error) => {
      Alert.alert(t('organizations.paymentError'));
      console.error(error);
    },
  });

  const handleOpenHistory = useCallback(() => {
    historySheetRef.current?.present();
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
      />
    ),
    [],
  );

  const getDaysUntilDue = (date: string) => {
    const dueDate = new Date(date);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getMembershipDuration = (periodEnd: string | null) => {
    if (!periodEnd) return null;
    const endDate = new Date(periodEnd);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);

    if (diffDays < 0)
      return { value: Math.abs(diffDays), unit: 'dias', isExpired: true };
    if (diffDays === 0) return { value: 0, unit: 'hoje', isExpired: false };
    if (diffDays < 30)
      return { value: diffDays, unit: 'dias', isExpired: false };
    return { value: diffMonths, unit: 'meses', isExpired: false };
  };

  if (isLoading) {
    return (
      <Animated.View
        entering={FadeIn}
        className="flex-1 justify-center items-center p-6"
      >
        <ActivityIndicator size="large" color="#059669" />
        <Text className="mt-4 text-gray-600">Carregando assinatura...</Text>
      </Animated.View>
    );
  }

  if (isError) {
    return (
      <Animated.View
        entering={FadeIn}
        className="flex-1 justify-center items-center p-6"
      >
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <Text className="text-xl font-bold text-gray-900 mb-2">
          Falha na Conexão
        </Text>
        <Text className="text-gray-600 text-center mb-4">
          Não foi possível carregar os dados da assinatura.
        </Text>
        <Button onPress={() => refetch()} className="bg-emerald-600">
          <RefreshCw className="text-white mr-2" size={20} />
          <Text className="text-white font-bold">Tentar Novamente</Text>
        </Button>
      </Animated.View>
    );
  }

  if (!data?.subscription) {
    return (
      <Animated.View
        entering={FadeIn}
        className="flex-1 justify-center items-center p-6"
      >
        <Shield className="text-gray-300 mb-4" size={64} />
        <Text className="text-xl font-bold text-gray-900 mb-2">
          Nenhuma Assinatura Ativa
        </Text>
        <Text className="text-gray-600 text-center">
          Entre em contato com o suporte para ativar sua assinatura.
        </Text>
      </Animated.View>
    );
  }

  const { subscription, payments } = data;
  const pendingPayment = payments?.find((inv) => inv.status === 'pending');
  const lastSuccessfulPayment = payments?.find(
    (inv) => inv.status === 'succeeded',
  );
  const daysUntilDue = subscription.current_period_end
    ? getDaysUntilDue(subscription.current_period_end)
    : null;

  const isOverdue =
    subscription.status === 'active' &&
    daysUntilDue !== null &&
    daysUntilDue < 0;

  const isActive = subscription.status === 'active' && !isOverdue;
  const membershipDuration = getMembershipDuration(
    subscription.current_period_end,
  );

  // Calculate pricing info
  const monthlyPrice = organization.monthly_price_amount
    ? (organization.monthly_price_amount / 100).toFixed(2)
    : null;
  const annualPrice = organization.annual_price_amount
    ? (organization.annual_price_amount / 100).toFixed(2)
    : null;

  return (
    <>
      {/* Membership Status Card */}
      <Animated.View
        entering={FadeInUp.springify()}
        layout={LinearTransition.springify()}
        className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"
      >
        <Animated.View
          layout={LinearTransition.springify()}
          className="flex-row items-center justify-between mb-4"
        >
          <Text className="text-lg font-bold text-gray-900">
            Status da Assinatura
          </Text>
          <MembershipStatusBadge
            status={subscription.status}
            isActive={isActive}
          />
        </Animated.View>

        {pendingPayment && !isOverdue && (
          <PendingPaymentAlert
            amount={pendingPayment.amount}
            onPayPress={() => pixMutation.mutate(pendingPayment.id)}
            isPaying={pixMutation.isPending}
          />
        )}

        {isActive && membershipDuration && !membershipDuration.isExpired && (
          <Animated.View
            entering={FadeInDown.springify()}
            exiting={FadeOut}
            layout={LinearTransition.springify()}
            className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-emerald-600 text-xs font-bold mb-1">
                  Válido até
                </Text>
                <Text className="text-gray-900 text-base font-bold">
                  {new Date(
                    subscription.current_period_end!,
                  ).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-emerald-600 text-3xl font-black">
                  {membershipDuration.value}
                </Text>
                <Text className="text-emerald-600 text-xs font-bold">
                  {membershipDuration.unit} restantes
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        <Animated.View
          layout={LinearTransition.springify()}
          className="flex-row items-center"
        >
          <View className="w-10 h-10 rounded-xl bg-purple-50 items-center justify-center mr-3">
            <TrendingUp className="text-purple-600" size={20} />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 font-semibold">
              Ciclo de Cobrança
            </Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-bold text-gray-900 capitalize">
                {subscription.plan_type === 'annual' ? 'Anual' : 'Mensal'}
              </Text>
              <View className="bg-emerald-50 rounded-lg px-2 py-1">
                <Text className="text-emerald-700 font-bold text-xs">
                  R${' '}
                  {subscription.plan_type === 'annual'
                    ? annualPrice
                    : monthlyPrice}
                  {subscription.plan_type === 'monthly' && '/mês'}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {subscription.plan_type === 'annual' && annualPrice && monthlyPrice && (
          <Animated.View
            entering={FadeInDown.delay(100).springify()}
            layout={LinearTransition.springify()}
            className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-3"
          >
            <Text className="text-emerald-800 text-xs font-bold text-center">
              Você está economizando R${' '}
              {(
                parseFloat(monthlyPrice) * 12 -
                parseFloat(annualPrice)
              ).toFixed(2)}{' '}
              por ano!
            </Text>
          </Animated.View>
        )}

        {lastSuccessfulPayment && (
          <Animated.View
            layout={LinearTransition.springify()}
            className="flex-row items-center pt-3 mt-3 border-t border-gray-100"
          >
            <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center mr-3">
              <CalendarCheck className="text-blue-600" size={20} />
            </View>
            <View>
              <Text className="text-xs text-gray-500 font-semibold">
                Membro Desde
              </Text>
              <Text className="text-base font-bold text-gray-900">
                {new Date(
                  lastSuccessfulPayment.paid_at ||
                    lastSuccessfulPayment.created_at,
                ).toLocaleDateString('pt-BR', {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Payment History Button */}
        <TouchableOpacity
          onPress={handleOpenHistory}
          className="flex-row items-center justify-between pt-3 mt-3 border-t border-gray-100"
        >
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center mr-3">
              <History className="text-gray-600" size={20} />
            </View>
            <View>
              <Text className="text-base font-bold text-gray-900">
                Histórico de Pagamentos
              </Text>
              <Text className="text-xs text-gray-500 font-semibold">
                {payments?.length || 0} pagamentos totais
              </Text>
            </View>
          </View>
          <Text className="text-gray-400 text-2xl">›</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Payment History Bottom Sheet */}
      <BottomSheetModal
        ref={historySheetRef}
        snapPoints={historySnapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: '#ffffff' }}
        handleIndicatorStyle={{ backgroundColor: '#999' }}
        enableDynamicSizing={false}
      >
        <View className="px-6 pb-4">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-2xl font-black text-gray-900">
                Histórico de Pagamentos
              </Text>
              <Text className="text-sm text-gray-500 font-semibold mt-1">
                {payments?.length || 0} pagamentos totais
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => historySheetRef.current?.close()}
              className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
            >
              <X className="text-gray-600" size={24} />
            </TouchableOpacity>
          </View>
        </View>

        <BottomSheetScrollView className="px-6">
          {payments && payments.length > 0 ? (
            <View className="pb-6">
              {payments.map((item, index) => (
                <Animated.View
                  key={item.id}
                  entering={FadeInDown.delay(index * 50).springify()}
                  layout={LinearTransition.springify()}
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-3"
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center flex-1">
                      <View className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 items-center justify-center mr-3">
                        <PixIcon />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xl font-bold text-gray-900">
                          R$ {(item.amount / 100).toFixed(2)}
                        </Text>
                        <Text className="text-xs text-gray-500 font-semibold mt-0.5">
                          {new Date(item.created_at).toLocaleDateString(
                            'pt-BR',
                            {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            },
                          )}
                        </Text>
                      </View>
                    </View>
                    <PaymentStatusBadge status={item.status} />
                  </View>

                  {item.status === 'pending' && (
                    <Animated.View
                      entering={FadeInDown.delay(100).springify()}
                      layout={LinearTransition.springify()}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          historySheetRef.current?.close();
                          pixMutation.mutate(item.id);
                        }}
                        className="bg-emerald-50 border border-emerald-200 rounded-lg py-3 mt-2"
                        disabled={pixMutation.isPending}
                      >
                        <Text className="text-emerald-700 font-bold text-center text-sm">
                          Gerar Código PIX →
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  )}
                </Animated.View>
              ))}
            </View>
          ) : (
            <Animated.View
              entering={FadeIn.delay(200)}
              className="justify-center items-center"
            >
              <PixIcon className="text-gray-300 mb-3" width={42} height={42} />
              <Text className="text-gray-500 text-center font-semibold">
                Nenhum pagamento ainda
              </Text>
              <Text className="text-gray-400 text-center text-sm mt-1">
                Seu histórico de pagamentos aparecerá aqui
              </Text>
            </Animated.View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    </>
  );
};
