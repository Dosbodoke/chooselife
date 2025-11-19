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

import { BecomeMemberForm } from './become-member-form';
import { PaginationIndicator } from './pagination-indicator';
import { ShowcaseItem, type ShowcaseItemData } from './showcase-item';

export type Props = {
  data: ShowcaseItemData[];
};

export const showcaseData: ShowcaseItemData[] = [
  {
    image:
      'https://instagram.fdiq2-1.fna.fbcdn.net/v/t51.29350-15/453577793_1581341749086286_8290063865444754430_n.jpg?stp=dst-jpg_e35_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0uaW1hZ2VfdXJsZ2VuLjE0MDN4MTc1NC5zZHIuZjI5MzUwLmRlZmF1bHRfaW1hZ2UuYzIifQ&_nc_ht=instagram.fdiq2-1.fna.fbcdn.net&_nc_cat=110&_nc_oc=Q6cZ2QGzcImsNvlkLur1az88zZUmPd2SVtVgaSlqAZmTRCgokKkVh8C2HjV2qRsNcrRAbX1hAoT-9s9vyOxuSKqxQEwG&_nc_ohc=_rCmgX4U8TAQ7kNvwFoMmzE&_nc_gid=gEidajNd9_AvYKDvUWyB3Q&edm=APs17CUBAAAA&ccb=7-5&ig_cache_key=MzQyMzYyOTc4MDA1NjQ4Mjg4MQ%3D%3D.3-ccb7-5&oh=00_Afi6p-ZcpcKteBDZ2Ve4SEkxJCer5IxGrxZwS4AVU-5dAA&oe=692302F8&_nc_sid=10d13b',
    title: 'Nossa Missão',
    description:
      'Desenvolver e disseminar o slackline em todas as suas vertentes, promovendo o equilíbrio, a arte e o bem-estar através do esporte.',
  },
  {
    image:
      'https://scontent.cdninstagram.com/v/t51.71878-15/503320157_1446434936708925_7393044839232764404_n.jpg?stp=dst-jpg_e15_tt6&_nc_cat=109&ig_cache_key=MzE5NTk2MDE4NDQ0NjM0MjAzNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6InhwaWRzLjU0MHg5NjAuc2RyLkMzIn0%3D&_nc_ohc=V0t3w6OhJBEQ7kNvwEC2vCI&_nc_oc=AdmmDBnicx4IpSpgGlyohzR_GIYJ_jB5ml50ulpFlu-0V5lprRG6qZuxruMLbUidNjsqN_Go4fLPF-e4San2Y2oT&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent.cdninstagram.com&_nc_gid=gEidajNd9_AvYKDvUWyB3Q&oh=00_AfipWWkPpV2Xhi-JpRdwBoN2BWDw7oF47SHvpK8F05NP3g&oe=6922FA03',
    title: 'Compromisso Ambiental',
    description:
      'Apoiamos a preservação do meio ambiente através de práticas de ecoturismo, reflorestamento com espécies nativas e conservação de espaços naturais.',
  },
  {
    image:
      'https://instagram.fdiq2-1.fna.fbcdn.net/v/t51.29350-15/399918062_226576220306339_1781882967348217609_n.jpg?stp=dst-jpg_e35_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0uaW1hZ2VfdXJsZ2VuLjE0NDB4OTYwLnNkci5mMjkzNTAuZGVmYXVsdF9pbWFnZS5jMiJ9&_nc_ht=instagram.fdiq2-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2QGzcImsNvlkLur1az88zZUmPd2SVtVgaSlqAZmTRCgokKkVh8C2HjV2qRsNcrRAbX1hAoT-9s9vyOxuSKqxQEwG&_nc_ohc=cnzz6QDlIMMQ7kNvwHLxzfN&_nc_gid=gEidajNd9_AvYKDvUWyB3Q&edm=APs17CUBAAAA&ccb=7-5&ig_cache_key=MzIzMDkyMjY3MTUwMzMyNTUxOQ%3D%3D.3-ccb7-5&oh=00_Afh-rgIngykj0RnLM8c5hukZPDxCZ4Bq5ISlXl5Uzqhtbw&oe=6922ED59&_nc_sid=10d13b',
    title: 'Comunidade Ativa',
    description:
      'Congregamos praticantes interessados em todas as modalidades do slackline, oferecendo eventos, workshops e treinamentos regulares.',
  },
  {
    image:
      'https://instagram.fdiq2-1.fna.fbcdn.net/v/t51.29350-15/453550339_1880932855715729_3079842179453323253_n.jpg?stp=dst-jpg_e35_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0uaW1hZ2VfdXJsZ2VuLjE0NDB4MTgwMC5zZHIuZjI5MzUwLmRlZmF1bHRfaW1hZ2UuYzIifQ&_nc_ht=instagram.fdiq2-1.fna.fbcdn.net&_nc_cat=105&_nc_oc=Q6cZ2QGzcImsNvlkLur1az88zZUmPd2SVtVgaSlqAZmTRCgokKkVh8C2HjV2qRsNcrRAbX1hAoT-9s9vyOxuSKqxQEwG&_nc_ohc=FNJPowtiVBkQ7kNvwFFMkjz&_nc_gid=gEidajNd9_AvYKDvUWyB3Q&edm=APs17CUBAAAA&ccb=7-5&ig_cache_key=MzQyMzYyOTc4MDA0NzkzNTk5MQ%3D%3D.3-ccb7-5&oh=00_AfgB5trRWGr2moijFH28teV84iAaBbYpkc2xhMHkQJCYZw&oe=6922F60A&_nc_sid=10d13b',
    title: 'Apoio aos Atletas',
    description:
      'Promovemos e apoiamos atletas, eventos e campeonatos vinculados ao slackline através de incentivos financeiros, equipamentos e infraestrutura.',
  },
  {
    image:
      'https://scontent.cdninstagram.com/v/t51.82787-15/525005948_18057160238598833_7760226485651516967_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=100&ig_cache_key=MzY4NTk5NzI5MzYxMDgxMTgwOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6InhwaWRzLjEwMTF4MTIzNS5zZHIuQzMifQ%3D%3D&_nc_ohc=Ipq1tvShMHUQ7kNvwHWKhjQ&_nc_oc=AdlosycnE51CwujXF9rlz5AeJvM60CVh_sacZzGcwAR3HG_ATLQrd-8amSGTiUjhJxZyQM1fF4lEvlYLtS9KPwwD&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent.cdninstagram.com&_nc_gid=7z6dvF7Mw0QftC-IfBN9Bg&oh=00_Afj914lsNd86QUXF3nbOq3Tn90AN5VBTirgKDSV38VQ0Jw&oe=69230A7C',
    title: 'Educação e Cultura',
    description:
      'Organizamos cursos, seminários, palestras e workshops sobre segurança, técnicas de montagem, primeiros socorros e conscientização esportiva.',
  },
];

const carouselData = [...showcaseData, { type: 'form' }];

export function Carousel() {
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
