import {
  Host,
  Switch as ExpoSwitch,
  TextInput as NativeTextInput,
  useNativeState,
} from '@expo/ui';
import * as Haptics from 'expo-haptics';
import {
  CheckCircle2Icon,
  CheckIcon,
  ChevronLeftIcon,
  XIcon,
} from 'lucide-react-native';
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
  /**
   * Optional formatter (e.g. maskCpf) applied synchronously to the native
   * text state on every keystroke, avoiding the controlled-input round trip.
   */
  mask?: (value: string) => string;
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

const textContentTypeToAutoComplete: Partial<
  Record<
    NonNullable<FieldProps['textContentType']>,
    React.ComponentProps<typeof NativeTextInput>['autoComplete']
  >
> = {
  emailAddress: 'email',
  name: 'name',
  telephoneNumber: 'tel',
};

export function GlassField({
  accessibilityLabel,
  autoCapitalize,
  error,
  keyboardType,
  label,
  mask,
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
  // Text lives in native SwiftUI state; React only mirrors it for the form.
  const text = useNativeState(value);
  const selection = useNativeState({ end: value.length, start: value.length });
  const lastEmitted = React.useRef(value);

  // Sync external writes (e.g. CEP autofill) into the native state.
  React.useEffect(() => {
    if (value !== lastEmitted.current) {
      text.value = value;
      selection.value = { end: value.length, start: value.length };
      lastEmitted.current = value;
    }
  }, [selection, text, value]);

  const handleChangeText = (raw: string) => {
    const next = mask ? mask(raw) : raw;
    if (next !== raw) {
      text.value = next;
      // Rewriting the text leaves the caret at its old index; snap it to the
      // end so the next keystroke lands after the inserted mask characters.
      selection.value = { end: next.length, start: next.length };
    }
    lastEmitted.current = next;
    onChangeText(next);
  };

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
        <Text className={`${labelColor} text-xs font-medium mb-1`}>
          {label}
          {required ? <Text className="text-red-600"> *</Text> : null}
        </Text>
        <View className="flex-row items-center gap-3">
          <Host style={{ flex: 1, height: multiline ? 88 : 24 }}>
            <NativeTextInput
              autoCapitalize={autoCapitalize}
              autoComplete={
                textContentType
                  ? textContentTypeToAutoComplete[textContentType]
                  : undefined
              }
              keyboardType={keyboardType}
              multiline={multiline}
              onBlur={() => {
                setFocused(false);
                onBlur?.();
              }}
              onChangeText={handleChangeText}
              onFocus={() => setFocused(true)}
              placeholder={placeholder}
              placeholderTextColor="rgba(39,39,42,0.35)"
              returnKeyType={returnKeyType}
              selection={mask ? selection : undefined}
              style={{ height: multiline ? 88 : 24 }}
              testID={`field-${accessibilityLabel.toLowerCase().replace(/\s+/g, '-')}`}
              textStyle={{
                color: '#09090B',
                fontSize: 16,
                letterSpacing: keyboardType === 'number-pad' ? 0.5 : undefined,
              }}
              value={text}
            />
          </Host>
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
              className={`px-4 py-2.5 rounded-full ${
                selected ? 'bg-blue-50' : 'bg-zinc-50'
              } ${columns ? 'items-center' : ''}`}
              style={[
                {
                  borderColor: selected ? '#3B82F6' : '#E4E4E7',
                  borderWidth: 1,
                },
                columns ? { flexBasis: `${100 / columns - 3}%` } : null,
              ]}
            >
              <Text
                className={`text-center font-medium ${
                  selected ? 'text-blue-700' : 'text-zinc-700'
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
            className={`rounded-2xl p-5 ${
              selected ? 'bg-blue-50/60' : 'bg-zinc-50'
            }`}
            style={{
              borderColor: selected ? '#2563EB' : '#E4E4E7',
              borderWidth: 2,
            }}
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-zinc-950 text-xl font-bold">
                  {option.title}
                </Text>
                <Text className="text-zinc-500 text-sm mt-1 leading-5">
                  {option.description}
                </Text>
              </View>
              <View
                className={`w-6 h-6 rounded-full items-center justify-center ${
                  selected ? 'bg-blue-600' : 'bg-white'
                }`}
                style={{
                  borderColor: selected ? '#2563EB' : '#D4D4D8',
                  borderWidth: 2,
                }}
              >
                {selected ? (
                  <Icon as={CheckIcon} size={14} color="#FFFFFF" />
                ) : null}
              </View>
            </View>
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
          seedColor="#2563EB"
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

export function ProgressHeader({
  canGoBack,
  currentStep,
  onBack,
  onClose,
  progress,
  subtitle,
  title,
  totalSteps,
}: {
  canGoBack: boolean;
  currentStep: number;
  onBack: () => void;
  onClose: () => void;
  progress: SharedValue<number>;
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
              <ProgressPill key={index} index={index} progress={progress} />
            ))}
          </View>
          <Text
            className="text-zinc-500 text-xs font-semibold tracking-wide text-center"
            maxFontSizeMultiplier={1.6}
          >
            PASSO {currentStep + 1} DE {totalSteps}
          </Text>
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
    </View>
  );
}

// `progress` is a continuous position (currentStep + 1): each pill fills the
// slice of it between `index` and `index + 1`, so a single timing animation
// fills exactly one pill going forward and unfills exactly one going back.
function ProgressPill({
  index,
  progress,
}: {
  index: number;
  progress: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    width: `${Math.min(Math.max(progress.value - index, 0), 1) * 100}%`,
  }));

  return (
    <View className="h-1 flex-1 rounded-full bg-zinc-200 overflow-hidden">
      <Animated.View className="h-full bg-emerald-500" style={animatedStyle} />
    </View>
  );
}

export function FooterCta({
  disabled,
  label,
  loading,
  onPress,
  saved,
}: {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
  saved?: boolean;
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
        className={`bg-zinc-950 rounded-full h-14 items-center justify-center ${
          disabled ? 'opacity-50' : ''
        }`}
        disabled={disabled || loading}
        onPress={onPress}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : saved ? (
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(150)}
            className="flex-row items-center gap-2"
          >
            <Icon as={CheckIcon} size={18} color="#FFFFFF" />
            <Text className="text-white text-lg font-bold">Salvo</Text>
          </Animated.View>
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
