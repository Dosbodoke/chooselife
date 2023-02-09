import { useState } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  Pressable,
  NativeSyntheticEvent,
  TextInputFocusEventData,
} from 'react-native';

interface Props {
  value: string;
  touched?: boolean;
  error?: string;
  accessibilityHint: string;
  disabled?: true;
  placeholder?: string;
  isDirty?: boolean;
  onChangeText: (e: string) => void;
  onBlur: (e: NativeSyntheticEvent<TextInputFocusEventData>) => void;
}

const TextArea = ({
  value,
  touched,
  error,
  accessibilityHint,
  disabled,
  placeholder,
  isDirty,
  onChangeText,
  onBlur,
}: Props) => {
  function getStatusClass(classes: { neutral: string; error: string; success: string }): string {
    if (touched && error) return classes.error;
    if (isDirty && !error) return classes.success;
    return classes.neutral;
  }

  return (
    <View className="mt-3 flex-1" pointerEvents={disabled ? 'none' : 'auto'}>
      <Pressable
        accessibilityRole="text"
        className={`relative h-40 rounded-md border-[1px] p-2 focus:border-black ${getStatusClass({
          neutral: 'border-gray-400',
          error: 'border-red-500',
          success: 'border-green-500',
        })} ${disabled && 'bg-gray-100'}`}>
        <RNTextInput
          multiline
          textAlignVertical="top"
          onChangeText={(value) => {
            onChangeText(value);
          }}
          onEndEditing={(e) => onChangeText(e.nativeEvent.text.trim())}
          onBlur={onBlur}
          accessibilityHint={accessibilityHint}
          className="flex-1 text-xl"
          selectionColor="#23a2a2"
          placeholder={placeholder}>
          {value}
        </RNTextInput>
      </Pressable>
      <Text className="ml-2 h-5 text-sm text-red-500">{touched && error}</Text>
    </View>
  );
};

export default TextArea;
