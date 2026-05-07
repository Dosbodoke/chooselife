import type { FestivalHighlineScheduleCard } from '@chooselife/ui';
import { cva } from 'class-variance-authority';
import React from 'react';
import {
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { cn } from '~/lib/utils';
import { useI18n } from '~/context/i18n';

import { ScheduleChipEdgeFade } from '~/components/festival/schedule-chip-edge-fade';
import { Text } from '~/components/ui/text';

const dayChipVariants = cva('rounded-full px-3 py-2', {
  variants: {
    active: {
      true: 'bg-[#101b2b]',
      false: 'bg-slate-100',
    },
  },
  defaultVariants: {
    active: false,
  },
});

const dayChipTextVariants = cva('font-semibold', {
  variants: {
    active: {
      true: 'text-white',
      false: 'text-slate-600',
    },
  },
  defaultVariants: {
    active: false,
  },
});

type FestivalScheduleDayChipsProps = {
  days: FestivalHighlineScheduleCard['days'];
  festivalTimeZone: string;
  onSelectDayKey: (dayKey: string) => void;
  selectedDayKey: string | null;
};

function formatDayLabel(dateKey: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone,
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

export function FestivalScheduleDayChips({
  days,
  festivalTimeZone,
  onSelectDayKey,
  selectedDayKey,
}: FestivalScheduleDayChipsProps) {
  const { locale } = useI18n();
  const scrollViewRef = React.useRef<ScrollView>(null);
  const dayChipLayoutsRef = React.useRef<
    Record<string, { width: number; x: number }>
  >({});

  const scrollSelectedDayChipIntoView = React.useCallback(
    (dayKey: string | null) => {
      if (!dayKey) return;

      const layout = dayChipLayoutsRef.current[dayKey];
      if (!layout) return;

      scrollViewRef.current?.scrollTo({
        x: Math.max(layout.x - 20, 0),
        animated: false,
      });
    },
    [],
  );

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      scrollSelectedDayChipIntoView(selectedDayKey);
    }, 0);

    return () => clearTimeout(timeout);
  }, [days, scrollSelectedDayChipIntoView, selectedDayKey]);

  const handleDayChipLayout = React.useCallback(
    (dayKey: string, event: LayoutChangeEvent) => {
      dayChipLayoutsRef.current[dayKey] = event.nativeEvent.layout;

      if (dayKey === selectedDayKey) {
        scrollSelectedDayChipIntoView(dayKey);
      }
    },
    [scrollSelectedDayChipIntoView, selectedDayKey],
  );

  return (
    <View className="-mx-5 relative">
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <View className="flex-row gap-2 px-5">
          {days.map((day) => {
            const isSelected = selectedDayKey === day.dateKey;

            return (
              <Pressable
                key={day.dateKey}
                className={cn(dayChipVariants({ active: isSelected }))}
                onLayout={(event) => handleDayChipLayout(day.dateKey, event)}
                onPress={() => onSelectDayKey(day.dateKey)}
              >
                <Text
                  className={cn(dayChipTextVariants({ active: isSelected }))}
                >
                  {formatDayLabel(day.dateKey, locale, festivalTimeZone)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <ScheduleChipEdgeFade direction="left" />
      <ScheduleChipEdgeFade direction="right" />
    </View>
  );
}
