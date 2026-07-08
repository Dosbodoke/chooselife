import * as Haptics from 'expo-haptics';
import { CheckCircle2Icon, ChevronLeftIcon, XIcon } from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { _layoutAnimation } from '~/utils/constants';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

type FieldProps = {
  accessibilityLabel: string;
  error?: string;
  label: string;
  multiline?: boolean;
  onBlur?: () => void;
  onChangeText: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  rightSlot?: React.ReactNode;
  value: string;
} & Pick<
  React.ComponentProps<typeof TextInput>,
  'autoCapitalize' | 'keyboardType' | 'returnKeyType' | 'textContentType'
>;

export function GlassField({
  accessibilityLabel,
  autoCapitalize,
  error,
  keyboardType,
  label,
  multiline,
  onBlur,
  onChangeText,
  placeholder,
  required,
  returnKeyType = 'next',
  rightSlot,
  textContentType,
  value,
}: FieldProps) {
  const [focused, setFocused] = React.useState(false);
  const border = error
    ? 'border-red-400/70'
    : focused
      ? 'border-emerald-400/70'
      : 'border-white/15';
  const labelColor = focused ? 'text-emerald-300' : 'text-white/60';

  return (
    <View className="gap-1.5">
      <View className={`bg-white/10 rounded-2xl border ${border} px-4 py-3.5`}>
        <Text className={`${labelColor} text-xs font-medium`}>
          {label}
          {required ? <Text className="text-emerald-300"> *</Text> : null}
        </Text>
        <View className="flex-row items-center gap-3">
          <TextInput
            accessibilityLabel={`${accessibilityLabel}${required ? ' obrigatório' : ''}`}
            autoCapitalize={autoCapitalize}
            className={`flex-1 text-white text-base ${keyboardType === 'number-pad' ? 'tracking-wide' : ''}`}
            keyboardType={keyboardType}
            multiline={multiline}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            placeholder={placeholder}
            placeholderTextColor="rgba(255,255,255,0.35)"
            returnKeyType={returnKeyType}
            style={multiline ? { minHeight: 88 } : undefined}
            textContentType={textContentType}
            textAlignVertical={multiline ? 'top' : 'center'}
            value={value}
          />
          {rightSlot}
        </View>
      </View>
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-red-300 text-xs mt-1.5"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function SelectChips<T extends string>({
  columns,
  error,
  label,
  onChange,
  options,
  required,
  value,
}: {
  columns?: 2 | 4;
  error?: string;
  label: string;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
  required?: boolean;
  value: T | null;
}) {
  return (
    <View className="gap-3">
      <Text className="text-white/60 text-xs font-medium">
        {label}
        {required ? <Text className="text-emerald-300"> *</Text> : null}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              hitSlop={8}
              onPress={() => {
                onChange(option.value);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className={`px-4 py-2.5 rounded-full border ${
                selected
                  ? 'bg-emerald-500/20 border-emerald-400'
                  : 'bg-white/10 border-white/20'
              } ${columns ? 'items-center' : ''}`}
              style={
                columns
                  ? {
                      flexBasis: `${100 / columns - 3}%`,
                    }
                  : undefined
              }
            >
              <Text
                className={`text-center ${
                  selected ? 'text-emerald-300 font-semibold' : 'text-white/80'
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text className="text-red-300 text-xs">{error}</Text> : null}
    </View>
  );
}

export function SelectCards<T extends string>({
  error,
  onChange,
  options,
  value,
}: {
  error?: string;
  onChange: (value: T) => void;
  options: { description: string; title: string; value: T }[];
  value: T | null;
}) {
  return (
    <View className="gap-3">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            activeOpacity={0.85}
            onPress={() => {
              onChange(option.value);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className={`bg-white/10 rounded-2xl border-2 p-5 ${
              selected ? 'border-emerald-400' : 'border-white/15'
            }`}
          >
            <Text className="text-white text-xl font-bold">{option.title}</Text>
            <Text className="text-white/60 text-sm mt-1 leading-5">
              {option.description}
            </Text>
          </TouchableOpacity>
        );
      })}
      {error ? <Text className="text-red-300 text-xs">{error}</Text> : null}
    </View>
  );
}

export function YesNoRow({
  description,
  error,
  label,
  onChange,
  value,
}: {
  description?: string;
  error?: string;
  label: string;
  onChange: (value: boolean) => void;
  value: boolean | null;
}) {
  return (
    <View className="gap-2">
      <View className="rounded-2xl bg-white/10 border border-white/15 p-4 flex-row justify-between items-center gap-3">
        <View className="flex-1">
          <Text className="text-white font-semibold">{label}</Text>
          {description ? (
            <Text className="text-white/55 text-xs mt-1">{description}</Text>
          ) : null}
        </View>
        <View
          accessibilityRole="switch"
          accessibilityState={{ checked: Boolean(value) }}
          className="flex-row bg-white/10 rounded-full p-1"
        >
          {[
            { label: 'Não', value: false },
            { label: 'Sim', value: true },
          ].map((option) => {
            const selected = value === option.value;
            return (
              <Pressable
                key={option.label}
                hitSlop={8}
                onPress={() => {
                  onChange(option.value);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={`px-3 py-2 rounded-full ${
                  selected ? 'bg-white' : 'bg-transparent'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    selected ? 'text-black' : 'text-white/75'
                  }`}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {error ? <Text className="text-red-300 text-xs">{error}</Text> : null}
    </View>
  );
}

export function ResumeBanner({
  onDismiss,
  onRestart,
}: {
  onDismiss: () => void;
  onRestart: () => void;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      className="bg-emerald-500/15 border border-emerald-400/30 rounded-2xl p-4 gap-2"
    >
      <Text className="text-white font-bold">
        Continuamos de onde você parou
      </Text>
      <View className="flex-row items-center gap-4">
        <Pressable onPress={onRestart} hitSlop={8}>
          <Text className="text-emerald-300 font-semibold">
            Recomeçar do zero
          </Text>
        </Pressable>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Text className="text-white/60 font-semibold">Dispensar</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function ProgressHeader({
  canGoBack,
  currentStep,
  onBack,
  onClose,
  progress,
  savedVisible,
  totalSteps,
}: {
  canGoBack: boolean;
  currentStep: number;
  onBack: () => void;
  onClose: () => void;
  progress: SharedValue<number>;
  savedVisible: boolean;
  totalSteps: number;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute top-0 left-0 right-0 px-6 pb-6 z-50"
      style={{
        paddingTop: insets.top + 12,
        experimental_backgroundImage:
          'linear-gradient(to bottom, rgba(2, 6, 23, 0.9) 55%, rgba(2, 6, 23, 0) 100%)',
      }}
    >
      <View className="flex-row items-center">
        <View className="w-11">
          {canGoBack ? (
            <Pressable
              onPress={onBack}
              className="p-2.5 rounded-full bg-white/10"
              hitSlop={12}
            >
              <Icon as={ChevronLeftIcon} size={20} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
        <View className="flex-1 gap-2 px-2">
          <View className="flex-row gap-1.5">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <ProgressPill
                key={index}
                active={index === currentStep}
                done={index < currentStep}
                progress={progress}
              />
            ))}
          </View>
          <View className="flex-row justify-center items-center gap-2">
            <Text
              className="text-white/60 text-xs font-semibold tracking-wide text-center"
              maxFontSizeMultiplier={1.6}
            >
              PASSO {currentStep + 1} DE {totalSteps}
            </Text>
            {savedVisible ? (
              <Animated.Text
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(150)}
                className="text-white/40 text-xs"
              >
                Salvo ✓
              </Animated.Text>
            ) : null}
          </View>
        </View>
        <Pressable
          onPress={onClose}
          className="p-2.5 rounded-full bg-white/10"
          hitSlop={12}
        >
          <Icon as={XIcon} size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

function ProgressPill({
  active,
  done,
  progress,
}: {
  active: boolean;
  done: boolean;
  progress: SharedValue<number>;
}) {
  const currentStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View className="h-1 flex-1 rounded-full bg-white/15 overflow-hidden">
      {done ? <View className="h-full w-full bg-emerald-400" /> : null}
      {active ? (
        <Animated.View className="h-full bg-emerald-400" style={currentStyle} />
      ) : null}
    </View>
  );
}

export function FooterCta({
  disabled,
  label,
  loading,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute bottom-0 left-0 right-0 px-6 pt-10"
      style={{
        paddingBottom: insets.bottom + 16,
        experimental_backgroundImage:
          'linear-gradient(to top, rgba(2, 6, 23, 0.95) 55%, rgba(2, 6, 23, 0) 100%)',
      }}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        className={`bg-white rounded-full py-4 items-center justify-center ${
          disabled ? 'opacity-50' : ''
        }`}
        disabled={disabled || loading}
        onPress={onPress}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text className="text-black text-lg font-bold">{label}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export function SuccessInterstitial() {
  return (
    <View className="flex-1 justify-center items-center gap-4 px-6">
      <Animated.View entering={ZoomIn}>
        <Icon as={CheckCircle2Icon} size={64} color="#10B981" />
      </Animated.View>
      <Animated.Text
        entering={FadeIn.delay(200)}
        className="text-white text-2xl font-bold text-center"
      >
        Cadastro completo!
      </Animated.Text>
      <Animated.Text
        entering={FadeIn.delay(400)}
        className="text-white/80 text-lg text-center"
      >
        Agora só falta o pagamento
      </Animated.Text>
    </View>
  );
}

export const animatedLayout = _layoutAnimation;
