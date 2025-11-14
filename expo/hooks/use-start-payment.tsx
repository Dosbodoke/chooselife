import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { useAuth } from '~/context/auth';
import { queryKeys } from '~/lib/query-keys';
import { supabase } from '~/lib/supabase';

const generatePixChargeFn = async ({
  amount,
  paymentId,
  customerName,
  customerEmail,
}: {
  amount: number;
  paymentId: string;
  customerName: string;
  customerEmail: string;
}) => {
  const { data, error } = await supabase.functions.invoke(
    'create-abacate-pay-charge',
    {
      body: {
        amount,
        paymentId,
        customer: {
          name: customerName,
          email: customerEmail,
        },
      },
    },
  );

  if (error) throw error;
  return data;
};

export const useStartPayment = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      amount,
      paymentId,
    }: {
      amount: number;
      paymentId: string;
    }) => {
      if (!profile?.name || !session?.user.email) {
        throw new Error('Customer name or email not available in profile.');
      }
      return generatePixChargeFn({
        amount,
        paymentId,
        customerName: profile.name,
        customerEmail: session.user.email,
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
        },
      });
    },
    onError: (error) => {
      console.error('Payment initiation failed:', error);
      // Here you could show a toast or an alert to the user
    },
  });
};
