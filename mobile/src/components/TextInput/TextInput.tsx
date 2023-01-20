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
  touched: boolean | undefined;
  error: string | undefined;
  accessibilityHint: string;
  isNumeric?: true;
  disabled?: true;
  suffix?: string;
  onChangeText: (e: string) => void;
  onBlur: (e: NativeSyntheticEvent<TextInputFocusEventData>) => void;
}

const TextInput = ({
  label,
  value,
  touched,
  error,
  accessibilityHint,
  isNumeric,
  disabled,
  suffix,
  onChangeText,
  onBlur,
}: Props) => {
  const [isFocused, setIsFocused] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);
  const showValue = Boolean(value) || isFocused;
  const hasError = touched && Boolean(error);

  function getStatusClass(neutral: string, error: string, success: string): string {
    if (touched) {
      if (hasError) return error;
      if (hasChanged) return success;
    }
    return neutral;
  }

  function handleOnBlur(e: NativeSyntheticEvent<TextInputFocusEventData>) {
    setIsFocused(false);
    onBlur(e);
  }

  return (
    <View className="flex-1 mt-3" pointerEvents={disabled ? 'none' : 'auto'}>
      <Pressable
        accessibilityRole="text"
        onPress={() => {
          if (!disabled) setIsFocused(true);
        }}
        className={`relative border-[1px] rounded-md px-2 h-16 focus:border-black ${getStatusClass(
          'border-gray-400',
          'border-red-500',
          'border-green-500'
        )} ${disabled && 'bg-gray-100'}`}>
        <Animated.Text
          className={`absolute ml-2 ${getStatusClass(
            'text-gray-400',
            'text-red-500',
            'text-green-500'
          )} ${showValue ? ['text-base'] : ['text-xl top-4']}`}>
          {label}
        </Animated.Text>

        {showValue && (
          <View className="flex flex-row mt-6 ">
            <RNTextInput
              keyboardType={isNumeric ? 'number-pad' : 'default'}
              returnKeyType="done"
              onChangeText={(value) => {
                if (hasChanged === false) setHasChanged(true);
                let normalizedValue = value.replace(/\s+/g, ' ');
                if (isNumeric) {
                  normalizedValue = normalizedValue.replace(/[^0-9]/g, '');
                }
                onChangeText(normalizedValue);
              }}
              onEndEditing={(e) => onChangeText(e.nativeEvent.text.trim())}
              onBlur={handleOnBlur}
              autoFocus={!disabled}
              accessibilityHint={accessibilityHint}
              className="text-xl flex-1 leading-6"
              selectionColor="#23a2a2">
              {value}
            </RNTextInput>
            {suffix && <Text className="text-lg font-bold">{suffix}</Text>}
          </View>
        )}
      </Pressable>
      <Text className="text-red-500 text-sm h-5 ml-2">{hasError && error}</Text>
    </View>
  );
};

export default TextInput;
