import {
  ShieldCheck,
  Mountain,
  Sparkles,
  Sun,
  Rocket,
  Wind,
  Zap,
  ArrowUpCircle,
  RefreshCw,
  Compass,
  MapPin,
  Activity,
} from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

import { Icon } from '~/components/ui/icon';

const GRID_ICONS = [
  ShieldCheck,
  Mountain,
  Sparkles,
  Sun,
  Rocket,
  Wind,
  Zap,
  ArrowUpCircle,
  RefreshCw,
  Compass,
  MapPin,
  Activity,
];

const CELL_SIZE = 40;
const ICON_SIZE = 18;

export function IconGridBackground({
  rows = 5,
  cols = 7,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <View
      pointerEvents="none"
      className="absolute inset-0 overflow-hidden"
    >
      {Array.from({ length: rows }, (_, rowIndex) => {
        const rowOpacity = Math.max(0, 1 - rowIndex / rows) * 0.06;
        return (
          <View key={rowIndex} className="flex-row justify-evenly" style={{ height: CELL_SIZE }}>
            {Array.from({ length: cols }, (_, colIndex) => {
              const iconIndex = (rowIndex * cols + colIndex) % GRID_ICONS.length;
              const LucideIcon = GRID_ICONS[iconIndex];
              return (
                <View
                  key={colIndex}
                  className="items-center justify-center"
                  style={{ width: CELL_SIZE, height: CELL_SIZE, opacity: rowOpacity }}
                >
                  <Icon as={LucideIcon} size={ICON_SIZE} className="text-foreground" />
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
