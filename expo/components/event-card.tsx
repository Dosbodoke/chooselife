import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  FadeInUp,
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { useI18n } from '~/context/i18n';
import type { Event } from '~/hooks/use-events';
import { LucideIcon } from '~/lib/icons/lucide-icon';

import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';

const DAMPING = 80;
export const _layoutAnimation = LinearTransition.springify().damping(DAMPING);
export const _exitingAnimation = FadeOut.springify().damping(DAMPING);
export const _enteringAnimation = FadeInUp.springify().damping(DAMPING);
const AnimatedCard = Animated.createAnimatedComponent(Card);

export const EventCard: React.FC<{ event: Event }> = ({ event }) => {
  const { locale } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => {
    setExpanded((prev) => !prev);
  };

  const rotateStyle = useAnimatedStyle(() => {
    const rotation = interpolate(expanded ? 1 : 0, [0, 1], [0, 180]);
    return {
      transform: [{ rotate: `${rotation}deg` }],
    };
  });

  return (
    <AnimatedCard layout={_layoutAnimation} className="shadow w-full">
      <Pressable onPress={toggleExpand}>
        <CardContent className="p-3 overflow-hidden">
          <View className="flex-row gap-3">
            <View className="flex-col items-center justify-center bg-primary/10 rounded p-2 min-w-[56px]">
              <Text className="text-sm font-bold text-primary">
                {new Date(event.start_date)
                  .toLocaleString(locale, { month: 'short' })
                  .toUpperCase()}
              </Text>
              <Text className="text-xl font-bold text-primary">
                {new Date(event.start_date).getDate()}
              </Text>
            </View>
            <View className="flex-1 justify-between">
              <View className="flex-row justify-between items-start">
                <Text className="font-medium flex-1 mr-2">{event.title}</Text>
                <Animated.View style={rotateStyle}>
                  <LucideIcon
                    name="ChevronDown"
                    className="size-5 text-muted-foreground"
                  />
                </Animated.View>
              </View>
              <View className="items-center flex-row gap-1">
                <LucideIcon
                  name="MapPin"
                  className="size-4 text-muted-foreground"
                />
                <Text className="text-sm text-muted-foreground">
                  {event.city}
                  {event.state ? `, ${event.state}` : ''} - {event.country}
                </Text>
              </View>
            </View>
          </View>

          {expanded && (
            <Animated.View
              className="mt-3 overflow-hidden"
              entering={_enteringAnimation}
              exiting={_exitingAnimation}
            >
              <View className="border-t border-border pt-3 gap-3">
                {/* Description */}
                {event.description && (
                  <Text className="text-sm text-muted-foreground">
                    {event.description}
                  </Text>
                )}

                {/* Event Type */}
                <View className="flex-row items-center gap-2">
                  <LucideIcon
                    name="Ticket"
                    className="size-4 text-muted-foreground"
                  />
                  <Text className="text-sm capitalize">{event.type}</Text>
                </View>

                {/* Date/Time Info */}
                <View className="flex-row items-center gap-2">
                  <LucideIcon
                    name="Calendar"
                    className="size-4 text-muted-foreground"
                  />
                  <Text className="text-sm">
                    {formatEventDate(
                      new Date(event.start_date),
                      event.end_date ? new Date(event.end_date) : undefined,
                      locale,
                    )}
                  </Text>
                </View>

                {/* Registration Link if available */}
                {event.registration_url && (
                  // @ts-expect-error: External Link - Expo Router handles this
                  <Link asChild href={event.registration_url}>
                    <Button className="mt-3">
                      <Text>Registrar</Text>
                    </Button>
                  </Link>
                )}
              </View>
            </Animated.View>
          )}
        </CardContent>
      </Pressable>
    </AnimatedCard>
  );
};

const formatEventDate = (
  startDate: Date,
  endDate: Date | undefined,
  locale: string,
): string => {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  };

  const startFormatted = startDate.toLocaleDateString(locale, options);

  if (!endDate) {
    return startFormatted;
  }

  // If same day, only show time for end date
  if (startDate.toDateString() === endDate.toDateString()) {
    const endTimeFormatted = endDate.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${startFormatted} - ${endTimeFormatted}`;
  }

  // Different days
  const endFormatted = endDate.toLocaleDateString(locale, options);
  return `${startFormatted} - ${endFormatted}`;
};

export const EventCardSkeleton: React.FC = () => (
  <Card className="shadow w-full">
    <CardContent className="p-3 overflow-hidden">
      <View className="flex-row gap-3">
        {/* Date Placeholder */}
        <View className="flex-col items-center justify-center bg-muted/30 rounded p-2 min-w-[56px]">
          {/* Month Placeholder */}
          <Skeleton className="h-4 w-8 mb-1" />
          {/* Day Placeholder */}
          <Skeleton className="h-6 w-6" />
        </View>

        {/* Main Content Placeholder */}
        <View className="flex-1 justify-between">
          {/* Top Row Placeholder (Title + Chevron) */}
          <View className="flex-row justify-between items-start mb-1">
            {/* Title Placeholder */}
            <Skeleton className="h-5 flex-1 mr-2" />
            {/* Chevron Placeholder */}
            <Skeleton className="h-5 w-5" />
          </View>

          {/* Bottom Row Placeholder (Pin + Location) */}
          <View className="items-center flex-row gap-1">
            {/* Pin Placeholder */}
            <Skeleton className="h-4 w-4" />
            {/* Location Placeholder */}
            <Skeleton className="h-4 w-3/4" />
          </View>
        </View>
      </View>
    </CardContent>
  </Card>
);
