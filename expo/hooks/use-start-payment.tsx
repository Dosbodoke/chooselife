import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { queryKeys } from '~/lib/query-keys';
import { getManualPaymentRouteParams } from '~/lib/manual-payment';

type StartPaymentInput = {
  amount?: number;
  paymentId: string;
};

export const useStartPayment = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payment: StartPaymentInput) => payment,
    onSuccess: (payment) => {
      // Invalidate queries to refetch subscription data
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription.all });
      router.push({
        pathname: '/payment',
        params: getManualPaymentRouteParams({
          amount: payment.amount,
          paymentId: payment.paymentId,
          paymentContext: 'subscription_renewal',
        }),
      });
    },
    onError: (error) => {
      console.error('Payment initiation failed:', error);
      // Here you could show a toast or an alert to the user
    },
  });
};
