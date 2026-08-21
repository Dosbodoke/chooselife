import {
  Host,
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
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ReviewRow } from '~/components/organizations/onboarding/form';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

type FieldProps = {
  accessibilityLabel: string;
  error?: string;
  label?: string;
  /**
   * Optional formatter (e.g. maskCpf) applied synchronously to the native
   * text state on every keystroke, avoiding the controlled-input round trip.
   */
  mask?: (value: string) => string;
  multiline?: boolean;
  onBlur?: () => void;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
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

/**
 * Universal `@expo/ui` types only expose `.value`, but native `useNativeState`
 * also implements React Compiler-friendly `.get()` / `.set()`. Prefer those.
 * Web's polyfill only has the `.value` accessor.
 */
type NativeStateWrite<T> = {
  value: T;
  get?: () => T;
  set?: (value: T) => void;
};

function setNativeState<T>(state: NativeStateWrite<T>, next: T) {
  if (typeof state.set === 'function') {
    state.set(next);
    return;
  }
  state.value = next;
}

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
  onSubmitEditing,
  placeholder,
  required,
  returnKeyType,
  rightSlot,
  textContentType,
  value,
}: FieldProps) {
  const [focused, setFocused] = React.useState(false);
  // Text lives in native SwiftUI state (captured once on mount). External
  // writes (e.g. CEP autofill) must remount via `key` on the parent.
  const text = useNativeState(value);
  const selection = useNativeState({ end: value.length, start: value.length });

  const handleChangeText = (raw: string) => {
    const next = mask ? mask(raw) : raw;
    if (next !== raw) {
      setNativeState(text, next);
      // Rewriting the text leaves the caret at its old index; snap it to the
      // end so the next keystroke lands after the inserted mask characters.
      setNativeState(selection, { end: next.length, start: next.length });
    }
    onChangeText(next);
  };

  const border = error
    ? 'border-red-500'
    : focused
      ? 'border-blue-500'
      : 'border-zinc-200';
  const labelColor = focused ? 'text-blue-600' : 'text-zinc-500';
  const resolvedReturnKeyType = returnKeyType ?? 'next';

  if (multiline) {
    // A SwiftUI multiline input has no usable return key, which trapped people
    // in the field. React Native's TextInput turns the system return key into
    // "done" and blurs on it, so the keyboard closes the way iOS users expect.
    return (
      <View className="gap-1.5">
        <View className={`bg-zinc-50 rounded-2xl border ${border} px-4 py-3.5`}>
          {label ? (
            <Text className={`${labelColor} text-xs font-medium mb-1`}>
              {label}
              {required ? <Text className="text-red-600"> *</Text> : null}
            </Text>
          ) : null}
          <TextInput
            accessibilityLabel={accessibilityLabel}
            autoCapitalize={autoCapitalize}
            multiline
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onSubmitEditing={onSubmitEditing}
            placeholder={placeholder}
            placeholderTextColor="rgba(39,39,42,0.35)"
            returnKeyType="done"
            style={{ color: '#09090B', fontSize: 16, height: 96 }}
            submitBehavior="blurAndSubmit"
            testID={`field-${accessibilityLabel.toLowerCase().replace(/\s+/g, '-')}`}
            textAlignVertical="top"
            value={value}
          />
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

  return (
    <View className="gap-1.5">
      <View className={`bg-zinc-50 rounded-2xl border ${border} px-4 py-3.5`}>
        {label ? (
          <Text className={`${labelColor} text-xs font-medium mb-1`}>
            {label}
            {required ? <Text className="text-red-600"> *</Text> : null}
          </Text>
        ) : null}
        <View className="flex-row items-center gap-3">
          <Host style={{ flex: 1, height: 24 }}>
            <NativeTextInput
              autoCapitalize={autoCapitalize}
              autoComplete={
                textContentType
                  ? textContentTypeToAutoComplete[textContentType]
                  : undefined
              }
              keyboardType={keyboardType}
              onBlur={() => {
                setFocused(false);
                onBlur?.();
              }}
              onChangeText={handleChangeText}
              onFocus={() => setFocused(true)}
              onSubmitEditing={onSubmitEditing}
              placeholder={placeholder}
              placeholderTextColor="rgba(39,39,42,0.35)"
              returnKeyType={resolvedReturnKeyType}
              selection={mask ? selection : undefined}
              style={{ height: 24 }}
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
  label?: string;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
  required?: boolean;
  value: T | null;
}) {
  return (
    <View className="gap-3">
      {label ? (
        <Text className="text-zinc-500 text-xs font-medium">
          {label}
          {required ? <Text className="text-red-600"> *</Text> : null}
        </Text>
      ) : null}
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
  label,
  onChange,
  options,
  value,
}: {
  error?: string;
  label?: string;
  onChange: (value: T) => void;
  options: { description?: string; title: string; value: T }[];
  value: T | null;
}) {
  return (
    <View className="gap-3">
      {label ? (
        <Text className="text-zinc-500 text-xs font-medium">{label}</Text>
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              onChange(option.value);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className={`rounded-2xl p-5 ${
              selected ? 'bg-blue-50/60' : 'bg-zinc-50'
            }`}
            style={({ pressed }) => ({
              borderColor: selected ? '#2563EB' : '#E4E4E7',
              borderWidth: 2,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-zinc-950 text-xl font-bold">
                  {option.title}
                </Text>
                {option.description ? (
                  <Text className="text-zinc-500 text-sm mt-1 leading-5">
                    {option.description}
                  </Text>
                ) : null}
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
          </Pressable>
        );
      })}
      {error ? <Text className="text-red-600 text-xs">{error}</Text> : null}
    </View>
  );
}

export function FocusedHeader({
  onBack,
  onClose,
  progress,
  sectionLabel,
  showBack,
}: {
  onBack: () => void;
  onClose: () => void;
  /** Continuous 0 → 1 fill position. */
  progress: SharedValue<number>;
  sectionLabel: string;
  showBack: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="px-5 pb-3 bg-white border-b border-zinc-100"
      style={{ paddingTop: Math.max(insets.top - 6, 8) }}
    >
      <View className="flex-row items-center">
        <View className="w-11">
          {showBack ? (
            <Pressable
              accessibilityLabel="Voltar"
              accessibilityRole="button"
              className="p-2.5 rounded-full bg-zinc-100"
              hitSlop={12}
              onPress={onBack}
            >
              <Icon as={ChevronLeftIcon} size={20} color="#18181B" />
            </Pressable>
          ) : null}
        </View>
        <View className="flex-1 px-2">
          <Text
            accessibilityRole="header"
            className="text-zinc-500 text-xs font-bold tracking-widest text-center"
            maxFontSizeMultiplier={1.6}
            numberOfLines={1}
          >
            {sectionLabel.toUpperCase()}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Fechar cadastro"
          accessibilityRole="button"
          className="p-2.5 rounded-full bg-zinc-100"
          hitSlop={12}
          onPress={onClose}
        >
          <Icon as={XIcon} size={20} color="#18181B" />
        </Pressable>
      </View>
      <View className="mt-3">
        <ProgressBar progress={progress} />
      </View>
    </View>
  );
}

function ProgressBar({ progress }: { progress: SharedValue<number> }) {
  const animatedStyle = useAnimatedStyle(() => ({
    width: `${Math.min(Math.max(progress.get(), 0), 1) * 100}%`,
  }));

  return (
    <View className="h-1 rounded-full bg-zinc-200 overflow-hidden">
      <Animated.View className="h-full bg-emerald-500" style={animatedStyle} />
    </View>
  );
}

export function ReviewList({
  items,
  onEdit,
}: {
  items: ReviewRow[];
  onEdit: (index: number) => void;
}) {
  let lastSection: string | null = null;

  return (
    <View className="gap-2">
      {items.map((item) => {
        const startsSection = item.section !== lastSection;
        lastSection = item.section;

        return (
          <View key={item.label}>
            {startsSection ? (
              <Text className="text-zinc-400 text-[11px] font-bold tracking-widest mt-4 mb-2">
                {item.section.toUpperCase()}
              </Text>
            ) : null}
            <Pressable
              accessibilityHint="Toque para corrigir esta resposta"
              accessibilityLabel={`${item.label}: ${item.value ?? 'não informado'}`}
              accessibilityRole="button"
              className="flex-row items-center gap-3 rounded-2xl bg-zinc-50 border border-zinc-200 px-4 py-3"
              onPress={() => onEdit(item.index)}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <View className="flex-1">
                <Text className="text-zinc-500 text-xs font-medium">
                  {item.label}
                </Text>
                <Text
                  className={`text-base font-semibold mt-0.5 ${
                    item.error ? 'text-red-600' : 'text-zinc-950'
                  }`}
                  numberOfLines={2}
                >
                  {item.value ?? (item.error ?? 'Não informado')}
                </Text>
              </View>
              <Text className="text-blue-600 text-xs font-bold">Editar</Text>
            </Pressable>
          </View>
        );
      })}
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
    // Kept in normal flow (not absolute) so the keyboard pushes it up instead
    // of covering it — that is what made "Continuar" unreachable before.
    <View
      className="px-6 pt-4 bg-white border-t border-zinc-100"
      style={{
        paddingBottom: insets.bottom + 12,
      }}
    >
      <Pressable
        accessibilityState={{ disabled: Boolean(disabled || loading) }}
        className="bg-zinc-950 rounded-full h-14 items-center justify-center disabled:opacity-50"
        disabled={disabled || loading}
        onPress={onPress}
        style={({ pressed }) => ({
          // Inline opacity so disabled state is reliable (className alone was
          // easy to miss against the solid black CTA).
          opacity: disabled || loading ? 0.45 : pressed ? 0.85 : 1,
        })}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="text-white text-lg font-bold">{label}</Text>
        )}
      </Pressable>
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
