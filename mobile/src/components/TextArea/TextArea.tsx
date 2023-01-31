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
  onChangeText,
  onBlur,
}: Props) => {
  const [hasChanged, setHasChanged] = useState(false);

  function getStatusClass(classes: { neutral: string; error: string; success: string }): string {
    if (touched && error) return classes.error;
    if (hasChanged && !error) return classes.success;
    return classes.neutral;
  }

  return (
    <View className="flex-1 mt-3" pointerEvents={disabled ? 'none' : 'auto'}>
      <Pressable
        accessibilityRole="text"
        className={`relative border-[1px] rounded-md p-2 h-40 focus:border-black ${getStatusClass({
          neutral: 'border-gray-400',
          error: 'border-red-500',
          success: 'border-green-500',
        })} ${disabled && 'bg-gray-100'}`}>
        <RNTextInput
          multiline
          textAlignVertical="top"
          onChangeText={(value) => {
            if (hasChanged === false) setHasChanged(true);
            onChangeText(value);
          }}
          onEndEditing={(e) => onChangeText(e.nativeEvent.text.trim())}
          onBlur={onBlur}
          accessibilityHint={accessibilityHint}
          className="text-xl flex-1"
          selectionColor="#23a2a2"
          placeholder={placeholder}>
          {value}
        </RNTextInput>
      </Pressable>
      <Text className="text-red-500 text-sm h-5 ml-2">{touched && error}</Text>
    </View>
  );
};

export default TextArea;
