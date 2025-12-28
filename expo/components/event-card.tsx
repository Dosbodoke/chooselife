import { Image, ImageSource } from 'expo-image';
import { Link } from 'expo-router';
import {
  CalendarIcon,
  ChevronDownIcon,
  MapPinIcon,
  ShareIcon,
  TicketIcon,
} from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import SquircleView from 'react-native-fast-squircle';
import Animated, {
  FadeInUp,
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Markdown } from 'react-native-remark';

import { useI18n } from '~/context/i18n';
import { type Event, isISAEvent, getCountryFlag } from '@chooselife/ui';
import { useShare } from '~/hooks/use-share';

import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';
import { htmlToMarkdown } from '~/utils/html-utils';

// Import category background image
import FestivalBgImage from '~/assets/images/festival.webp';
import EducationBgImage from '~/assets/images/education.webp';
import ContestsBgImage from '~/assets/images/contest.webp';
import { ISAIcon } from '~/lib/icons/isa';
import { DAMPING } from '~/utils/constants';

// Configure SquircleView for NativeWind
const StyledSquircle = SquircleView;
cssInterop(StyledSquircle, {
  className: { target: 'style' },
});

const AnimatedSquircle = Animated.createAnimatedComponent(StyledSquircle);
cssInterop(AnimatedSquircle, {
  className: { target: 'style' },
});


export const _layoutAnimation = LinearTransition.springify().damping(DAMPING);
export const _exitingAnimation = FadeOut.springify().damping(DAMPING);
export const _enteringAnimation = FadeInUp.springify().damping(DAMPING);

/** Get gradient for event category */
function getCategoryGradient(type?: string): string {
  return `linear-gradient(135deg, ${"rgba(0, 0, 0, 0.85)"} 0%, ${"rgba(0, 0, 0, 0.95)"} 100%)`;
}

/** Category colors for badge dot indicator */
const CATEGORY_BADGE_COLORS: Record<string, { bg: string; dot: string; text: string }> = {
  contests: { bg: 'bg-blue-50', dot: 'bg-blue-500', text: 'text-blue-700' },
  education: { bg: 'bg-green-50', dot: 'bg-green-500', text: 'text-green-700' },
  events: { bg: 'bg-orange-50', dot: 'bg-orange-500', text: 'text-orange-700' },
};

/** Valid category image types */
type CategoryImageType = 'festival' | 'education' | 'contests';

/** Category image configuration */
type CategoryConfig = {
  image: ImageSource;
  overlayOpacity: number; // 0-100, will be used as bg-black/XX
  contentPosition: 'left' | 'center' | 'right' | 'top' | 'bottom';
};

/** Category background images and styling configuration */
const CATEGORY_CONFIG: Record<CategoryImageType, CategoryConfig> = {
  festival: {
    image: FestivalBgImage as ImageSource,
    overlayOpacity: 45,
    contentPosition: "left",
  },
  education: {
    image: EducationBgImage as ImageSource,
    overlayOpacity: 15,
    contentPosition: 'center',
  },
  contests: {
    image: ContestsBgImage as ImageSource,
    overlayOpacity: 35,
    contentPosition: "right",
  },
};

/** Type guard to check if a string is a valid category image type */
function isCategoryImageType(type: string | undefined): type is CategoryImageType {
  return type !== undefined && type in CATEGORY_CONFIG;
}

/** Get category config with type safety */
function getCategoryConfig(type: CategoryImageType): CategoryConfig {
  return CATEGORY_CONFIG[type];
}


/** DateBox component - Shows date with optional background image */
const DateBox: React.FC<{
  monthShort: string;
  dayOfMonth: number;
  eventType?: CategoryImageType;
  imageUrl?: string | null;
  isISAEvent?: boolean;
}> = ({ monthShort, dayOfMonth, eventType, imageUrl, isISAEvent = false }) => {
  const [imageError, setImageError] = useState(false);
  
  // For external images (from event data)
  const hasCustomImage = imageUrl && !imageError;
  // For ISA events, show category background image
  const showCategoryImage = isISAEvent && !hasCustomImage;

  return (
    <View className="items-center justify-center min-w-[100px] self-stretch overflow-hidden">
      {/* Background: Custom Image, Category Image, or Gradient */}
      {hasCustomImage ? (
        <>
          {/* Custom Background Image from event */}
          <Image
            source={{ uri: imageUrl }}
            contentFit="cover"
            style={{ position: 'absolute', width: '100%', height: '100%' }}
            onError={() => setImageError(true)}
            transition={200}
          />
          {/* Dark Overlay for text readability */}
          <View className="absolute inset-0 bg-black/50" />
        </>
      ) : showCategoryImage && eventType ? (
        (() => {
          const config = getCategoryConfig(eventType);
          return (
            <>
              {/* Category Background Image for ISA events */}
              <Image
                source={config.image}
                contentFit="cover"
                contentPosition={config.contentPosition}
                style={{ position: 'absolute', width: '100%', height: '100%' }}
              />
              {/* Dark Overlay for text readability */}
              <View 
                className="absolute inset-0" 
                style={{ backgroundColor: `rgba(0, 0, 0, ${config.overlayOpacity / 100})` }}
              />
            </>
          );
        })()
      ) : (
        /* Gradient Background for internal events */
        <View
          className="absolute inset-0"
          style={{
            experimental_backgroundImage: getCategoryGradient(eventType),
          }}
        />
      )}

      {/* Date Text (always on top) */}
      <View className="z-10 items-center p-3">
        <Text className="text-[10px] font-bold text-white tracking-wider opacity-90">
          {monthShort}
        </Text>
        <Text className="text-3xl font-black text-white -mt-0.5">
          {dayOfMonth}
        </Text>
      </View>
    </View>
  );
};

/** Get human readable category label */
function getCategoryLabel(type?: string): CategoryImageType {
  console.log(type);
  switch (type) {
    case 'contests':
      return 'contests';
    case 'education':
      return 'education';
    case 'events':
      return 'festival';
    default:
      return 'festival';
  }
}

/** Category Badge - Shows event type with colored dot indicator */
const CategoryBadge: React.FC<{ type?: string }> = ({ type }) => {
  const colors = CATEGORY_BADGE_COLORS[type || ''] || { bg: 'bg-gray-50', dot: 'bg-gray-500', text: 'text-gray-700' };
  const label = getCategoryLabel(type);

  return (
    <View className={`flex-row items-center gap-1.5 ${colors.bg} px-2.5 py-1 rounded-full border border-gray-200/50`}>
      {/* Colored Dot */}
      <View className={`size-2 rounded-full ${colors.dot}`} />
      <Text className={`text-xs font-semibold ${colors.text}`}>{label}</Text>
    </View>
  );
};

/** ISA Badge component - shows ISA source indicator (absolute positioned) */
const ISABadge: React.FC = () => {
  return (
    <View className="absolute bottom-2 right-2 z-10">
      <ISAIcon width={44} height={24} />
    </View>
  );
};

export const EventCard: React.FC<{ event: Event }> = ({ event }) => {
  const { t } = useTranslation();
  const { locale } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const isFromISA = isISAEvent(event);
  const eventType: CategoryImageType = isFromISA ? getCategoryLabel(event.type) : 'festival';

  const toggleExpand = () => {
    setExpanded((prev) => !prev);
  };

  const { share } = useShare();

  const handleShare = () => {
    const location = `${event.city}${event.state ? `, ${event.state}` : ''}${event.country ? `, ${event.country}` : ''}`;
    const title = `${event.title} - ${location}`;
    const url = event.registration_url || `https://chooselife.app/events`;

    share({ title, url, type: 'default' });
  };

  const rotateStyle = useAnimatedStyle(() => {
    const rotation = interpolate(expanded ? 1 : 0, [0, 1], [0, 180]);
    return {
      transform: [{ rotate: `${rotation}deg` }],
    };
  });

  // Get start date info
  const startDate = new Date(event.start_date);
  const monthShort = startDate
    .toLocaleString(locale, { month: 'short' })
    .toUpperCase();
  const dayOfMonth = startDate.getDate();

  return (
    <AnimatedSquircle
      layout={_layoutAnimation}
      className="w-full bg-card border border-border/40 overflow-hidden rounded-3xl"
      cornerSmoothing={0.8}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      {/* Country Flag Background Indicator */}
      {event.country && getCountryFlag(event.country) && (
        <View className="absolute top-0 -right-6 z-0 overflow-hidden">
          <Text 
            className="text-[120px] opacity-25"
            style={{ transform: [{ rotate: '15deg' }] }}
          >
            {getCountryFlag(event.country)}
          </Text>
        </View>
      )}

      {/* ISA Badge - Bottom Right */}
      {isFromISA && <ISABadge />}
      <Pressable onPress={toggleExpand} className="active:bg-muted/30">
        <View className="pr-4 py-0">
          <View className="flex-row gap-4">
            {/* Date Box - With optional image or category gradient */}
            <DateBox
              monthShort={monthShort}
              dayOfMonth={dayOfMonth}
              eventType={eventType}
              isISAEvent={isFromISA}
              imageUrl={
                'image_url' in event && typeof event.image_url === 'string'
                  ? event.image_url
                  : null
              }
            />

            {/* Main Content */}
            <View className="flex-1 justify-center gap-1 py-2">
              {/* Title Row with Share Button */}
              <View className="flex-row justify-between items-start gap-2">
                <Text
                  className="font-bold text-base text-foreground flex-1 leading-tight"
                  numberOfLines={2}
                >
                  {event.title}
                </Text>
                <View className="flex-row items-center gap-1">
                  {/* Share Button */}
                  <Pressable
                    onPress={handleShare}
                    className="p-1.5 rounded-full active:bg-muted/50"
                    hitSlop={8}
                  >
                    <Icon as={ShareIcon} className="size-4 text-muted-foreground" />
                  </Pressable>
                  {/* Expand Button */}
                  <Animated.View style={rotateStyle}>
                    <Icon
                      as={ChevronDownIcon}
                      className="size-5 text-muted-foreground"
                    />
                  </Animated.View>
                </View>
              </View>

              {/* Location - Badge Style */}
              <View className="flex-row items-center gap-1.5 bg-muted/60 px-2.5 py-1.5 rounded-xl self-start mt-1">
                <Icon as={MapPinIcon} className="size-3.5 text-primary" />
                <Text
                  className="text-sm font-medium text-foreground"
                  numberOfLines={1}
                >
                  {event.city}
                  {event.state ? `, ${event.state}` : ''}
                  {event.country ? ` · ${event.country}` : ''}
                </Text>
              </View>

              {/* Event Type Badge */}
              {isFromISA && (
                <View className="flex-row flex-wrap gap-2 mt-1.5">
                  <CategoryBadge type={event.type} />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Expanded Content */}
        {expanded && (
          <Animated.View
            entering={_enteringAnimation}
            exiting={_exitingAnimation}
          >
            <View className="px-4 pb-4">
              <View className="border-t border-border/50 pt-4 gap-4">
                {/* Description */}
                {event.description && (
                  <View>
                    {isFromISA ? (
                      <View className="text-sm">
                        <Markdown markdown={htmlToMarkdown(event.description)} />
                      </View>
                    ) : (
                      <Text className="text-sm text-muted-foreground leading-relaxed">
                        {event.description}
                      </Text>
                    )}
                  </View>
                )}

                {/* Info Pills */}
                <View className="flex-row flex-wrap gap-2">
                  {/* Date Range Pill */}
                  <View className="flex-row items-center gap-2 bg-muted/50 px-3 py-2 rounded-xl">
                    <Icon
                      as={CalendarIcon}
                      className="size-4 text-primary"
                    />
                    <Text className="text-sm font-medium text-foreground">
                      {formatEventDate(
                        startDate,
                        event.end_date ? new Date(event.end_date) : undefined,
                        locale,
                      )}
                    </Text>
                  </View>

                  {/* Event Type Pill (for internal events) */}
                  {!isFromISA && event.type && (
                    <View className="flex-row items-center gap-2 bg-muted/50 px-3 py-2 rounded-xl">
                      <Icon
                        as={TicketIcon}
                        className="size-4 text-primary"
                      />
                      <Text className="text-sm font-medium capitalize text-foreground">
                        {event.type}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Registration Link */}
                {event.registration_url && (
                  // @ts-expect-error: External Link - Expo Router handles this
                  <Link asChild href={event.registration_url}>
                    <Button className="mt-1" size="default">
                      <Text className="font-semibold text-primary-foreground">
                        {isFromISA
                          ? t('components.event-card.viewDetails')
                          : t('components.event-card.book')}
                      </Text>
                    </Button>
                  </Link>
                )}
              </View>
            </View>
          </Animated.View>
        )}
      </Pressable>
    </AnimatedSquircle>
  );
};

const formatEventDate = (
  startDate: Date,
  endDate: Date | undefined,
  locale: string,
): string => {
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  };

  const startDateStr = startDate.toLocaleDateString(locale, dateOptions);

  if (!endDate) {
    return startDateStr;
  }

  // If same day
  if (startDate.toDateString() === endDate.toDateString()) {
    return startDateStr;
  }

  // Multi-day event
  const endDateStr = endDate.toLocaleDateString(locale, dateOptions);
  return `${startDateStr} – ${endDateStr}`;
};

export const EventCardSkeleton: React.FC = () => (
  <StyledSquircle
    className="w-full bg-card border border-border/40 overflow-hidden rounded-3xl"
    cornerSmoothing={0.8}
  >
    <View className="p-4">
      <View className="flex-row gap-4">
        {/* Date Placeholder */}
        <View className="items-center justify-center bg-muted/30 rounded-2xl p-3 min-w-[72px] min-h-[72px]">
          <Skeleton className="h-3 w-8 mb-1" />
          <Skeleton className="h-8 w-8" />
        </View>

        {/* Content Placeholder */}
        <View className="flex-1 justify-center gap-2">
          <Skeleton className="h-5 w-full" />
          <View className="flex-row items-center gap-1.5">
            <Skeleton className="h-3.5 w-3.5 rounded-full" />
            <Skeleton className="h-4 w-3/4" />
          </View>
        </View>
      </View>
    </View>
  </StyledSquircle>
);
