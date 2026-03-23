import * as Haptics from 'expo-haptics';
import { Minus, Plus } from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';

interface HighlineLengthInputProps {
  onLengthChange: (length: number) => void;
  initialValue?: number;
}

const STEP = 5;
const MIN_LENGTH = 1;
const MAX_LENGTH = 5000;

// Color thresholds
const COLORS = {
  short: '#3b82f6', // blue-500
  medium: '#10b981', // emerald-500
  long: '#f59e0b', // amber-500
  extreme: '#ef4444', // red-500
  worldRecord: '#8b5cf6', // violet-500
};

export const HighlineLengthInput: React.FC<HighlineLengthInputProps> = ({
  onLengthChange,
  initialValue = 100,
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(initialValue.toString());

  // Animation value for color transitions
  const progress = useDerivedValue(() => {
    return withSpring(value);
  });

  const animatedTextStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      progress.value,
      [20, 100, 300, 600, 1000],
      [
        COLORS.short,
        COLORS.medium,
        COLORS.long,
        COLORS.extreme,
        COLORS.worldRecord,
      ],
    );

    return {
      color,
    };
  });

  const handleIncrement = () => {
    const newValue = Math.min(value + STEP, MAX_LENGTH);
    updateValue(newValue);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDecrement = () => {
    const newValue = Math.max(value - STEP, MIN_LENGTH);
    updateValue(newValue);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const updateValue = (newValue: number) => {
    setValue(newValue);
    setInputValue(newValue.toString());
    onLengthChange(newValue);
  };

  const handleTextChange = (text: string) => {
    setInputValue(text);
  };

  const handleEndEditing = () => {
    setIsEditing(false);
    const num = parseInt(inputValue, 10);
    if (!isNaN(num) && num >= MIN_LENGTH && num <= MAX_LENGTH) {
      updateValue(num);
    } else {
      setInputValue(value.toString());
    }
  };

  return (
    <View className="mb-6">
      <Text className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-gray-500">
        {t('app.setup-simulator.lengthInput.label')}
      </Text>

      <View className="relative flex-row items-center justify-center p-4 rounded-3xl bg-gray-50 shadow-sm border border-gray-100">
        <TouchableOpacity
          onPress={handleDecrement}
          className="size-14 items-center justify-center rounded-2xl bg-white shadow-sm active:bg-gray-100"
          activeOpacity={0.7}
        >
          <Minus size={24} color="#4b5563" strokeWidth={2.5} />
        </TouchableOpacity>

        {isEditing ? (
          <TextInput
            autoFocus
            keyboardType="numeric"
            value={inputValue}
            onChangeText={handleTextChange}
            onBlur={handleEndEditing}
            onEndEditing={handleEndEditing}
            className="flex-1 text-center text-6xl font-black text-gray-900 p-0"
            style={{ height: 80 }}
          />
        ) : (
          <TouchableOpacity
            onPress={() => {
              setIsEditing(true);
              Haptics.selectionAsync();
            }}
            className="flex-1 items-center justify-center"
          >
            <View className="relative flex-row items-baseline">
              <Animated.Text
                style={animatedTextStyle}
                className="text-6xl font-black tracking-tighter"
              >
                {value}
              </Animated.Text>
              <View className="absolute" style={{ right: -24, bottom: 8 }}>
                <Text className="text-2xl font-bold text-gray-400">m</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleIncrement}
          className="size-14 items-center justify-center rounded-2xl bg-white shadow-sm active:bg-gray-100"
          activeOpacity={0.7}
        >
          <Plus size={24} color="#4b5563" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
};
