import SlacCabeMaisImage from '~/assets/images/slac-cabe-mais.png';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { PrimaryButton } from '~/components/ui/primary-button';
import { Text } from '~/components/ui/text';

type BecomeMemberCardProps = {
  slug: string;
  resumeDraft?: boolean;
};

// The button docks into the card's bottom edge, so the radii are concentric:
// card radius = pill radius (28) + inset (8).
const BUTTON_INSET = 8;
const CARD_RADIUS = 28 + BUTTON_INSET;

export function BecomeMemberCard({
  slug,
  resumeDraft = false,
}: BecomeMemberCardProps) {
  const router = useRouter();
  const buttonLabel = resumeDraft ? 'Continuar cadastro' : 'Quero me associar';

  return (
    <View
      className="overflow-hidden bg-zinc-900"
      style={{ borderRadius: CARD_RADIUS, borderCurve: 'continuous' }}
    >
      <View
        className="absolute inset-0"
        style={{
          experimental_backgroundImage:
            'radial-gradient(circle at 0% 0%, rgba(139, 92, 246, 0.55) 0%, rgba(24, 24, 27, 0) 60%)',
        }}
      />
      <Image
        source={SlacCabeMaisImage}
        style={{
          position: 'absolute',
          top: -40,
          right: -50,
          width: 260,
          height: 260,
          transform: [{ rotate: '25deg' }],
          opacity: 0.3,
        }}
        contentFit="contain"
      />
      {/* Scrim: fades the stamp out behind the copy so the text stays legible. */}
      <View
        className="absolute inset-0"
        style={{
          experimental_backgroundImage:
            'linear-gradient(to top, rgba(24, 24, 27, 1) 30%, rgba(24, 24, 27, 0.85) 55%, rgba(24, 24, 27, 0) 85%)',
        }}
      />

      <View className="min-h-[200px] justify-end gap-3 px-6 pb-6 pt-10">
        <Text className="text-xs font-bold uppercase tracking-[2px] text-violet-300">
          Associação SL.A.C
        </Text>
        <Text className="text-[30px] font-black leading-[34px] tracking-tight text-white">
          {resumeDraft ? 'Continue seu cadastro' : 'Torne-se um associado'}
        </Text>
        <Text className="text-[15px] leading-6 text-zinc-300">
          {resumeDraft
            ? 'Seu cadastro está salvo. Continue de onde parou para solicitar sua associação.'
            : 'Junte-se à associação e apoie o desenvolvimento do slackline no Cerrado.'}
        </Text>
      </View>

      <View style={{ padding: BUTTON_INSET }}>
        <PrimaryButton
          tone="inverse"
          label={buttonLabel}
          onPress={() => router.push(`/organizations/${slug}/member`)}
        />
      </View>
    </View>
  );
}
