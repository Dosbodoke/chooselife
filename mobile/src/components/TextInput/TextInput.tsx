import { useState } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  Animated,
  Pressable,
  NativeSyntheticEvent,
  TextInputFocusEventData,
} from 'react-native';

interface Props {
  label: string;
  value: string;
  touched?: boolean;
  error?: string;
  accessibilityHint: string;
  keyboardType?: 'number-pad' | 'default' | 'email-address';
  disabled?: true;
  suffix?: string;
  isDirty?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  onChangeText: (e: string) => void;
  onBlur: (e: NativeSyntheticEvent<TextInputFocusEventData>) => void;
}

const TextInput = ({
  label,
  value,
  touched,
  error,
  accessibilityHint,
  keyboardType,
  disabled,
  suffix,
  isDirty,
  secureTextEntry,
  autoCapitalize,
  onChangeText,
  onBlur,
}: Props) => {
  const [isFocused, setIsFocused] = useState(false);
  const showValue = Boolean(value) || isFocused;

  function getStatusClass(classes: { neutral: string; error: string; success: string }): string {
    if (touched && error) return classes.error;
    if (isDirty && !error) return classes.success;
    return classes.neutral;
  }

  function handleOnBlur(e: NativeSyntheticEvent<TextInputFocusEventData>) {
    setIsFocused(false);
    onBlur(e);
  }

  return (
    <View className="mt-3 grow" pointerEvents={disabled ? 'none' : 'auto'}>
      <Pressable
        accessibilityRole="text"
        onPress={() => {
          if (!disabled) setIsFocused(true);
        }}
        className={`relative h-16 rounded-md border-[1px] px-2 focus:border-black ${getStatusClass({
          neutral: 'border-gray-400',
          error: 'border-red-500',
          success: 'border-green-500',
        })} ${disabled && 'bg-gray-100'}`}>
        <Animated.Text
          className={`absolute ml-2 ${getStatusClass({
            neutral: 'text-gray-400',
            error: 'text-red-500',
            success: 'text-green-500',
          })} ${showValue ? ['text-base'] : ['top-4 text-xl']}`}>
          {label}
        </Animated.Text>

        {showValue && (
          <View className="mt-6 flex flex-row ">
            <RNTextInput
              keyboardType={keyboardType || 'default'}
              returnKeyType="done"
              autoCapitalize={autoCapitalize || 'sentences'}
              secureTextEntry={secureTextEntry}
              onChangeText={(value) => {
                let normalizedValue = value.replace(/\s+/g, ' ');
                if (keyboardType === 'number-pad') {
                  normalizedValue = normalizedValue.replace(/[^0-9]/g, '');
                }
                onChangeText(normalizedValue);
              }}
              onEndEditing={(e) => onChangeText(e.nativeEvent.text.trim())}
              onBlur={handleOnBlur}
              autoFocus={!disabled}
              accessibilityHint={accessibilityHint}
              className="flex-1 text-xl leading-6"
              selectionColor="#23a2a2">
              {value}
            </RNTextInput>
            {suffix && <Text className="text-lg font-bold">{suffix}</Text>}
          </View>
        )}
      </Pressable>
      <Text className="ml-2 h-5 text-sm text-red-500">{touched && error}</Text>
    </View>
  );
};

export default TextInput;
