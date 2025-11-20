import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { queryKeys } from '~/lib/query-keys';
import { supabase } from '~/lib/supabase';

const generatePixChargeFn = async ({
  amount,
  paymentId,
}: {
  amount: number;
  paymentId: string;
}) => {
  const { data, error } = await supabase.functions.invoke(
    'create-abacate-pay-charge',
    {
      body: {
        amount,
        paymentId,
      },
    },
  );

  if (error) throw error;
  return data;
};

export const useStartPayment = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      amount,
      paymentId,
    }: {
      amount: number;
      paymentId: string;
    }) => {
      return generatePixChargeFn({
        amount,
        paymentId,
      });
    },
    onSuccess: (data) => {
      // Invalidate queries to refetch subscription data
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription.all });
      router.push({
        pathname: '/payment',
        params: {
          pixCopyPaste: data.brCode,
          qrCodeImage: data.brCodeBase64,
          chargeId: data.id,
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
