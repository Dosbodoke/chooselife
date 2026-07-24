import SlacCabeMaisImage from '~/assets/images/slac-cabe-mais.png';
import { Image } from 'expo-image';
import { CheckIcon, ChevronRightIcon } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

type PaymentUnderReviewCardProps = {
  onPress: () => void;
};

export function PaymentUnderReviewCard({
  onPress,
}: PaymentUnderReviewCardProps) {
  return (
    <View
      className="relative overflow-hidden rounded-xl bg-zinc-900"
      style={{ borderCurve: 'continuous' }}
    >
      <Image
        source={SlacCabeMaisImage}
        contentFit="contain"
        style={{
          height: 190,
          opacity: 0.1,
          position: 'absolute',
          right: -48,
          top: -32,
          transform: [{ rotate: '18deg' }],
          width: 190,
        }}
      />

      <View className="gap-5 p-6">
        <View className="flex-row items-center">
          <View className="flex-row items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5">
            <Icon as={CheckIcon} size={14} color="#6EE7B7" strokeWidth={2.5} />
            <Text className="text-xs font-bold text-emerald-200">
              Confirmação recebida
            </Text>
          </View>
        </View>

        <View className="gap-2">
          <Text className="text-2xl font-black text-white">
            Pagamento em análise
          </Text>
          <Text className="text-[15px] font-medium leading-6 text-zinc-300">
            Seu aviso de pagamento foi registrado. Agora, a equipe da SL.A.C
            está conferindo o PIX.
          </Text>
          <Text className="text-sm leading-5 text-zinc-400">
            Você verá sua associação aqui assim que a confirmação for concluída.
          </Text>
        </View>

        <Button
          size="lg"
          accessibilityLabel="Ver detalhes do pagamento PIX"
          className="h-12 w-full justify-between rounded-lg bg-white px-4 active:scale-[0.98] active:bg-zinc-100"
          onPress={onPress}
        >
          <View className="flex-row items-center gap-2">
            <Text className="font-bold text-zinc-950">Ver pagamento</Text>
            <View className="rounded-full bg-zinc-200 px-2 py-0.5">
              <Text className="text-[11px] font-bold text-zinc-600">PIX</Text>
            </View>
          </View>
          <Icon as={ChevronRightIcon} size={18} color="#18181B" />
        </Button>
      </View>
    </View>
  );
}
