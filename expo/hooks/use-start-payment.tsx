import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PaymentCheckoutSession } from '@packages/database/functions.types';
import { useRouter } from 'expo-router';

import { queryKeys } from '~/lib/query-keys';
import { supabase } from '~/lib/supabase';

const createPaymentCheckoutFn = async ({
  paymentId,
}: {
  paymentId: string;
}) => {
  const { data, error } = await supabase.functions.invoke<PaymentCheckoutSession>(
    'create-payment-checkout',
    {
      body: {
        paymentId,
      },
    },
  );

  if (error) throw error;
  if (!data) throw new Error('Invalid response from create-payment-checkout');
  return data;
};

export const useStartPayment = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      paymentId,
    }: {
      paymentId: string;
    }) => {
      return createPaymentCheckoutFn({
        paymentId,
      });
    },
    onSuccess: (data) => {
      // Invalidate queries to refetch subscription data
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription.all });
      router.push({
        pathname: '/payment',
        params: {
          checkoutUrl: 'checkoutUrl' in data ? data.checkoutUrl : undefined,
          pixCopyPaste: 'brCode' in data ? data.brCode : undefined,
          qrCodeImage: 'brCodeBase64' in data ? data.brCodeBase64 : undefined,
          paymentId: data.paymentId,
          paymentContext: 'subscription_renewal',
        },
      });
    },
    onError: (error) => {
      console.error('Payment initiation failed:', error);
      // Here you could show a toast or an alert to the user
    },
  });
};
