import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { RigFormProvider } from '~/context/rig-form';

import { WebbingSetup } from '~/components/webbing-setup';

const DEFAULT_HIGHLINE_LENGTH = 100;

export default function SetupSimulatorScreen() {
  const { t } = useTranslation();
  const [highlineLength, setHighlineLength] = useState<number>(
    DEFAULT_HIGHLINE_LENGTH,
  );

  // Handler function to be passed to HighlineLengthInput
  // This will be called only when editing ends with a valid number
  const handleFinalLengthChange = (newLength: number) => {
    setHighlineLength(newLength);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t('app.setup-simulator.title'),
        }}
      />
      <RigFormProvider highlineLength={highlineLength}>
        <KeyboardAwareScrollView
          contentContainerClassName="flex-grow px-6 pt-4 pb-8 gap-4"
          keyboardShouldPersistTaps="handled"
        >
          <HighlineLengthInput onLengthChange={handleFinalLengthChange} />
          <WebbingSetup />
        </KeyboardAwareScrollView>
      </RigFormProvider>
    </>
  );
}

interface HighlineLengthInputProps {
  onLengthChange: (length: number) => void; // Callback when editing finishes with a valid number
}

export const HighlineLengthInput: React.FC<HighlineLengthInputProps> = ({
  onLengthChange,
}) => {
  const { t } = useTranslation();

  const [inputValue, setInputValue] = useState<string>(
    DEFAULT_HIGHLINE_LENGTH.toString(),
  );

  const handleTextChange = (text: string) => {
    setInputValue(text);
  };

  const handleEndEditing = () => {
    const trimmedText = inputValue.trim();
    const numberValue = Number(trimmedText);

    // Check if the input is a valid, non-negative number
    if (trimmedText !== '' && !isNaN(numberValue) && numberValue >= 0) {
      // If valid, call the callback provided by the parent
      onLengthChange(numberValue);
      // Ensure the input visually reflects the potentially cleaned number (e.g., removes leading zeros)
      setInputValue(numberValue.toString());
    } else {
      // If invalid or empty, reset the input field to the last valid value
      // received from the parent (initialValue prop)
      setInputValue(DEFAULT_HIGHLINE_LENGTH.toString());
    }
  };

  return (
    <View>
      <Text className="mb-2 text-sm font-medium text-gray-600">
        {t('app.setup-simulator.lengthInput.label')}
      </Text>
      <TextInput
        className="rounded-md border border-gray-300 px-3 py-2 text-base"
        value={inputValue}
        onChangeText={handleTextChange}
        onEndEditing={handleEndEditing}
        keyboardType="numeric"
        placeholder={t('app.setup-simulator.lengthInput.placeholder')}
        placeholderTextColor="#9ca3af"
      />
    </View>
  );
};
