import { AnimatedFlashList, FlashListProps } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import type { Component } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useScrollOffset,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { supabase } from '~/lib/supabase';
import { Tables } from '~/utils/database-generated.types';

import { BecomeMemberForm } from './become-member-form';
import { PaginationIndicator } from './pagination-indicator';
import { ShowcaseItem, type ShowcaseItemData } from './showcase-item';

export type Props = {
  data: ShowcaseItemData[];
};

export const showcaseData: ShowcaseItemData[] = [
  {
    image: supabase.storage.from('promo').getPublicUrl('slac-carousel-1.jpeg')
      .data.publicUrl,
    title: 'Nossa Missão',
    description:
      'Desenvolver e disseminar o slackline em todas as suas vertentes, promovendo o equilíbrio, a arte e o bem-estar através do esporte.',
  },
  {
    image: supabase.storage.from('promo').getPublicUrl('slac-carousel-2.jpg')
      .data.publicUrl,
    title: 'Apoio aos Atletas',
    description:
      'Promovemos e apoiamos atletas, eventos e campeonatos vinculados ao slackline através de incentivos financeiros, equipamentos e infraestrutura.',
  },
  {
    image: supabase.storage.from('promo').getPublicUrl('slac-carousel-3.jpg')
      .data.publicUrl,
    title: 'Educação e Cultura',
    description:
      'Organizamos cursos, seminários, palestras e workshops sobre segurança, técnicas de montagem, primeiros socorros e conscientização esportiva.',
  },
];

const carouselData = [...showcaseData, { type: 'form' }];

export function Carousel({ org }: { org: Tables<'organizations'> }) {
  const { width, height } = useWindowDimensions();

  const animatedRef =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAnimatedRef<Component<FlashListProps<any>, any, any>>();
  const scrollY = useScrollOffset(animatedRef);

  const currentIndex = useDerivedValue(() => {
    return Math.round(scrollY.value / height);
  });

  const isFormScreen = useDerivedValue(
    () => currentIndex.value === carouselData.length - 1,
  );

  const paginationStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isFormScreen.value ? 0 : 1),
    };
  });

  // Trigger haptic feedback when index changes
  useAnimatedReaction(
    () => currentIndex.value,
    (current, previous) => {
      if (previous !== null && current !== previous) {
        scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [currentIndex],
  );

  return (
    <>
      <AnimatedFlashList
        ref={animatedRef}
        data={carouselData}
        keyExtractor={(_, index) => String(index)}
        snapToInterval={height}
        decelerationRate="fast"
        renderItem={({ item, index }) => (
          <View
            style={{
              width,
              height,
            }}
          >
            {'title' in item ? (
              <ShowcaseItem
                item={item}
                index={index}
                scrollY={scrollY}
                itemSize={height}
              />
            ) : (
              <BecomeMemberForm
                scrollY={scrollY}
                itemIndex={index}
                itemHeight={height}
                org={org}
              />
            )}
          </View>
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        bounces={false}
        drawDistance={height * 2}
      />

      <Animated.View
        style={paginationStyle}
        className="absolute top-1/2 right-3 gap-1.5 z-50"
        pointerEvents="none"
      >
        {showcaseData.map((_, index) => (
          <PaginationIndicator
            key={index}
            index={index}
            scrollY={scrollY}
            itemSize={height}
          />
        ))}
      </Animated.View>
    </>
  );
}
