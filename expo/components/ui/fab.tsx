import { useRouter } from 'expo-router';
import { PlusIcon, type LucideIcon } from 'lucide-react-native';
import React from 'react';
import { TouchableOpacity, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

// ============================================================================
// Types
// ============================================================================

interface FABProps {
  /** Icon to display (defaults to PlusIcon) */
  icon?: LucideIcon;
  /** Optional label text */
  label?: string;
  /** Press handler */
  onPress?: () => void;
  /** Route to navigate to */
  href?: string;
  /** Custom container style */
  style?: ViewStyle;
  /** Whether to show the FAB */
  visible?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Floating Action Button with iOS premium styling.
 * Positioned at bottom-right with safe area consideration.
 */
export const FAB: React.FC<FABProps> = ({
  icon: IconComponent = PlusIcon,
  label,
  onPress,
  href,
  style,
  visible = true,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (href) {
      router.push(href as any);
    }
  };

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: insets.bottom + 16,
          alignItems: 'center',
        },
        style,
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        className="bg-primary flex-row items-center justify-center rounded-full shadow-lg"
        style={{
          paddingVertical: label ? 14 : 16,
          paddingHorizontal: label ? 20 : 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <View className="items-center justify-center">
          <Icon
            as={IconComponent}
            className="size-6 text-primary-foreground"
          />
        </View>
        {label && (
          <Text className="text-primary-foreground font-semibold text-base ml-2">
            {label}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};
