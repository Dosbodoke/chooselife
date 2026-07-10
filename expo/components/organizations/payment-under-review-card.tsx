import SlacCabeMaisImage from '~/assets/images/slac-cabe-mais.png';
import { Image } from 'expo-image';
import { CheckIcon, ChevronRightIcon, Clock3Icon } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';

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
        <View className="flex-row items-center gap-2 self-start rounded-full bg-emerald-400/10 px-3 py-1.5">
          <Icon as={CheckIcon} size={14} color="#6EE7B7" strokeWidth={2.5} />
          <Text className="text-xs font-bold text-emerald-300">
            Confirmação recebida
          </Text>
        </View>

        <View className="max-w-[280px] gap-2">
          <View className="flex-row items-center gap-3">
            <View className="size-10 items-center justify-center rounded-full bg-white/10">
              <Icon as={Clock3Icon} size={20} color="#F4F4F5" />
            </View>
            <Text className="flex-1 text-2xl font-black text-white">
              Pagamento em análise
            </Text>
          </View>
          <Text className="text-[15px] font-medium leading-6 text-zinc-400">
            Seu aviso de pagamento foi registrado. Agora, a equipe da SL.A.C
            está conferindo o PIX.
          </Text>
          <Text className="text-sm leading-5 text-zinc-500">
            Você verá sua associação aqui assim que a confirmação for concluída.
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className="flex-row items-center justify-between border-t border-white/10 px-6 py-4 active:bg-white/5"
      >
        <View className="flex-row items-center gap-3">
          <Text className="font-bold text-white">Ver pagamento</Text>
          <View className="rounded-full bg-white/10 px-2 py-0.5">
            <Text className="text-[11px] font-semibold text-zinc-400">PIX</Text>
          </View>
        </View>
        <Icon as={ChevronRightIcon} size={18} color="#A1A1AA" />
      </Pressable>
    </View>
  );
}
