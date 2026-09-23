import Compact from '~/prototypes/highline-tabs/compact';
import Dock from '~/prototypes/highline-tabs/dock';
import Sticky from '~/prototypes/highline-tabs/sticky';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const names = ['Sticky', 'Compact', 'Dock'];
const variants = [Sticky, Compact, Dock];

/** Native translation of prototype/PICKER.md. This chrome is never promoted. */
export default function HighlineTabsPrototype() {
  const { v } = useLocalSearchParams<{ v?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const parsed = Number(v);
  const current =
    Number.isInteger(parsed) && parsed >= 1 && parsed <= 3 ? parsed - 1 : 0;
  const [replay, setReplay] = useState(0);
  const [frames, setFrames] = useState<
    Record<number, { x: number; width: number }>
  >({});
  const highlightX = useSharedValue(4);
  const highlightWidth = useSharedValue(0);
  const highlight = useAnimatedStyle(() => ({
    width: highlightWidth.value,
    transform: [{ translateX: highlightX.value }],
  }));
  const Variant = variants[current];
  function position(index: number, animated: boolean) {
    const frame = frames[index];
    if (!frame) return;
    const config = {
      duration: reduceMotion || !animated ? 0 : 250,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
    };
    highlightX.value = withTiming(frame.x, config);
    highlightWidth.value = withTiming(frame.width, config);
  }
  function select(index: number) {
    position(index, true);
    router.setParams({ v: String(index + 1) });
  }
  return (
    <View style={[styles.root, { paddingTop: insets.top + 60 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Variant key={`${current}-${replay}`} />
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Prototype variants"
        accessibilityValue={{ text: names[current] }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) =>
          select(
            (current + (event.nativeEvent.actionName === 'increment' ? 1 : 2)) %
              3,
          )
        }
        style={[styles.picker, { top: insets.top + 12 }]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.highlight, highlight]}
        />
        {names.map((name, i) => (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityLabel={`Prototype ${name}`}
            accessibilityState={{ selected: current === i }}
            testID={`prototype-${name.toLowerCase()}`}
            onLayout={(event) => {
              const frame = event.nativeEvent.layout;
              setFrames((previous) => ({
                ...previous,
                [i]: { x: frame.x, width: frame.width },
              }));
              if (i === current) {
                highlightX.value = frame.x;
                highlightWidth.value = frame.width;
              }
            }}
            onPress={() => select(i)}
            hitSlop={{ top: 8, bottom: 8 }}
            style={({ pressed }) => [
              styles.item,
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
          >
            <Text style={[styles.label, current === i && { color: 'white' }]}>
              {name}
            </Text>
          </Pressable>
        ))}
        <View style={styles.divider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Replay prototype"
          onPress={() => setReplay((value) => value + 1)}
          hitSlop={8}
          style={[styles.item, { paddingHorizontal: 10 }]}
        >
          <Text style={[styles.label, { fontSize: 14 }]}>↻</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f4f6' },
  picker: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 2147483647,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,10,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    shadowOpacity: 0.24,
    elevation: 8,
  },
  highlight: {
    position: 'absolute',
    top: 4,
    left: 0,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  item: {
    height: 28,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
  },
  label: { fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  divider: {
    width: 1,
    height: 16,
    marginHorizontal: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
