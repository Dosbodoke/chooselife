import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  RefreshCw,
  Shield,
  TrendingUp,
  XCircle,
} from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Modal,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '~/context/auth';
import { supabase } from '~/lib/supabase';
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
    .eq('subscription_id', subscription.id);

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
      text: 'Approved',
      bg: 'bg-green-50',
      textClass: 'text-green-700',
      border: 'border-green-200',
    },
    pending_payment: {
      icon: <Clock className="text-amber-600" size={16} />,
      text: 'Pending Payment',
      bg: 'bg-amber-50',
      textClass: 'text-amber-700',
      border: 'border-amber-200',
    },
    canceled: {
      icon: <XCircle className="text-gray-600" size={16} />,
      text: 'Canceled',
      bg: 'bg-gray-50',
      textClass: 'text-gray-700',
      border: 'border-gray-200',
    },
    succeeded: {
      icon: <CheckCircle className="text-green-600" size={16} />,
      text: 'Succeeded',
      bg: 'bg-green-50',
      textClass: 'text-green-700',
      border: 'border-green-200',
    },
    pending: {
      icon: <Clock className="text-amber-600" size={16} />,
      text: 'Pending',
      bg: 'bg-amber-50',
      textClass: 'text-amber-700',
      border: 'border-amber-200',
    },
    failed: {
      icon: <XCircle className="text-red-600" size={16} />,
      text: 'Failed',
      bg: 'bg-red-50',
      textClass: 'text-red-700',
      border: 'border-red-200',
    },
    overdue: {
      icon: <AlertCircle className="text-red-600" size={16} />,
      text: 'Overdue',
      bg: 'bg-red-50',
      textClass: 'text-red-700',
      border: 'border-red-200',
    },
    default: {
      icon: <AlertCircle className="text-gray-600" size={16} />,
      text: 'Unknown',
      bg: 'bg-gray-50',
      textClass: 'text-gray-700',
      border: 'border-gray-200',
    },
  };

  const config =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.default;

  return (
    <View
      className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${config.bg} border ${config.border}`}
    >
      {config.icon}
      <Text className={`text-xs font-bold ${config.textClass}`}>
        {config.text}
      </Text>
    </View>
  );
};

export function Payments({
  organization,
}: {
  organization: Tables<'organizations'>;
}) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [pixInfo, setPixInfo] = React.useState<{ brCode: string } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['subscription', organization.id, profile?.id],
    queryFn: () => fetchSubscriptionData(organization.id, profile!.id),
    enabled: !!organization.id && !!profile?.id,
  });

  const pixMutation = useMutation({
    mutationFn: generatePixChargeFn,
    onSuccess: (data) => {
      setPixInfo(data);
    },
    onError: (error) => {
      Alert.alert(t('organizations.paymentError'));
      console.error(error);
    },
  });

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert(t('general.copiedToClipboard'));
  };

  const closeModal = () => {
    setPixInfo(null);
    queryClient.invalidateQueries({
      queryKey: ['subscription', organization.id, profile?.id],
    });
  };

  const getDaysUntilDue = (date: string) => {
    const dueDate = new Date(date);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <ActivityIndicator size="large" color="#059669" />
        <Text className="mt-4 text-gray-600">Loading subscription...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <Text className="text-xl font-bold text-gray-900 mb-2">
          Connection Failed
        </Text>
        <Text className="text-gray-600 text-center mb-4">
          Unable to load subscription data.
        </Text>
        <Button onPress={() => refetch()} className="bg-emerald-600">
          <RefreshCw className="text-white mr-2" size={20} />
          <Text className="text-white font-bold">Retry</Text>
        </Button>
      </View>
    );
  }

  if (!data?.subscription) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <Shield className="text-gray-300 mb-4" size={64} />
        <Text className="text-xl font-bold text-gray-900 mb-2">
          No Active Membership
        </Text>
        <Text className="text-gray-600 text-center">
          Contact support to activate your membership.
        </Text>
      </View>
    );
  }

  const { subscription, payments } = data;
  const pendingPayment = payments?.find((inv) => inv.status === 'pending');
  const daysUntilDue = subscription.current_period_end
    ? getDaysUntilDue(subscription.current_period_end)
    : null;

  const isOverdue =
    subscription.status === 'active' &&
    daysUntilDue !== null &&
    daysUntilDue < 0;

  const displayStatus = isOverdue ? 'overdue' : subscription.status;

  const paidPayments = payments.filter((p) => p.status === 'succeeded');
  const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <View className="flex-1 bg-gray-50 px-6 py-6">
      {/* Alert Banners */}
      {isOverdue && (
        <View className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex-row items-start">
          <AlertCircle className="text-red-600 mr-3 mt-0.5" size={24} />
          <View className="flex-1">
            <Text className="text-red-800 font-bold mb-1">
              ⚠️ Payment Overdue
            </Text>
            <Text className="text-red-700 text-sm">
              Your subscription has expired. Pay the pending invoice to renew.
            </Text>
          </View>
        </View>
      )}

      {subscription.status === 'pending_payment' && pendingPayment && (
        <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex-row items-start">
          <Clock className="text-amber-600 mr-3 mt-0.5" size={24} />
          <View className="flex-1">
            <Text className="text-amber-800 font-bold mb-1">
              ⏱️ Payment Pending
            </Text>
            <Text className="text-amber-700 text-sm">
              Complete your payment to activate your membership!
            </Text>
          </View>
        </View>
      )}

      {/* Subscription Card */}
      <View className="bg-white border border-gray-200 rounded-2xl p-5 mb-4 shadow-sm">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-bold text-gray-900">
            Your Subscription
          </Text>
          <PaymentStatusBadge status={displayStatus} />
        </View>

        <View className="space-y-3">
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-xl bg-emerald-50 items-center justify-center mr-3">
              <TrendingUp className="text-emerald-600" size={20} />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-gray-500 font-semibold">
                Plan Type
              </Text>
              <Text className="text-base font-bold text-gray-900 capitalize">
                {subscription.plan_type}
              </Text>
            </View>
          </View>

          {subscription.current_period_end && (
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-xl bg-purple-50 items-center justify-center mr-3">
                <Calendar className="text-purple-600" size={20} />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-gray-500 font-semibold">
                  Next Payment
                </Text>
                <Text className="text-base font-bold text-gray-900">
                  {new Date(subscription.current_period_end).toLocaleDateString(
                    'pt-BR',
                  )}
                </Text>
                {daysUntilDue !== null && (
                  <Text
                    className={`text-xs font-semibold mt-0.5 ${
                      daysUntilDue < 0
                        ? 'text-red-600'
                        : daysUntilDue < 7
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                    }`}
                  >
                    {daysUntilDue > 0
                      ? `in ${daysUntilDue} days`
                      : daysUntilDue === 0
                        ? 'Due today!'
                        : `${Math.abs(daysUntilDue)} days overdue`}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Pay Now Button */}
      {pendingPayment && (
        <Button
          onPress={() => pixMutation.mutate(pendingPayment.id)}
          disabled={pixMutation.isPending}
          className="bg-emerald-600 mb-6 rounded-2xl py-5 shadow-md"
        >
          {pixMutation.isPending ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <DollarSign className="text-white mr-2" size={24} />
              <Text className="text-white font-black text-lg">PAY NOW</Text>
            </>
          )}
        </Button>
      )}

      {/* Stats Card */}
      {paidPayments.length > 0 && (
        <View className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-5 mb-6 shadow-md">
          <View className="flex-row items-center mb-4">
            <Shield className="text-white mr-2" size={20} />
            <Text className="text-white text-lg font-bold">
              Your Contribution
            </Text>
          </View>
          <View className="flex-row justify-between items-end">
            <View>
              <Text className="text-emerald-100 text-xs font-semibold uppercase tracking-wider mb-1">
                Total Invested
              </Text>
              <Text className="text-white text-3xl font-black">
                R$ {(totalPaid / 100).toFixed(2)}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-emerald-100 text-xs font-semibold uppercase tracking-wider mb-1">
                Payments
              </Text>
              <Text className="text-white text-2xl font-bold">
                {paidPayments.length}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Payment History */}
      <View>
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-bold text-gray-900">
            Payment History
          </Text>
          <Text className="text-gray-500 text-sm font-semibold">
            {payments?.length || 0} total
          </Text>
        </View>

        {payments && payments.length > 0 ? (
          <View className="space-y-3">
            {payments.map((item) => (
              <View
                key={item.id}
                className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
              >
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center flex-1">
                    <View className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 items-center justify-center mr-3">
                      <CreditCard className="text-emerald-600" size={22} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xl font-bold text-gray-900">
                        R$ {(item.amount / 100).toFixed(2)}
                      </Text>
                      <Text className="text-xs text-gray-500 font-semibold mt-0.5">
                        {new Date(item.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>
                  <PaymentStatusBadge status={item.status} />
                </View>

                {item.status === 'pending' && (
                  <TouchableOpacity
                    onPress={() => pixMutation.mutate(item.id)}
                    className="bg-emerald-50 border border-emerald-200 rounded-lg py-3 mt-2"
                    disabled={pixMutation.isPending}
                  >
                    <Text className="text-emerald-700 font-bold text-center text-sm">
                      Generate PIX Code →
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        ) : (
          <View className="bg-white border border-gray-200 rounded-xl p-8 items-center shadow-sm">
            <CreditCard className="text-gray-300 mb-3" size={48} />
            <Text className="text-gray-500 text-center font-semibold">
              No payments yet
            </Text>
            <Text className="text-gray-400 text-center text-sm mt-1">
              Your payment history will appear here
            </Text>
          </View>
        )}
      </View>

      {/* PIX Modal */}
      <Modal visible={!!pixInfo} transparent animationType="slide">
        <View className="flex-1 justify-center items-center bg-black/60 px-4">
          <View className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <View className="items-center mb-6">
              <View className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200 items-center justify-center mb-4">
                <DollarSign className="text-emerald-600" size={40} />
              </View>
              <Text className="text-3xl font-black text-gray-900 text-center">
                PIX Payment
              </Text>
              <Text className="text-gray-600 text-center mt-2">
                {t('organizations.pixInstructions')}
              </Text>
            </View>

            {pixInfo?.brCode && (
              <>
                <View className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                  <Text className="text-emerald-600 text-xs font-bold mb-2 uppercase tracking-wider">
                    PIX Code
                  </Text>
                  <Text
                    selectable
                    className="text-gray-900 text-sm leading-5 font-mono"
                  >
                    {pixInfo.brCode}
                  </Text>
                </View>

                <Button
                  onPress={() => copyToClipboard(pixInfo.brCode)}
                  className="bg-emerald-600 mb-3 rounded-xl py-4 shadow-md"
                >
                  <Download className="text-white mr-2" size={20} />
                  <Text className="text-white font-black">COPY CODE</Text>
                </Button>
              </>
            )}

            <Button
              onPress={closeModal}
              className="bg-gray-200 rounded-xl py-4"
            >
              <Text className="text-gray-800 font-bold">Close</Text>
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}
