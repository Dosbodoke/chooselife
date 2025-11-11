import { Image as ExpoImage, ImageSource } from 'expo-image';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { Text } from '~/components/ui/text';

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ShowcaseItemData = {
  image: ImageSource;
  title: string;
  description: string;
};

export type ShowcaseItemProps = {
  index: number;
  scrollY: SharedValue<number>;
  item: ShowcaseItemData;
  itemSize: number;
};

export function ShowcaseItem({
  item,
  index,
  scrollY,
  itemSize,
}: ShowcaseItemProps) {
  const animatedIndex = useDerivedValue(() => {
    return scrollY.get() / itemSize;
  });

  const rContainerStyle = useAnimatedStyle(() => {
    const translateY =
      Platform.OS === 'ios'
        ? interpolate(
            scrollY.get(),
            [(index - 1) * itemSize, index * itemSize, index * itemSize + 1],
            [0, 0, 1],
          )
        : 0;

    return {
      opacity: interpolate(
        animatedIndex.get(),
        [index - 1, index, index + 1],
        [0, 1, 0],
      ),
      transform: [
        {
          translateY,
        },
        {
          scale: interpolate(
            scrollY.get(),
            [(index - 1) * itemSize, index * itemSize, (index + 1) * itemSize],
            [1.2, 1, 0.5],
            {
              extrapolateRight: Extrapolation.CLAMP,
            },
          ),
        },
      ],
    };
  });

  const rImageStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        animatedIndex.get(),
        [index - 1, index, index + 1],
        [0, 0.3, 0],
      ),
      transform: [
        {
          translateY: interpolate(
            scrollY.get(),
            [(index - 1) * itemSize, index * itemSize, index * itemSize + 1],
            [0, 0, 1],
          ),
        },
        {
          scale: interpolate(
            scrollY.get(),
            [(index - 1) * itemSize, index * itemSize, (index + 1) * itemSize],
            [5, 1, 1],
            {
              extrapolateRight: Extrapolation.CLAMP,
            },
          ),
        },
      ],
    };
  });

  return (
    <View className="flex-1">
      <AnimatedView style={[StyleSheet.absoluteFill, rImageStyle]}>
        <ExpoImage
          source={item.image}
          style={StyleSheet.absoluteFill}
          blurRadius={100}
        />
      </AnimatedView>
      <AnimatedView
        className="flex-1 items-center justify-center p-8"
        style={[rContainerStyle]}
      >
        <View className="mb-5 gap-2 items-center">
          <Text className="text-2xl text-gray-900 font-semibold">
            {item.title}
          </Text>
          <Text className="text-center text-gray-500 font-medium text-xl">
            {item.description}
          </Text>
        </View>
        <AnimatedPressable>
          <View className="w-[240px] aspect-[1/2] items-center justify-center rounded-3xl p-0 border border-neutral-100 shadow-2xl shadow-black/5">
            <ExpoImage
              source={item.image}
              style={StyleSheet.absoluteFill}
              transition={200}
            />
          </View>
        </AnimatedPressable>
      </AnimatedView>
    </View>
  );
}

export const showcaseData: ShowcaseItemData[] = [
  {
    image: {
      uri: 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/images/heroui-native-example/raycast-showcase-light.png',
    },
    title: 'Nossa Missão',
    description:
      'Desenvolver e disseminar o slackline em todas as suas vertentes, promovendo o equilíbrio, a arte e o bem-estar através do esporte.',
  },
  {
    image: {
      uri: 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/images/heroui-native-example/cooking-onboarding-light-1.png',
    },
    title: 'Compromisso Ambiental',
    description:
      'Apoiamos a preservação do meio ambiente através de práticas de ecoturismo, reflorestamento com espécies nativas e conservação de espaços naturais.',
  },
  {
    image: {
      uri: 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/images/heroui-native-example/linear-task-light.png',
    },
    title: 'Comunidade Ativa',
    description:
      'Congregamos praticantes interessados em todas as modalidades do slackline, oferecendo eventos, workshops e treinamentos regulares.',
  },
  {
    image: {
      uri: 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/images/heroui-native-example/showcase-paywall.png',
    },
    title: 'Apoio aos Atletas',
    description:
      'Promovemos e apoiamos atletas, eventos e campeonatos vinculados ao slackline através de incentivos financeiros, equipamentos e infraestrutura.',
  },
  {
    image: {
      uri: 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/images/heroui-native-example/showcases-onboarding-light-1.png',
    },
    title: 'Educação e Cultura',
    description:
      'Organizamos cursos, seminários, palestras e workshops sobre segurança, técnicas de montagem, primeiros socorros e conscientização esportiva.',
  },
  {
    image: {
      uri: 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/images/heroui-native-example/home-components-light.png',
    },
    title: 'Infraestrutura',
    description:
      'Disponibilizamos equipamentos e locais de treino para associados, mantendo uma biblioteca especializada e centros de treinamento.',
  },
];
