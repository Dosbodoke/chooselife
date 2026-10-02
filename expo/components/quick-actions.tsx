import { Link, type Href } from 'expo-router';
import {
  ArrowRightIcon,
  BookIcon,
  PencilRulerIcon,
  type LucideIcon,
} from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

const CARD_HEIGHT = 176;
const CARD_GAP = 12;
const SCREEN_GUTTER = 16;

type QuickAction = {
  id: 'setupSimulator' | 'learn';
  href: Href;
  icon: LucideIcon;
  gradient: [from: string, to: string];
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'setupSimulator',
    href: '/setup-simulator',
    icon: PencilRulerIcon,
    gradient: ['#FF9A8B', '#F5455C'],
  },
  {
    id: 'learn',
    href: '/learn' as Href,
    icon: BookIcon,
    gradient: ['#B79CFF', '#7B3FF2'],
  },
];

export const QuickActions: React.FC = () => {
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(width * 0.72);

  return (
    // Bleeds past the screen gutter so cards scroll edge to edge.
    <View className="-mx-4 my-6">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={{
          paddingHorizontal: SCREEN_GUTTER,
          gap: CARD_GAP,
        }}
      >
        {QUICK_ACTIONS.map((action) => (
          <QuickActionCard key={action.id} action={action} width={cardWidth} />
        ))}
      </ScrollView>
    </View>
  );
};

const QuickActionCard: React.FC<{ action: QuickAction; width: number }> = ({
  action,
  width,
}) => {
  const { t } = useTranslation();
  const prefix = `app.(tabs).home.quickActions.${action.id}` as const;
  const title = t(`${prefix}.title`);
  const description = t(`${prefix}.description`);
  const gradientId = `quick-action-${action.id}`;

  return (
    <Link href={action.href} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={description}
        style={({ pressed }) => ({
          transform: [{ scale: pressed ? 0.97 : 1 }],
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <View
          className="overflow-hidden rounded-[28px] p-5 justify-between"
          style={{ width, height: CARD_HEIGHT, borderCurve: 'continuous' }}
        >
          <Svg
            width={width}
            height={CARD_HEIGHT}
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={action.gradient[0]} />
                <Stop offset="1" stopColor={action.gradient[1]} />
              </LinearGradient>
            </Defs>
            <Rect width={width} height={CARD_HEIGHT} fill={`url(#${gradientId})`} />
          </Svg>

          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: -18,
              bottom: -24,
              transform: [{ rotate: '-14deg' }],
              opacity: 0.22,
            }}
          >
            <Icon as={action.icon} size={150} color="#fff" strokeWidth={1.5} />
          </View>

          <View>
            <Text className="text-[11px] font-bold uppercase tracking-widest text-white/80">
              {t(`${prefix}.eyebrow`)}
            </Text>
            <Text className="mt-1 text-2xl font-bold tracking-tight text-white">
              {title}
            </Text>
            <Text
              className="mt-1 text-sm text-white/85"
              numberOfLines={2}
              style={{ maxWidth: '78%' }}
            >
              {description}
            </Text>
          </View>

          <View className="flex-row self-start items-center gap-1.5 rounded-full bg-white/25 px-3 py-1.5">
            <Text className="text-xs font-semibold text-white">
              {t('app.(tabs).home.quickActions.open')}
            </Text>
            <Icon as={ArrowRightIcon} size={13} color="#fff" strokeWidth={2.5} />
          </View>
        </View>
      </Pressable>
    </Link>
  );
};
