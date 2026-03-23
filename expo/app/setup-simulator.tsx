import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { RigFormProvider } from '~/context/rig-form';

import { WebbingSetup } from '~/components/webbing-setup';
import { HighlineLengthInput } from '~/components/webbing-setup/highline-length-input';

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
          <HighlineLengthInput
            onLengthChange={handleFinalLengthChange}
            initialValue={DEFAULT_HIGHLINE_LENGTH}
          />
          <WebbingSetup />
        </KeyboardAwareScrollView>
      </RigFormProvider>
    </>
  );
}
