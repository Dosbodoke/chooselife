import { Host, Switch as ExpoSwitch } from '@expo/ui';
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
    ? 'border-red-500'
    : focused
      ? 'border-blue-500'
      : 'border-zinc-200';
  const labelColor = focused ? 'text-blue-600' : 'text-zinc-500';

  return (
    <View className="gap-1.5">
      <View
        className={`bg-zinc-50 rounded-2xl border ${border} px-4 py-3.5`}
      >
        <Text className={`${labelColor} text-xs font-medium`}>
          {label}
          {required ? <Text className="text-red-600"> *</Text> : null}
        </Text>
        <View className="flex-row items-center gap-3">
          <TextInput
            accessibilityLabel={`${accessibilityLabel}${required ? ' obrigatório' : ''}`}
            autoCapitalize={autoCapitalize}
            className={`flex-1 text-zinc-950 text-base ${keyboardType === 'number-pad' ? 'tracking-wide' : ''}`}
            keyboardType={keyboardType}
            multiline={multiline}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            placeholder={placeholder}
            placeholderTextColor="rgba(39,39,42,0.35)"
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
          className="text-red-600 text-xs mt-1.5"
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
      <Text className="text-zinc-500 text-xs font-medium">
        {label}
        {required ? <Text className="text-red-600"> *</Text> : null}
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
                  ? 'bg-blue-50 border-blue-500'
                  : 'bg-zinc-50 border-zinc-200'
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
                  selected ? 'text-blue-700 font-semibold' : 'text-zinc-700'
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text className="text-red-600 text-xs">{error}</Text> : null}
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
            className={`bg-zinc-50 rounded-2xl border-2 p-5 ${
              selected ? 'border-emerald-500' : 'border-zinc-200'
            }`}
          >
            <Text className="text-zinc-950 text-xl font-bold">
              {option.title}
            </Text>
            <Text className="text-zinc-500 text-sm mt-1 leading-5">
              {option.description}
            </Text>
          </TouchableOpacity>
        );
      })}
      {error ? <Text className="text-red-600 text-xs">{error}</Text> : null}
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
      <View className="rounded-2xl bg-zinc-50 border border-zinc-200 p-4 flex-row justify-between items-center gap-3">
        <View className="flex-1">
          <Text className="text-zinc-950 font-semibold">{label}</Text>
          {description ? (
            <Text className="text-zinc-500 text-xs mt-1">{description}</Text>
          ) : null}
        </View>
        <View
          accessibilityRole="switch"
          accessibilityState={{ checked: Boolean(value) }}
          className="flex-row bg-zinc-200 rounded-full p-1"
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
                    selected ? 'text-zinc-950' : 'text-zinc-600'
                  }`}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {error ? <Text className="text-red-600 text-xs">{error}</Text> : null}
    </View>
  );
}

export function NativeSwitchRow({
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
      <View className="rounded-2xl bg-zinc-50 border border-zinc-200 p-4 flex-row justify-between items-center gap-4">
        <View className="flex-1">
          <Text className="text-zinc-950 font-semibold">{label}</Text>
          {description ? (
            <Text className="text-zinc-500 text-xs mt-1 leading-4">
              {description}
            </Text>
          ) : null}
        </View>
        <Host
          colorScheme="light"
          matchContents
          seedColor="#10B981"
          style={{ minHeight: 44, minWidth: 54 }}
        >
          <ExpoSwitch
            testID={`switch-${label.toLowerCase().replace(/\s+/g, '-')}`}
            value={Boolean(value)}
            onValueChange={(nextValue) => {
              onChange(nextValue);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          />
        </Host>
      </View>
      {error ? <Text className="text-red-600 text-xs">{error}</Text> : null}
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
      className="mt-3 bg-blue-50 border border-blue-100 rounded-2xl px-3 py-2"
    >
      <View className="flex-row items-center gap-3">
        <Text className="text-zinc-950 text-xs font-semibold flex-1">
          Continuamos de onde você parou
        </Text>
        <Pressable onPress={onRestart} hitSlop={8}>
          <Text className="text-blue-700 text-xs font-semibold">
            Recomeçar do zero
          </Text>
        </Pressable>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Text className="text-zinc-500 text-xs font-semibold">
            Dispensar
          </Text>
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
  onDismissResume,
  onRestartResume,
  progress,
  savedVisible,
  showResumeBanner,
  subtitle,
  title,
  totalSteps,
}: {
  canGoBack: boolean;
  currentStep: number;
  onBack: () => void;
  onClose: () => void;
  onDismissResume: () => void;
  onRestartResume: () => void;
  progress: SharedValue<number>;
  savedVisible: boolean;
  showResumeBanner: boolean;
  subtitle: string;
  title: string;
  totalSteps: number;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute top-0 left-0 right-0 px-6 pb-4 z-50 bg-white border-b border-zinc-100"
      style={{
        paddingTop: Math.max(insets.top - 6, 8),
      }}
    >
      <View className="flex-row items-center">
        <View className="w-11">
          {canGoBack ? (
            <Pressable
              onPress={onBack}
              className="p-2.5 rounded-full bg-zinc-100"
              hitSlop={12}
            >
              <Icon as={ChevronLeftIcon} size={20} color="#18181B" />
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
              className="text-zinc-500 text-xs font-semibold tracking-wide text-center"
              maxFontSizeMultiplier={1.6}
            >
              PASSO {currentStep + 1} DE {totalSteps}
            </Text>
            {savedVisible ? (
              <Animated.Text
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(150)}
                className="text-zinc-400 text-xs"
              >
                Salvo ✓
              </Animated.Text>
            ) : null}
          </View>
        </View>
        <Pressable
          onPress={onClose}
          className="p-2.5 rounded-full bg-zinc-100"
          hitSlop={12}
        >
          <Icon as={XIcon} size={20} color="#18181B" />
        </Pressable>
      </View>
      <View className="mt-4 gap-1">
        <Text
          accessibilityRole="header"
          className="text-zinc-950 text-2xl font-bold leading-8"
        >
          {title}
        </Text>
        <Text className="text-zinc-500 text-base leading-6">{subtitle}</Text>
      </View>
      {showResumeBanner ? (
        <ResumeBanner
          onDismiss={onDismissResume}
          onRestart={onRestartResume}
        />
      ) : null}
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
    <View className="h-1 flex-1 rounded-full bg-zinc-200 overflow-hidden">
      {done ? <View className="h-full w-full bg-emerald-500" /> : null}
      {active ? (
        <Animated.View
          className="h-full bg-emerald-500"
          style={currentStyle}
        />
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
      className="absolute bottom-0 left-0 right-0 px-6 pt-4 bg-white border-t border-zinc-100"
      style={{
        paddingBottom: insets.bottom + 16,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        className={`bg-zinc-950 rounded-full py-4 items-center justify-center ${
          disabled ? 'opacity-50' : ''
        }`}
        disabled={disabled || loading}
        onPress={onPress}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="text-white text-lg font-bold">{label}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export function SuccessInterstitial() {
  return (
    <View className="flex-1 justify-center items-center gap-4 px-6 bg-white">
      <Animated.View entering={ZoomIn}>
        <Icon as={CheckCircle2Icon} size={64} color="#6D28D9" />
      </Animated.View>
      <Animated.Text
        entering={FadeIn.delay(200)}
        className="text-zinc-950 text-2xl font-bold text-center"
      >
        Cadastro completo!
      </Animated.Text>
      <Animated.Text
        entering={FadeIn.delay(400)}
        className="text-zinc-500 text-lg text-center"
      >
        Agora só falta o pagamento
      </Animated.Text>
    </View>
  );
}

export const animatedLayout = _layoutAnimation;
