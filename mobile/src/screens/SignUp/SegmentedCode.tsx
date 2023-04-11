import { useRef, useState, useEffect } from 'react';
import { TextInput, View, Pressable, Text } from 'react-native';

interface Props {
  code: string;
  setCode: (code: string) => void;
  setIsPinReady: (isPinReady: boolean) => void;
}

const MAXIMUM_LENGTH = 6;

const OTPInput = ({ code, setCode, setIsPinReady }: Props) => {
  const boxArray = new Array(MAXIMUM_LENGTH).fill(0);
  const inputRef = useRef<TextInput>(null);

  const [isInputBoxFocused, setIsInputBoxFocused] = useState(false);

  const handleOnPress = () => {
    setIsInputBoxFocused(true);
    inputRef.current?.focus();
  };

  const handleOnBlur = () => {
    setIsInputBoxFocused(false);
  };

  useEffect(() => {
    // update pin ready status

    if (code.length === MAXIMUM_LENGTH) {
      inputRef.current?.blur();
      setIsPinReady(true);
    } else {
      setIsPinReady(false);
    }
    // clean up function
    return () => {
      setIsPinReady(false);
    };
  }, [code]);
  const boxDigit = (_: string, index: number) => {
    const digit = code[index] || '';

    const isCurrentValue = index === code.length;
    const isLastValue = index === MAXIMUM_LENGTH - 1;
    const isCodeComplete = code.length === MAXIMUM_LENGTH;

    const isValueFocused = isCurrentValue || (isLastValue && isCodeComplete);

    return (
      <View
        className={`h-14 w-10 items-center justify-center rounded-md border-2 ${
          isInputBoxFocused && isValueFocused ? 'border-blue-300 bg-gray-300' : 'border-gray-200'
        }`}
        key={index}>
        <Text className="text-3xl">{digit}</Text>
      </View>
    );
  };

  return (
    <View className="flex items-center justify-center">
      <Pressable onPress={handleOnPress} className="w-4/5 flex-row justify-evenly">
        {boxArray.map(boxDigit)}
      </Pressable>
      <TextInput
        value={code}
        onChangeText={setCode}
        maxLength={MAXIMUM_LENGTH}
        ref={inputRef}
        onBlur={handleOnBlur}
        autoCapitalize="none"
        keyboardType="number-pad"
        returnKeyType="done"
        className="absolute opacity-0"
      />
    </View>
  );
};

export default OTPInput;
