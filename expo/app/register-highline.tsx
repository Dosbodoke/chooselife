import React from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { HighlineForm } from '~/components/highline/highline-form';

const RegisterHighlineScreen: React.FC = () => {
  return (
    <KeyboardAwareScrollView
      contentContainerClassName="min-h-screen"
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={false}
    >
      <HighlineForm />
    </KeyboardAwareScrollView>
  );
};

export default RegisterHighlineScreen;
